using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.BusinessRules;
using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;
using CncMonitoring.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace CncMonitoring.Application.UseCases;

/// <summary>
/// Core use case: processes one telemetry snapshot and persists all derived records.
/// Idempotent: duplicate snapshots within the same second are ignored.
/// </summary>
public sealed class ProcessTelemetryUseCase
{
    private readonly IMachineRepository _machines;
    private readonly IStatusHistoryRepository _statusHistory;
    private readonly IProductionRepository _production;
    private readonly IAlarmRepository _alarms;
    private readonly IDowntimeRepository _downtime;
    private readonly ILogger<ProcessTelemetryUseCase> _logger;

    public ProcessTelemetryUseCase(
        IMachineRepository machines,
        IStatusHistoryRepository statusHistory,
        IProductionRepository production,
        IAlarmRepository alarms,
        IDowntimeRepository downtime,
        ILogger<ProcessTelemetryUseCase> logger)
    {
        _machines = machines;
        _statusHistory = statusHistory;
        _production = production;
        _alarms = alarms;
        _downtime = downtime;
        _logger = logger;
    }

    public async Task ProcessAsync(TelemetrySnapshot snapshot, CancellationToken ct)
    {
        // --- Validate ---
        if (!ProductionRules.IsValid(snapshot.TotalParts, snapshot.GoodParts, snapshot.RejectedParts))
        {
            _logger.LogWarning("Invalid production counts for {MachineCode}: Total={Total} Good={Good} Rejected={Rejected}",
                snapshot.MachineCode, snapshot.TotalParts, snapshot.GoodParts, snapshot.RejectedParts);
            return;  // Permanent validation error — do not retry
        }

        // --- Upsert machine ---
        var machine = await _machines.GetByCodeAsync(snapshot.MachineCode, ct)
            ?? new Machine
            {
                MachineCode = snapshot.MachineCode,
                Name = snapshot.MachineName,
                MachineType = snapshot.MachineType,
                IdealCycleTimeSeconds = snapshot.ActualCycleTimeSeconds,
                CreatedAtUtc = DateTime.UtcNow
            };
        machine.Name = snapshot.MachineName;
        machine.MachineType = snapshot.MachineType;
        machine = await _machines.UpsertAsync(machine, ct);

        // --- Status transition ---
        var lastStatus = await _statusHistory.GetLatestAsync(machine.Id, ct);
        var statusChanged = lastStatus == null || lastStatus.Status != snapshot.Status;

        if (statusChanged)
        {
            _logger.LogInformation(
                "[SIMULATOR] Machine {Code} status transition: {Old} -> {New}",
                snapshot.MachineCode,
                lastStatus?.Status.ToString() ?? "(none)",
                snapshot.Status);

            await _statusHistory.AddAsync(new MachineStatusHistory
            {
                MachineId = machine.Id,
                Status = snapshot.Status,
                OccurredAtUtc = snapshot.TimestampUtc
            }, ct);

            await HandleDowntimeTransitionAsync(machine.Id, lastStatus?.Status, snapshot.Status,
                snapshot.TimestampUtc, snapshot.ActiveAlarmCode, ct);
        }

        // --- Production record (always record) ---
        await _production.AddAsync(new ProductionRecord
        {
            MachineId = machine.Id,
            RecordedAtUtc = snapshot.TimestampUtc,
            TotalParts = snapshot.TotalParts,
            GoodParts = snapshot.GoodParts,
            RejectedParts = snapshot.RejectedParts,
            ActualCycleTimeSeconds = snapshot.ActualCycleTimeSeconds,
            DataSource = TelemetrySnapshot.DataSource
        }, ct);

        // --- Alarms ---
        await HandleAlarmsAsync(machine.Id, snapshot, ct);
    }

    private async Task HandleDowntimeTransitionAsync(
        int machineId,
        MachineStatus? previousStatus,
        MachineStatus newStatus,
        DateTime occurredAt,
        string? alarmCode,
        CancellationToken ct)
    {
        // Close any open downtime interval if machine is now Running
        if (newStatus == MachineStatus.Running)
        {
            var open = await _downtime.GetOpenIntervalAsync(machineId, ct);
            if (open != null)
            {
                await _downtime.CloseIntervalAsync(open.Id, occurredAt, ct);
                _logger.LogInformation("Downtime interval closed for machine {MachineId}. Duration: {Duration}",
                    machineId, occurredAt - open.StartAtUtc);
            }
        }
        // Open a new downtime interval if machine entered a non-running state
        else if (newStatus is MachineStatus.Stopped or MachineStatus.Alarm)
        {
            // Ensure no open interval exists (avoid duplicates on restart)
            var existing = await _downtime.GetOpenIntervalAsync(machineId, ct);
            if (existing == null)
            {
                await _downtime.OpenIntervalAsync(machineId, newStatus, occurredAt, alarmCode, ct);
                _logger.LogInformation("Downtime interval opened for machine {MachineId}. Reason: {Reason}",
                    machineId, newStatus);
            }
        }
    }

    private async Task HandleAlarmsAsync(int machineId, TelemetrySnapshot snapshot, CancellationToken ct)
    {
        if (snapshot.Status == MachineStatus.Alarm && snapshot.ActiveAlarmCode != null)
        {
            var existing = await _alarms.GetActiveAlarmAsync(machineId, snapshot.ActiveAlarmCode, ct);
            if (existing == null)
            {
                await _alarms.AddAsync(new MachineAlarm
                {
                    MachineId = machineId,
                    AlarmCode = snapshot.ActiveAlarmCode,
                    Description = snapshot.ActiveAlarmDescription ?? snapshot.ActiveAlarmCode,
                    Severity = snapshot.AlarmSeverity,
                    TriggeredAtUtc = snapshot.TimestampUtc,
                    IsActive = true
                }, ct);
                _logger.LogWarning("[ALARM] Machine {MachineId} alarm {Code}: {Desc}",
                    machineId, snapshot.ActiveAlarmCode, snapshot.ActiveAlarmDescription);
            }
        }
        else if (snapshot.Status != MachineStatus.Alarm)
        {
            // Clear all active alarms when machine leaves alarm state
            await _alarms.ClearAllActiveForMachineAsync(machineId, snapshot.TimestampUtc, ct);
        }
    }
}

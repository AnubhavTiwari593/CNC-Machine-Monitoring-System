using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Api.DTOs;

public sealed record DowntimeIntervalDto(
    long Id,
    int MachineId,
    MachineStatus Reason,
    DateTime StartAtUtc,
    DateTime? EndAtUtc,
    double DurationMinutes,
    bool IsOpen,
    string? AlarmCode
);

public sealed record DowntimeSummaryDto(
    int MachineId,
    string MachineCode,
    string MachineName,
    double TotalDowntimeMinutes,
    int DowntimeIncidents,
    DateTime PeriodFrom,
    DateTime PeriodTo
);

using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Enums;
using CncMonitoring.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace CncMonitoring.Infrastructure.Simulator;

/// <summary>
/// SIMULATED DATA SOURCE — generates realistic but entirely synthetic CNC machine telemetry.
/// No physical machines are connected. All data is randomly generated for demonstration purposes.
/// </summary>
public sealed class CncMachineSimulator : IMachineDataSource
{
    public string SourceName => "Simulator";

    private readonly ILogger<CncMachineSimulator> _logger;
    private readonly List<SimulatedMachineState> _machines;
    private readonly Random _rng = new();

    // Alarm catalog
    private static readonly (string Code, string Description, AlarmSeverity Severity)[] AlarmCatalog =
    [
        ("E-001", "Spindle overload detected", AlarmSeverity.Critical),
        ("E-002", "Tool breakage sensor triggered", AlarmSeverity.Critical),
        ("W-001", "Coolant level low", AlarmSeverity.Warning),
        ("W-002", "Vibration threshold exceeded", AlarmSeverity.Warning),
        ("W-003", "Temperature warning on axis motor", AlarmSeverity.Warning),
        ("E-003", "Emergency stop activated", AlarmSeverity.Emergency),
        ("I-001", "Scheduled maintenance due", AlarmSeverity.Info),
    ];

    public CncMachineSimulator(ILogger<CncMachineSimulator> logger)
    {
        _logger = logger;
        _machines =
        [
            new SimulatedMachineState("CNC-001", "VMC-Alpha",  "Vertical Mill",  idealCycleSeconds: 12.5),
            new SimulatedMachineState("CNC-002", "Lathe-Beta", "CNC Lathe",       idealCycleSeconds: 8.0),
            new SimulatedMachineState("CNC-003", "Router-Gamma","CNC Router",     idealCycleSeconds: 15.0),
            new SimulatedMachineState("CNC-004", "EDM-Delta",   "Wire EDM",        idealCycleSeconds: 45.0),
            new SimulatedMachineState("CNC-005", "Grinder-Epsilon","CNC Grinder", idealCycleSeconds: 6.5),
        ];
    }

    public Task<IReadOnlyList<TelemetrySnapshot>> GetLatestTelemetryAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var snapshots = new List<TelemetrySnapshot>(_machines.Count);

        foreach (var machine in _machines)
        {
            machine.Tick(_rng, now);
            snapshots.Add(machine.ToSnapshot(now));
        }

        _logger.LogDebug("[SIMULATOR] Generated telemetry for {Count} machines at {Timestamp:O}",
            snapshots.Count, now);

        return Task.FromResult<IReadOnlyList<TelemetrySnapshot>>(snapshots);
    }

    private sealed class SimulatedMachineState
    {
        public string Code { get; }
        public string Name { get; }
        public string Type { get; }
        public double IdealCycleSeconds { get; }

        public MachineStatus Status { get; private set; } = MachineStatus.Running;
        public long TotalParts { get; private set; } = 0;
        public long GoodParts { get; private set; } = 0;
        public long RejectedParts { get; private set; } = 0;
        public double ActualCycleTimeSeconds { get; private set; }

        public string? ActiveAlarmCode { get; private set; }
        public string? ActiveAlarmDescription { get; private set; }
        public AlarmSeverity ActiveAlarmSeverity { get; private set; }

        private int _stateTicksRemaining = 0;

        public SimulatedMachineState(string code, string name, string type, double idealCycleSeconds)
        {
            Code = code;
            Name = name;
            Type = type;
            IdealCycleSeconds = idealCycleSeconds;
            ActualCycleTimeSeconds = idealCycleSeconds * 1.05;
        }

        public void Tick(Random rng, DateTime now)
        {
            if (_stateTicksRemaining > 0)
            {
                _stateTicksRemaining--;
                if (_stateTicksRemaining == 0)
                    Recover();
                return;
            }

            // Random state change
            var roll = rng.NextDouble();
            if (Status == MachineStatus.Running)
            {
                if (roll < 0.04)       // 4% chance of alarm
                    TriggerAlarm(rng);
                else if (roll < 0.08)  // 4% chance of stop
                    TriggerStop(rng);
                else if (roll < 0.10)  // 2% chance of idle
                {
                    Status = MachineStatus.Idle;
                    _stateTicksRemaining = rng.Next(3, 10);
                }
                else
                    ProduceParts(rng);
            }
            else if (Status == MachineStatus.Idle)
            {
                if (roll < 0.5)
                    Recover();
            }
        }

        private void ProduceParts(Random rng)
{
    var newParts = rng.Next(1, 4);
    var newRejected = 0L;

    // Each part has a 5% chance of being rejected.
    for (var i = 0; i < newParts; i++)
    {
        if (rng.NextDouble() < 0.05)
        {
            newRejected++;
        }
    }

    var newGood = newParts - newRejected;

    TotalParts += newParts;
    GoodParts += newGood;
    RejectedParts += newRejected;

    // Slight cycle-time variation (+/-10%).
    ActualCycleTimeSeconds =
        IdealCycleSeconds * (1.0 + (rng.NextDouble() - 0.5) * 0.2);
 }

        private void TriggerAlarm(Random rng)
        {
            var alarm = AlarmCatalog[rng.Next(AlarmCatalog.Length)];
            Status = MachineStatus.Alarm;
            ActiveAlarmCode = alarm.Code;
            ActiveAlarmDescription = alarm.Description;
            ActiveAlarmSeverity = alarm.Severity;
            _stateTicksRemaining = rng.Next(5, 20);
        }

        private void TriggerStop(Random rng)
        {
            Status = MachineStatus.Stopped;
            ActiveAlarmCode = null;
            ActiveAlarmDescription = null;
            _stateTicksRemaining = rng.Next(3, 15);
        }

        private void Recover()
        {
            Status = MachineStatus.Running;
            ActiveAlarmCode = null;
            ActiveAlarmDescription = null;
        }

        public TelemetrySnapshot ToSnapshot(DateTime timestamp) => new(
            MachineCode: Code,
            MachineName: Name,
            MachineType: Type,
            Status: Status,
            TotalParts: TotalParts,
            GoodParts: GoodParts,
            RejectedParts: RejectedParts,
            ActualCycleTimeSeconds: ActualCycleTimeSeconds,
            ActiveAlarmCode: ActiveAlarmCode,
            ActiveAlarmDescription: ActiveAlarmDescription,
            AlarmSeverity: ActiveAlarmSeverity,
            TimestampUtc: timestamp
        );
    }
}

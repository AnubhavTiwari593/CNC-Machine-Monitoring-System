using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Domain.ValueObjects;

/// <summary>
/// A point-in-time telemetry reading from a machine data source.
/// Labelled SIMULATOR — this value object carries data from the simulator, not a real machine.
/// </summary>
public sealed record TelemetrySnapshot(
    string MachineCode,
    string MachineName,
    string MachineType,
    MachineStatus Status,
    long TotalParts,
    long GoodParts,
    long RejectedParts,
    double ActualCycleTimeSeconds,
    string? ActiveAlarmCode,
    string? ActiveAlarmDescription,
    AlarmSeverity AlarmSeverity,
    DateTime TimestampUtc
)
{
    public const string DataSource = "SIMULATOR";
}

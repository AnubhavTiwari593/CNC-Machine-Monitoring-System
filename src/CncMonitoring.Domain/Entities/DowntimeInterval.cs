using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Domain.Entities;

/// <summary>
/// A computed downtime interval derived from status history.
/// Start is when machine entered non-Running state, End when it resumed Running.
/// Open intervals (EndAtUtc == null) mean the machine is currently down.
/// </summary>
public class DowntimeInterval
{
    public long Id { get; set; }
    public int MachineId { get; set; }
    public MachineStatus Reason { get; set; }  // Stopped or Alarm
    public DateTime StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public string? AlarmCode { get; set; }

    public TimeSpan Duration =>
        EndAtUtc.HasValue
            ? EndAtUtc.Value - StartAtUtc
            : DateTime.UtcNow - StartAtUtc;

    // Navigation
    public Machine Machine { get; set; } = null!;
}

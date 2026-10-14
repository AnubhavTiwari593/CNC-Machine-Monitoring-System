using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Domain.Entities;

/// <summary>
/// Records a machine status transition at a specific point in time.
/// Used for calculating downtime intervals.
/// </summary>
public class MachineStatusHistory
{
    public long Id { get; set; }
    public int MachineId { get; set; }
    public MachineStatus Status { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string? Notes { get; set; }

    // Navigation
    public Machine Machine { get; set; } = null!;
}

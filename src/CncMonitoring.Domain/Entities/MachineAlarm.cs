using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Domain.Entities;

/// <summary>
/// Records an alarm event on a CNC machine.
/// </summary>
public class MachineAlarm
{
    public long Id { get; set; }
    public int MachineId { get; set; }
    public string AlarmCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AlarmSeverity Severity { get; set; }
    public DateTime TriggeredAtUtc { get; set; }
    public DateTime? ClearedAtUtc { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public Machine Machine { get; set; } = null!;
}

using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Domain.Entities;

/// <summary>
/// Represents a CNC machine registered in the system.
/// This is simulated data — no physical machine communication occurs.
/// </summary>
public class Machine
{
    public int Id { get; set; }
    public string MachineCode { get; set; } = string.Empty;  // e.g. "CNC-001"
    public string Name { get; set; } = string.Empty;
    public string MachineType { get; set; } = string.Empty;  // e.g. "Lathe", "Mill", "Router"
    public string Location { get; set; } = string.Empty;
    public double IdealCycleTimeSeconds { get; set; }  // theoretical minimum cycle time
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<MachineStatusHistory> StatusHistory { get; set; } = [];
    public ICollection<ProductionRecord> ProductionRecords { get; set; } = [];
    public ICollection<MachineAlarm> Alarms { get; set; } = [];
}

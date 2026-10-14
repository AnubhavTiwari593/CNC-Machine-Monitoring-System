namespace CncMonitoring.Domain.Entities;

/// <summary>
/// A production snapshot for a machine at a point in time.
/// Counts are cumulative since last reset.
/// </summary>
public class ProductionRecord
{
    public long Id { get; set; }
    public int MachineId { get; set; }
    public DateTime RecordedAtUtc { get; set; }
    public long TotalParts { get; set; }
    public long GoodParts { get; set; }
    public long RejectedParts { get; set; }
    public double ActualCycleTimeSeconds { get; set; }
    public string DataSource { get; set; } = "SIMULATOR";  // Always labelled

    // Navigation
    public Machine Machine { get; set; } = null!;
}

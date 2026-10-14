namespace CncMonitoring.Domain.Entities;

/// <summary>Structured service events stored in the database for audit and diagnostics.</summary>
public class ServiceLog
{
    public long Id { get; set; }
    public string Level { get; set; } = "Info";
    public string Message { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Exception { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
}

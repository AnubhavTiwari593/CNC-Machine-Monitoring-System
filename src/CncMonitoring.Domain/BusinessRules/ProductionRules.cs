namespace CncMonitoring.Domain.BusinessRules;

/// <summary>Core business rules for production record validation.</summary>
public static class ProductionRules
{
    /// <summary>Rejected parts cannot exceed total parts.</summary>
    public static bool IsValid(long totalParts, long goodParts, long rejectedParts)
    {
        if (totalParts < 0 || goodParts < 0 || rejectedParts < 0) return false;
        if (goodParts > totalParts - rejectedParts) return false;
        return true;
    }

    /// <summary>OEE Availability = uptime / planned time (0..1).</summary>
    public static double CalculateAvailability(TimeSpan uptime, TimeSpan plannedTime)
    {
        if (plannedTime <= TimeSpan.Zero) return 0;
        var ratio = uptime.TotalSeconds / plannedTime.TotalSeconds;
        return Math.Clamp(ratio, 0.0, 1.0);
    }

    /// <summary>OEE Performance = (idealCycleTime * totalParts) / runTime.</summary>
    public static double CalculatePerformance(double idealCycleTimeSeconds, long totalParts, TimeSpan runTime)
    {
        if (runTime <= TimeSpan.Zero || idealCycleTimeSeconds <= 0) return 0;
        return Math.Clamp((idealCycleTimeSeconds * totalParts) / runTime.TotalSeconds, 0.0, 1.0);
    }

    /// <summary>OEE Quality = goodParts / totalParts.</summary>
    public static double CalculateQuality(long goodParts, long totalParts)
    {
        if (totalParts <= 0) return 0;
        return Math.Clamp((double)goodParts / totalParts, 0.0, 1.0);
    }
}

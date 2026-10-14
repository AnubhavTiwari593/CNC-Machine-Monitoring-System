namespace CncMonitoring.Worker;

public sealed class WorkerSettings
{
    public int PollingIntervalSeconds { get; init; } = 8;
    public int MaxRetryAttempts { get; init; } = 5;
    public double RetryBaseDelaySeconds { get; init; } = 2.0;
}

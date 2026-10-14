using CncMonitoring.Application.Interfaces;
using CncMonitoring.Application.UseCases;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CncMonitoring.Worker.Services;

/// <summary>
/// Background service that periodically collects simulated machine telemetry and persists it.
/// Uses bounded exponential backoff retries on transient failures.
/// A failed collection cycle does not terminate future cycles.
/// </summary>
public sealed class TelemetryCollectionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMachineDataSource _dataSource;
    private readonly ILogger<TelemetryCollectionWorker> _logger;
    private readonly WorkerSettings _settings;
    private int _consecutiveFailures = 0;
    private bool _isRunning = false;
    private DateTime? _lastSuccessUtc;

    public bool IsHealthy => _consecutiveFailures < _settings.MaxRetryAttempts;
    public int ConsecutiveFailures => _consecutiveFailures;
    public DateTime? LastSuccessUtc => _lastSuccessUtc;

    public TelemetryCollectionWorker(
        IServiceScopeFactory scopeFactory,
        IMachineDataSource dataSource,
        IOptions<WorkerSettings> settings,
        ILogger<TelemetryCollectionWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _dataSource = dataSource;
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TelemetryCollectionWorker starting. DataSource={Source}, PollingIntervalSeconds={Interval}",
            _dataSource.SourceName, _settings.PollingIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            // Avoid overlapping executions
            if (_isRunning)
            {
                await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
                continue;
            }

            _isRunning = true;
            try
            {
                await RunCollectionCycleWithRetryAsync(stoppingToken);
            }
            finally
            {
                _isRunning = false;
            }

            // Wait for next polling interval
            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(_settings.PollingIntervalSeconds),
                    stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("TelemetryCollectionWorker stopped gracefully.");
    }

    private async Task RunCollectionCycleWithRetryAsync(CancellationToken ct)
    {
        for (int attempt = 1; attempt <= _settings.MaxRetryAttempts; attempt++)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await RunSingleCollectionCycleAsync(ct);
                _consecutiveFailures = 0;
                _lastSuccessUtc = DateTime.UtcNow;
                return;  // Success
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Collection cancelled during attempt {Attempt}.", attempt);
                throw;
            }
            catch (Exception ex) when (IsTransientException(ex))
            {
                _consecutiveFailures++;
                var delay = TimeSpan.FromSeconds(
                    _settings.RetryBaseDelaySeconds * Math.Pow(2, attempt - 1));

                _logger.LogWarning(
                    ex,
                    "Transient error on attempt {Attempt}/{Max}. Retrying in {Delay:g}. ConsecutiveFailures={Failures}",
                    attempt, _settings.MaxRetryAttempts, delay, _consecutiveFailures);

                try { await Task.Delay(delay, ct); }
                catch (OperationCanceledException) { throw; }
            }
            catch (Exception ex)
            {
                // Permanent / validation error — log and stop retrying this cycle
                _logger.LogError(ex,
                    "Permanent error in collection cycle (attempt {Attempt}). Skipping cycle.", attempt);
                _consecutiveFailures++;
                return;
            }
        }

        _logger.LogError(
            "Collection cycle failed after {Max} attempts. ConsecutiveFailures={Failures}",
            _settings.MaxRetryAttempts, _consecutiveFailures);
    }

    private async Task RunSingleCollectionCycleAsync(CancellationToken ct)
    {
        var snapshots = await _dataSource.GetLatestTelemetryAsync(ct);

        _logger.LogDebug("[SIMULATOR] Collected {Count} telemetry snapshots.", snapshots.Count);

        // Use a new scope per cycle so DbContext is properly disposed
        using var scope = _scopeFactory.CreateScope();
        var useCase = scope.ServiceProvider.GetRequiredService<ProcessTelemetryUseCase>();

        foreach (var snapshot in snapshots)
        {
            if (ct.IsCancellationRequested) break;
            await useCase.ProcessAsync(snapshot, ct);
        }
    }

    private static bool IsTransientException(Exception ex)
    {
        // MySQL connectivity and EF transient exceptions
        return ex is MySqlConnector.MySqlException
            || ex is Microsoft.EntityFrameworkCore.DbUpdateException
            || ex.GetType().Name.Contains("Transient", StringComparison.OrdinalIgnoreCase);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("TelemetryCollectionWorker stopping...");
        await base.StopAsync(cancellationToken);
        _logger.LogInformation("TelemetryCollectionWorker stopped.");
    }
}

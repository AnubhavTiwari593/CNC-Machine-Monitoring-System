using CncMonitoring.Domain.ValueObjects;

namespace CncMonitoring.Application.Interfaces;

/// <summary>
/// Abstraction for machine data collection.
/// Implemented by the Simulator for now; future implementations can wrap real CNC/PLC adapters.
/// </summary>
public interface IMachineDataSource
{
    /// <summary>Returns the current telemetry for all configured machines.</summary>
    Task<IReadOnlyList<TelemetrySnapshot>> GetLatestTelemetryAsync(CancellationToken cancellationToken = default);

    /// <summary>Human-readable name of this data source (e.g. "Simulator", "Fanuc-OPC-UA").</summary>
    string SourceName { get; }
}

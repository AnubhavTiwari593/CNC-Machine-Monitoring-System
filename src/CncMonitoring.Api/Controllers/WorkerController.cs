using Microsoft.AspNetCore.Mvc;

namespace CncMonitoring.Api.Controllers;

/// <summary>Exposes worker service runtime status.</summary>
[ApiController]
[Route("api/worker")]
public class WorkerController : ControllerBase
{
    private static readonly DateTime _startedAt = DateTime.UtcNow;

    /// <summary>Returns worker/API process status. The worker runs as a separate process.</summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            ApiProcess = new
            {
                Status = "Running",
                StartedAtUtc = _startedAt,
                UptimeSeconds = (DateTime.UtcNow - _startedAt).TotalSeconds
            },
            Note = "The TelemetryCollectionWorker runs as a separate process (CncMonitoring.Worker). " +
                   "Query the database to verify data collection is active.",
            DataSource = "SIMULATOR"
        });
    }
}

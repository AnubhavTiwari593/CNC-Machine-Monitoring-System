using CncMonitoring.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly CncDbContext _db;
    private readonly ILogger<HealthController> _logger;

    public HealthController(CncDbContext db, ILogger<HealthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Returns application liveness and database readiness status.</summary>
    [HttpGet]
    [ProducesResponseType(200)]
    [ProducesResponseType(503)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        bool dbReady = false;
        string? dbError = null;
        try
        {
            dbReady = await _db.Database.CanConnectAsync(ct);
        }
        catch (Exception ex)
        {
            dbError = ex.Message;
            _logger.LogWarning(ex, "Health check: database not ready.");
        }

        var result = new
        {
            Status = dbReady ? "Healthy" : "Degraded",
            Application = "CncMonitoring.Api",
            DataSource = "SIMULATOR",
            Database = new { Ready = dbReady, Error = dbError },
            TimestampUtc = DateTime.UtcNow
        };

        return dbReady ? Ok(result) : StatusCode(503, result);
    }
}

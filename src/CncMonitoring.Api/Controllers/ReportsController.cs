using CncMonitoring.Api.DTOs;
using CncMonitoring.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CncMonitoring.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IProductionRepository _production;
    private readonly IDowntimeRepository _downtime;
    private readonly IMachineRepository _machines;

    public ReportsController(
        IProductionRepository production,
        IDowntimeRepository downtime,
        IMachineRepository machines)
    {
        _production = production;
        _downtime = downtime;
        _machines = machines;
    }

    /// <summary>Production report for a date range (supports pagination per machine).</summary>
    [HttpGet("production")]
    public async Task<ActionResult<ApiResponse<object>>> GetProductionReport(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var fromDate = from ?? DateTime.UtcNow.AddDays(-7);
        var toDate = to ?? DateTime.UtcNow;

        if (toDate < fromDate)
            return BadRequest(ApiResponse.Fail<object>("'to' must be after 'from'.", 400));

        var summary = await _production.GetAllMachinesSummaryAsync(fromDate, toDate, ct);
        var machines = await _machines.GetAllActiveAsync(ct);

        var downtimeByMachine = new Dictionary<int, TimeSpan>();
        foreach (var m in machines)
        {
            downtimeByMachine[m.Id] = await _downtime.GetTotalDowntimeAsync(m.Id, fromDate, toDate, ct);
        }

        var report = summary.Select(s => new
        {
            s.MachineId,
            s.MachineCode,
            s.MachineName,
            s.TotalParts,
            s.GoodParts,
            s.RejectedParts,
            QualityRate = s.TotalParts > 0 ? Math.Round((double)s.GoodParts / s.TotalParts, 4) : 0,
            DowntimeMinutes = downtimeByMachine.TryGetValue(s.MachineId, out var dt) ? Math.Round(dt.TotalMinutes, 2) : 0,
            PeriodFrom = fromDate,
            PeriodTo = toDate,
            DataSource = "SIMULATOR"
        }).ToList();

        return Ok(ApiResponse.Ok(new { Report = report, GeneratedAtUtc = DateTime.UtcNow }));
    }
}

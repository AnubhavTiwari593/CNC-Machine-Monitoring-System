using CncMonitoring.Api.DTOs;
using CncMonitoring.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CncMonitoring.Api.Controllers;

[ApiController]
[Route("api/downtime")]
public class DowntimeController : ControllerBase
{
    private readonly IMachineRepository _machines;
    private readonly IDowntimeRepository _downtime;

    public DowntimeController(IMachineRepository machines, IDowntimeRepository downtime)
    {
        _machines = machines;
        _downtime = downtime;
    }

    /// <summary>Get downtime summary for all machines over a date range.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<DowntimeSummaryDto>>>> Get(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var fromDate = from ?? DateTime.UtcNow.AddDays(-1);
        var toDate = to ?? DateTime.UtcNow;

        var machines = await _machines.GetAllActiveAsync(ct);
        var results = new List<DowntimeSummaryDto>();

        foreach (var m in machines)
        {
            var intervals = await _downtime.GetIntervalsAsync(m.Id, fromDate, toDate, ct);
            var totalDowntime = await _downtime.GetTotalDowntimeAsync(m.Id, fromDate, toDate, ct);

            results.Add(new DowntimeSummaryDto(
                m.Id, m.MachineCode, m.Name,
                totalDowntime.TotalMinutes,
                intervals.Count,
                fromDate, toDate
            ));
        }

        return Ok(ApiResponse.Ok(results.AsReadOnly()));
    }
}

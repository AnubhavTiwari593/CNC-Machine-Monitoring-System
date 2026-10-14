using CncMonitoring.Api.DTOs;
using CncMonitoring.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CncMonitoring.Api.Controllers;

[ApiController]
[Route("api/production")]
public class ProductionController : ControllerBase
{
    private readonly IProductionRepository _production;

    public ProductionController(IProductionRepository production)
        => _production = production;

    /// <summary>Get production summary across all machines for a date range.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ProductionSummaryDto>>>> GetSummary(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var fromDate = from ?? DateTime.UtcNow.AddDays(-1);
        var toDate = to ?? DateTime.UtcNow;

        if (toDate < fromDate)
            return BadRequest(ApiResponse.Fail<IReadOnlyList<ProductionSummaryDto>>("'to' must be after 'from'.", 400));

        var summaries = await _production.GetAllMachinesSummaryAsync(fromDate, toDate, ct);

        var dtos = summaries.Select(s => new ProductionSummaryDto(
            s.MachineId, s.MachineCode, s.MachineName,
            s.TotalParts, s.GoodParts, s.RejectedParts,
            s.TotalParts > 0 ? (double)s.GoodParts / s.TotalParts : 0,
            s.FirstRecordedAtUtc, s.LastRecordedAtUtc
        )).ToList();

        return Ok(ApiResponse.Ok(dtos.AsReadOnly()));
    }
}

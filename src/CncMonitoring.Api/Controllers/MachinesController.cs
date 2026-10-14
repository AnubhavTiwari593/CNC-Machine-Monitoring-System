using CncMonitoring.Api.DTOs;
using CncMonitoring.Application.Interfaces;
using CncMonitoring.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Api.Controllers;

[ApiController]
[Route("api/machines")]
public class MachinesController : ControllerBase
{
    private readonly IMachineRepository _machines;
    private readonly CncDbContext _db;

    public MachinesController(IMachineRepository machines, CncDbContext db)
    {
        _machines = machines;
        _db = db;
    }

    /// <summary>Get all active machines with their latest status.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MachineStatusDto>>>> GetAll(CancellationToken ct)
    {
        var machines = await _machines.GetAllActiveAsync(ct);

        var statuses = new List<MachineStatusDto>();
        foreach (var m in machines)
        {
            var latestStatus = await _db.StatusHistory
                .Where(h => h.MachineId == m.Id)
                .OrderByDescending(h => h.OccurredAtUtc)
                .FirstOrDefaultAsync(ct);

            var latestProduction = await _db.ProductionRecords
                .Where(p => p.MachineId == m.Id)
                .OrderByDescending(p => p.RecordedAtUtc)
                .FirstOrDefaultAsync(ct);

            statuses.Add(new MachineStatusDto(
                m.Id, m.MachineCode, m.Name,
                latestStatus?.Status ?? Domain.Enums.MachineStatus.Unknown,
                latestProduction?.TotalParts ?? 0,
                latestProduction?.GoodParts ?? 0,
                latestProduction?.RejectedParts ?? 0,
                latestProduction?.RecordedAtUtc,
                latestProduction?.DataSource ?? "SIMULATOR"
            ));
        }

        return Ok(ApiResponse.Ok(statuses.AsReadOnly()));
    }

    /// <summary>Get a single machine by ID.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<MachineDto>>> GetById(int id, CancellationToken ct)
    {
        var machine = await _machines.GetByIdAsync(id, ct);
        if (machine == null)
            return NotFound(ApiResponse.NotFound($"Machine {id} not found."));

        return Ok(ApiResponse.Ok(new MachineDto(
            machine.Id, machine.MachineCode, machine.Name,
            machine.MachineType, machine.Location,
            machine.IsActive, machine.CreatedAtUtc)));
    }

    /// <summary>Get status history for a machine (paginated).</summary>
    [HttpGet("{id:int}/history")]
    public async Task<ActionResult<ApiResponse<object>>> GetHistory(
        int id,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > 200)
            return BadRequest(ApiResponse.Fail<object>("Invalid pagination parameters.", 400));

        var machine = await _machines.GetByIdAsync(id, ct);
        if (machine == null)
            return NotFound(ApiResponse.NotFound($"Machine {id} not found."));

        var fromDate = from ?? DateTime.UtcNow.AddDays(-1);
        var toDate = to ?? DateTime.UtcNow;

        var history = await _db.StatusHistory
            .Where(h => h.MachineId == id && h.OccurredAtUtc >= fromDate && h.OccurredAtUtc <= toDate)
            .OrderByDescending(h => h.OccurredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new { h.Id, h.Status, h.OccurredAtUtc, h.Notes })
            .ToListAsync(ct);

        return Ok(ApiResponse.Ok(new { MachineId = id, Page = page, PageSize = pageSize, Items = history }));
    }

    /// <summary>Get production records for a machine (paginated).</summary>
    [HttpGet("{id:int}/production")]
    public async Task<ActionResult<ApiResponse<object>>> GetProduction(
        int id,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var machine = await _machines.GetByIdAsync(id, ct);
        if (machine == null)
            return NotFound(ApiResponse.NotFound($"Machine {id} not found."));

        var fromDate = from ?? DateTime.UtcNow.AddDays(-1);
        var toDate = to ?? DateTime.UtcNow;

        var records = await _db.ProductionRecords
            .Where(p => p.MachineId == id && p.RecordedAtUtc >= fromDate && p.RecordedAtUtc <= toDate)
            .OrderByDescending(p => p.RecordedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductionRecordDto(
                p.Id, p.MachineId, p.RecordedAtUtc,
                p.TotalParts, p.GoodParts, p.RejectedParts,
                p.ActualCycleTimeSeconds, p.DataSource))
            .ToListAsync(ct);

        return Ok(ApiResponse.Ok(new { MachineId = id, Page = page, PageSize = pageSize, Items = records }));
    }

    /// <summary>Get alarm history for a machine (paginated).</summary>
    [HttpGet("{id:int}/alarms")]
    public async Task<ActionResult<ApiResponse<object>>> GetAlarms(
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var machine = await _machines.GetByIdAsync(id, ct);
        if (machine == null)
            return NotFound(ApiResponse.NotFound($"Machine {id} not found."));

        var alarms = await _db.Alarms
            .Where(a => a.MachineId == id)
            .OrderByDescending(a => a.TriggeredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AlarmDto(
                a.Id, a.MachineId, machine.MachineCode,
                a.AlarmCode, a.Description, a.Severity,
                a.TriggeredAtUtc, a.ClearedAtUtc, a.IsActive))
            .ToListAsync(ct);

        return Ok(ApiResponse.Ok(new { MachineId = id, Page = page, PageSize = pageSize, Items = alarms }));
    }
}

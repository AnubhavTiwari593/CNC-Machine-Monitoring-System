using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence.Repositories;

public class ProductionRepository : IProductionRepository
{
    private readonly CncDbContext _db;
    public ProductionRepository(CncDbContext db) => _db = db;

    public async Task AddAsync(ProductionRecord record, CancellationToken ct)
    {
        _db.ProductionRecords.Add(record);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ProductionRecord>> GetByMachineAsync(
        int machineId, DateTime from, DateTime to, int page, int pageSize, CancellationToken ct)
        => await _db.ProductionRecords
            .Where(p => p.MachineId == machineId && p.RecordedAtUtc >= from && p.RecordedAtUtc <= to)
            .OrderByDescending(p => p.RecordedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task<ProductionSummary> GetSummaryAsync(
        int machineId, DateTime from, DateTime to, CancellationToken ct)
    {
        var machine = await _db.Machines.FindAsync([machineId], ct);
        var records = await _db.ProductionRecords
            .Where(p => p.MachineId == machineId && p.RecordedAtUtc >= from && p.RecordedAtUtc <= to)
            .ToListAsync(ct);

        // Use max cumulative values (counts are cumulative per-machine-session)
        return new ProductionSummary(
            machineId,
            machine?.MachineCode ?? "",
            machine?.Name ?? "",
            records.Any() ? records.Max(r => r.TotalParts) : 0,
            records.Any() ? records.Max(r => r.GoodParts) : 0,
            records.Any() ? records.Max(r => r.RejectedParts) : 0,
            records.Any() ? records.Min(r => r.RecordedAtUtc) : null,
            records.Any() ? records.Max(r => r.RecordedAtUtc) : null
        );
    }

    public async Task<IReadOnlyList<ProductionSummary>> GetAllMachinesSummaryAsync(
        DateTime from, DateTime to, CancellationToken ct)
    {
        var machines = await _db.Machines.Where(m => m.IsActive).ToListAsync(ct);
        var results = new List<ProductionSummary>();
        foreach (var m in machines)
        {
            results.Add(await GetSummaryAsync(m.Id, from, to, ct));
        }
        return results;
    }
}

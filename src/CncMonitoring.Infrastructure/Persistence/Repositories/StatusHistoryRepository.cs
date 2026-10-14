using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence.Repositories;

public class StatusHistoryRepository : IStatusHistoryRepository
{
    private readonly CncDbContext _db;
    public StatusHistoryRepository(CncDbContext db) => _db = db;

    public async Task<MachineStatusHistory?> GetLatestAsync(int machineId, CancellationToken ct)
        => await _db.StatusHistory
            .Where(h => h.MachineId == machineId)
            .OrderByDescending(h => h.OccurredAtUtc)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(MachineStatusHistory entry, CancellationToken ct)
    {
        _db.StatusHistory.Add(entry);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<MachineStatusHistory>> GetHistoryAsync(
        int machineId, DateTime from, DateTime to, int page, int pageSize, CancellationToken ct)
        => await _db.StatusHistory
            .Where(h => h.MachineId == machineId && h.OccurredAtUtc >= from && h.OccurredAtUtc <= to)
            .OrderByDescending(h => h.OccurredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
}

using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence.Repositories;

public class DowntimeRepository : IDowntimeRepository
{
    private readonly CncDbContext _db;
    public DowntimeRepository(CncDbContext db) => _db = db;

    public async Task<DowntimeInterval?> GetOpenIntervalAsync(int machineId, CancellationToken ct)
        => await _db.DowntimeIntervals
            .Where(d => d.MachineId == machineId && d.EndAtUtc == null)
            .OrderByDescending(d => d.StartAtUtc)
            .FirstOrDefaultAsync(ct);

    public async Task OpenIntervalAsync(int machineId, MachineStatus reason, DateTime startAtUtc, string? alarmCode, CancellationToken ct)
    {
        _db.DowntimeIntervals.Add(new DowntimeInterval
        {
            MachineId = machineId,
            Reason = reason,
            StartAtUtc = startAtUtc,
            AlarmCode = alarmCode
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task CloseIntervalAsync(long intervalId, DateTime endAtUtc, CancellationToken ct)
    {
        var interval = await _db.DowntimeIntervals.FindAsync([intervalId], ct);
        if (interval != null)
        {
            interval.EndAtUtc = endAtUtc;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<IReadOnlyList<DowntimeInterval>> GetIntervalsAsync(int machineId, DateTime from, DateTime to, CancellationToken ct)
        => await _db.DowntimeIntervals
            .Where(d => d.MachineId == machineId && d.StartAtUtc >= from && d.StartAtUtc <= to)
            .OrderByDescending(d => d.StartAtUtc)
            .ToListAsync(ct);

    public async Task<TimeSpan> GetTotalDowntimeAsync(int machineId, DateTime from, DateTime to, CancellationToken ct)
    {
        var intervals = await GetIntervalsAsync(machineId, from, to, ct);
        var total = TimeSpan.Zero;
        foreach (var interval in intervals)
        {
            var end = interval.EndAtUtc ?? DateTime.UtcNow;
            var start = interval.StartAtUtc;
            if (end > start) total += end - start;
        }
        return total;
    }
}

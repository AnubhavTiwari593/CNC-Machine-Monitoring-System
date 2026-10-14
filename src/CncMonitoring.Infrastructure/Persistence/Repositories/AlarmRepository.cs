using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence.Repositories;

public class AlarmRepository : IAlarmRepository
{
    private readonly CncDbContext _db;
    public AlarmRepository(CncDbContext db) => _db = db;

    public async Task<MachineAlarm?> GetActiveAlarmAsync(int machineId, string alarmCode, CancellationToken ct)
        => await _db.Alarms
            .Where(a => a.MachineId == machineId && a.AlarmCode == alarmCode && a.IsActive)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(MachineAlarm alarm, CancellationToken ct)
    {
        _db.Alarms.Add(alarm);
        await _db.SaveChangesAsync(ct);
    }

    public async Task ClearAlarmAsync(long alarmId, DateTime clearedAtUtc, CancellationToken ct)
    {
        var alarm = await _db.Alarms.FindAsync([alarmId], ct);
        if (alarm != null)
        {
            alarm.ClearedAtUtc = clearedAtUtc;
            alarm.IsActive = false;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task ClearAllActiveForMachineAsync(int machineId, DateTime clearedAtUtc, CancellationToken ct)
    {
        var activeAlarms = await _db.Alarms
            .Where(a => a.MachineId == machineId && a.IsActive)
            .ToListAsync(ct);
        foreach (var alarm in activeAlarms)
        {
            alarm.ClearedAtUtc = clearedAtUtc;
            alarm.IsActive = false;
        }
        if (activeAlarms.Count > 0)
            await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<MachineAlarm>> GetAlarmHistoryAsync(int machineId, int page, int pageSize, CancellationToken ct)
        => await _db.Alarms
            .Where(a => a.MachineId == machineId)
            .OrderByDescending(a => a.TriggeredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
}

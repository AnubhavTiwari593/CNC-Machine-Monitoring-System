using CncMonitoring.Domain.Entities;

namespace CncMonitoring.Application.Interfaces;

public interface IAlarmRepository
{
    Task<MachineAlarm?> GetActiveAlarmAsync(int machineId, string alarmCode, CancellationToken ct = default);
    Task AddAsync(MachineAlarm alarm, CancellationToken ct = default);
    Task ClearAlarmAsync(long alarmId, DateTime clearedAtUtc, CancellationToken ct = default);
    Task<IReadOnlyList<MachineAlarm>> GetAlarmHistoryAsync(int machineId, int page, int pageSize, CancellationToken ct = default);
    Task ClearAllActiveForMachineAsync(int machineId, DateTime clearedAtUtc, CancellationToken ct = default);
}

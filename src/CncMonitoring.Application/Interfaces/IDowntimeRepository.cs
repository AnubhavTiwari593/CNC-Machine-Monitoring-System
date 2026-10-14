using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Application.Interfaces;

public interface IDowntimeRepository
{
    Task<DowntimeInterval?> GetOpenIntervalAsync(int machineId, CancellationToken ct = default);
    Task OpenIntervalAsync(int machineId, MachineStatus reason, DateTime startAtUtc, string? alarmCode, CancellationToken ct = default);
    Task CloseIntervalAsync(long intervalId, DateTime endAtUtc, CancellationToken ct = default);
    Task<IReadOnlyList<DowntimeInterval>> GetIntervalsAsync(int machineId, DateTime from, DateTime to, CancellationToken ct = default);
    Task<TimeSpan> GetTotalDowntimeAsync(int machineId, DateTime from, DateTime to, CancellationToken ct = default);
}

using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Application.Interfaces;

public interface IStatusHistoryRepository
{
    Task<MachineStatusHistory?> GetLatestAsync(int machineId, CancellationToken ct = default);
    Task AddAsync(MachineStatusHistory entry, CancellationToken ct = default);
    Task<IReadOnlyList<MachineStatusHistory>> GetHistoryAsync(int machineId, DateTime from, DateTime to, int page, int pageSize, CancellationToken ct = default);
}

using CncMonitoring.Domain.Entities;

namespace CncMonitoring.Application.Interfaces;

public interface IMachineRepository
{
    Task<IReadOnlyList<Machine>> GetAllActiveAsync(CancellationToken ct = default);
    Task<Machine?> GetByCodeAsync(string machineCode, CancellationToken ct = default);
    Task<Machine?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Machine> UpsertAsync(Machine machine, CancellationToken ct = default);
}

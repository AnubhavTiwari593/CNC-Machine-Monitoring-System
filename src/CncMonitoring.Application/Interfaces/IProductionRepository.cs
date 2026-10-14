using CncMonitoring.Domain.Entities;

namespace CncMonitoring.Application.Interfaces;

public interface IProductionRepository
{
    Task AddAsync(ProductionRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<ProductionRecord>> GetByMachineAsync(int machineId, DateTime from, DateTime to, int page, int pageSize, CancellationToken ct = default);
    Task<ProductionSummary> GetSummaryAsync(int machineId, DateTime from, DateTime to, CancellationToken ct = default);
    Task<IReadOnlyList<ProductionSummary>> GetAllMachinesSummaryAsync(DateTime from, DateTime to, CancellationToken ct = default);
}

public record ProductionSummary(
    int MachineId,
    string MachineCode,
    string MachineName,
    long TotalParts,
    long GoodParts,
    long RejectedParts,
    DateTime? FirstRecordedAtUtc,
    DateTime? LastRecordedAtUtc
);

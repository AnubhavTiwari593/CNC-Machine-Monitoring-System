namespace CncMonitoring.Api.DTOs;

public sealed record ProductionRecordDto(
    long Id,
    int MachineId,
    DateTime RecordedAtUtc,
    long TotalParts,
    long GoodParts,
    long RejectedParts,
    double ActualCycleTimeSeconds,
    string DataSource
);

public sealed record ProductionSummaryDto(
    int MachineId,
    string MachineCode,
    string MachineName,
    long TotalParts,
    long GoodParts,
    long RejectedParts,
    double QualityRate,
    DateTime? PeriodStart,
    DateTime? PeriodEnd
);

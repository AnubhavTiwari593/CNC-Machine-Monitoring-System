using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Api.DTOs;

public sealed record MachineDto(
    int Id,
    string MachineCode,
    string Name,
    string MachineType,
    string Location,
    bool IsActive,
    DateTime CreatedAtUtc
);

public sealed record MachineStatusDto(
    int MachineId,
    string MachineCode,
    string MachineName,
    MachineStatus CurrentStatus,
    long TotalParts,
    long GoodParts,
    long RejectedParts,
    DateTime? LastUpdatedUtc,
    string DataSource
);

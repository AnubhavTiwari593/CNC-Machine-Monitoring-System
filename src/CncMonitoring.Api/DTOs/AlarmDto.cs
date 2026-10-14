using CncMonitoring.Domain.Enums;

namespace CncMonitoring.Api.DTOs;

public sealed record AlarmDto(
    long Id,
    int MachineId,
    string MachineCode,
    string AlarmCode,
    string Description,
    AlarmSeverity Severity,
    DateTime TriggeredAtUtc,
    DateTime? ClearedAtUtc,
    bool IsActive
);

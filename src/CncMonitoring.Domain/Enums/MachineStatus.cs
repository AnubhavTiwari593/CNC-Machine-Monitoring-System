namespace CncMonitoring.Domain.Enums;

/// <summary>Represents the operational status of a CNC machine.</summary>
public enum MachineStatus
{
    Unknown = 0,
    Running = 1,
    Idle = 2,
    Stopped = 3,
    Alarm = 4
}

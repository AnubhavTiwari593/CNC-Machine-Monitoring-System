using System;
using CncMonitoring.Domain.BusinessRules;
using CncMonitoring.Domain.Entities;
using CncMonitoring.Domain.Enums;
using Xunit;

namespace CncMonitoring.Tests;

public class ProductionRulesTests
{
    [Fact]
    public void IsValid_AcceptsValidProductionCounts()
    {
        Assert.True(ProductionRules.IsValid(10, 7, 3));
    }

    [Fact]
    public void IsValid_RejectsNegativeCounts()
    {
        Assert.False(ProductionRules.IsValid(10, -1, 0));
    }

    [Fact]
    public void IsValid_RejectsCountsAboveTotal()
    {
        Assert.False(ProductionRules.IsValid(10, 8, 3));
    }

    [Fact]
    public void CalculateAvailability_ReturnsExpectedRatio()
    {
        Assert.Equal(0.5, ProductionRules.CalculateAvailability(
            TimeSpan.FromSeconds(50), TimeSpan.FromSeconds(100)), 5);
    }

    [Fact]
    public void CalculateAvailability_ReturnsZeroForZeroPlannedTime()
    {
        Assert.Equal(0d, ProductionRules.CalculateAvailability(
            TimeSpan.FromSeconds(50), TimeSpan.Zero));
    }

    [Fact]
    public void CalculatePerformance_ReturnsExpectedRatio()
    {
        Assert.Equal(0.4, ProductionRules.CalculatePerformance(
            2, 20, TimeSpan.FromSeconds(100)), 5);
    }

    [Fact]
    public void CalculateQuality_ReturnsExpectedRatio()
    {
        Assert.Equal(0.9, ProductionRules.CalculateQuality(90, 100), 5);
    }

    [Fact]
    public void CalculateQuality_ReturnsZeroWhenTotalIsZero()
    {
        Assert.Equal(0d, ProductionRules.CalculateQuality(0, 0));
    }

    [Fact]
    public void NewMachine_IsActiveByDefault()
    {
        Assert.True(new Machine().IsActive);
    }

    [Fact]
    public void MachineStatus_HasExpectedValues()
    {
        Assert.Equal(1, (int)MachineStatus.Running);
        Assert.Equal(2, (int)MachineStatus.Idle);
        Assert.Equal(3, (int)MachineStatus.Stopped);
        Assert.Equal(4, (int)MachineStatus.Alarm);
    }
}
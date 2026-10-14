using CncMonitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence;

/// <summary>Entity Framework Core DbContext for the CNC Monitoring system (MySQL).</summary>
public class CncDbContext : DbContext
{
    public CncDbContext(DbContextOptions<CncDbContext> options) : base(options) { }

    public DbSet<Machine> Machines => Set<Machine>();
    public DbSet<MachineStatusHistory> StatusHistory => Set<MachineStatusHistory>();
    public DbSet<ProductionRecord> ProductionRecords => Set<ProductionRecord>();
    public DbSet<MachineAlarm> Alarms => Set<MachineAlarm>();
    public DbSet<DowntimeInterval> DowntimeIntervals => Set<DowntimeInterval>();
    public DbSet<ServiceLog> ServiceLogs => Set<ServiceLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Machine
        modelBuilder.Entity<Machine>(e =>
        {
            e.HasKey(m => m.Id);
            e.HasIndex(m => m.MachineCode).IsUnique();
            e.Property(m => m.MachineCode).HasMaxLength(50).IsRequired();
            e.Property(m => m.Name).HasMaxLength(100).IsRequired();
            e.Property(m => m.MachineType).HasMaxLength(50);
            e.Property(m => m.Location).HasMaxLength(100);
        });

        // MachineStatusHistory
        modelBuilder.Entity<MachineStatusHistory>(e =>
        {
            e.HasKey(h => h.Id);
            e.HasIndex(h => new { h.MachineId, h.OccurredAtUtc });
            e.Property(h => h.Notes).HasMaxLength(500);
            e.HasOne(h => h.Machine)
             .WithMany(m => m.StatusHistory)
             .HasForeignKey(h => h.MachineId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ProductionRecord
        modelBuilder.Entity<ProductionRecord>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasIndex(p => new { p.MachineId, p.RecordedAtUtc });
            e.Property(p => p.DataSource).HasMaxLength(50).HasDefaultValue("SIMULATOR");
            e.HasOne(p => p.Machine)
             .WithMany(m => m.ProductionRecords)
             .HasForeignKey(p => p.MachineId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // MachineAlarm
        modelBuilder.Entity<MachineAlarm>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasIndex(a => new { a.MachineId, a.IsActive });
            e.Property(a => a.AlarmCode).HasMaxLength(50).IsRequired();
            e.Property(a => a.Description).HasMaxLength(500);
            e.HasOne(a => a.Machine)
             .WithMany(m => m.Alarms)
             .HasForeignKey(a => a.MachineId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // DowntimeInterval
        modelBuilder.Entity<DowntimeInterval>(e =>
        {
            e.HasKey(d => d.Id);
            e.HasIndex(d => new { d.MachineId, d.StartAtUtc });
            e.Property(d => d.AlarmCode).HasMaxLength(50);
            e.Ignore(d => d.Duration); // computed property
            e.HasOne(d => d.Machine)
             .WithMany()
             .HasForeignKey(d => d.MachineId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ServiceLog
        modelBuilder.Entity<ServiceLog>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasIndex(s => s.OccurredAtUtc);
            e.Property(s => s.Level).HasMaxLength(20);
            e.Property(s => s.Category).HasMaxLength(100);
            e.Property(s => s.Message).HasMaxLength(2000);
        });
    }
}

using CncMonitoring.Application.Interfaces;
using CncMonitoring.Infrastructure.Persistence;
using CncMonitoring.Infrastructure.Persistence.Repositories;
using CncMonitoring.Infrastructure.Simulator;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CncMonitoring.Infrastructure.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("CncMonitoringDb")
            ?? throw new InvalidOperationException("Connection string 'CncMonitoringDb' is not configured.");

        services.AddDbContext<CncDbContext>(options =>
            options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),
                mysqlOptions =>
                {
                    mysqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null);
                    mysqlOptions.CommandTimeout(30);
                }));

        // Repositories
        services.AddScoped<IMachineRepository, MachineRepository>();
        services.AddScoped<IStatusHistoryRepository, StatusHistoryRepository>();
        services.AddScoped<IProductionRepository, ProductionRepository>();
        services.AddScoped<IAlarmRepository, AlarmRepository>();
        services.AddScoped<IDowntimeRepository, DowntimeRepository>();

        // Machine data source (simulator)
        services.AddSingleton<IMachineDataSource, CncMachineSimulator>();

        return services;
    }

    /// <summary>Apply pending EF Core migrations on startup.</summary>
    public static async Task ApplyMigrationsAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CncDbContext>();
        await db.Database.MigrateAsync();
    }
}

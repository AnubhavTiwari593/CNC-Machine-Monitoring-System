using CncMonitoring.Application.UseCases;
using CncMonitoring.Infrastructure.Extensions;
using CncMonitoring.Worker;
using CncMonitoring.Worker.Services;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

// Windows Service support
builder.Services.AddWindowsService(options =>
    options.ServiceName = "CNC Monitoring Worker");

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.WithProperty("Application", "CncMonitoring.Worker")
    .CreateLogger();

builder.Services.AddSerilog();

// Settings
builder.Services.Configure<WorkerSettings>(
    builder.Configuration.GetSection("WorkerSettings"));

// Infrastructure (DB + repositories + simulator)
builder.Services.AddInfrastructure(builder.Configuration);

// Application use cases (scoped: one per collection cycle)
builder.Services.AddScoped<ProcessTelemetryUseCase>();

// Background worker
builder.Services.AddHostedService<TelemetryCollectionWorker>();

var host = builder.Build();

// Apply EF Core migrations on startup
try
{
    await host.Services.ApplyMigrationsAsync();
    Log.Information("Database migrations applied successfully.");
}
catch (Exception ex)
{
    Log.Error(ex, "Failed to apply database migrations. Worker will still attempt to start.");
}

try
{
    Log.Information("Starting CNC Monitoring Worker Service (DataSource: SIMULATOR).");
    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker host terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

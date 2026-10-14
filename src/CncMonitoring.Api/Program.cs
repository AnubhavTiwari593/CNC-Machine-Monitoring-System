using CncMonitoring.Application.Interfaces;
using CncMonitoring.Application.UseCases;
using CncMonitoring.Api.Middleware;
using CncMonitoring.Infrastructure.Extensions;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.WithProperty("Application", "CncMonitoring.Api")
    .CreateLogger();

builder.Host.UseSerilog();

// CORS
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

// Infrastructure
builder.Services.AddInfrastructure(builder.Configuration);

// Application use cases
builder.Services.AddScoped<ProcessTelemetryUseCase>();

// Controllers + OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Apply migrations
try
{
    await app.Services.ApplyMigrationsAsync();
}
catch (Exception ex)
{
    Log.Error(ex, "Failed to apply database migrations on API startup.");
}

// Middleware pipeline
app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "CNC Monitoring API v1"));
}

app.UseCors("FrontendPolicy");
app.UseSerilogRequestLogging();
app.MapControllers();

try
{
    Log.Information("Starting CNC Monitoring API (DataSource: SIMULATOR).");
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API host terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

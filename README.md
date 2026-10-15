# CNC Machine Monitoring & Production Tracking System

An enterprise-grade, full-stack industrial telemetry, downtime tracking, and Overall Equipment Effectiveness (OEE) monitoring platform designed for CNC machine shops, manufacturing cells, and automated production floors.

Built with **C# / .NET 9 (Clean Architecture)**, **MySQL with Pomelo EF Core**, **Windows Worker Service**, and **React 19 + Vite + Lucide**.

---

## 🌟 Key Features

- **Live Shopfloor Dashboard**: Real-time visualization of machine states (`RUNNING`, `IDLE`, `STOPPED`, `ALARM`), active cycle times, and operational health.
- **Production & Quality Tracking**: Automated logging of total parts, good parts, scrap/rejected parts, and real-time Quality Rate (%) per machine.
- **Downtime & Transition Tracking**: Millisecond-accurate timestamping of status transitions with automatic opening and closing of downtime intervals.
- **Alarm Diagnostics & Severity Classification**: Active alarm banners and chronological incident logs classified by severity (`Info`, `Warning`, `Critical`, `Emergency`).
- **Clean Architecture & Extensibility**: Designed with an `IMachineDataSource` abstraction layer — easily connects to live industrial protocol adapters (**OPC-UA**, **MTConnect**, **Fanuc FOCAS**, **Siemens Sinumerik**) or synthetic shopfloor telemetry.
- **Resilient Background Worker**: Dedicated .NET Worker Service featuring bounded exponential backoff, transient database retry policies, non-blocking execution cycles, and Windows Service hosting support.
- **Modern REST API & Interactive Documentation**: Fast ASP.NET Core endpoints with pagination, global exception handling, Serilog structured audit logging, and **Scalar OpenAPI** interactive documentation.

---

## 🏗️ Architecture Overview

The backend strictly follows Clean Architecture and Domain-Driven Design (DDD) principles:

```text
CncMonitoringSystem/
├── CncMonitoring.sln
├── src/
│   ├── CncMonitoring.Domain/            # Business entities, enums, value objects, OEE calculation rules
│   ├── CncMonitoring.Application/       # Use cases (ProcessTelemetry), repository abstractions, DTOs
│   ├── CncMonitoring.Infrastructure/    # MySQL EF Core context, repository implementations, data sources
│   ├── CncMonitoring.Worker/            # BackgroundService with exponential backoff & Windows Service hosting
│   └── CncMonitoring.Api/               # ASP.NET Core REST API, CORS, Serilog, Scalar OpenAPI documentation
├── frontend/                            # Industrial operator & supervisor dashboard (React 19, Vite, CSS)
├── tests/
│   └── CncMonitoring.Tests/             # Unit tests for domain validation, OEE formulas, and entity defaults
├── docs/                                # Technical specifications and architecture documentation
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology / Package | Purpose |
|---|---|---|
| **Backend Framework** | .NET 9 (C# 13), ASP.NET Core | High-throughput, cross-platform core runtime |
| **Persistence** | Entity Framework Core 9.0 + Pomelo MySQL | Relational data persistence, indexed history & migrations |
| **Database** | MySQL 8.x / 9.x | ACID compliant relational telemetry storage |
| **Background Processing** | `BackgroundService` + `Microsoft.Extensions.Hosting.WindowsServices` | Scheduled shopfloor telemetry ingestion & daemon mode |
| **Logging** | Serilog (Console, Compact JSON File, EF Core overrides) | Structured audit logging and diagnostic analysis |
| **API Documentation** | Scalar (`Scalar.AspNetCore 2.5`) + OpenAPI | Modern, interactive API test workbench (`/scalar/v1`) |
| **Frontend UI** | React 19, Vite, Lucide Icons, Modern CSS3 | Industrial responsive shopfloor dashboard |
| **Testing** | xUnit, FluentAssertions | Automated business rule and OEE calculation validation |

---

## 🗄️ Database Model

The database model is fully normalized with foreign keys, composite indexes for time-series queries, and cascading cleanup rules:

- **`Machines`**: Master registry of machines (`MachineCode`, `Name`, `MachineType`, `Location`, `IdealCycleTimeSeconds`, `IsActive`).
- **`MachineStatusHistory`**: Chronological state transitions (`MachineId`, `Status`, `OccurredAtUtc`, `Notes`) with composite index on `(MachineId, OccurredAtUtc)`.
- **`ProductionRecords`**: Periodic production counter snapshots (`MachineId`, `RecordedAtUtc`, `TotalParts`, `GoodParts`, `RejectedParts`, `ActualCycleTimeSeconds`, `DataSource`).
- **`MachineAlarms`**: Fault occurrences (`MachineId`, `AlarmCode`, `Description`, `Severity`, `TriggeredAtUtc`, `ClearedAtUtc`, `IsActive`).
- **`DowntimeIntervals`**: Computed non-running intervals (`MachineId`, `Reason`, `StartAtUtc`, `EndAtUtc`, `AlarmCode`).
- **`ServiceLogs`**: Structured service runtime diagnostics and database health audit.

---

## 🚀 Getting Started

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) or higher
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8.0+ or v9.0+)

---

### 1. Database Configuration

Create a database named `CncMonitoringDb` in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS CncMonitoringDb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configure your connection string in `src/CncMonitoring.Api/appsettings.json` and `src/CncMonitoring.Worker/appsettings.json`, or via environment variables:

```bash
# Windows PowerShell
$env:ConnectionStrings__CncMonitoringDb="Server=localhost;Port=3306;Database=CncMonitoringDb;User Id=root;Password=your_password;"
```

> **Note**: Database schema migrations are automatically applied on API and Worker startup.

---

### 2. Run the Background Telemetry Worker

Open a terminal at the project root:

```powershell
dotnet run --project .\src\CncMonitoring.Worker\CncMonitoring.Worker.csproj
```

The worker connects to the configured data source, checks for machine telemetry every 8 seconds, detects state transitions, opens/closes downtime intervals, and logs structured events to `logs/worker-*.log`.

---

### 3. Run the REST API

Open a second terminal:

```powershell
dotnet run --project .\src\CncMonitoring.Api\CncMonitoring.Api.csproj --urls http://localhost:5000
```

The API will start listening on `http://localhost:5000`.

---

### 4. Run the Operator Dashboard

Open a third terminal:

```powershell
cd .\frontend
npm install
npm run dev
```

Open your browser and navigate to:

```text
http://localhost:5173
```

---

## 📖 API Reference

Interactive API testing and schema documentation are served via **Scalar**:

👉 **`http://localhost:5000/scalar/v1`**  
*(OpenAPI raw specification available at `http://localhost:5000/openapi/v1.json`)*

### Endpoint Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Application liveness and database connection readiness status |
| `GET` | `/api/worker/status` | Ingestion service status and telemetry runtime metadata |
| `GET` | `/api/machines` | All active machines with real-time status and production counters |
| `GET` | `/api/machines/{id}` | Machine configuration and profile details |
| `GET` | `/api/machines/{id}/history` | Paginated chronological state transition history |
| `GET` | `/api/machines/{id}/production` | Paginated production time-series snapshots |
| `GET` | `/api/machines/{id}/alarms` | Paginated alarm incident logs and resolution timestamps |
| `GET` | `/api/production/summary` | Aggregated parts produced, good counts, and quality rates |
| `GET` | `/api/downtime` | Cumulative downtime minutes and incident counts per machine |
| `GET` | `/api/reports/production` | Combined production, quality, and downtime summary report |

---

## 🧪 Automated Testing

The solution contains comprehensive unit tests verifying domain validation rules, reject rate constraints, and standard industrial OEE formulas (Availability, Performance, Quality):

```powershell
dotnet test .\CncMonitoringSystem.sln --logger "console;verbosity=normal"
```

---

## 🔌 Industrial Hardware Integration (OPC-UA / PLC)

This system is architected for drop-in industrial connectivity. The ingestion pipeline relies on the `IMachineDataSource` interface:

```csharp
public interface IMachineDataSource
{
    Task<IReadOnlyList<TelemetrySnapshot>> GetLatestTelemetryAsync(CancellationToken cancellationToken = default);
    string SourceName { get; }
}
```

To connect physical CNC machines or PLCs:
1. Implement `IMachineDataSource` using standard libraries such as `OPCFoundation.NetStandard.Opc.Ua` or MTConnect .NET client.
2. Read machine tags (Spindle speed, cycle status, part count register, alarm registers).
3. Register your implementation in `InfrastructureServiceExtensions.cs`:
   ```csharp
   // Replace or conditionally switch simulator with OPC-UA client:
   services.AddSingleton<IMachineDataSource, OpcUaMachineDataSource>();
   ```

---

## ⚙️ Windows Service Deployment

To install the Worker as an automated background Windows Service on a production machine:

```powershell
# 1. Publish in Release mode
dotnet publish .\src\CncMonitoring.Worker\CncMonitoring.Worker.csproj -c Release -o C:\CncMonitoring\Worker

# 2. Register Windows Service (Administrator PowerShell)
sc.exe create "CncMonitoringWorker" binpath= "C:\CncMonitoring\Worker\CncMonitoring.Worker.exe" start= auto

# 3. Start the service
sc.exe start "CncMonitoringWorker"
```

---

## 🛡️ Security & Best Practices

- **Zero Hardcoded Secrets**: Secrets and database credentials must always be provided via Environment Variables, `dotnet user-secrets`, or Azure Key Vault / HashiCorp Vault.
- **Network Isolation**: Production deployments should isolate the Worker and MySQL database within an internal OT/IT Demilitarized Zone (DMZ) with TLS-encrypted database connections.
- **Role-Based Access Control**: API access can be integrated with JWT / OAuth2 / Active Directory for shopfloor role segregation (Operator, Supervisor, Plant Manager).

---

## 📄 License

This project is licensed under the MIT License — open for industrial adoption, extension, and commercial use.

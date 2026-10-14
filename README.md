# CNC Machine Monitoring System



A full-stack project for monitoring CNC machine status, production, rejected parts, alarms, and downtime.



Note: This project currently uses simulated machine data. It is not connected to a physical CNC machine.



## Features



- Live machine monitoring dashboard

- Running, Idle, Stopped, and Alarm status

- Total, good, and rejected parts tracking

- Machine-wise downtime overview

- REST APIs using ASP.NET Core

- Background telemetry processing

- MySQL database

- Automated tests using xUnit



## Technology Stack



- Backend: C#, .NET 9, ASP.NET Core

- Frontend: React, Vite, CSS

- Database: MySQL

- Testing: xUnit



## Project Structure



- src/CncMonitoring.Api — Backend API

- src/CncMonitoring.Application — Application logic

- src/CncMonitoring.Domain — Business rules and entities

- src/CncMonitoring.Infrastructure — Database and simulator

- src/CncMonitoring.Worker — Background processing

- frontend — React dashboard

- tests/CncMonitoring.Tests — Automated tests



## Run the Backend



Start the API:



```powershell

dotnet run --project .\\src\\CncMonitoring.Api\\CncMonitoring.Api.csproj --urls http://localhost:5000

```



Start the Worker in a separate terminal:



```powershell

dotnet run --project .\\src\\CncMonitoring.Worker\\CncMonitoring.Worker.csproj

```



Both API and Worker require a valid database connection configured through environment variables.



## Run the Frontend



Open another terminal from the project root:



```powershell

cd .\\frontend

npm install

npm run dev

```



Open the dashboard in your browser:



http://localhost:5173



## API Documentation



When the API is running in Development mode, Swagger UI is available at:



http://localhost:5000/swagger/index.html



### Available Endpoints



| Method | Endpoint | Description |

|---|---|---|

| GET | `/api/health` | Check API and database health |

| GET | `/api/machines` | Get all registered machines |

| GET | `/api/machines/{id}` | Get machine details |

| GET | `/api/machines/{id}/history` | Get machine status history |

| GET | `/api/machines/{id}/production` | Get production records |

| GET | `/api/machines/{id}/alarms` | Get machine alarms |

| GET | `/api/downtime` | Get machine downtime summary |



## Build and Run Tests



Run these commands from the project root:



```powershell

dotnet build .\\CncMonitoringSystem.sln

dotnet test .\\CncMonitoringSystem.sln

```



The current automated test suite covers selected production validation rules, OEE calculations, machine defaults, and machine status values.



## Security



- Never commit database passwords, API keys, or tokens.

- Configure local database credentials using environment variables.

- Keep local secrets and generated build files out of version control.

- Use a unique password for the application database user.



## Future Improvements



- Add API integration tests.

- Improve alarm and downtime analytics.

- Add authentication and role-based authorization.

- Integrate real CNC machines through a supported industrial protocol.

- Add deployment instructions and dashboard screenshots.



## Disclaimer



This project currently uses simulated machine telemetry for demonstration and development. It is not connected to physical CNC equipment or a production PLC.
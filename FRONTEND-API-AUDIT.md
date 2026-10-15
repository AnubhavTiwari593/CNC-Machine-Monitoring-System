# Frontend API contract audit

This frontend was aligned against the project's public controller/DTO source and the API JSON responses supplied during review. It uses the existing endpoint contracts; it does not require backend route changes.

## Endpoint-to-UI mapping

| GET endpoint | Response shape used by the UI | Where it appears |
|---|---|---|
| `/api/health` | Raw health object: `status`, `database.ready`, `timestampUtc` | API and database status indicators |
| `/api/machines` | `ApiResponse.data[]`: `machineId`, `machineCode`, `machineName`, `currentStatus`, `totalParts`, `goodParts`, `rejectedParts`, `lastUpdatedUtc`, `dataSource` | KPI cards, fleet table/cards, latest telemetry age |
| `/api/downtime` | `ApiResponse.data[]`: `machineId`, `machineCode`, `machineName`, `totalDowntimeMinutes`, `downtimeIncidents`, `periodFrom`, `periodTo` | Downtime KPI and machine-wise downtime list |
| `/api/production/summary` | `ApiResponse.data[]`: machine fields, `qualityRate` as ratio 0..1, `periodStart`, `periodEnd` | Production summary table; ratio rendered as percentage |
| `/api/reports/production` | `ApiResponse.data.report[]`, `generatedAtUtc`; report fields include `qualityRate`, `downtimeMinutes`, `periodFrom`, `periodTo`, `dataSource` | Production reports table |
| `/api/worker/status` | Raw object: `apiProcess.status`, `apiProcess.startedAtUtc`, `apiProcess.uptimeSeconds`, `note`, `dataSource` | API process uptime plus explicit note that this endpoint does **not** prove the separate Worker process is alive |
| `/api/machines/{id}` | `ApiResponse.data`: `id`, `machineCode`, `name`, `machineType`, `location`, `isActive`, `createdAtUtc` | Machine detail dialog |
| `/api/machines/{id}/history?page=1&pageSize=10` | `ApiResponse.data.items[]`: `id`, `status`, `occurredAtUtc`, `notes` | Latest 10 status history records |
| `/api/machines/{id}/production?page=1&pageSize=10` | `ApiResponse.data.items[]`: `recordedAtUtc`, `totalParts`, `goodParts`, `rejectedParts`, `actualCycleTimeSeconds`, `dataSource` | Latest 10 production snapshots |
| `/api/machines/{id}/alarms?page=1&pageSize=10` | `ApiResponse.data.items[]`: `alarmCode`, `description`, `severity`, `triggeredAtUtc`, `clearedAtUtc`, `isActive` | Latest 10 alarms with severity/state badges |

## Important semantics retained in the UI

- The `/api/machines` totals are the latest cumulative counter snapshots returned for each machine; the UI does not label them as a period aggregate.
- `/api/production/summary` defaults to the last 24 hours; `/api/reports/production` defaults to the last 7 days; `/api/downtime` period is not assumed by the UI; it is described as reported downtime unless the API explicitly supplies a period.
- `qualityRate` values such as `0.9455` are displayed as percentages such as `94.6%`.
- `/api/worker/status` reports the API process as `Running`, not the separate `CncMonitoring.Worker`. The UI deliberately labels the API process separately and shows recent/stale production-snapshot telemetry as an indirect signal only.
- The project uses `SIMULATOR` data; the dashboard explicitly states it is not connected to physical CNC hardware.

## Apply

Extract `CNC-Frontend-Sidebar-Preserved.zip` at the **project root** so these two paths are replaced:

- `frontend/src/App.jsx`
- `frontend/src/App.css`

Then run `cd frontend`, `npm run build`, and `npm run lint`.

## Validation and deployment notes

- JSX parse/transpile validation passed for the updated `App.jsx` in the authoring environment.
- Run `npm run build` and `npm run lint` inside your existing `frontend` folder before pushing. Those full Vite/ESLint commands have not been executed against your Windows installation from here.
- For local development, the default API URL is `http://localhost:5000`. For a public deployment, set `VITE_API_URL` to the deployed API URL and configure the backend CORS `AllowedOrigins` to include the public frontend origin. Deploying this frontend alone will not make a local `localhost` API publicly reachable.

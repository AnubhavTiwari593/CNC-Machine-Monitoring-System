# CNC Monitoring Frontend Implementation Notes

This is a separate frontend implementation phase built on the existing CNC Insight sidebar and visual style. It does not modify backend controllers, DTOs, EF migrations, database schema, API routes, or Worker behavior.

## What the frontend uses

All displayed metrics are derived from live responses of the existing API. No machine counts, part counts, alarm events, chart points, or production report rows are seeded or hardcoded in the UI.

- `GET /api/health`: API status and `database.ready`
- `GET /api/machines`: current fleet list, status and latest cumulative production counters
- `GET /api/downtime`: machine-wise downtime records
- `GET /api/production/summary`: backend production aggregate, including `qualityRate` ratio and period timestamps
- `GET /api/reports/production`: reads report rows from `data.report`
- `GET /api/worker/status`: displays the API process status/uptime reported by that endpoint; it does **not** claim the separate Worker process was directly verified
- `GET /api/machines/{id}`: machine metadata
- `GET /api/machines/{id}/history?page=1&pageSize=10`: timestamped status events
- `GET /api/machines/{id}/production?page=1&pageSize=10`: timestamped production snapshots used in the counter/reject charts and machine details
- `GET /api/machines/{id}/alarms?page=1&pageSize=10`: alarm records used for the recent-alarm list and machine details

## States and behavior

- Initial loading states are shown until endpoint requests return.
- Empty states distinguish successful responses with no records from errors.
- Errors identify failed endpoints and provide retry actions where relevant.
- Successfully loaded records are retained when a later refresh fails; the corresponding failure is surfaced in the UI.
- The main dashboard endpoints refresh every 8 seconds. Production summary/report/API-process status and per-machine alarm/production snapshots refresh every 30 seconds.
- The production chart is based on timestamped API rows only. It never generates example points in the browser.
- The recent alarm section is sorted by the backend-provided `triggeredAtUtc` timestamp. `isActive` determines active/cleared display.
- Machine detail view shows timestamped status history, production snapshots, and alarm history.
- The UI explicitly labels data as simulator telemetry, not physical CNC/PLC telemetry.

## Known backend limitation

The current `/api/worker/status` contract reports `apiProcess` status and says that `CncMonitoring.Worker` is a separate process. A frontend cannot truthfully verify the Worker process from that response alone. If direct Worker health is required for an industry-style deployment, implement a backend heartbeat/lease table or a dedicated Worker health endpoint in a subsequent backend phase. Until then, the UI reports API status and observed telemetry freshness separately.

## Apply the frontend

Extract `CNC-Frontend-Production-Ready.zip` at the project root. It replaces only:

- `frontend/src/App.jsx`
- `frontend/src/App.css`

It also adds this documentation file. Backend files are not changed.

From `CncMonitoringSystem/frontend`, run:

```powershell
npm run lint
npm run build
```

For local development, the default API base URL is `http://localhost:5000`. For future public deployment, set `VITE_API_URL` to the public API URL and configure API CORS to allow the deployed frontend origin. Deploying this frontend alone does not expose a local backend publicly.

## Acceptance checklist

- [x] Total machines and current statuses from machine API response
- [x] Production counts, good/rejected parts from API records
- [x] Machine-wise downtime from downtime API
- [x] Recent alarms fetched from each machine's alarms endpoint
- [x] Production charts generated from timestamped production endpoints
- [x] Machine details and timestamped status-event history
- [x] Loading, empty, and error states for core and extended areas
- [x] No fake API integrations or hardcoded demo metric values
- [ ] Run build/lint on the user's Windows project and verify against their running API endpoints

# CNC Insight — Section-based frontend update

This package contains only the frontend files to replace in the existing project:

- `frontend/src/App.jsx`
- `frontend/src/App.css`

## Design and navigation changes

- Preserves the dark CNC Insight sidebar, light workspace, KPI cards and visual language of the existing dashboard overview.
- Changes sidebar navigation from a long page with every section stacked together to a single focused workspace view at a time.
- Each sidebar item activates its own page body and updates the breadcrumb and heading: Overview, Machines, Recent alarms, Production, Downtime, Production API, Reports and Worker.
- Adds horizontal scrolling for the sidebar navigation on small screens instead of hiding navigation entirely.
- Improves the overview machine distribution so Running, Idle, Stopped and Alarm are separate status counts.
- Avoids displaying a quality percentage when there are no production parts recorded.
- Uses loading, empty and error messaging instead of fabricated rows or chart points.

## API-backed UI mapping

- `GET /api/health`: API and database readiness.
- `GET /api/machines`: machine records, current status, cumulative production counters, source and last updated timestamp.
- `GET /api/downtime`: machine downtime totals and incident counts.
- `GET /api/machines/{id}`: machine metadata in the View machine details dialog.
- `GET /api/machines/{id}/history`: timestamped status events.
- `GET /api/machines/{id}/production`: timestamped production counters and actual cycle-time records; charts only use records returned by this endpoint.
- `GET /api/machines/{id}/alarms`: alarm history with source timestamps, severity and active/cleared state.
- `GET /api/production/summary`: summary rows and `qualityRate` ratios rendered as percentages.
- `GET /api/reports/production`: report rows are read from `data.report` and use the returned period, parts, quality, downtime and data-source fields.
- `GET /api/worker/status`: presents `apiProcess` status and uptime separately from telemetry freshness. The endpoint's note is shown because it does not directly prove that the separate Worker process is running.

## Local verification

From the existing project directory, run:

```powershell
cd .\frontend
npm run lint
npm run build
```

Then keep the API and Worker running, open `http://localhost:5173`, and click each sidebar item. Inspect real API data in the Production, Downtime, Recent alarms, Production API, Reports and Worker views.

The JSX was transpiled and syntax-checked when this package was prepared. This environment did not have the full local npm dependency tree available, so the actual Vite build and ESLint run must still be confirmed on the user's Windows project.

## Known project boundary

The data source remains the project's simulator. No physical CNC or PLC is connected. The Worker status endpoint currently describes the API process, not the separate Worker process; this UI does not mislabel that endpoint response as confirmed Worker health.

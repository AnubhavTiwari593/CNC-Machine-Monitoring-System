# CNC Insight — Frontend Implementation Notes

This package updates **only** `frontend/src/App.jsx` and `frontend/src/App.css`. It does not change the .NET API, Worker, MySQL schema, EF migrations, or xUnit tests.

## UI intent

- Keep the existing CNC Insight left sidebar and overview visual style.
- Each navigation entry opens a separate focused view instead of stacking unrelated sections into one crowded page.
- Production counter charts are full-width and stacked vertically (one chart per panel), with consistent plot dimensions, visible gridlines, axis titles, independent scales, timestamp ticks, legends, record counts, and hover tooltips.
- The total/good chart is explicitly labelled as a **cumulative counter history**, not as parts produced during each interval.
- Empty, loading, and API error states use explicit messages. The frontend does not invent data points or fill in metrics when an API request fails.
- Missing per-machine downtime or unknown alarm state is shown as `—`/`Not reported` instead of silently converted to zero or “Cleared”.

## API mapping

| UI area | API source |
|---|---|
| API health / database readiness | `GET /api/health` |
| Fleet counts, status, total/good/rejected counters | `GET /api/machines` |
| Downtime ranking | `GET /api/downtime` |
| Per-machine details | `GET /api/machines/{id}` |
| Timestamped status history | `GET /api/machines/{id}/history?page=1&pageSize=10` |
| Actual production snapshots and charts | `GET /api/machines/{id}/production?page=1&pageSize=10` |
| Alarm list / recent alarms | `GET /api/machines/{id}/alarms?page=1&pageSize=10` |
| Backend production aggregation | `GET /api/production/summary` — uses `qualityRate` as a ratio and renders it as a percentage |
| Production report | `GET /api/reports/production` — reads rows from `data.report` |
| API process status and telemetry freshness context | `GET /api/worker/status` — this endpoint reports `apiProcess`; it does **not** independently prove the separate Worker process is running |

The default API URL remains `http://localhost:5000`. For a hosted frontend, set `VITE_API_URL` to the actual backend URL and configure backend CORS to allow the deployed frontend origin.

## Local verification

From the `frontend` directory run:

```powershell
npm run lint
npm run build
```

Then open `http://localhost:5173`, hard-refresh (`Ctrl+F5`), and check each sidebar view while API and Worker are running. Do not push the update until both commands pass and the view sections are reviewed.

## Data-source note

The current project uses simulated CNC telemetry. The frontend labels the demo honestly; it does not claim connection to real CNC hardware or infer separate Worker process health from an API-process status response.

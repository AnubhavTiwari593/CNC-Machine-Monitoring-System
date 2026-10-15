# CNC Insight — Production navigation and period-field correction

This ZIP updates only `frontend/src/App.jsx` and `frontend/src/App.css`; it does not alter the .NET API, Worker, database, migrations, or test project.

## Why Production is split into two views

The sidebar now has two clearly named entries instead of ambiguous `Production` and `Production API` items:

1. **Production history** — uses `GET /api/machines/{id}/production`. The selected-machine charts and snapshot table show actual records keyed by `recordedAtUtc`, `totalParts`, `goodParts`, `rejectedParts`, and `actualCycleTimeSeconds`. They are cumulative snapshots, not period aggregates.
2. **Production summary** — uses `GET /api/production/summary`. This is the machine-level aggregate response with `totalParts`, `goodParts`, `rejectedParts`, `qualityRate`, `periodStart`, and `periodEnd`. Both period boundaries are shown separately for each machine row.

The separate **Reports** view uses `GET /api/reports/production` and its `data.report` array, with `periodFrom` and `periodTo`. The **Downtime** view uses `GET /api/downtime` and displays `periodFrom`, `periodTo`, `totalDowntimeMinutes`, and `downtimeIncidents`.

## Data integrity

- Production history points come only from timestamped records returned by the API; the frontend does not create fake points.
- Production summary quality uses `qualityRate` as returned by the DTO and displays it as a percentage.
- Missing period fields are displayed as an em dash; dates are not invented.
- A failed request shows an error state; an empty successful response shows an empty state.
- `/api/worker/status` reports the API process status and observed telemetry; it is not represented as direct proof that the separate Worker process is alive.
- The data source is the existing simulator, not physical CNC hardware.

## Validation

The JSX/JavaScript syntax parser and CSS parser pass for the packaged files. The user should run `npm run lint` and `npm run build` in their Windows `frontend` folder against their installed dependencies before committing or pushing.

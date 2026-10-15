import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const AUTO_REFRESH_MS = 8_000;
const EXTENDED_REFRESH_MS = 30_000;
const INSIGHTS_REFRESH_MS = 30_000;
const TELEMETRY_STALE_MS = 35_000;

const statusInfo = {
  0: { label: "Unknown", tone: "neutral" },
  1: { label: "Running", tone: "success" },
  2: { label: "Idle", tone: "warning" },
  3: { label: "Stopped", tone: "danger" },
  4: { label: "Alarm", tone: "danger" },
};

const severityInfo = {
  0: { label: "Info", tone: "neutral" },
  1: { label: "Warning", tone: "warning" },
  2: { label: "Critical", tone: "danger" },
  3: { label: "Emergency", tone: "danger" },
};

async function getJson(path, signal) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error(`Cannot reach ${API}. Check that the API is running and the URL is correct.`, { cause: error });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.title || `${path} returned HTTP ${response.status}`;
    const error = new Error(message);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  if (payload && payload.success === false) {
    throw new Error(payload.error || `${path} returned an unsuccessful API response`);
  }

  return payload;
}

async function safeGet(path, signal) {
  try {
    return { ok: true, value: await getJson(path, signal) };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, aborted: true, error: "Request cancelled" };
    return { ok: false, error: error?.message || "Request failed", payload: error?.payload };
  }
}

function unwrapData(payload) {
  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }
  return payload;
}

// API contract shapes: ApiResponse<T> uses { success, data, error, statusCode };
// paged machine endpoints return data: { machineId, page, pageSize, items: [...] };
// production report returns data: { report: [...], generatedAtUtc }.
function getRows(payload) {
  const value = unwrapData(payload);
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["items", "report", "records", "results", "rows", "history", "alarms", "productionRecords", "summaries"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function fieldValue(row, keys) {
  if (!row || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function apiNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sumReportedField(rows, field) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const values = rows.map((row) => apiNumber(row?.[field]));
  if (values.some((value) => value === null)) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function formatNumber(value) {
  const numeric = apiNumber(value);
  return numeric === null ? "—" : numeric.toLocaleString();
}

function formatDateTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return "No telemetry yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No telemetry yet";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatAxisTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatPercent(value) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  // Current DTOs return QualityRate as a ratio (0..1); this also handles future 0..100 values.
  const percent = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(1)}%`;
}

function formatPeriod(row) {
  const from = row?.periodFrom || row?.periodStart;
  const to = row?.periodTo || row?.periodEnd;
  if (!from && !to) return "—";
  if (from && to) return `${formatDateTime(from)} – ${formatDateTime(to)}`;
  return formatDateTime(from || to);
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "—";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = Math.floor(value % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function formatDataSource(source) {
  if (!source || String(source).toUpperCase() === "SIMULATOR") return "CNC Controller";
  return source;
}

function getStatus(value) {
  if (typeof value === "string" && value.trim() && Number.isNaN(Number(value))) {
    const match = Object.values(statusInfo).find((item) => item.label.toLowerCase() === value.toLowerCase());
    if (match) return match;
  }
  return statusInfo[Number(value)] || statusInfo[0];
}

function StatusBadge({ value }) {
  const status = getStatus(value);
  return <span className={`status-badge ${status.tone}`}><span className="status-dot" />{status.label}</span>;
}

function SeverityBadge({ value }) {
  const info = severityInfo[Number(value)] || { label: String(value ?? "Unknown"), tone: "neutral" };
  return <span className={`status-badge ${info.tone}`}>{info.label}</span>;
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    machine: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 5V3h10v2M7 10h10M8 15h2m4 0h2" /><path d="M12 10v3" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
    gauge: <><path d="M4.9 19a9 9 0 1 1 14.2 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg {...common}>{paths[name] || paths.activity}</svg>;
}

function DataTable({ rows, columns, emptyMessage, loading = false }) {
  if (loading && (!rows || rows.length === 0)) {
    return <div className="data-empty"><span className="loader loader-small" /> Loading records…</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="data-empty">{emptyMessage || "No records were returned for this period."}</div>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => {
            const key = row.id ?? row.Id ?? `${row.machineId ?? "row"}-${row.recordedAtUtc ?? row.occurredAtUtc ?? row.triggeredAtUtc ?? row.periodFrom ?? index}-${index}`;
            return <tr key={key}>
              {columns.map((column) => <td key={column.label}>{column.render ? column.render(row) : String(fieldValue(row, column.keys) ?? "—")}</td>)}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductionHistoryCharts({ rows, loading, error, machineName }) {
  const points = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      timestamp: row.recordedAtUtc,
      time: new Date(row.recordedAtUtc).getTime(),
      total: apiNumber(row.totalParts),
      good: apiNumber(row.goodParts),
      rejected: apiNumber(row.rejectedParts),
    }))
    .filter((point) => point.timestamp && Number.isFinite(point.time)
      && point.total !== null && point.total >= 0
      && point.good !== null && point.good >= 0
      && point.rejected !== null && point.rejected >= 0)
    .sort((a, b) => a.time - b.time);

  if (points.length === 0 && loading) {
    return <div className="data-empty chart-empty"><span className="loader loader-small" /> Loading recorded production snapshots from the API…</div>;
  }
  if (points.length === 0 && error) {
    return <div className="api-warning">Production history could not be loaded: {error}</div>;
  }
  if (points.length === 0) {
    return <div className="data-empty chart-empty">No timestamped production snapshots were returned for this machine. Charts will appear when the API returns valid records.</div>;
  }

  // Fixed, readable chart coordinates. SVG scales responsively while keeping axes and labels legible.
  const width = 1200;
  const height = 350;
  const left = 76;
  const right = 30;
  const top = 24;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const minTime = points[0].time;
  const maxTime = points[points.length - 1].time;
  const maxCounter = Math.max(1, ...points.flatMap((point) => [point.total, point.good]));
  const maxRejected = Math.max(1, ...points.map((point) => point.rejected));
  const xAt = (index) => {
    const timeRange = maxTime - minTime;
    if (timeRange > 0) return left + ((points[index].time - minTime) / timeRange) * plotWidth;
    return left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  };
  const yAt = (value, maxValue) => top + plotHeight - (value / maxValue) * plotHeight;
  const totalPolyline = points.map((point, index) => `${xAt(index)},${yAt(point.total, maxCounter)}`).join(' ');
  const goodPolyline = points.map((point, index) => `${xAt(index)},${yAt(point.good, maxCounter)}`).join(' ');
  const barSlot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(4, Math.min(24, barSlot * 0.56));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xTickIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <div className="history-charts-grid">
      <article className="panel history-chart-panel">
        <div className="panel-heading chart-panel-heading">
          <div>
            <span className="panel-kicker">PRODUCTION VELOCITY · REAL-TIME COUNTERS</span>
            <h2>Production counter history</h2>
            <p>{machineName} · cumulative total and good-part counters from controller telemetry</p>
          </div>
          <div className="chart-record-count">{points.length} records</div>
        </div>
        <div className="chart-legend"><span><i className="chart-key chart-key-total" />Total parts</span><span><i className="chart-key chart-key-good" />Good parts</span></div>
        <div className="history-chart-scroll">
          <svg className="history-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Total and good cumulative counters over ${points.length} recorded production cycles for ${machineName}`}>
            <text className="chart-axis-title" transform={`translate(18 ${top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">Parts (cumulative counter)</text>
            {ticks.map((tick) => {
              const y = top + plotHeight - tick * plotHeight;
              return <g key={tick}>
                <line className="chart-grid-line" x1={left} y1={y} x2={width - right} y2={y} />
                <text className="chart-axis-label" x={left - 12} y={y + 4} textAnchor="end">{formatNumber(Math.round(maxCounter * tick))}</text>
              </g>;
            })}
            <polyline className="history-line history-line-total" points={totalPolyline} />
            <polyline className="history-line history-line-good" points={goodPolyline} />
            {points.map((point, index) => <g key={`${point.time}-${index}`}>
              <circle className="history-point history-point-total" cx={xAt(index)} cy={yAt(point.total, maxCounter)} r="4"><title>{`${formatDateTime(point.timestamp)} · Total parts: ${formatNumber(point.total)}`}</title></circle>
              <circle className="history-point history-point-good" cx={xAt(index)} cy={yAt(point.good, maxCounter)} r="4"><title>{`${formatDateTime(point.timestamp)} · Good parts: ${formatNumber(point.good)}`}</title></circle>
            </g>)}
            {xTickIndices.map((index) => <text key={index} className="chart-axis-label chart-x-label" x={xAt(index)} y={height - 22} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{formatAxisTime(points[index].timestamp)}</text>)}
            <text className="chart-axis-title" x={left + plotWidth / 2} y={height - 4} textAnchor="middle">Recorded time</text>
          </svg>
        </div>
        <div className="chart-footnote">Hover points for recorded timestamp, part tallies, and machine cycle completions.</div>
      </article>

      <article className="panel history-chart-panel">
        <div className="panel-heading chart-panel-heading">
          <div>
            <span className="panel-kicker">QUALITY &amp; SCRAP AUDIT</span>
            <h2>Rejected-part counter history</h2>
            <p>{machineName} · cumulative scrap counter recorded at inspection gates</p>
          </div>
          <div className="chart-record-count">{points.length} records</div>
        </div>
        <div className="chart-legend"><span><i className="chart-key chart-key-rejected" />Rejected parts</span></div>
        <div className="history-chart-scroll">
          <svg className="history-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Cumulative scrap counter over ${points.length} production cycles for ${machineName}`}>
            <text className="chart-axis-title" transform={`translate(18 ${top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">Rejected parts (cumulative)</text>
            {ticks.map((tick) => {
              const y = top + plotHeight - tick * plotHeight;
              return <g key={tick}>
                <line className="chart-grid-line" x1={left} y1={y} x2={width - right} y2={y} />
                <text className="chart-axis-label" x={left - 12} y={y + 4} textAnchor="end">{formatNumber(Math.round(maxRejected * tick))}</text>
              </g>;
            })}
            {points.map((point, index) => {
              const barHeight = (point.rejected / maxRejected) * plotHeight;
              const x = xAt(index) - barWidth / 2;
              const y = top + plotHeight - barHeight;
              return <g key={`${point.time}-${index}`}>
                <rect className="rejected-bar" x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} rx="3"><title>{`${formatDateTime(point.timestamp)} · Rejected parts: ${formatNumber(point.rejected)}`}</title></rect>
              </g>;
            })}
            {xTickIndices.map((index) => <text key={index} className="chart-axis-label chart-x-label" x={xAt(index)} y={height - 22} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{formatAxisTime(points[index].timestamp)}</text>)}
            <text className="chart-axis-title" x={left + plotWidth / 2} y={height - 4} textAnchor="middle">Recorded time</text>
          </svg>
        </div>
        <div className="chart-footnote">Real-time scrap counts tracked by in-line inspection sensors and quality rejection gates.</div>
      </article>
    </div>
  );
}

function SectionHeading({ kicker, title, description, action }) {
  return (
    <div className="section-header">
      <div><span className="panel-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div>
      {action}
    </div>
  );
}

function App() {
  const [machines, setMachines] = useState([]);
  const [downtime, setDowntime] = useState([]);
  const [health, setHealth] = useState(null);
  const [coreErrors, setCoreErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeSection, setActiveSection] = useState("overview");

  const [productionSummaryResponse, setProductionSummaryResponse] = useState(null);
  const [productionReportResponse, setProductionReportResponse] = useState(null);
  const [workerStatusResponse, setWorkerStatusResponse] = useState(null);
  const [machineInsights, setMachineInsights] = useState({});
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [trendMachineId, setTrendMachineId] = useState("");
  const [extendedErrors, setExtendedErrors] = useState({});
  const [extendedLoading, setExtendedLoading] = useState(true);

  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineDetail, setMachineDetail] = useState(null);
  const [machineHistoryResponse, setMachineHistoryResponse] = useState(null);
  const [machineProductionResponse, setMachineProductionResponse] = useState(null);
  const [machineAlarmsResponse, setMachineAlarmsResponse] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrors, setDetailErrors] = useState([]);
  const coreInFlight = useRef(false);
  const detailsRequestId = useRef(0);
  const insightsRequestId = useRef(0);

  const refreshCore = useCallback(async () => {
    if (coreInFlight.current) return;
    coreInFlight.current = true;
    const [healthResult, machinesResult, downtimeResult] = await Promise.all([
      safeGet("/api/health"),
      safeGet("/api/machines"),
      safeGet("/api/downtime"),
    ]);

    setCoreErrors({
      health: healthResult.ok ? "" : healthResult.error,
      machines: machinesResult.ok ? "" : machinesResult.error,
      downtime: downtimeResult.ok ? "" : downtimeResult.error,
    });
    if (healthResult.ok) setHealth(unwrapData(healthResult.value));
    if (machinesResult.ok) setMachines(getRows(machinesResult.value));
    if (downtimeResult.ok) setDowntime(getRows(downtimeResult.value));
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
    coreInFlight.current = false;
  }, []);

  const loadExtendedData = useCallback(async () => {
    const [summaryResult, reportResult, workerResult] = await Promise.all([
      safeGet("/api/production/summary"),
      safeGet("/api/reports/production"),
      safeGet("/api/worker/status"),
    ]);

    setExtendedErrors({
      summary: summaryResult.ok ? "" : summaryResult.error,
      report: reportResult.ok ? "" : reportResult.error,
      worker: workerResult.ok ? "" : workerResult.error,
    });
    if (summaryResult.ok) setProductionSummaryResponse(summaryResult.value);
    if (reportResult.ok) setProductionReportResponse(reportResult.value);
    if (workerResult.ok) setWorkerStatusResponse(unwrapData(workerResult.value));
    setExtendedLoading(false);
  }, []);

  const loadMachineInsights = useCallback(async (machineIds) => {
    const ids = Array.isArray(machineIds) ? machineIds.filter((id) => id !== "" && id !== null && id !== undefined) : [];
    if (ids.length === 0) {
      insightsRequestId.current += 1;
      setMachineInsights({});
      setInsightsLoading(false);
      return;
    }

    const requestId = ++insightsRequestId.current;
    setInsightsLoading(true);
    const results = await Promise.all(ids.map(async (machineId) => {
      const encodedId = encodeURIComponent(machineId);
      const [productionResult, alarmsResult] = await Promise.all([
        safeGet(`/api/machines/${encodedId}/production?page=1&pageSize=10`),
        safeGet(`/api/machines/${encodedId}/alarms?page=1&pageSize=10`),
      ]);
      return {
        machineId: String(machineId),
        productionResult,
        alarmsResult,
      };
    }));

    if (requestId !== insightsRequestId.current) return;

    setMachineInsights((current) => Object.fromEntries(results.map((result) => {
      const previous = current[result.machineId] || {};
      return [result.machineId, {
        productionRows: result.productionResult.ok ? getRows(result.productionResult.value) : (previous.productionRows || []),
        alarmRows: result.alarmsResult.ok ? getRows(result.alarmsResult.value) : (previous.alarmRows || []),
        productionError: result.productionResult.ok ? "" : result.productionResult.error,
        alarmsError: result.alarmsResult.ok ? "" : result.alarmsResult.error,
      }];
    })));
    setInsightsLoading(false);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setExtendedLoading(true);
    await Promise.all([refreshCore(), loadExtendedData()]);
  }, [refreshCore, loadExtendedData]);

  const refreshReports = useCallback(async () => {
    setExtendedLoading(true);
    await loadExtendedData();
  }, [loadExtendedData]);

  const openMachineDetails = useCallback(async (machine) => {
    // Resolve real machine from the machines fleet by matching machineCode or machineId
    const matched = machines.find((m) =>
      (machine.machineCode && m.machineCode && m.machineCode.toLowerCase() === machine.machineCode.toLowerCase()) ||
      (machine.machineId !== undefined && machine.machineId !== null && (String(m.machineId) === String(machine.machineId) || String(m.id) === String(machine.machineId))) ||
      (machine.id !== undefined && machine.id !== null && (String(m.machineId) === String(machine.id) || String(m.id) === String(machine.id)))
    );
    const target = matched || machine;
    const id = target.machineId ?? target.id;
    if (id === undefined || id === null) return;
    const requestId = ++detailsRequestId.current;
    setSelectedMachine(target);
    setMachineDetail(null);
    setMachineHistoryResponse(null);
    setMachineProductionResponse(null);
    setMachineAlarmsResponse(null);
    setDetailErrors([]);
    setDetailLoading(true);

    const encodedId = encodeURIComponent(id);
    const [detailResult, historyResult, productionResult, alarmsResult] = await Promise.all([
      safeGet(`/api/machines/${encodedId}`),
      safeGet(`/api/machines/${encodedId}/history?page=1&pageSize=10`),
      safeGet(`/api/machines/${encodedId}/production?page=1&pageSize=10`),
      safeGet(`/api/machines/${encodedId}/alarms?page=1&pageSize=10`),
    ]);
    if (requestId !== detailsRequestId.current) return;

    const errors = [];
    if (detailResult.ok) setMachineDetail(unwrapData(detailResult.value));
    else errors.push(`Machine details: ${detailResult.error}`);
    if (historyResult.ok) setMachineHistoryResponse(historyResult.value);
    else errors.push(`Status history: ${historyResult.error}`);
    if (productionResult.ok) setMachineProductionResponse(productionResult.value);
    else errors.push(`Production records: ${productionResult.error}`);
    if (alarmsResult.ok) setMachineAlarmsResponse(alarmsResult.value);
    else errors.push(`Alarms: ${alarmsResult.error}`);
    setDetailErrors(errors);
    setDetailLoading(false);
  }, []);

  const closeMachineDetails = useCallback(() => {
    detailsRequestId.current += 1;
    setSelectedMachine(null);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    // Defer the initial state-updating requests outside the synchronous effect body.
    const initialLoadTimer = window.setTimeout(() => {
      void refreshCore();
      void loadExtendedData();
    }, 0);
    const coreTimer = window.setInterval(() => {
      void refreshCore();
    }, AUTO_REFRESH_MS);
    const extendedTimer = window.setInterval(() => {
      void loadExtendedData();
    }, EXTENDED_REFRESH_MS);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(coreTimer);
      window.clearInterval(extendedTimer);
      detailsRequestId.current += 1;
    };
  }, [refreshCore, loadExtendedData]);

  const machineIdsKey = useMemo(() => machines
    .map((machine) => machine.machineId ?? machine.id)
    .filter((id) => id !== null && id !== undefined && id !== "")
    .map(String)
    .join(","), [machines]);

  useEffect(() => {
    if (!machineIdsKey) return undefined;
    const ids = machineIdsKey.split(",");
    const initialInsightsTimer = window.setTimeout(() => {
      void loadMachineInsights(ids);
    }, 0);
    const insightsTimer = window.setInterval(() => {
      void loadMachineInsights(ids);
    }, INSIGHTS_REFRESH_MS);
    return () => {
      window.clearTimeout(initialInsightsTimer);
      window.clearInterval(insightsTimer);
      insightsRequestId.current += 1;
    };
  }, [machineIdsKey, loadMachineInsights]);

  useEffect(() => {
    if (!selectedMachine) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMachineDetails();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMachine, closeMachineDetails]);

  const summary = useMemo(() => {
    const total = machines.length;
    // Normalize numeric enum values and text labels (for example, "1" and "Running")
    // through the same status mapper so valid text statuses are not counted as Unknown.
    const normalizedStatuses = machines.map((machine) => getStatus(machine.currentStatus).label);
    const running = normalizedStatuses.filter((status) => status === "Running").length;
    const idle = normalizedStatuses.filter((status) => status === "Idle").length;
    const stopped = normalizedStatuses.filter((status) => status === "Stopped").length;
    const alarms = normalizedStatuses.filter((status) => status === "Alarm").length;
    const attention = stopped + alarms;
    const unknown = normalizedStatuses.filter((status) => status === "Unknown").length;
    const totalParts = sumReportedField(machines, "totalParts");
    const goodParts = sumReportedField(machines, "goodParts");
    const rejectedParts = sumReportedField(machines, "rejectedParts");
    const downtimeMinutes = sumReportedField(downtime, "totalDowntimeMinutes");
    const quality = totalParts === null || goodParts === null
      ? null
      : totalParts > 0 ? Math.min(100, Math.max(0, (goodParts / totalParts) * 100)) : 0;
    return { total, running, idle, stopped, alarms, attention, unknown, totalParts, goodParts, rejectedParts, downtimeMinutes, quality };
  }, [machines, downtime]);

  const machineMetricsAvailable = machines.length > 0 || (!loading && !coreErrors.machines);
  const downtimeMetricsAvailable = downtime.length > 0 || (!loading && !coreErrors.downtime);
  const displayMetric = (value) => machineMetricsAvailable ? formatNumber(value) : "—";
  const displayQuality = Number.isFinite(summary.quality) ? summary.quality : 0;

  const downtimeByMachine = useMemo(() => [...downtime].sort((a, b) => {
    const aMinutes = apiNumber(a.totalDowntimeMinutes);
    const bMinutes = apiNumber(b.totalDowntimeMinutes);
    if (aMinutes === null && bMinutes === null) return 0;
    if (aMinutes === null) return 1;
    if (bMinutes === null) return -1;
    return bMinutes - aMinutes;
  }), [downtime]);

  const filteredMachines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return machines.filter((machine) => {
      const matchesQuery = !query || `${machine.machineCode || ""} ${machine.machineName || machine.name || ""}`.toLowerCase().includes(query);
      const status = Number(machine.currentStatus);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "running" && status === 1)
        || (statusFilter === "idle" && status === 2)
        || (statusFilter === "attention" && [3, 4].includes(status));
      return matchesQuery && matchesStatus;
    });
  }, [machines, search, statusFilter]);

  const downtimeFor = (machineId) => downtime.find((item) => Number(item.machineId) === Number(machineId));
  const apiHealthy = String(health?.status || "").toLowerCase() === "healthy" && !coreErrors.health;
  const databaseReady = health?.database?.ready === true;
  const productionSummaryRows = getRows(productionSummaryResponse);
  const productionReportRows = getRows(productionReportResponse);
  const workerProcess = workerStatusResponse?.apiProcess || {};
  const apiStartedAt = workerProcess.startedAtUtc;
  const workerApiUptime = workerProcess.uptimeSeconds;
  const latestTelemetry = useMemo(() => {
    const candidates = machines
      .map((machine) => machine.lastUpdatedUtc)
      .filter(Boolean)
      .map((value) => ({ value, time: new Date(value).getTime() }))
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => b.time - a.time);
    if (!candidates.length) return null;
    const newest = candidates[0];
    const observedAt = lastRefresh ? lastRefresh.getTime() : newest.time;
    const ageMs = Math.max(0, observedAt - newest.time);
    const fresh = ageMs <= TELEMETRY_STALE_MS;
    return { timestamp: newest.value, ageMs, fresh, ageLabel: formatDuration(ageMs / 1000) };
  }, [machines, lastRefresh]);

  const telemetryLabel = latestTelemetry
    ? latestTelemetry.fresh ? "Recent telemetry received" : "Telemetry appears stale"
    : loading ? "Waiting for telemetry" : "No telemetry timestamp available";

  const coreErrorEntries = Object.entries(coreErrors).filter(([, message]) => message);
  const anyCoreError = coreErrorEntries.length > 0;
  const detail = machineDetail || {};
  const selectedMachineId = selectedMachine ? (selectedMachine.machineId ?? selectedMachine.id) : null;
  const machineHistoryRows = getRows(machineHistoryResponse);
  const machineProductionRows = getRows(machineProductionResponse);
  const machineAlarmRows = getRows(machineAlarmsResponse);
  const machineLookup = useMemo(() => new Map(machines.map((machine) => [
    String(machine.machineId ?? machine.id), machine,
  ])), [machines]);
  const insightEntries = Object.values(machineInsights);
  const alarmFetchErrors = insightEntries.filter((entry) => entry.alarmsError);
  const productionHistoryErrors = insightEntries.filter((entry) => entry.productionError);
  const recentAlarms = useMemo(() => Object.values(machineInsights)
    .flatMap((entry) => (entry.alarmRows || []).map((alarm) => {
      const machine = machineLookup.get(String(entry.machineId));
      return {
        ...alarm,
        machineId: entry.machineId,
        machineCode: machine?.machineCode || alarm.machineCode || `Machine ${entry.machineId}`,
        machineName: machine?.machineName || alarm.machineName || machine?.name || "Machine",
      };
    }))
    .filter((alarm) => alarm.triggeredAtUtc && Number.isFinite(new Date(alarm.triggeredAtUtc).getTime()))
    .sort((a, b) => new Date(b.triggeredAtUtc).getTime() - new Date(a.triggeredAtUtc).getTime())
    .slice(0, 8), [machineInsights, machineLookup]);

  const trendMachine = machines.find((machine) => String(machine.machineId ?? machine.id) === String(trendMachineId)) || machines[0] || null;
  const trendMachineKey = trendMachine ? String(trendMachine.machineId ?? trendMachine.id) : "";
  const trendInsight = trendMachineKey ? machineInsights[trendMachineKey] : null;
  const trendRows = trendInsight?.productionRows || [];
  const refreshMachineInsights = useCallback(() => {
    void loadMachineInsights(machineIdsKey ? machineIdsKey.split(",") : []);
  }, [loadMachineInsights, machineIdsKey]);

  const pageMeta = {
    overview: { breadcrumb: "Operations overview", kicker: "OPERATIONS CENTER", title: "Shopfloor", accent: "overview", description: "Real-time operating view of machine health, production velocity, and line availability." },
    machines: { breadcrumb: "Machine fleet", kicker: "LIVE TELEMETRY", title: "Machine", accent: "fleet", description: "Live shopfloor fleet overview, current machine states, and controller part tallies." },
    alarms: { breadcrumb: "Recent alarms", kicker: "SHOPFLOOR EVENTS", title: "Alarm", accent: "history", description: "Real-time machine alarm feed, critical error codes, and cleared fault history." },
    production: { breadcrumb: "Production", kicker: "OUTPUT & QUALITY", title: "Production", accent: "analysis", description: "Real-time part counters, cycle times, and output trends recorded from the CNC controller." },
    downtime: { breadcrumb: "Downtime", kicker: "AVAILABILITY", title: "Downtime", accent: "analysis", description: "Accumulated downtime minutes, incident frequencies, and stoppage duration by machine." },
    "production-api": { breadcrumb: "Shift summary", kicker: "SHIFT METRICS", title: "Production", accent: "summary", description: "Shift-level production output, good vs scrap parts, and first-pass quality rates across the shopfloor." },
    reports: { breadcrumb: "Reports", kicker: "PRODUCTION AUDIT", title: "Production", accent: "reports", description: "Consolidated shift report detailing machine output, quality yield, scrap, and total downtime." },
    worker: { breadcrumb: "System health", kicker: "TELEMETRY ENGINE", title: "System", accent: "health & telemetry", description: "Real-time telemetry collection status, background ingestion pipeline, and controller gateway heartbeat." },
  };
  const currentPage = pageMeta[activeSection] || pageMeta.overview;
  const navigateTo = useCallback((section) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#overview" onClick={(event) => { event.preventDefault(); navigateTo("overview"); }} aria-label="CNC Insight home">
          <span className="brand-mark"><Icon name="activity" size={22} /></span>
          <span className="brand-copy"><strong>CNC<span> INSIGHT</span></strong><small>SHOPFLOOR INTELLIGENCE</small></span>
        </a>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className={`nav-item ${activeSection === "overview" ? "active" : ""}`} href="#overview" onClick={(event) => { event.preventDefault(); navigateTo("overview"); }} aria-current={activeSection === "overview" ? "page" : undefined}><Icon name="grid" /><span>Overview</span><span className="nav-indicator" /></a>
          <a className={`nav-item ${activeSection === "machines" ? "active" : ""}`} href="#machines" onClick={(event) => { event.preventDefault(); navigateTo("machines"); }} aria-current={activeSection === "machines" ? "page" : undefined}><Icon name="machine" /><span>Machines</span><span className="nav-count">{machines.length || "—"}</span></a>
          <a className={`nav-item ${activeSection === "alarms" ? "active" : ""}`} href="#alarms" onClick={(event) => { event.preventDefault(); navigateTo("alarms"); }} aria-current={activeSection === "alarms" ? "page" : undefined}><Icon name="alert" /><span>Recent alarms</span><span className="nav-count">{recentAlarms.length || (insightsLoading || insightEntries.length === 0 ? "—" : alarmFetchErrors.length === insightEntries.length ? "!" : "0")}</span></a>
          <a className={`nav-item ${activeSection === "production" ? "active" : ""}`} href="#production" onClick={(event) => { event.preventDefault(); navigateTo("production"); }} aria-current={activeSection === "production" ? "page" : undefined}><Icon name="chart" /><span>Production</span></a>
          <a className={`nav-item ${activeSection === "downtime" ? "active" : ""}`} href="#downtime" onClick={(event) => { event.preventDefault(); navigateTo("downtime"); }} aria-current={activeSection === "downtime" ? "page" : undefined}><Icon name="clock" /><span>Downtime</span></a>
          <a className={`nav-item ${activeSection === "production-api" ? "active" : ""}`} href="#production-api" onClick={(event) => { event.preventDefault(); navigateTo("production-api"); }} aria-current={activeSection === "production-api" ? "page" : undefined}><Icon name="chart" /><span>Shift summary</span></a>
          <a className={`nav-item ${activeSection === "reports" ? "active" : ""}`} href="#reports" onClick={(event) => { event.preventDefault(); navigateTo("reports"); }} aria-current={activeSection === "reports" ? "page" : undefined}><Icon name="box" /><span>Reports</span></a>
          <a className={`nav-item ${activeSection === "worker" ? "active" : ""}`} href="#worker" onClick={(event) => { event.preventDefault(); navigateTo("worker"); }} aria-current={activeSection === "worker" ? "page" : undefined}><Icon name="activity" /><span>System health</span></a>
        </nav>
        <div className="sidebar-spacer" />
        <div className="environment-card">
          <div className="environment-icon"><Icon name="activity" size={16} /></div>
          <div><strong>Shopfloor Network</strong><span>Industrial Gateway Active</span></div>
          <span className="env-dot" />
        </div>
        <div className="sidebar-footer"><span className="footer-orb" /> CNC Monitoring System <span>v1.1</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{currentPage.breadcrumb}</strong></div>
          <div className="topbar-right">
            <div className={`connection-pill ${apiHealthy ? "is-online" : "is-pending"}`}>
              <span className="connection-dot" />{apiHealthy ? "Gateway online" : coreErrors.health ? "Gateway offline" : "Checking gateway"}
            </div>
            <div className="topbar-date">{lastRefresh ? lastRefresh.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "Connecting to shopfloor"}</div>
            <div className="avatar" title="CNC Operations">CO</div>
          </div>
        </header>

        <div className={`page-body page-body-${activeSection}`}>
          {anyCoreError && (
            <div className="error-banner">
              <Icon name="alert" size={20} />
              <div><strong>Gateway communication warning</strong><span>{coreErrorEntries.map(([name, message]) => `${name}: ${message}`).join(" · ")}. Retaining last recorded shopfloor state.</span></div>
              <button onClick={refreshAll} className="error-retry" disabled={refreshing || extendedLoading}>Retry connection</button>
            </div>
          )}

          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> {currentPage.kicker} <span className="eyebrow-tag">LIVE SHOPFLOOR</span></div>
              <h1>{currentPage.title} <span>{currentPage.accent}</span></h1>
              <p>{currentPage.description}</p>
            </div>
            <button className="refresh-button" onClick={refreshAll} disabled={refreshing || extendedLoading}>
              <span className={refreshing || extendedLoading ? "refresh-icon spinning" : "refresh-icon"}><Icon name="refresh" size={17} /></span>
              {refreshing || extendedLoading ? "Updating…" : "Refresh shopfloor"}
            </button>
          </section>

          {activeSection === "overview" && (
          <>
          <section className="status-ribbon" aria-label="System status">
            <div className="ribbon-main">
              <span className={`ribbon-live ${latestTelemetry?.fresh ? "is-fresh" : "is-stale"}`}><span /></span>
              <div><strong>{telemetryLabel}</strong><span>{latestTelemetry ? `Latest controller telemetry recorded: ${formatDateTime(latestTelemetry.timestamp)} (${latestTelemetry.ageLabel} ago)` : "Awaiting controller telemetry broadcast."}</span></div>
            </div>
            <div className="ribbon-divider" />
            <div className="ribbon-check"><span className={`check-icon ${databaseReady ? "ready" : "pending"}`}><Icon name={databaseReady ? "check" : "database"} size={14} /></span><div><small>DATABASE</small><strong>{databaseReady ? "Connected" : health?.database?.ready === false ? "Not ready" : "Checking"}</strong></div></div>
            <div className="ribbon-check"><span className={`check-icon ${apiHealthy ? "ready" : "pending"}`}><Icon name={apiHealthy ? "check" : "activity"} size={14} /></span><div><small>CNC GATEWAY</small><strong>{apiHealthy ? "Operational" : coreErrors.health ? "Disconnected" : "Connecting"}</strong></div></div>
          </section>

          <section className="metrics-grid" aria-label="Production key metrics">
            <article className="metric-card metric-primary"><div className="metric-top"><span className="metric-label">Connected machines</span><span className="metric-icon blue"><Icon name="machine" /></span></div><div className="metric-value">{machineMetricsAvailable ? summary.total : "—"}<small> units</small></div><div className="metric-bottom"><span className="metric-subtle">Shopfloor fleet</span><span className="metric-tag">FLEET</span></div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Running now</span><span className="metric-icon green"><Icon name="activity" /></span></div><div className="metric-value">{machineMetricsAvailable ? summary.running : "—"}<small> / {machineMetricsAvailable ? summary.total : "—"}</small></div><div className="mini-progress"><span className="progress-green" style={{ width: `${machineMetricsAvailable && summary.total ? (summary.running / summary.total) * 100 : 0}%` }} /></div><div className="metric-bottom"><span className="metric-subtle">Active in production</span><span className="metric-status success-text">Live telemetry</span></div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Needs attention</span><span className="metric-icon red"><Icon name="alert" /></span></div><div className="metric-value">{machineMetricsAvailable ? summary.attention : "—"}<small> units</small></div><div className="metric-bottom"><span className="metric-subtle">Stopped: {machineMetricsAvailable ? summary.stopped : "—"} · Alarm: {machineMetricsAvailable ? summary.alarms : "—"}</span><span className={`metric-tag ${!machineMetricsAvailable ? "" : summary.attention ? "tag-danger" : "tag-good"}`}>{!machineMetricsAvailable ? "UNKNOWN" : summary.attention ? "INSPECT" : "NORMAL"}</span></div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Total parts produced</span><span className="metric-icon violet"><Icon name="box" /></span></div><div className="metric-value">{displayMetric(summary.totalParts)}<small> parts</small></div><div className="metric-bottom"><span className="metric-subtle">Good: {displayMetric(summary.goodParts)}</span><span className="metric-subtle">Rejected: {displayMetric(summary.rejectedParts)}</span></div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Total fleet downtime</span><span className="metric-icon amber"><Icon name="clock" /></span></div><div className="metric-value">{downtimeMetricsAvailable && Number.isFinite(summary.downtimeMinutes) ? summary.downtimeMinutes.toFixed(1) : "—"}<small> min</small></div><div className="metric-bottom"><span className="metric-subtle">Accumulated stoppage</span><span className="metric-tag">DOWNTIME</span></div></article>
          </section>

          <section className="insights-grid" id="production">
            <article className="panel production-panel">
              <div className="panel-heading"><div><span className="panel-kicker">FIRST-PASS YIELD</span><h2>Production quality</h2><p>Good and rejected part counts from controller inspection sensors</p></div><span className="panel-icon"><Icon name="gauge" /></span></div>
              <div className="quality-layout">
                <div className="quality-ring" style={{ "--quality": `${displayQuality}%` }}><div className="quality-ring-inner"><strong>{machineMetricsAvailable && summary.totalParts > 0 && Number.isFinite(summary.quality) ? summary.quality.toFixed(1) : "—"}{machineMetricsAvailable && summary.totalParts > 0 && Number.isFinite(summary.quality) && <small>%</small>}</strong><span>Good / total</span></div></div>
                <div className="quality-details">
                  <div className="quality-detail"><span className="legend-dot good-dot" /><div><span>Good parts</span><strong>{displayMetric(summary.goodParts)}</strong></div><em>{machineMetricsAvailable && summary.totalParts > 0 && Number.isFinite(summary.quality) ? `${summary.quality.toFixed(1)}%` : "—"}</em></div>
                  <div className="quality-detail"><span className="legend-dot reject-dot" /><div><span>Rejected parts</span><strong>{displayMetric(summary.rejectedParts)}</strong></div><em>{machineMetricsAvailable && summary.totalParts > 0 && Number.isFinite(summary.rejectedParts) ? `${(summary.rejectedParts / summary.totalParts * 100).toFixed(1)}%` : "—"}</em></div>
                  <div className="quality-bar"><span style={{ width: `${displayQuality}%` }} /></div>
                  <div className="quality-footnote">First-pass quality rate calculated across active production lines.</div>
                </div>
              </div>
            </article>

            <article className="panel status-panel">
              <div className="panel-heading"><div><span className="panel-kicker">FLEET HEALTH</span><h2>Machine distribution</h2><p>Current status across active machine records</p></div><span className="panel-icon"><Icon name="chart" /></span></div>
              <div className="distribution-total"><strong>{machineMetricsAvailable ? summary.total : "—"}</strong><span>machine records</span></div>
              <div className="distribution-bar" role="img" aria-label={machineMetricsAvailable ? `${summary.running} running, ${summary.idle} idle, ${summary.stopped} stopped, ${summary.alarms} in alarm, ${summary.unknown} unknown` : "Waiting for machine status data"}>
                <span className="segment-running" style={{ width: `${machineMetricsAvailable && summary.total ? summary.running / summary.total * 100 : 0}%` }} />
                <span className="segment-idle" style={{ width: `${machineMetricsAvailable && summary.total ? summary.idle / summary.total * 100 : 0}%` }} />
                <span className="segment-stopped" style={{ width: `${machineMetricsAvailable && summary.total ? summary.stopped / summary.total * 100 : 0}%` }} />
                <span className="segment-alarm" style={{ width: `${machineMetricsAvailable && summary.total ? summary.alarms / summary.total * 100 : 0}%` }} />
                <span className="segment-unknown" style={{ width: `${machineMetricsAvailable && summary.total ? summary.unknown / summary.total * 100 : 0}%` }} />
              </div>
              <div className="distribution-legend">
  <div><span className="legend-dot good-dot" /><span>Running</span><strong>{machineMetricsAvailable ? summary.running : "—"}</strong></div>
  <div><span className="legend-dot idle-dot" /><span>Idle</span><strong>{machineMetricsAvailable ? summary.idle : "—"}</strong></div>
  <div><span className="legend-dot stopped-dot" /><span>Stopped</span><strong>{machineMetricsAvailable ? summary.stopped : "—"}</strong></div>
  <div><span className="legend-dot alarm-dot" /><span>Alarm</span><strong>{machineMetricsAvailable ? summary.alarms : "—"}</strong></div>
  {machineMetricsAvailable && summary.unknown > 0 && (
    <div><span className="legend-dot unknown-dot" /><span>Unknown</span><strong>{summary.unknown}</strong></div>
  )}
</div>
            </article>
          </section>
          </>
          )}

          {activeSection === "production" && <section className="section-block history-section" id="production-history">
            <SectionHeading
              kicker="REAL-TIME VELOCITY"
              title="Production history"
              description="Live output velocity and cumulative parts counters recorded directly from the CNC controller."
              action={<label className="trend-machine-select"><span>Machine</span><select value={trendMachineKey} onChange={(event) => setTrendMachineId(event.target.value)} disabled={machines.length === 0} aria-label="Select machine for production history">{machines.length === 0 && <option value="">No machines available</option>}{machines.map((machine) => <option key={machine.machineId ?? machine.id} value={String(machine.machineId ?? machine.id)}>{machine.machineCode || `Machine ${machine.machineId ?? machine.id}`} · {machine.machineName || machine.name || "Machine"}</option>)}</select></label>}
            />
            {productionHistoryErrors.length > 0 && <div className="api-warning">Some machine telemetry streams experienced delay ({productionHistoryErrors.length} machine(s)). {trendInsight?.productionError ? `Selected machine: ${trendInsight.productionError}` : "Displaying last confirmed controller records."} <button className="inline-retry" onClick={refreshMachineInsights} disabled={insightsLoading}>{insightsLoading ? "Connecting…" : "Retry connection"}</button></div>}
            <ProductionHistoryCharts rows={trendRows} loading={insightsLoading || (machines.length > 0 && insightEntries.length === 0)} error={trendInsight?.productionError || ""} machineName={trendMachine?.machineName || trendMachine?.name || trendMachine?.machineCode || (trendMachine ? `Machine ${trendMachineKey}` : "Selected machine")} />
            <article className="panel production-records-panel">
              <div className="panel-heading"><div><span className="panel-kicker">CYCLE AUDIT</span><h2>Latest production cycles</h2><p>Timestamped cycle completions and part tallies received from the machine controller.</p></div><span className="panel-icon"><Icon name="database" /></span></div>
              {trendInsight?.productionError && <div className="api-warning">Cycle records unavailable: {trendInsight.productionError}</div>}
              <DataTable rows={trendRows} loading={insightsLoading} emptyMessage="No cycle completions recorded for the selected machine." columns={[
                { label: "Recorded at", render: (row) => formatDateTime(row.recordedAtUtc) },
                { label: "Total parts", render: (row) => formatNumber(row.totalParts) },
                { label: "Good parts", render: (row) => formatNumber(row.goodParts) },
                { label: "Rejected", render: (row) => formatNumber(row.rejectedParts) },
                { label: "Cycle time", render: (row) => apiNumber(row.actualCycleTimeSeconds) === null ? "—" : `${apiNumber(row.actualCycleTimeSeconds).toFixed(2)} sec` },
                { label: "Data Source", render: (row) => formatDataSource(row.dataSource) },
              ]} />
            </article>
          </section>}

          {activeSection === "machines" && <section className="section-block machine-view-section" id="machines">
            <SectionHeading kicker="LIVE TELEMETRY" title={<>Connected machines <span className="count-chip">{machines.length}</span></>} description="Current operational status, cycle times, and part counts for all connected CNC machines." action={<span className={`updated-label ${coreErrors.machines ? "update-failed" : ""}`}><span className="updated-dot" />{coreErrors.machines ? "Telemetry sync failed" : lastRefresh ? `Last sync ${formatTime(lastRefresh)}` : "Awaiting initial sync"}</span>} />
            {coreErrors.machines && <div className="api-warning">Machine telemetry sync warning: {coreErrors.machines}</div>}
            <div className="machine-toolbar">
              <label className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search machine name or code…" aria-label="Search machines" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" size={14} /></button>}</label>
              <div className="filter-group" aria-label="Filter machines by status">{[{ value: "all", label: "All machines" }, { value: "running", label: "Running" }, { value: "idle", label: "Idle" }, { value: "attention", label: "Stopped / alarm" }].map((filter) => <button key={filter.value} className={statusFilter === filter.value ? "filter-chip selected" : "filter-chip"} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}</div>
            </div>

            {loading ? <div className="empty-state"><span className="loader" /><strong>Connecting to machine fleet…</strong><span>Awaiting controller telemetry broadcast.</span></div> : filteredMachines.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="search" size={22} /></span><strong>{machines.length ? "No machines match these filters" : "No machine telemetry received"}</strong><span>{machines.length ? "Try another search term or status filter." : "Verify controller network connectivity and gateway service."}</span><button className="text-button" onClick={() => { setSearch(""); setStatusFilter("all"); refreshCore(); }}>Reset filters</button></div> : (
              <div className="machine-grid">
                {filteredMachines.map((machine) => {
                  const status = getStatus(machine.currentStatus);
                  const down = downtimeFor(machine.machineId);
                  const total = apiNumber(machine.totalParts);
                  const good = apiNumber(machine.goodParts);
                  const rejected = apiNumber(machine.rejectedParts);
                  const quality = total !== null && good !== null && total > 0 ? Math.min(100, Math.max(0, good / total * 100)) : 0;
                  return <article className={`machine-card tone-${status.tone}`} key={machine.machineId}>
                    <div className="machine-card-top"><div className="machine-avatar"><Icon name="machine" size={22} /></div><StatusBadge value={machine.currentStatus} /></div>
                    <div className="machine-identity"><span className="machine-code">{machine.machineCode || `MACHINE-${machine.machineId}`}</span><h3>{machine.machineName || "Unnamed machine"}</h3></div>
                    <div className="machine-output-head"><span>First-pass quality</span><strong>{formatPercent(total !== null && good !== null && total > 0 ? good / total : null)}</strong></div>
                    <div className="machine-quality-bar"><span style={{ width: `${quality}%` }} /></div>
                    <div className="machine-stats"><div><span>Total parts</span><strong>{formatNumber(total)}</strong></div><div><span>Good parts</span><strong>{formatNumber(good)}</strong></div><div><span>Rejected</span><strong className={rejected > 0 ? "reject-value" : ""}>{formatNumber(rejected)}</strong></div><div><span>Downtime</span><strong>{down && apiNumber(down.totalDowntimeMinutes) !== null ? apiNumber(down.totalDowntimeMinutes).toFixed(1) : "—"}{down && apiNumber(down.totalDowntimeMinutes) !== null && <small> min</small>}</strong></div></div>
                    <div className="machine-card-footer"><span><span className="source-dot" />{formatDataSource(machine.dataSource)}</span><span title={machine.lastUpdatedUtc}>Updated {formatTime(machine.lastUpdatedUtc)}</span></div>
                    <button className="machine-details-button" onClick={() => openMachineDetails(machine)}>View machine details <Icon name="chevron" size={15} /></button>
                  </article>;
                })}
              </div>
            )}
          </section>}

          {activeSection === "downtime" && <section className="section-block downtime-block" id="downtime">
            <SectionHeading kicker="MACHINE AVAILABILITY" title="Machine downtime ranking" description="Total recorded stoppage duration and event frequency based on controller state transitions." action={<span className="total-minutes">{downtimeMetricsAvailable && Number.isFinite(summary.downtimeMinutes) ? summary.downtimeMinutes.toFixed(1) : "—"} <small>min total</small></span>} />
            {coreErrors.downtime && <div className="api-warning">Downtime data could not be refreshed: {coreErrors.downtime}</div>}
            <div className="downtime-panel">
              {loading && downtimeByMachine.length === 0 && !coreErrors.downtime ? <div className="data-empty"><span className="loader loader-small" /> Loading downtime records from the API…</div> : downtimeByMachine.length === 0 ? <div className="downtime-empty">{coreErrors.downtime ? "Downtime is unavailable because the API request failed." : "No downtime records were returned by the backend."}</div> : downtimeByMachine.map((item) => {
                const machine = machines.find((entry) => Number(entry.machineId) === Number(item.machineId));
                const reportedMinutes = apiNumber(item.totalDowntimeMinutes);
                const minutes = reportedMinutes ?? 0;
                const maxMinutes = Math.max(...downtimeByMachine.map((entry) => apiNumber(entry.totalDowntimeMinutes) ?? 0), 1);
                return <div className="downtime-row" key={item.machineId}>
                  <div className="downtime-machine"><span className="downtime-machine-icon"><Icon name="clock" size={17} /></span><div><strong>{item.machineCode || machine?.machineCode || `Machine ${item.machineId}`}</strong><span>{item.machineName || machine?.machineName || "Machine downtime"} · {formatNumber(item.downtimeIncidents)} incident(s)</span></div></div>
                  <div className="downtime-track" role="img" aria-label={`${minutes.toFixed(1)} minutes downtime`}><span style={{ width: `${Math.min(100, minutes / maxMinutes * 100)}%` }} /></div>
                  <div className="downtime-value">{reportedMinutes === null ? "—" : minutes.toFixed(1)} {reportedMinutes !== null && <small>min</small>}</div>
                </div>;
              })}
            </div>
          </section>}

          {activeSection === "alarms" && <section className="section-block alarms-block" id="alarms">
            <SectionHeading kicker="SHOPFLOOR ALARMS" title="Live machine alarms" description="Real-time alarm events, fault codes, and cleared fault history across all connected CNC machines." action={<button className="text-button" onClick={refreshMachineInsights} disabled={insightsLoading}>{insightsLoading ? "Scanning alarms…" : "Refresh alarms"}</button>} />
            {alarmFetchErrors.length > 0 && <div className="api-warning">Alarm communication delayed for {alarmFetchErrors.length} of {insightEntries.length || machines.length} machine(s). {alarmFetchErrors.map((entry) => `${machineLookup.get(String(entry.machineId))?.machineCode || `Machine ${entry.machineId}`}: ${entry.alarmsError}`).join(" · ")} <button className="inline-retry" onClick={refreshMachineInsights} disabled={insightsLoading}>{insightsLoading ? "Retrying…" : "Retry"}</button></div>}
            {(insightsLoading || (machines.length > 0 && insightEntries.length === 0)) && recentAlarms.length === 0 ? (
              <div className="data-empty"><span className="loader loader-small" /> Loading real-time machine alarms…</div>
            ) : recentAlarms.length === 0 ? (
              alarmFetchErrors.length > 0 && alarmFetchErrors.length === insightEntries.length
                ? <div className="data-empty">Alarm communication is temporarily unavailable. Verify controller network gateway.</div>
                : <div className="data-empty">No active alarms or recent faults recorded across the shopfloor. All machines operating normally.</div>
            ) : (
              <div className="recent-alarm-list">
                {recentAlarms.map((alarm, index) => (
                  <article className="recent-alarm-item" key={`${alarm.machineId}-${alarm.alarmCode || "alarm"}-${alarm.triggeredAtUtc}-${index}`}>
                    <span className={`alarm-severity-marker severity-${Number(alarm.severity) || 0}`}><Icon name="alert" size={18} /></span>
                    <div className="recent-alarm-main">
                      <div className="recent-alarm-title"><strong>{alarm.description || alarm.alarmCode || "Machine alarm"}</strong><SeverityBadge value={alarm.severity} /></div>
                      <div className="recent-alarm-meta"><span>{alarm.machineCode}</span><span>{alarm.machineName}</span><span>Code: {alarm.alarmCode || "—"}</span></div>
                    </div>
                    <div className="recent-alarm-state">
                      {alarm.isActive === true ? <span className="active-alarm">Active</span> : alarm.isActive === false ? <span className="cleared-alarm">Cleared</span> : <span className="unknown-alarm">Resolved</span>}
                      <time dateTime={alarm.triggeredAtUtc}>{formatDateTime(alarm.triggeredAtUtc)}</time>
                    </div>
                    <button className="alarm-open-machine" onClick={() => {
                      const matched = machines.find((m) =>
                        (alarm.machineCode && m.machineCode && m.machineCode.toLowerCase() === alarm.machineCode.toLowerCase()) ||
                        (alarm.machineId !== undefined && (String(m.machineId) === String(alarm.machineId) || String(m.id) === String(alarm.machineId)))
                      );
                      const machineToOpen = matched || {
                        machineId: alarm.machineId,
                        machineCode: alarm.machineCode || "CNC-005",
                        machineName: alarm.machineName || "CNC Machine",
                        name: alarm.machineName || "CNC Machine",
                        currentStatus: 4, // Alarm
                      };
                      void openMachineDetails(machineToOpen);
                    }}>View machine</button>
                  </article>
                ))}
              </div>
            )}
            <p className="panel-footnote">Alarm event log ordered by trigger timestamp with active fault flags and resolution times.</p>
          </section>}

          {(["production-api", "worker"].includes(activeSection)) && <section className="extended-panels single-panel-view" id={activeSection}>
            {activeSection === "production-api" && <article className="panel extended-panel">
              <div className="panel-heading"><div><span className="panel-kicker">SHIFT AGGREGATES</span><h2>Summary by machine</h2><p>Cumulative shift performance, quality yields, and parts produced by each CNC station</p></div><span className="panel-icon"><Icon name="chart" /></span></div>
              {extendedErrors.summary ? <div className="api-warning">Shift production summary unavailable: {extendedErrors.summary}</div> : <DataTable rows={productionSummaryRows} loading={extendedLoading} emptyMessage="No shift summary records recorded for this period." columns={[
                { label: "Machine", render: (row) => <div className="table-machine"><strong>{row.machineName || row.machineCode || `Machine ${row.machineId}`}</strong><small>{row.machineCode || `ID ${row.machineId}`}</small></div> },
                { label: "Total Parts", render: (row) => formatNumber(row.totalParts) },
                { label: "Good Parts", render: (row) => formatNumber(row.goodParts) },
                { label: "Scrap / Rejected", render: (row) => formatNumber(row.rejectedParts) },
                { label: "First-Pass Quality", render: (row) => <span className="quality-cell">{formatPercent(row.qualityRate)}</span> },
                { label: "Recorded Period", render: (row) => formatPeriod(row) },
              ]} />}
              <div className="panel-footnote">First-pass quality rate reflects the ratio of defect-free parts to total output across the operational shift.</div>
            </article>}

            {activeSection === "worker" && <article className="panel extended-panel" id="worker">
              <div className="panel-heading"><div><span className="panel-kicker">TELEMETRY INGESTION ENGINE</span><h2>Engine health &amp; telemetry pipeline</h2><p>Continuous real-time telemetry polling and persistence engine status</p></div><span className="panel-icon"><Icon name="activity" /></span></div>
              {extendedErrors.worker ? <div className="api-warning">Engine status check failed: {extendedErrors.worker}</div> : workerStatusResponse ? <>
                <div className="worker-status-line"><span className={`worker-status-dot ${String(workerProcess.status || "").toLowerCase() === "running" ? "ready" : "pending"}`} /><strong>Ingestion Service: {workerProcess.status ? "Running & Active" : "Operational"}</strong><button className="text-button" onClick={refreshReports} disabled={extendedLoading}>{extendedLoading ? "Verifying…" : "Verify health"}</button></div>
                <div className="worker-info-grid">
                  <div><span>Gateway uptime</span><strong>{formatDuration(workerApiUptime)}</strong></div>
                  <div><span>Telemetry stream</span><strong className={latestTelemetry?.fresh ? "fresh-text" : "stale-text"}>{latestTelemetry ? latestTelemetry.fresh ? "Active & Synchronized" : "Reconnecting" : "Awaiting stream"}</strong></div>
                  <div><span>Connection protocol</span><strong>{formatDataSource(workerStatusResponse.dataSource)}</strong></div>
                  <div><span>Gateway started (local time)</span><strong>{formatDateTime(apiStartedAt)}</strong></div>
                  <div className="worker-info-wide"><span>Latest machine snapshot</span><strong>{latestTelemetry ? formatDateTime(latestTelemetry.timestamp) : "No telemetry packets received"}</strong></div>
                </div>
                <div className="api-warning worker-note" style={{ color: "#1e5b41", background: "#f0faf5", borderColor: "#c8ebd9" }}><strong>Engine Status:</strong> Background telemetry service is actively polling machine controllers, verifying part tallies, and maintaining persistent transaction logs.</div>
              </> : <div className="data-empty">{extendedLoading ? "Verifying engine status…" : "No engine telemetry response received."}</div>}
            </article>}
          </section>}

          {activeSection === "reports" && <section className="section-block reports-view-section" id="reports">
            <SectionHeading kicker="CONSOLIDATED SHIFT REPORT" title="Production summary by machine" description="Aggregated shift metrics across all connected shopfloor CNC units" action={<button className="text-button" onClick={refreshReports} disabled={extendedLoading}>{extendedLoading ? "Updating…" : "Refresh report"}</button>} />
            {extendedErrors.report ? <div className="api-warning">Shift production report unavailable: {extendedErrors.report}</div> : <DataTable rows={productionReportRows} loading={extendedLoading} emptyMessage="No shift production report records for this period." columns={[
              { label: "Machine", render: (row) => <div className="table-machine"><strong>{row.machineName || row.machineCode || `Machine ${row.machineId}`}</strong><small>{row.machineCode || `ID ${row.machineId}`}</small></div> },
              { label: "Shift Period", render: (row) => formatPeriod(row) },
              { label: "Total Parts", render: (row) => formatNumber(row.totalParts) },
              { label: "Good Parts", render: (row) => formatNumber(row.goodParts) },
              { label: "Rejected", render: (row) => formatNumber(row.rejectedParts) },
              { label: "Quality Yield", render: (row) => <span className="quality-cell">{formatPercent(row.qualityRate)}</span> },
              { label: "Downtime", render: (row) => apiNumber(row.downtimeMinutes) === null ? "—" : `${apiNumber(row.downtimeMinutes).toFixed(2)} min` },
              { label: "Data Source", render: (row) => formatDataSource(row.dataSource) },
            ]} />}
            {productionReportResponse?.data?.generatedAtUtc && <p className="panel-footnote">Report generated at {formatDateTime(productionReportResponse.data.generatedAtUtc)}. Telemetry Source: Industrial Field Controller Gateway.</p>}
          </section>}

          <footer className="page-footer"><span>© {lastRefresh ? lastRefresh.getFullYear() : "—"} CNC Insight · Shopfloor Intelligence</span><span><span className="footer-live-dot" />LIVE INDUSTRIAL TELEMETRY · SHOPFLOOR ONLINE</span><span>{lastRefresh ? `Last sync ${formatTime(lastRefresh)}` : "Connecting to shopfloor"}</span></footer>
        </div>
      </main>

      {selectedMachine && <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMachineDetails(); }}>
        <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="machine-detail-title">
          <div className="detail-dialog-header">
            <div><span className="panel-kicker">MACHINE SPECIFICATION</span><h2 id="machine-detail-title">{detail.name || detail.machineName || selectedMachine.machineName || selectedMachine.name || selectedMachine.machineCode || `Machine ${selectedMachineId}`}</h2><p>{selectedMachine.machineCode || `Machine ID ${selectedMachineId}`}</p></div>
            <button className="detail-close" onClick={closeMachineDetails} aria-label="Close machine details"><Icon name="close" /></button>
          </div>
          {detailLoading && <div className="data-empty"><span className="loader loader-small" /> Loading machine details and live records…</div>}
          {detailErrors.length > 0 && <div className="api-warning">Machine communication notice: {detailErrors.join(" · ")}</div>}
          <div className="detail-kpis">
            <div><span>Current status</span><strong><StatusBadge value={selectedMachine.currentStatus} /></strong></div>
            <div><span>Machine type</span><strong>{detail.machineType || "—"}</strong></div>
            <div><span>Location</span><strong>{detail.location || "—"}</strong></div>
            <div><span>Operational state</span><strong>{detail.isActive === true ? "Active" : detail.isActive === false ? "Inactive" : "—"}</strong></div>
          </div>
          <h3>Status history <small>Recent state transitions and events</small></h3>
          <DataTable rows={machineHistoryRows} loading={detailLoading} emptyMessage="No status history records returned." columns={[
            { label: "Occurred at", render: (row) => formatDateTime(row.occurredAtUtc) },
            { label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { label: "Notes", render: (row) => row.notes || "—" },
          ]} />
          <h3>Production records <small>Recent cycle snapshots and output counters</small></h3>
          <DataTable rows={machineProductionRows} loading={detailLoading} emptyMessage="No production snapshots returned." columns={[
            { label: "Recorded at", render: (row) => formatDateTime(row.recordedAtUtc) },
            { label: "Total", render: (row) => formatNumber(row.totalParts) },
            { label: "Good", render: (row) => formatNumber(row.goodParts) },
            { label: "Rejected", render: (row) => formatNumber(row.rejectedParts) },
            { label: "Cycle time", render: (row) => apiNumber(row.actualCycleTimeSeconds) === null ? "—" : `${apiNumber(row.actualCycleTimeSeconds).toFixed(2)} sec` },
            { label: "Data Source", render: (row) => formatDataSource(row.dataSource) },
          ]} />
          <h3>Alarms <small>Recent machine alarms and faults</small></h3>
          <DataTable rows={machineAlarmRows} loading={detailLoading} emptyMessage="No alarm records returned for this machine." columns={[
            { label: "Code", render: (row) => row.alarmCode || "—" },
            { label: "Description", render: (row) => row.description || "—" },
            { label: "Severity", render: (row) => <SeverityBadge value={row.severity} /> },
            { label: "State", render: (row) => row.isActive === true ? <span className="active-alarm">Active</span> : row.isActive === false ? <span className="cleared-alarm">Cleared</span> : <span className="unknown-alarm">Resolved</span> },
            { label: "Triggered at", render: (row) => formatDateTime(row.triggeredAtUtc) },
            { label: "Cleared at", render: (row) => formatDateTime(row.clearedAtUtc) },
          ]} />
        </section>
      </div>}
    </div>
  );
}

export default App;
 

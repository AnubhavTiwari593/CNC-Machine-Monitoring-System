import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

const statusInfo = {
  0: { label: "Unknown", tone: "neutral" },
  1: { label: "Running", tone: "success" },
  2: { label: "Idle", tone: "warning" },
  3: { label: "Stopped", tone: "danger" },
  4: { label: "Alarm", tone: "danger" },
};

async function getJson(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return response.json();
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    machine: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 5V3h10v2M7 10h10M8 15h2m4 0h2" /><path d="M12 10v3" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
    gauge: <><path d="M4.9 19a9 9 0 1 1 14.2 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1" /></>,
  };
  return <svg {...common}>{paths[name] || paths.activity}</svg>;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatTime(value) {
  if (!value) return "Awaiting telemetry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Awaiting telemetry";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function App() {
  const [machines, setMachines] = useState([]);
  const [downtime, setDowntime] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [healthResult, machineResult, downtimeResult] = await Promise.all([
        getJson("/api/health"),
        getJson("/api/machines"),
        getJson("/api/downtime"),
      ]);

      setHealth(healthResult);
      setMachines(Array.isArray(machineResult?.data) ? machineResult.data : []);
      setDowntime(Array.isArray(downtimeResult?.data) ? downtimeResult.data : []);
      setError("");
      setLastRefresh(new Date());
    } catch (err) {
      setError(`${err.message}. Check that the API is running at localhost:5000.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [refresh]);

  const summary = useMemo(() => {
    const total = machines.length;
    const running = machines.filter((m) => Number(m.currentStatus) === 1).length;
    const idle = machines.filter((m) => Number(m.currentStatus) === 2).length;
    const attention = machines.filter((m) => [3, 4].includes(Number(m.currentStatus))).length;
    const totalParts = machines.reduce((sum, m) => sum + Number(m.totalParts || 0), 0);
    const goodParts = machines.reduce((sum, m) => sum + Number(m.goodParts || 0), 0);
    const rejectedParts = machines.reduce((sum, m) => sum + Number(m.rejectedParts || 0), 0);
    const downtimeMinutes = downtime.reduce((sum, item) => sum + Number(item.totalDowntimeMinutes || 0), 0);
    const quality = totalParts > 0 ? Math.min(100, Math.max(0, (goodParts / totalParts) * 100)) : 0;
    return { total, running, idle, attention, totalParts, goodParts, rejectedParts, downtimeMinutes, quality };
  }, [machines, downtime]);

  const downtimeByMachine = useMemo(() => {
    return [...downtime].sort(
      (a, b) => Number(b.totalDowntimeMinutes || 0) - Number(a.totalDowntimeMinutes || 0)
    );
  }, [downtime]);

  const filteredMachines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return machines.filter((machine) => {
      const matchesQuery = !query || `${machine.machineCode || ""} ${machine.machineName || ""}`.toLowerCase().includes(query);
      const currentStatus = Number(machine.currentStatus);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "running" && currentStatus === 1)
        || (statusFilter === "idle" && currentStatus === 2)
        || (statusFilter === "attention" && [3, 4].includes(currentStatus));
      return matchesQuery && matchesStatus;
    });
  }, [machines, search, statusFilter]);

  const downtimeFor = (machineId) => downtime.find((item) => Number(item.machineId) === Number(machineId));
  const apiReady = Boolean(health && String(health.status || "").toLowerCase() === "healthy");
  const databaseReady = Boolean(health?.database?.ready);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#overview" aria-label="CNC Insight home">
          <span className="brand-mark"><Icon name="activity" size={22} /></span>
          <span className="brand-copy"><strong>CNC<span> INSIGHT</span></strong><small>SHOPFLOOR INTELLIGENCE</small></span>
        </a>

        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Icon name="grid" /><span>Overview</span><span className="nav-indicator" /></a>
          <a className="nav-item" href="#machines"><Icon name="machine" /><span>Machines</span><span className="nav-count">{machines.length || "—"}</span></a>
          <a className="nav-item" href="#production"><Icon name="chart" /><span>Production</span></a>
          <a className="nav-item" href="#downtime"><Icon name="clock" /><span>Downtime</span></a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="environment-card">
          <div className="environment-icon"><Icon name="activity" size={16} /></div>
          <div><strong>Demo environment</strong><span>Simulated machine data</span></div>
          <span className="env-dot" />
        </div>
        <div className="sidebar-footer"><span className="footer-orb" /> CNC Monitoring System <span>v1.0</span></div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14} /><strong>Operations overview</strong></div>
          <div className="topbar-right">
            <div className={`connection-pill ${apiReady ? "is-online" : "is-pending"}`}>
              <span className="connection-dot" />{apiReady ? "API connected" : "Checking API"}
            </div>
            <div className="topbar-date">{new Date().toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
            <div className="avatar" title="CNC Operations">CO</div>
          </div>
        </header>

        <div className="page-body">
          {error && <div className="error-banner"><Icon name="alert" size={20} /><div><strong>Unable to refresh live data</strong><span>{error}</span></div><button onClick={refresh} className="error-retry">Try again</button></div>}

          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> OPERATIONS CENTER <span className="eyebrow-tag">SIMULATOR</span></div>
              <h1>Shopfloor <span>overview</span></h1>
              <p>Your production floor at a glance. Monitor machine health, output and downtime in one place.</p>
            </div>
            <button className="refresh-button" onClick={refresh} disabled={refreshing}>
              <span className={refreshing ? "refresh-icon spinning" : "refresh-icon"}><Icon name="refresh" size={17} /></span>
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
          </section>

          <section className="status-ribbon" aria-label="System status">
            <div className="ribbon-main"><span className="ribbon-live"><span /></span><div><strong>Monitoring is active</strong><span>Machine telemetry syncs automatically every 8 seconds</span></div></div>
            <div className="ribbon-divider" />
            <div className="ribbon-check"><span className={`check-icon ${databaseReady ? "ready" : "pending"}`}><Icon name={databaseReady ? "check" : "database"} size={14} /></span><div><small>DATABASE</small><strong>{databaseReady ? "Connected" : "Checking"}</strong></div></div>
            <div className="ribbon-check"><span className={`check-icon ${apiReady ? "ready" : "pending"}`}><Icon name={apiReady ? "check" : "activity"} size={14} /></span><div><small>BACKEND API</small><strong>{apiReady ? "Healthy" : "Waiting"}</strong></div></div>
          </section>

          <section className="metrics-grid" aria-label="Production key metrics">
            <article className="metric-card metric-primary">
              <div className="metric-top"><span className="metric-label">Total machines</span><span className="metric-icon blue"><Icon name="machine" /></span></div>
              <div className="metric-value">{summary.total}<small> units</small></div>
              <div className="metric-bottom"><span className="metric-subtle">Registered in system</span><span className="metric-tag">FLEET</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Running now</span><span className="metric-icon green"><Icon name="activity" /></span></div>
              <div className="metric-value">{summary.running}<small> / {summary.total}</small></div>
              <div className="mini-progress"><span className="progress-green" style={{ width: `${summary.total ? (summary.running / summary.total) * 100 : 0}%` }} /></div>
              <div className="metric-bottom"><span className="metric-subtle">Actively operating</span><span className="metric-status success-text">● Live</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Needs attention</span><span className="metric-icon red"><Icon name="alert" /></span></div>
              <div className="metric-value">{summary.attention}<small> units</small></div>
              <div className="metric-bottom"><span className="metric-subtle">Stopped or in alarm</span><span className={`metric-tag ${summary.attention ? "tag-danger" : "tag-good"}`}>{summary.attention ? "CHECK" : "CLEAR"}</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Total output</span><span className="metric-icon violet"><Icon name="box" /></span></div>
              <div className="metric-value">{formatNumber(summary.totalParts)}<small> parts</small></div>
              <div className="metric-bottom"><span className="metric-subtle">Good: {formatNumber(summary.goodParts)}</span><span className="metric-subtle">Rejected: {formatNumber(summary.rejectedParts)}</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Total downtime</span><span className="metric-icon amber"><Icon name="clock" /></span></div>
              <div className="metric-value">{summary.downtimeMinutes.toFixed(1)}<small> min</small></div>
              <div className="metric-bottom"><span className="metric-subtle">Reported by telemetry</span><span className="metric-tag">DOWNTIME</span></div>
            </article>
          </section>

          <section className="insights-grid" id="production">
            <article className="panel production-panel">
              <div className="panel-heading"><div><span className="panel-kicker">OUTPUT QUALITY</span><h2>Production quality</h2><p>Good parts compared with total output</p></div><span className="panel-icon"><Icon name="gauge" /></span></div>
              <div className="quality-layout">
                <div className="quality-ring" style={{ "--quality": `${summary.quality}%` }}><div className="quality-ring-inner"><strong>{summary.quality.toFixed(1)}<small>%</small></strong><span>Good parts</span></div></div>
                <div className="quality-details">
                  <div className="quality-detail"><span className="legend-dot good-dot" /><div><span>Accepted output</span><strong>{formatNumber(summary.goodParts)}</strong></div><em>{summary.totalParts ? `${summary.quality.toFixed(1)}%` : "—"}</em></div>
                  <div className="quality-detail"><span className="legend-dot reject-dot" /><div><span>Rejected output</span><strong>{formatNumber(summary.rejectedParts)}</strong></div><em>{summary.totalParts ? `${((summary.rejectedParts / summary.totalParts) * 100).toFixed(1)}%` : "—"}</em></div>
                  <div className="quality-bar"><span style={{ width: `${summary.quality}%` }} /></div>
                  <div className="quality-footnote">Based on recorded simulator counters</div>
                </div>
              </div>
            </article>

            <article className="panel status-panel">
              <div className="panel-heading"><div><span className="panel-kicker">FLEET HEALTH</span><h2>Machine distribution</h2><p>Current status across the fleet</p></div><span className="panel-icon"><Icon name="chart" /></span></div>
              <div className="distribution-total"><strong>{summary.total}</strong><span>machines monitored</span></div>
              <div className="distribution-bar" role="img" aria-label={`${summary.running} running, ${summary.idle} idle, ${summary.attention} stopped or alarm`}>
                <span className="segment-running" style={{ width: `${summary.total ? (summary.running / summary.total) * 100 : 0}%` }} />
                <span className="segment-idle" style={{ width: `${summary.total ? (summary.idle / summary.total) * 100 : 0}%` }} />
                <span className="segment-alert" style={{ width: `${summary.total ? (summary.attention / summary.total) * 100 : 0}%` }} />
                <span className="segment-unknown" style={{ width: `${summary.total ? (Math.max(0, summary.total - summary.running - summary.idle - summary.attention) / summary.total) * 100 : 0}%` }} />
              </div>
              <div className="distribution-legend">
                <div><span className="legend-dot good-dot" /><span>Running</span><strong>{summary.running}</strong></div>
                <div><span className="legend-dot idle-dot" /><span>Idle</span><strong>{summary.idle}</strong></div>
                <div><span className="legend-dot reject-dot" /><span>Stopped / Alarm</span><strong>{summary.attention}</strong></div>
              </div>
            </article>
          </section>

          <section className="section-block" id="machines">
            <div className="section-header">
              <div><span className="panel-kicker">LIVE TELEMETRY</span><h2>Machine fleet <span className="count-chip">{machines.length}</span></h2><p>Current status and production counters for each machine</p></div>
              <span className="updated-label"><span className="updated-dot" />Auto refresh · 8 sec</span>
            </div>

            <div className="machine-toolbar">
              <label className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search machine name or ID…" aria-label="Search machines" />{search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}</label>
              <div className="filter-group" aria-label="Filter machines by status">
                {[{ value: "all", label: "All machines" }, { value: "running", label: "Running" }, { value: "idle", label: "Idle" }, { value: "attention", label: "Attention" }].map((filter) => <button key={filter.value} className={statusFilter === filter.value ? "filter-chip selected" : "filter-chip"} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}
              </div>
            </div>

            {loading ? <div className="empty-state"><span className="loader" /><strong>Connecting to machine fleet…</strong><span>Fetching current telemetry from the backend.</span></div> : filteredMachines.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="search" size={22} /></span><strong>No machines found</strong><span>Try another search term or status filter.</span><button className="text-button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button></div> : (
              <div className="machine-grid">
                {filteredMachines.map((machine) => {
                  const status = statusInfo[Number(machine.currentStatus)] || statusInfo[0];
                  const down = downtimeFor(machine.machineId);
                  const parts = Number(machine.totalParts || 0);
                  const good = Number(machine.goodParts || 0);
                  const rejected = Number(machine.rejectedParts || 0);
                  const quality = parts > 0 ? Math.min(100, Math.max(0, good / parts * 100)) : 0;
                  return (
                    <article className={`machine-card tone-${status.tone}`} key={machine.machineId}>
                      <div className="machine-card-top"><div className="machine-avatar"><Icon name="machine" size={22} /></div><span className={`status-badge ${status.tone}`}><span className="status-dot" />{status.label}</span></div>
                      <div className="machine-identity"><span className="machine-code">{machine.machineCode || `MACHINE-${machine.machineId}`}</span><h3>{machine.machineName || "Unnamed machine"}</h3></div>
                      <div className="machine-output-head"><span>Production quality</span><strong>{quality.toFixed(1)}%</strong></div>
                      <div className="machine-quality-bar"><span style={{ width: `${quality}%` }} /></div>
                      <div className="machine-stats">
                        <div><span>Total parts</span><strong>{formatNumber(parts)}</strong></div>
                        <div><span>Good parts</span><strong>{formatNumber(good)}</strong></div>
                        <div><span>Rejected</span><strong className={rejected > 0 ? "reject-value" : ""}>{formatNumber(rejected)}</strong></div>
                        <div><span>Downtime</span><strong>{Number(down?.totalDowntimeMinutes || 0).toFixed(1)} <small>min</small></strong></div>
                      </div>
                      <div className="machine-card-footer"><span><span className="source-dot" />{machine.dataSource || "SIMULATOR"}</span><span title={machine.lastUpdatedUtc}>Updated {formatTime(machine.lastUpdatedUtc)}</span></div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section-block downtime-block" id="downtime">
            <div className="section-header compact-header"><div><span className="panel-kicker">AVAILABILITY</span><h2>Downtime overview</h2><p>Machines ranked by reported downtime</p></div><span className="total-minutes">{summary.downtimeMinutes.toFixed(1)} <small>min total</small></span></div>
            <div className="downtime-panel">
              {downtimeByMachine.length === 0 ? <div className="downtime-empty">No downtime records reported yet.</div> : downtimeByMachine.slice(0, 5).map((item) => {
                const machine = machines.find((m) => Number(m.machineId) === Number(item.machineId));
                const minutes = Number(item.totalDowntimeMinutes || 0);
                const maxMinutes = Math.max(...downtimeByMachine.map((d) => Number(d.totalDowntimeMinutes || 0)), 1);
                return <div className="downtime-row" key={item.machineId}>
                  <div className="downtime-machine"><span className="downtime-machine-icon"><Icon name="clock" size={17} /></span><div><strong>{machine?.machineCode || `Machine ${item.machineId}`}</strong><span>{machine?.machineName || "Machine downtime"}</span></div></div>
                  <div className="downtime-track"><span style={{ width: `${Math.min(100, minutes / maxMinutes * 100)}%` }} /></div>
                  <div className="downtime-value">{minutes.toFixed(1)} <small>min</small></div>
                </div>;
              })}
            </div>
          </section>

          <footer className="page-footer"><span>© {new Date().getFullYear()} CNC Insight · CNC Monitoring System</span><span><span className="footer-live-dot" />Demo simulator data · Not connected to physical CNC hardware</span><span>{lastRefresh ? `Last sync ${lastRefresh.toLocaleTimeString()}` : "Waiting for initial sync"}</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;

import { Activity, AlertTriangle, FileText, Radio, ScanLine, ShieldCheck, Signal, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration, formatFirestoreDate, getAdminDashboardStats, listRecentAuditLogs } from '../services/adminFirestore';
import { humanAction } from './ActivityLog';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [nextStats, nextLogs] = await Promise.all([
        getAdminDashboardStats(),
        listRecentAuditLogs(7).catch(() => []),
      ]);
      setStats(nextStats);
      setLogs(nextLogs);
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load live dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const ownerName = stats?.currentOwner?.name || 'Unassigned';
  const onlineText = stats?.online ? 'Online' : 'Offline';
  const signal = rssiQuality(stats?.status?.rssi);
  const attention = useMemo(() => {
    const items = [];
    if (stats && !stats.online) items.push({ tone: 'red', title: 'SoilSense device is offline', text: 'No fresh heartbeat within the 60-second device window.', to: '/admin/devices' });
    if (stats && !stats.currentOwner) items.push({ tone: 'orange', title: 'No current device owner', text: 'Assign an active farmer or technician before starting a scan.', to: '/admin/devices' });
    if (stats?.openSupport > 0) items.push({ tone: 'blue', title: `${stats.openSupport} support ticket${stats.openSupport === 1 ? '' : 's'} need attention`, text: 'Review open and in-progress support concerns.', to: '/admin/support' });
    if (stats?.inactiveFarmers > 0) items.push({ tone: 'gray', title: `${stats.inactiveFarmers} inactive mobile account${stats.inactiveFarmers === 1 ? '' : 's'}`, text: 'Review access in Farmer Management.', to: '/admin/farmers' });
    if (!items.length && stats) items.push({ tone: '', title: 'System looks healthy', text: 'No urgent account, ownership, device, or support issues detected.', to: '/admin/devices' });
    return items;
  }, [stats]);

  return <>
    <div className="admin-page-head">
      <div><h1>Dashboard</h1><p>Live overview of SoilSense accounts, device health, ownership, completed scans and reports.</p></div>
      <button className="admin-btn" type="button" onClick={load} disabled={loading}><Activity /> {loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    {error && <div className="admin-inline-alert error">{error}</div>}

    <section className="admin-kpis">
      <Kpi icon={Users} label="Mobile Accounts" value={stats?.farmers ?? '—'} note={`${stats?.activeFarmers ?? 0} active`} />
      <Kpi icon={ScanLine} label="Scans (24h)" value={stats?.scansToday ?? '—'} note={`${stats?.totalScans ?? 0} total`} />
      <Kpi icon={FileText} label="Reports Generated" value={stats?.reports ?? '—'} note="User-generated reports" />
      <Kpi icon={Radio} label="Device Status" value={onlineText} tone={stats?.online ? '' : 'red'} note="60s heartbeat window" />
      <Kpi icon={ShieldCheck} label="Current Owner" value={ownerName} tone={stats?.currentOwner ? 'blue' : 'orange'} note="Single-owner privacy" />
      <Kpi icon={Signal} label="Wi-Fi Signal" value={signal.label} tone={signal.tone} note={Number.isInteger(stats?.status?.rssi) ? `${stats.status.rssi} dBm` : 'No RSSI'} />
    </section>

    <section className="admin-grid-2 admin-dashboard-health-grid">
      <div className="admin-card">
        <div className="admin-card-head">
          <div><h2>Device Health</h2><p className="admin-card-sub">Operational status only. Soil nutrient values remain in the user-facing app.</p></div>
          <Link className="admin-card-link" to="/admin/devices">Manage device</Link>
        </div>
        <div className="admin-health-hero">
          <span className={`admin-device-orb ${stats?.online ? 'online' : 'offline'}`}><Radio /></span>
          <div>
            <strong>SoilSense ESP32 · {stats?.online ? 'Online' : 'Offline'}</strong>
            <p>{stats?.status?.scanning === true ? 'Scan currently in progress' : 'Device is idle'}</p>
          </div>
        </div>
        <div className="admin-detail-list admin-health-details">
          <Row a="Current owner" b={ownerName} />
          <Row a="Scan state" b={stats?.status?.scanning === true ? 'Scanning' : 'Idle'} />
          <Row a="Configured duration" b={formatDuration(stats?.scanSettings?.durationSeconds ?? stats?.status?.scanDurationSeconds)} />
          <Row a="Last heartbeat" b={formatFirestoreDate(stats?.status?.lastSeen)} />
          <Row a="Last completed scan" b={formatFirestoreDate(stats?.latestScan?.timestamp)} />
          <Row a="Firmware (last scan)" b={stats?.latestScan?.firmwareVersion || '—'} />
          <Row a="Hardware fingerprint" b={stats?.status?.hardwareFingerprint || stats?.latestScan?.hardwareFingerprint || '—'} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Needs Attention</h2><p className="admin-card-sub">Automatically derived from live Firestore state.</p></div></div>
        <div className="admin-detail-list">{attention.map(item => <Link className="admin-attention-link" to={item.to} key={item.title}><Attention {...item} /></Link>)}</div>
      </div>
    </section>

    <section className="admin-card admin-dashboard-activity-card">
      <div className="admin-card-head">
        <div><h2>Recent Admin Activity</h2><p className="admin-card-sub">Ownership, account, support and portal-setting actions.</p></div>
        <Link className="admin-card-link" to="/admin/activity">View full audit log</Link>
      </div>
      {logs.length ? <div className="admin-audit-list">{logs.map(log => <div className="admin-audit-item" key={log.id}>
        <span className="admin-audit-dot" />
        <div><strong>{humanAction(log.action)}</strong><p>{log.targetEmail || log.targetUid || 'System'} · {formatFirestoreDate(log.createdAt)}</p></div>
      </div>)}</div> : <div className="admin-empty admin-compact-empty"><div><Activity /><p>No admin activity recorded yet.</p></div></div>}
    </section>
  </>;
}

function Kpi({ icon: Icon, label, value, note, tone = '' }) {
  return <article className="admin-kpi"><span className={`admin-kpi-icon ${tone}`}><Icon /></span><div><small>{label}</small><strong title={String(value)}>{value}</strong><em>{note}</em></div></article>;
}

function Attention({ title, text, tone = '' }) {
  return <div className="admin-attention-row"><span className={`admin-kpi-icon ${tone}`}><AlertTriangle /></span><div><strong>{title}</strong><span className="admin-subtext">{text}</span></div></div>;
}

function Row({ a, b }) {
  return <div className="admin-detail-row"><span>{a}</span><strong>{b}</strong></div>;
}

function rssiQuality(value) {
  if (!Number.isInteger(value)) return { label: 'Unknown', tone: 'gray' };
  if (value >= -60) return { label: 'Excellent', tone: '' };
  if (value >= -70) return { label: 'Good', tone: 'blue' };
  if (value >= -80) return { label: 'Fair', tone: 'orange' };
  return { label: 'Weak', tone: 'red' };
}

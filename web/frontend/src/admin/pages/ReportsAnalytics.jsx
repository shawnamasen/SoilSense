import { Activity, BellRing, Download, FileText, Radio, ScanLine, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { exportAnalyticsCsv, formatFirestoreDate, getReportsAnalytics } from '../services/adminFirestore';

export default function ReportsAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const next = await getReportsAnalytics();
      setData(next);
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load live analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const maxDaily = Math.max(1, ...(data?.dailyScans || []).map(item => item.count));
  const maxHour = Math.max(1, ...(data?.hourBuckets || []).map(item => item.count));
  const roleTotal = Math.max(1, (data?.farmers || 0) + (data?.technicians || 0));
  const activePct = data?.mobileUsers ? Math.round((data.activeUsers / data.mobileUsers) * 100) : 0;
  const deviceText = data?.deviceOnline ? 'Online' : 'Offline';

  const headline = useMemo(() => {
    if (!data) return 'Loading current usage…';
    if (data.scans7d === 0) return 'No completed scans were recorded in the last 7 days.';
    return `${data.scans7d} completed scan${data.scans7d === 1 ? '' : 's'} in the last 7 days, with ${data.scans24h} in the last 24 hours.`;
  }, [data]);

  return <>
    <div className="admin-page-head">
      <div><h1>Reports & Analytics</h1><p>Live system usage and operational metrics. This page intentionally avoids displaying individual farmers&apos; nutrient readings.</p></div>
      <div className="admin-actions">
        <button className="admin-btn" type="button" onClick={load} disabled={loading}><Activity /> {loading ? 'Refreshing…' : 'Refresh'}</button>
        <button className="admin-btn" type="button" disabled={!data} onClick={() => data && exportAnalyticsCsv(data)}><Download /> Export CSV</button>
      </div>
    </div>

    {error && <div className="admin-inline-alert error">{error}</div>}
    <div className="admin-inline-alert">{headline}</div>

    <section className="admin-kpis admin-kpis-five">
      <Metric icon={ScanLine} label="Total Completed Scans" value={data?.totalScans ?? '—'} note={`${data?.scans30d ?? 0} in 30 days`} />
      <Metric icon={Users} label="Active Mobile Accounts" value={data?.activeUsers ?? '—'} note={`${activePct}% of registered`} tone="blue" />
      <Metric icon={FileText} label="Reports Generated" value={data?.reports ?? '—'} note="User-generated reports" />
      <Metric icon={BellRing} label="Unread User Alerts" value={data?.unreadAlerts ?? '—'} note={`${data?.alerts ?? 0} total alerts`} tone={data?.unreadAlerts ? 'orange' : ''} />
      <Metric icon={Radio} label="Device Status" value={deviceText} note="60s heartbeat rule" tone={data?.deviceOnline ? '' : 'red'} />
    </section>

    <section className="admin-grid-2 admin-analytics-primary-grid">
      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Completed Scans · Last 7 Days</h2><p className="admin-card-sub">Counts are based on real soil_readings timestamps.</p></div></div>
        <div className="admin-bar-chart" aria-label="Completed scans over the last seven days">
          {(data?.dailyScans || []).map(item => <div className="admin-bar-column" key={item.key}>
            <strong>{item.count}</strong>
            <div className="admin-bar-track"><span style={{ height: `${Math.max(item.count ? 12 : 2, (item.count / maxDaily) * 100)}%` }} /></div>
            <small>{item.label}</small>
          </div>)}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Account Health</h2><p className="admin-card-sub">Registered mobile roles and access status.</p></div></div>
        <div className="admin-progress-group">
          <Progress label="Active accounts" value={data?.activeUsers || 0} total={data?.mobileUsers || 0} />
          <Progress label="Inactive accounts" value={data?.inactiveUsers || 0} total={data?.mobileUsers || 0} tone="red" />
          <Progress label="Farmers" value={data?.farmers || 0} total={roleTotal} tone="blue" />
          <Progress label="Technicians" value={data?.technicians || 0} total={roleTotal} tone="purple" />
        </div>
        <div className="admin-analytics-meta">
          <div><small>Registered mobile accounts</small><strong>{data?.mobileUsers ?? '—'}</strong></div>
          <div><small>Open support tickets</small><strong>{data?.openSupport ?? '—'}</strong></div>
        </div>
      </div>
    </section>

    <section className="admin-grid-2 admin-analytics-secondary-grid">
      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Scan Activity by Time of Day · Last 7 Days</h2><p className="admin-card-sub">Helps show when the system is actually being used.</p></div></div>
        <div className="admin-horizontal-bars">
          {(data?.hourBuckets || []).map(item => <div className="admin-horizontal-row" key={item.label}>
            <span>{item.label}</span>
            <div><i style={{ width: `${Math.max(item.count ? 7 : 0, (item.count / maxHour) * 100)}%` }} /></div>
            <strong>{item.count}</strong>
          </div>)}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Current Operational Snapshot</h2><p className="admin-card-sub">Device and data freshness without exposing private soil values.</p></div></div>
        <div className="admin-detail-list admin-analytics-snapshot">
          <Row a="Device" b={deviceText} />
          <Row a="Device state" b={data?.deviceStatus?.scanning === true ? 'Scanning' : 'Idle'} />
          <Row a="Latest heartbeat" b={formatFirestoreDate(data?.deviceStatus?.lastSeen)} />
          <Row a="Latest completed scan" b={formatFirestoreDate(data?.latestScan?.timestamp)} />
          <Row a="Firmware (latest scan)" b={data?.latestScan?.firmwareVersion || '—'} />
          <Row a="Current owner assigned" b={data?.currentOwnerUid ? 'Yes' : 'No'} />
          <Row a="Analytics refreshed" b={data?.generatedAt ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(data.generatedAt) : '—'} />
        </div>
      </div>
    </section>
  </>;
}

function Metric({ icon: Icon, label, value, note, tone = '' }) {
  return <article className="admin-kpi"><span className={`admin-kpi-icon ${tone}`}><Icon /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function Progress({ label, value, total, tone = '' }) {
  const pct = total ? Math.min(100, Math.max(0, Math.round((value / total) * 100))) : 0;
  return <div className="admin-progress-row">
    <div><span>{label}</span><strong>{value}</strong></div>
    <div className={`admin-progress-track ${tone}`}><i style={{ width: `${pct}%` }} /></div>
  </div>;
}

function Row({ a, b }) {
  return <div className="admin-detail-row"><span>{a}</span><strong>{b}</strong></div>;
}

import {
  Activity,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  Smartphone,
  Timer,
  Unlink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AdminKpi from '../components/AdminKpi';
import ConfirmDialog from '../components/ConfirmDialog';
import DetailRow from '../components/DetailRow';
import StatusBadge from '../components/StatusBadge';
import {
  assignCurrentOwner,
  clearCurrentOwner,
  devicePresence,
  formatDuration,
  formatFirestoreDate,
  getLatestScanMetadata,
  subscribeDeviceState,
  subscribeUsers,
} from '../services/adminFirestore';

export default function Devices() {
  const [users, setUsers] = useState([]);
  const [deviceState, setDeviceState] = useState({ status: null, assignment: null, scanSettings: null });
  const [latestScan, setLatestScan] = useState(null);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [confirm, setConfirm] = useState(null);

  useEffect(() => subscribeUsers(setUsers, err => setError(err?.message || 'Could not load users.')), []);
  useEffect(() => subscribeDeviceState(setDeviceState, err => setError(err?.message || 'Could not load device state.')), []);
  useEffect(() => {
    let active = true;
    async function loadLatestScan() {
      try {
        const next = await getLatestScanMetadata();
        if (active) setLatestScan(next);
      } catch (err) {
        if (active) setError(err?.message || 'Could not load latest scan metadata.');
      }
    }
    loadLatestScan();
    const timer = window.setInterval(loadLatestScan, 20_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const mobileUsers = useMemo(() => users.filter(user => ['farmer', 'technician'].includes(user.role)), [users]);
  const currentOwnerUid = String(deviceState.assignment?.currentOwnerUid || '');
  const currentOwner = mobileUsers.find(user => user.id === currentOwnerUid) || null;
  const presence = useMemo(() => devicePresence(deviceState.status), [deviceState.status, clock]);
  const search = queryText.trim().toLowerCase();
  const candidates = useMemo(() => mobileUsers.filter(user => {
    const matchesSearch = !search || `${user.name} ${user.email} ${user.uid}`.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? user.active : !user.active);
    return matchesSearch && matchesStatus;
  }), [mobileUsers, search, statusFilter]);

  const signal = rssiQuality(deviceState.status?.rssi);
  const heartbeatAge = Number.isFinite(presence.ageMs) ? `${Math.max(0, Math.round(presence.ageMs / 1000))}s ago` : 'Never';
  const durationSeconds = deviceState.scanSettings?.durationSeconds ?? deviceState.status?.scanDurationSeconds;
  const scanning = deviceState.status?.scanning === true;

  async function execute(key, action, success) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      window.setTimeout(() => setNotice(''), 4500);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy('');
      setConfirm(null);
    }
  }

  function requestOwner(user) {
    if (user.id === currentOwnerUid || !user.active) return;
    setConfirm({ type: 'assign', user });
  }

  function requestUnassign(user) {
    if (user.id !== currentOwnerUid) return;
    setConfirm({ type: 'unassign', user });
  }

  async function confirmOwnerChange() {
    if (!confirm?.user) return;
    const user = confirm.user;
    if (confirm.type === 'assign') {
      await execute(`owner-${user.id}`, () => assignCurrentOwner(user), `${user.name} is now the current SoilSense Owner.`);
      return;
    }
    await execute(`remove-${user.id}`, () => clearCurrentOwner(user), 'The SoilSense device is now unassigned.');
  }

  return <>
    <div className="admin-page-head">
      <div>
        <h1>Device Management</h1>
        <p>Live ESP32 health, scan state, 60-second heartbeat monitoring and single-owner assignment.</p>
      </div>
    </div>

    {notice && <div className="admin-inline-alert success">{notice}</div>}
    {error && <div className="admin-inline-alert error">{error}</div>}

    <section className="admin-kpis admin-kpis-five">
      <AdminKpi icon={Smartphone} label="Physical Devices" value="1" />
      <AdminKpi icon={presence.online ? Wifi : WifiOff} label="Connection" value={presence.online ? 'Online' : 'Offline'} tone={presence.online ? '' : 'red'} />
      <AdminKpi icon={scanning ? Activity : CheckCircle2} label="Scan State" value={scanning ? 'Scanning' : 'Idle'} tone={scanning ? 'orange' : ''} />
      <AdminKpi icon={Timer} label="Scan Duration" value={formatDuration(durationSeconds)} tone="blue" />
      <AdminKpi icon={Signal} label="Signal" value={signal.label} tone={signal.tone} />
    </section>

    <section className="admin-grid-2 admin-device-live-layout">
      <div className="admin-card admin-live-device-card">
        <div className="admin-card-head">
          <div><h2>SoilSense ESP32 Health</h2><p className="admin-card-sub">Live status from Firestore system/device_status and latest completed scan metadata.</p></div>
          <StatusBadge tone={presence.online ? '' : 'red'}>{presence.online ? 'Online' : 'Offline'}</StatusBadge>
        </div>
        <div className="admin-device-hero">
          <span className={`admin-device-orb ${presence.online ? 'online' : 'offline'}`}><Cpu /></span>
          <div>
            <strong>{deviceState.status?.hardwareFingerprint || latestScan?.hardwareFingerprint || 'Waiting for device heartbeat'}</strong>
            <p>{scanning ? `Scanning for up to ${formatDuration(durationSeconds)}` : presence.reason}</p>
          </div>
        </div>
        <div className="admin-detail-section admin-detail-list">
          <DetailRow label="Hardware Fingerprint" value={deviceState.status?.hardwareFingerprint || latestScan?.hardwareFingerprint || '—'} />
          <DetailRow label="Device State" value={scanning ? 'Scanning' : 'Idle'} />
          <DetailRow label="Configured Scan Duration" value={formatDuration(durationSeconds)} />
          <DetailRow label="Wi-Fi Setup Mode" value={deviceState.status?.setupMode === true ? 'Active' : 'Inactive'} />
          <DetailRow label="RSSI" value={Number.isInteger(deviceState.status?.rssi) ? `${deviceState.status.rssi} dBm (${signal.label})` : '—'} />
          <DetailRow label="Last Heartbeat" value={formatFirestoreDate(deviceState.status?.lastSeen)} />
          <DetailRow label="Heartbeat Age" value={heartbeatAge} />
          <DetailRow label="Last Completed Scan" value={formatFirestoreDate(latestScan?.timestamp)} />
          <DetailRow label="Firmware Version" value={latestScan?.firmwareVersion || '—'} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Current Owner</h2><p className="admin-card-sub">Exactly one active mobile account can receive future device scans.</p></div></div>
        {currentOwner ? <div className="admin-current-owner-card">
          <span className="admin-owner-icon"><ShieldCheck /></span>
          <div><strong>{currentOwner.name}</strong><p>{currentOwner.email}</p><span className="admin-status">Current Owner</span></div>
        </div> : <div className="admin-empty admin-owner-empty"><div><Unlink /><p>No account currently owns the device.</p></div></div>}
        {currentOwner && <button className="admin-btn danger admin-full-button" type="button" disabled={Boolean(busy)} onClick={() => requestUnassign(currentOwner)}><Unlink /> Set Not Owner / Unassign</button>}
        <div className="admin-device-privacy-note">
          <strong>Privacy behavior</strong>
          <p>Reassigning the device changes only who receives future scans. Existing private readings remain with their original account.</p>
        </div>
      </div>
    </section>

    <section className="admin-card admin-owner-management-card">
      <div className="admin-card-head">
        <div><h2>Owner / Not Owner</h2><p className="admin-card-sub">Assigning an Owner automatically makes every other mobile account Not Owner.</p></div>
      </div>
      <div className="admin-toolbar">
        <label className="admin-search"><Search /><input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Search account name, email or UID..." /></label>
        <select className="admin-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Device Access</th><th>Actions</th></tr></thead>
          <tbody>
            {candidates.map(user => {
              const owner = user.id === currentOwnerUid;
              return <tr key={user.id} className={owner ? 'admin-table-selected' : ''}>
                <td><strong className="admin-name">{user.name}</strong><span className="admin-subtext">{user.email}</span></td>
                <td><span className={`admin-status ${user.role === 'technician' ? 'purple' : 'blue'}`}>{capitalize(user.role)}</span></td>
                <td><span className={`admin-status ${user.active ? '' : 'red'}`}>{user.active ? 'Active' : 'Inactive'}</span></td>
                <td><span className={`admin-status ${owner ? '' : 'gray'}`}>{owner ? 'Owner' : 'Not Owner'}</span></td>
                <td className="admin-row-actions">
                  <button className={`admin-btn ${owner ? 'primary' : ''}`} type="button" disabled={Boolean(busy) || !user.active || owner} onClick={() => requestOwner(user)}>Owner</button>
                  <button className="admin-btn" type="button" disabled={Boolean(busy) || !owner} onClick={() => requestUnassign(user)}>Not Owner</button>
                </td>
              </tr>;
            })}
            {!candidates.length && <tr><td colSpan="5"><div className="admin-empty"><div><RefreshCw /><p>No accounts match this filter.</p></div></div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <ConfirmDialog
      open={Boolean(confirm)}
      title={confirm?.type === 'assign' ? 'Confirm device ownership' : 'Remove current owner?'}
      confirmLabel={confirm?.type === 'assign' ? 'Assign Owner' : 'Unassign Device'}
      tone={confirm?.type === 'unassign' ? 'danger' : 'primary'}
      busy={Boolean(busy)}
      onCancel={() => setConfirm(null)}
      onConfirm={confirmOwnerChange}
    >
      {confirm?.type === 'assign' ? <>
        <p>Assign <strong>{confirm?.user?.name}</strong> as the current SoilSense owner?</p>
        {currentOwner && <p>The existing owner, <strong>{currentOwner.name}</strong>, will immediately become Not Owner.</p>}
        <p>Previous users keep their existing private readings; only future completed scans go to the new owner.</p>
      </> : <>
        <p>Remove <strong>{confirm?.user?.name}</strong> as the current owner?</p>
        <p>The device will remain unassigned until an administrator selects another active account, and scans should not be started while no owner is assigned.</p>
      </>}
    </ConfirmDialog>
  </>;
}

function rssiQuality(value) {
  if (!Number.isInteger(value)) return { label: 'Unknown', tone: 'gray' };
  if (value >= -60) return { label: 'Excellent', tone: '' };
  if (value >= -70) return { label: 'Good', tone: 'blue' };
  if (value >= -80) return { label: 'Fair', tone: 'orange' };
  return { label: 'Weak', tone: 'red' };
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

import {
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAdminPreferences } from '../context/AdminPreferencesContext';
import {
  deleteSoilSenseAccount,
  exportUsersCsv,
  formatFirestoreDate,
  getUserMetrics,
  renameUser,
  setUserActive,
  setUserRole,
  subscribeUsers,
} from '../services/adminFirestore';

const EMPTY_METRICS = { readings: 0, reports: 0, alerts: 0, fields: 0 };

export default function Farmers() {
  const { preferences } = useAdminPreferences();
  const [users, setUsers] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => subscribeUsers(next => {
    setUsers(next);
    setLoading(false);
  }, err => {
    setError(err?.message || 'Could not load SoilSense users.');
    setLoading(false);
  }), []);

  const farmers = useMemo(() => users.filter(user => ['farmer', 'technician'].includes(user.role)), [users]);
  const selected = useMemo(() => farmers.find(user => user.id === selectedId) || null, [farmers, selectedId]);

  useEffect(() => {
    if (!selected) {
      setMetrics(EMPTY_METRICS);
      return undefined;
    }
    let active = true;
    setMetricsLoading(true);
    getUserMetrics(selected.id).then(value => {
      if (active) setMetrics(value);
    }).catch(err => {
      if (active) setError(err?.message || 'Could not load account usage.');
    }).finally(() => {
      if (active) setMetricsLoading(false);
    });
    return () => { active = false; };
  }, [selected?.id]);

  const filteredRows = useMemo(() => {
    const search = queryText.trim().toLowerCase();
    return farmers.filter(user => {
      const matchesSearch = !search || `${user.name} ${user.email} ${user.uid}`.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? user.active : !user.active);
      const matchesRole = roleFilter === 'All' || user.role === roleFilter.toLowerCase();
      const matchesOwner = ownerFilter === 'All' || (ownerFilter === 'Owner' ? user.isOwner : !user.isOwner);
      return matchesSearch && matchesStatus && matchesRole && matchesOwner;
    });
  }, [farmers, queryText, statusFilter, roleFilter, ownerFilter]);

  const perPage = preferences.itemsPerPage || 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const rows = filteredRows.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => setPage(1), [queryText, statusFilter, roleFilter, ownerFilter, perPage]);

  const summary = useMemo(() => ({
    total: farmers.length,
    active: farmers.filter(user => user.active).length,
    inactive: farmers.filter(user => !user.active).length,
    owner: farmers.filter(user => user.isOwner).length,
  }), [farmers]);

  function message(text) {
    setNotice(text);
    setError('');
    window.setTimeout(() => setNotice(''), 4500);
  }

  async function run(key, action, success) {
    setBusy(key);
    setError('');
    try {
      await action();
      message(success);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy('');
    }
  }

  async function handleRename() {
    if (!selected) return;
    const nextName = window.prompt('Enter the farmer name:', selected.name);
    if (nextName == null || nextName.trim() === selected.name) return;
    await run(`rename-${selected.id}`, () => renameUser(selected, nextName), 'Farmer name updated.');
  }

  async function handleDelete() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Delete ${selected.name}'s SoilSense account data?\n\nThis removes their profile, private readings, analyses, reports, alerts, fields, app preferences and push tokens. The action cannot be undone from this screen.`,
    );
    if (!confirmed) return;
    const phrase = window.prompt(`Type DELETE to confirm removal of ${selected.email}:`);
    if (phrase !== 'DELETE') return;
    await run(`delete-${selected.id}`, async () => {
      const result = await deleteSoilSenseAccount(selected);
      setSelectedId('');
      return result;
    }, 'SoilSense account and private data deleted.');
  }

  return <>
    <div className="admin-page-head">
      <div>
        <h1>Farmer Management</h1>
        <p>Live SoilSense mobile accounts. Review profiles, access status, roles, usage and account data.</p>
      </div>
      <div className="admin-actions">
        <button className="admin-btn" type="button" onClick={() => exportUsersCsv(filteredRows)} disabled={!filteredRows.length}>
          <Download /> Export CSV
        </button>
      </div>
    </div>

    <section className="admin-summary-grid admin-farmer-summary">
      <Summary label="Registered Users" value={summary.total} />
      <Summary label="Active" value={summary.active} tone="green" />
      <Summary label="Inactive" value={summary.inactive} tone="red" />
      <Summary label="Current Owner" value={summary.owner ? 'Assigned' : 'None'} tone="blue" />
    </section>

    {notice && <div className="admin-inline-alert success">{notice}</div>}
    {error && <div className="admin-inline-alert error">{error}</div>}

    <div className={selected ? 'admin-grid-2 admin-farmer-layout' : ''}>
      <section className="admin-card">
        <div className="admin-toolbar admin-toolbar-wrap">
          <label className="admin-search">
            <Search />
            <input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Search name, email or UID..." />
          </label>
          <Filter value={statusFilter} onChange={setStatusFilter} options={['All', 'Active', 'Inactive']} label="Status" />
          <Filter value={roleFilter} onChange={setRoleFilter} options={['All', 'Farmer', 'Technician']} label="Role" />
          <Filter value={ownerFilter} onChange={setOwnerFilter} options={['All', 'Owner', 'Not Owner']} label="Ownership" />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-farmers-table">
            <thead><tr><th>User</th><th>Role</th><th>Account</th><th>Device Access</th><th>Registered</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="7"><div className="admin-empty"><div><RefreshCw className="admin-spin" /><p>Loading live accounts...</p></div></div></td></tr>}
              {!loading && rows.map(user => <tr key={user.id} className={selectedId === user.id ? 'admin-table-selected' : ''}>
                <td><strong className="admin-name">{user.name}</strong><span className="admin-subtext">{user.email}</span></td>
                <td><span className={`admin-status ${user.role === 'technician' ? 'purple' : 'blue'}`}>{capitalize(user.role)}</span></td>
                <td><span className={`admin-status ${user.active ? '' : 'red'}`}>{user.active ? 'Active' : 'Inactive'}</span></td>
                <td><span className={`admin-status ${user.isOwner ? '' : 'gray'}`}>{user.isOwner ? 'Owner' : 'Not Owner'}</span></td>
                <td>{formatFirestoreDate(user.createdAt)}</td>
                <td>{formatFirestoreDate(user.updatedAt)}</td>
                <td><button className="admin-btn" type="button" onClick={() => setSelectedId(user.id)}>View Details</button></td>
              </tr>)}
              {!loading && !rows.length && <tr><td colSpan="7"><div className="admin-empty"><div><UserRound /><p>No accounts match these filters.</p></div></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination"><span>Showing {rows.length} of {filteredRows.length} matching accounts</span><div className="admin-page-controls"><button className="admin-btn" type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {safePage} of {totalPages}</span><button className="admin-btn" type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next</button></div></div>
      </section>

      {selected && <aside className="admin-card admin-detail-panel admin-farmer-detail">
        <div className="admin-card-head">
          <div><h2>Account Details</h2><p className="admin-card-sub">UID: {selected.uid}</p></div>
          <button className="admin-btn" type="button" onClick={() => setSelectedId('')}>Close</button>
        </div>

        <div className="admin-profile-big">
          <span className="admin-avatar"><UserRound /></span>
          <h2>{selected.name}</h2>
          <p className="admin-card-sub">{selected.email}</p>
          <div className="admin-profile-badges">
            <span className={`admin-status ${selected.active ? '' : 'red'}`}>{selected.active ? 'Active' : 'Inactive'}</span>
            <span className={`admin-status ${selected.isOwner ? '' : 'gray'}`}>{selected.isOwner ? 'Current Owner' : 'Not Owner'}</span>
          </div>
        </div>

        <div className="admin-detail-section">
          <h2>Usage</h2>
          <div className="admin-mini-metrics">
            <MiniMetric label="Private Scans" value={metricsLoading ? '…' : metrics.readings} />
            <MiniMetric label="Reports" value={metricsLoading ? '…' : metrics.reports} />
            <MiniMetric label="Alerts" value={metricsLoading ? '…' : metrics.alerts} />
            <MiniMetric label="Fields" value={metricsLoading ? '…' : metrics.fields} />
          </div>
        </div>

        <div className="admin-detail-section admin-detail-list">
          <Row a="Role" b={capitalize(selected.role)} />
          <Row a="Registered" b={formatFirestoreDate(selected.createdAt)} />
          <Row a="Last Profile Update" b={formatFirestoreDate(selected.updatedAt)} />
        </div>

        <div className="admin-detail-section">
          <h2>Account Actions</h2>
          <div className="admin-action-stack">
            <button className="admin-btn" type="button" disabled={Boolean(busy)} onClick={handleRename}>Edit Display Name</button>
            <select className="admin-select admin-full-select" value={selected.role} disabled={Boolean(busy)} onChange={event => run(`role-${selected.id}`, () => setUserRole(selected, event.target.value), `Role changed to ${event.target.value}.`)}>
              <option value="farmer">Farmer</option>
              <option value="technician">Technician</option>
            </select>
            <button className={`admin-btn ${selected.active ? 'danger' : 'primary'}`} type="button" disabled={Boolean(busy)} onClick={() => run(`active-${selected.id}`, () => setUserActive(selected, !selected.active), selected.active ? 'Account deactivated.' : 'Account reactivated.')}>
              {selected.active ? <><UserX /> Deactivate Account</> : <><UserCheck /> Reactivate Account</>}
            </button>
            <a className="admin-btn" href="/admin/devices"><ShieldCheck /> Manage Device Ownership</a>
            <button className="admin-btn danger admin-delete-account" type="button" disabled={Boolean(busy)} onClick={handleDelete}><Trash2 /> Delete Account Data</button>
          </div>
          <p className="admin-card-sub admin-delete-note">Deletion removes the SoilSense Firestore profile and private app data and blocks profile recreation through a deletion tombstone. Firebase Authentication credentials are not exposed to the browser.</p>
        </div>
      </aside>}
    </div>
  </>;
}

function Summary({ label, value, tone = '' }) {
  return <div className={`admin-summary-item admin-summary-accent ${tone}`}><small>{label}</small><strong>{value}</strong></div>;
}

function MiniMetric({ label, value }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function Row({ a, b }) {
  return <div className="admin-detail-row"><span>{a}</span><strong>{b}</strong></div>;
}

function Filter({ value, onChange, options, label }) {
  return <select className="admin-select" value={value} onChange={event => onChange(event.target.value)} aria-label={`Filter by ${label.toLowerCase()}`}>
    {options.map(option => <option key={option}>{option}</option>)}
  </select>;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

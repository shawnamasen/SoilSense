import { Activity, Download, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAdminPreferences } from '../context/AdminPreferencesContext';
import { exportAuditCsv, formatFirestoreDate, subscribeAuditLogs } from '../services/adminFirestore';

const ACTION_LABELS = {
  device_owner_assigned: 'Device owner assigned',
  device_owner_cleared: 'Device owner removed',
  user_reactivated: 'Account reactivated',
  user_deactivated: 'Account deactivated',
  user_role_changed: 'User role changed',
  user_name_changed: 'Display name changed',
  user_account_deleted: 'Account data deleted',
  support_ticket_created: 'Support ticket created',
  support_ticket_updated: 'Support ticket updated',
  admin_preferences_updated: 'Admin preferences updated',
};

export default function ActivityLog() {
  const { preferences } = useAdminPreferences();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => subscribeAuditLogs(setLogs, err => setError(err?.message || 'Could not load admin activity.'), 250), []);

  const actionOptions = useMemo(() => ['All', ...Array.from(new Set(logs.map(log => log.action).filter(Boolean))).sort()], [logs]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(log => {
      const haystack = `${humanAction(log.action)} ${log.adminEmail || ''} ${log.targetEmail || ''} ${JSON.stringify(log.details || {})}`.toLowerCase();
      return (!q || haystack.includes(q)) && (actionFilter === 'All' || log.action === actionFilter);
    });
  }, [logs, search, actionFilter]);

  const perPage = preferences.itemsPerPage || 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => setPage(1), [search, actionFilter, perPage]);

  return <>
    <div className="admin-page-head">
      <div><h1>Admin Activity</h1><p>Searchable audit trail for account, ownership, support and administrator-setting changes.</p></div>
      <button className="admin-btn" type="button" disabled={!filtered.length} onClick={() => exportAuditCsv(filtered)}><Download /> Export CSV</button>
    </div>

    {error && <div className="admin-inline-alert error">{error}</div>}

    <section className="admin-card">
      <div className="admin-toolbar admin-toolbar-wrap">
        <label className="admin-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search action, admin, target or details..." /></label>
        <select className="admin-select" value={actionFilter} onChange={event => setActionFilter(event.target.value)}>
          {actionOptions.map(option => <option value={option} key={option}>{option === 'All' ? 'All actions' : humanAction(option)}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table admin-activity-table">
          <thead><tr><th>Date</th><th>Action</th><th>Administrator</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map(log => <tr key={log.id}>
              <td>{formatFirestoreDate(log.createdAt)}</td>
              <td><span className="admin-status blue">{humanAction(log.action)}</span></td>
              <td>{log.adminEmail || log.adminUid || '—'}</td>
              <td>{log.targetEmail || log.targetUid || 'System'}</td>
              <td className="admin-activity-details">{detailText(log.details)}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan="5"><div className="admin-empty"><div><Activity /><p>No admin activity matches this filter.</p></div></div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <span>Showing {rows.length} of {filtered.length} activities</span>
        <div className="admin-page-controls">
          <button className="admin-btn" type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
          <span>Page {safePage} of {totalPages}</span>
          <button className="admin-btn" type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next</button>
        </div>
      </div>
    </section>
  </>;
}

export function humanAction(action) {
  return ACTION_LABELS[action] || String(action || 'Admin action').replaceAll('_', ' ');
}

function detailText(details) {
  if (!details || typeof details !== 'object') return '—';
  const entries = Object.entries(details).filter(([, value]) => value !== '' && value != null);
  if (!entries.length) return '—';
  return entries.map(([key, value]) => `${prettyKey(key)}: ${String(value)}`).join(' · ');
}

function prettyKey(value) {
  return String(value).replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
}

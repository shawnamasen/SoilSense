import { AlertTriangle, Mail, Plus, Radio, Search, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAdminPreferences } from '../context/AdminPreferencesContext';
import {
  createSupportTicket,
  devicePresence,
  formatFirestoreDate,
  subscribeDeviceState,
  subscribeSupportTickets,
  subscribeUsers,
  updateSupportTicket,
} from '../services/adminFirestore';

const EMPTY_TICKET = {
  subject: '',
  requesterName: '',
  requesterEmail: '',
  requesterUid: '',
  category: 'device',
  priority: 'medium',
  description: '',
};

export default function Support() {
  const { preferences } = useAdminPreferences();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [deviceState, setDeviceState] = useState({ status: null, assignment: null });
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TICKET);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => subscribeSupportTickets(next => setTickets(next), err => setError(err?.message || 'Could not load support tickets.')), []);
  useEffect(() => subscribeUsers(setUsers, () => undefined), []);
  useEffect(() => subscribeDeviceState(setDeviceState, () => undefined), []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = tickets.find(ticket => ticket.id === selectedId) || null;
  useEffect(() => {
    if (!selected) {
      setEdit(null);
      return;
    }
    setEdit({
      priority: selected.priority,
      status: selected.status,
      adminNote: selected.adminNote || '',
    });
  }, [selected?.id, selected?.updatedAt]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return tickets.filter(ticket => {
      const haystack = `${ticket.id} ${ticket.subject} ${ticket.requesterName} ${ticket.requesterEmail} ${ticket.category}`.toLowerCase();
      const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
      return (!q || haystack.includes(q)) && matchesStatus;
    });
  }, [tickets, queryText, statusFilter]);

  const counts = useMemo(() => ({
    open: tickets.filter(ticket => ticket.status === 'open').length,
    inProgress: tickets.filter(ticket => ticket.status === 'in_progress').length,
    resolved: tickets.filter(ticket => ticket.status === 'resolved').length,
    closed: tickets.filter(ticket => ticket.status === 'closed').length,
  }), [tickets]);

  const perPage = preferences.itemsPerPage || 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => setPage(1), [queryText, statusFilter, perPage]);

  const mobileUsers = users.filter(user => ['farmer', 'technician'].includes(user.role));
  const ownerUid = String(deviceState.assignment?.currentOwnerUid || '');
  const owner = mobileUsers.find(user => user.id === ownerUid) || null;
  const presence = useMemo(() => devicePresence(deviceState.status), [deviceState.status, clock]);
  const diagnostics = [];
  if (!presence.online) diagnostics.push({ tone: 'red', title: 'Device offline', text: 'No fresh heartbeat within 60 seconds.', category: 'device', priority: 'high' });
  if (!owner) diagnostics.push({ tone: 'orange', title: 'No current owner assigned', text: 'Future scans cannot be routed to a mobile account until ownership is assigned.', category: 'account', priority: 'high' });
  if (deviceState.status?.scanning === true) diagnostics.push({ tone: 'blue', title: 'Scan currently active', text: `The device reports an active scan (${deviceState.status?.scanDurationSeconds || '—'} sec limit).`, category: 'scan', priority: 'medium' });
  if (!diagnostics.length) diagnostics.push({ tone: '', title: 'No live system issue detected', text: 'Device heartbeat and owner assignment currently look healthy.', category: 'other', priority: 'low' });

  function showNotice(text) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 4000);
  }

  function openNew(prefill = null) {
    setDraft({ ...EMPTY_TICKET, ...(prefill || {}) });
    setCreateOpen(true);
  }

  function chooseRequester(uid) {
    const user = mobileUsers.find(item => item.id === uid);
    setDraft(current => ({
      ...current,
      requesterUid: uid,
      requesterName: user?.name || '',
      requesterEmail: user?.email || '',
    }));
  }

  async function createTicket(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = await createSupportTicket(draft);
      setCreateOpen(false);
      setSelectedId(id);
      showNotice('Support ticket created.');
    } catch (err) {
      setError(err?.message || 'Could not create support ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selected || !edit) return;
    setBusy(true);
    setError('');
    try {
      await updateSupportTicket(selected, edit);
      showNotice('Support ticket updated.');
    } catch (err) {
      setError(err?.message || 'Could not update support ticket.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="admin-page-head">
      <div><h1>Support & Diagnostics</h1><p>Log real support cases, track resolution status and use live device state for faster troubleshooting.</p></div>
      <button className="admin-btn primary" type="button" onClick={() => openNew()}><Plus /> New Ticket</button>
    </div>

    {notice && <div className="admin-inline-alert success">{notice}</div>}
    {error && <div className="admin-inline-alert error">{error}</div>}

    <section className="admin-kpis" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
      <Mini label="Open" value={counts.open} tone="red" />
      <Mini label="In Progress" value={counts.inProgress} tone="orange" />
      <Mini label="Resolved" value={counts.resolved} tone="blue" />
      <Mini label="Closed" value={counts.closed} />
    </section>

    <section className="admin-card admin-support-diagnostics">
      <div className="admin-card-head"><div><h2>Live System Diagnostics</h2><p className="admin-card-sub">Operational checks derived from device heartbeat and ownership state.</p></div><span className={`admin-status ${presence.online ? '' : 'red'}`}>{presence.online ? 'Device Online' : 'Device Offline'}</span></div>
      <div className="admin-diagnostic-grid">
        {diagnostics.map(issue => <div className="admin-diagnostic-card" key={issue.title}>
          <span className={`admin-kpi-icon ${issue.tone}`}><AlertTriangle /></span>
          <div><strong>{issue.title}</strong><p>{issue.text}</p></div>
          {issue.tone !== '' && <button className="admin-btn" type="button" onClick={() => openNew({ subject: issue.title, category: issue.category, priority: issue.priority, description: issue.text, requesterUid: owner?.id || '', requesterName: owner?.name || '', requesterEmail: owner?.email || '' })}>Create Ticket</button>}
        </div>)}
      </div>
    </section>

    <div className={selected ? 'admin-grid-2 admin-support-layout' : ''}>
      <section className="admin-card">
        <div className="admin-toolbar admin-toolbar-wrap">
          <label className="admin-search"><Search /><input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Search ticket, requester, category or ID..." /></label>
          <select className="admin-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-support-table">
            <thead><tr><th>Ticket</th><th>Subject</th><th>Requester</th><th>Category</th><th>Priority</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map(ticket => <tr key={ticket.id} className={selectedId === ticket.id ? 'admin-table-selected' : ''}>
                <td className="admin-name">{shortId(ticket.id)}</td>
                <td>{ticket.subject}</td>
                <td><strong className="admin-name">{ticket.requesterName || 'Internal'}</strong><span className="admin-subtext">{ticket.requesterEmail || 'No email'}</span></td>
                <td><span className="admin-status gray">{label(ticket.category)}</span></td>
                <td><span className={`admin-status ${ticket.priority === 'high' ? 'red' : ticket.priority === 'medium' ? 'orange' : ''}`}>{label(ticket.priority)}</span></td>
                <td><span className={`admin-status ${ticket.status === 'open' ? 'red' : ticket.status === 'in_progress' ? 'orange' : ticket.status === 'resolved' ? 'blue' : 'gray'}`}>{label(ticket.status)}</span></td>
                <td>{formatFirestoreDate(ticket.updatedAt || ticket.createdAt)}</td>
                <td><button className="admin-btn" type="button" onClick={() => setSelectedId(ticket.id)}>View</button></td>
              </tr>)}
              {!rows.length && <tr><td colSpan="8"><div className="admin-empty"><div><Wrench /><p>No support tickets match this filter.</p></div></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>Showing {rows.length} of {filtered.length} tickets</span>
          <div className="admin-page-controls">
            <button className="admin-btn" type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
            <span>Page {safePage} of {totalPages}</span>
            <button className="admin-btn" type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      </section>

      {selected && edit && <aside className="admin-card admin-detail-panel admin-support-detail">
        <div className="admin-card-head">
          <div><h2>{shortId(selected.id)} · {selected.subject}</h2><p className="admin-card-sub">Created {formatFirestoreDate(selected.createdAt)}</p></div>
          <button className="admin-icon-btn" type="button" onClick={() => setSelectedId('')} aria-label="Close ticket"><X /></button>
        </div>
        <div className="admin-detail-section admin-detail-list">
          <Row a="Requester" b={selected.requesterName || 'Internal'} />
          <Row a="Email" b={selected.requesterEmail || '—'} />
          <Row a="Category" b={label(selected.category)} />
          <Row a="Created by" b={selected.createdByEmail || 'Administrator'} />
        </div>
        <div className="admin-detail-section"><h2>Issue Description</h2><p className="admin-support-description">{selected.description}</p></div>
        <div className="admin-detail-section admin-form-grid">
          <Field label="Priority"><select className="admin-input" value={edit.priority} onChange={event => setEdit(current => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
          <Field label="Status"><select className="admin-input" value={edit.status} onChange={event => setEdit(current => ({ ...current, status: event.target.value }))}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></Field>
        </div>
        <div className="admin-detail-section">
          <h2>Admin Note</h2>
          <textarea className="admin-input admin-textarea" value={edit.adminNote} onChange={event => setEdit(current => ({ ...current, adminNote: event.target.value }))} placeholder="Record troubleshooting steps, resolution details, or follow-up notes..." />
          <div className="admin-support-actions">
            <button className="admin-btn primary" type="button" disabled={busy} onClick={saveSelected}>{busy ? 'Saving…' : 'Save Update'}</button>
            {selected.requesterEmail && <a className="admin-btn" href={`mailto:${encodeURIComponent(selected.requesterEmail)}?subject=${encodeURIComponent(`SoilSense Support: ${selected.subject}`)}`}><Mail /> Email Requester</a>}
          </div>
          <p className="admin-card-sub admin-support-note">Email opens the administrator&apos;s mail app. SoilSense stores the internal support note and status in Firestore; it does not claim to send email automatically.</p>
        </div>
      </aside>}
    </div>

    {createOpen && <div className="admin-modal-backdrop" role="presentation">
      <form className="admin-modal admin-ticket-modal" onSubmit={createTicket}>
        <div className="admin-modal-head">
          <span className="admin-modal-icon"><Radio /></span>
          <div><h2>Create Support Ticket</h2><p className="admin-card-sub">Log a real concern or create one from a live system diagnostic.</p></div>
          <button className="admin-icon-btn" type="button" onClick={() => setCreateOpen(false)} disabled={busy} aria-label="Close"><X /></button>
        </div>
        <div className="admin-modal-body admin-ticket-form">
          <Field label="Requester account (optional)">
            <select className="admin-input" value={draft.requesterUid} onChange={event => chooseRequester(event.target.value)}>
              <option value="">Internal / no linked account</option>
              {mobileUsers.map(user => <option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}
            </select>
          </Field>
          <div className="admin-form-grid">
            <Field label="Requester name"><input className="admin-input" value={draft.requesterName} onChange={event => setDraft(current => ({ ...current, requesterName: event.target.value }))} /></Field>
            <Field label="Requester email"><input className="admin-input" type="email" value={draft.requesterEmail} onChange={event => setDraft(current => ({ ...current, requesterEmail: event.target.value }))} /></Field>
          </div>
          <Field label="Subject"><input className="admin-input" required minLength="3" maxLength="160" value={draft.subject} onChange={event => setDraft(current => ({ ...current, subject: event.target.value }))} /></Field>
          <div className="admin-form-grid">
            <Field label="Category"><select className="admin-input" value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}><option value="device">Device</option><option value="account">Account</option><option value="scan">Scanning</option><option value="app">Mobile App</option><option value="other">Other</option></select></Field>
            <Field label="Priority"><select className="admin-input" value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
          </div>
          <Field label="Issue description"><textarea className="admin-input admin-textarea" required minLength="3" maxLength="4000" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></Field>
        </div>
        <div className="admin-modal-actions"><button className="admin-btn" type="button" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</button><button className="admin-btn primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create Ticket'}</button></div>
      </form>
    </div>}
  </>;
}

function Mini({ label: text, value, tone = '' }) {
  return <article className="admin-kpi"><span className={`admin-kpi-icon ${tone}`}><span style={{ fontWeight: 900 }}>{value}</span></span><div><small>{text}</small><strong>{value}</strong></div></article>;
}
function Row({ a, b }) { return <div className="admin-detail-row"><span>{a}</span><strong>{b}</strong></div>; }
function Field({ label: text, children }) { return <label className="admin-field"><span>{text}</span>{children}</label>; }
function shortId(value) { return `#${String(value || '').slice(0, 7).toUpperCase()}`; }
function label(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()); }

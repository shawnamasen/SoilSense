import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

const MOBILE_ROLES = new Set(['farmer', 'technician']);
const OWNED_COLLECTIONS = [
  ['soil_readings', 'ownerUid'],
  ['ai_results', 'userId'],
  ['soil_analyses', 'userId'],
  ['alerts', 'userId'],
  ['reports', 'userId'],
  ['fields', 'userId'],
];
export const DEVICE_OFFLINE_AFTER_MS = 60_000;
export const DEFAULT_ADMIN_PREFERENCES = Object.freeze({
  darkMode: false,
  itemsPerPage: 20,
  alertDeviceOffline: true,
  alertUnassignedOwner: true,
  alertSupport: true,
  alertInactiveAccounts: false,
});

function assertDb() {
  if (!db) throw new Error('Firestore is not configured.');
}

function adminIdentity() {
  return {
    uid: auth?.currentUser?.uid || '',
    email: auth?.currentUser?.email || '',
  };
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function safeDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatFirestoreDate(value, fallback = '—') {
  const date = timestampToDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 60) return `${Math.round(value)} sec`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}

export function devicePresence(status, staleAfterMs = DEVICE_OFFLINE_AFTER_MS) {
  if (!status) return { online: false, ageMs: Infinity, reason: 'No heartbeat received' };
  const lastSeen = timestampToDate(status.lastSeen);
  if (!lastSeen) return { online: false, ageMs: Infinity, reason: 'Heartbeat timestamp unavailable' };
  const ageMs = Math.max(0, Date.now() - lastSeen.getTime());
  const online = status.online === true && ageMs <= staleAfterMs;
  return {
    online,
    ageMs,
    reason: online ? 'Heartbeat is fresh' : status.online === false ? 'Device reported offline' : 'Heartbeat is stale',
  };
}

function normalizeUser(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: data.uid || snapshot.id,
    name: data.name || 'Unnamed User',
    email: data.email || '',
    role: String(data.role || 'farmer').toLowerCase(),
    active: data.active === true,
    isOwner: data.isOwner === true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeTicket(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    subject: data.subject || 'Untitled concern',
    requesterName: data.requesterName || '',
    requesterEmail: data.requesterEmail || '',
    requesterUid: data.requesterUid || '',
    category: data.category || 'other',
    priority: data.priority || 'medium',
    status: data.status || 'open',
    description: data.description || '',
    adminNote: data.adminNote || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    resolvedAt: data.resolvedAt || null,
    createdByUid: data.createdByUid || '',
    createdByEmail: data.createdByEmail || '',
  };
}

export function subscribeUsers(callback, onError) {
  assertDb();
  return onSnapshot(collection(db, 'users'), snapshot => {
    const users = snapshot.docs.map(normalizeUser).sort((a, b) => a.name.localeCompare(b.name));
    callback(users);
  }, onError);
}

export function subscribeDeviceState(callback, onError) {
  assertDb();
  let status = null;
  let assignment = null;
  let scanSettings = null;
  const emit = () => callback({ status, assignment, scanSettings });
  const stopStatus = onSnapshot(doc(db, 'system', 'device_status'), snap => {
    status = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    emit();
  }, onError);
  const stopAssignment = onSnapshot(doc(db, 'system', 'device_assignment'), snap => {
    assignment = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    emit();
  }, onError);
  const stopSettings = onSnapshot(doc(db, 'system', 'scan_settings'), snap => {
    scanSettings = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    emit();
  }, onError);
  return () => {
    stopStatus();
    stopAssignment();
    stopSettings();
  };
}

async function writeAudit(batch, action, target = {}, details = {}) {
  const admin = adminIdentity();
  const ref = doc(collection(db, 'admin_audit_logs'));
  batch.set(ref, {
    action,
    adminUid: admin.uid,
    adminEmail: admin.email,
    targetUid: target.uid || '',
    targetEmail: target.email || '',
    details,
    createdAt: serverTimestamp(),
  });
}

async function addAudit(action, target = {}, details = {}) {
  const batch = writeBatch(db);
  await writeAudit(batch, action, target, details);
  await batch.commit();
}

export async function assignCurrentOwner(user) {
  assertDb();
  if (!user?.id) throw new Error('Select a valid account.');
  if (!MOBILE_ROLES.has(user.role) || user.active !== true) {
    throw new Error('Only an active farmer or technician can be assigned as Owner.');
  }

  const ownerQuery = query(collection(db, 'users'), where('isOwner', '==', true));
  const ownersSnapshot = await getDocs(ownerQuery);
  const batch = writeBatch(db);

  ownersSnapshot.docs.forEach(ownerDoc => {
    if (ownerDoc.id !== user.id) {
      batch.update(ownerDoc.ref, { isOwner: false, updatedAt: serverTimestamp() });
    }
  });

  batch.update(doc(db, 'users', user.id), { isOwner: true, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'system', 'device_assignment'), {
    currentOwnerUid: user.id,
    updatedAt: serverTimestamp(),
  });
  await writeAudit(batch, 'device_owner_assigned', { uid: user.id, email: user.email }, { name: user.name });
  await batch.commit();
}

export async function clearCurrentOwner(user = null) {
  assertDb();
  const ownerQuery = query(collection(db, 'users'), where('isOwner', '==', true));
  const ownersSnapshot = await getDocs(ownerQuery);
  const batch = writeBatch(db);
  ownersSnapshot.docs.forEach(ownerDoc => {
    batch.update(ownerDoc.ref, { isOwner: false, updatedAt: serverTimestamp() });
  });
  batch.set(doc(db, 'system', 'device_assignment'), {
    currentOwnerUid: '',
    updatedAt: serverTimestamp(),
  });
  await writeAudit(batch, 'device_owner_cleared', user ? { uid: user.id, email: user.email } : {}, {});
  await batch.commit();
}

export async function setUserActive(user, active) {
  assertDb();
  if (!user?.id) throw new Error('User was not found.');
  if (user.role === 'admin') throw new Error('Administrator status cannot be changed from Farmer Management.');

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.id), {
    active: Boolean(active),
    ...(active ? {} : { isOwner: false }),
    updatedAt: serverTimestamp(),
  });

  if (!active && user.isOwner) {
    batch.set(doc(db, 'system', 'device_assignment'), {
      currentOwnerUid: '',
      updatedAt: serverTimestamp(),
    });
  }
  await writeAudit(batch, active ? 'user_reactivated' : 'user_deactivated', { uid: user.id, email: user.email }, { name: user.name });
  await batch.commit();
}

export async function setUserRole(user, role) {
  assertDb();
  if (!MOBILE_ROLES.has(role)) throw new Error('Role must be farmer or technician.');
  if (!user?.id || user.role === 'admin') throw new Error('Administrator roles cannot be edited here.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.id), { role, updatedAt: serverTimestamp() });
  await writeAudit(batch, 'user_role_changed', { uid: user.id, email: user.email }, { from: user.role, to: role });
  await batch.commit();
}

export async function renameUser(user, name) {
  assertDb();
  const clean = String(name || '').trim();
  if (clean.length < 2 || clean.length > 100) throw new Error('Name must be between 2 and 100 characters.');
  if (!user?.id || user.role === 'admin') throw new Error('Administrator profiles cannot be renamed here.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.id), { name: clean, updatedAt: serverTimestamp() });
  await writeAudit(batch, 'user_name_changed', { uid: user.id, email: user.email }, { from: user.name, to: clean });
  await batch.commit();
}

export async function getUserMetrics(uid) {
  assertDb();
  const [readings, reports, alerts, fields] = await Promise.all([
    getCountFromServer(query(collection(db, 'soil_readings'), where('ownerUid', '==', uid))),
    getCountFromServer(query(collection(db, 'reports'), where('userId', '==', uid))),
    getCountFromServer(query(collection(db, 'alerts'), where('userId', '==', uid))),
    getCountFromServer(query(collection(db, 'fields'), where('userId', '==', uid))),
  ]);
  return {
    readings: readings.data().count,
    reports: reports.data().count,
    alerts: alerts.data().count,
    fields: fields.data().count,
  };
}

async function collectOwnedDocs(uid) {
  const snapshots = await Promise.all(OWNED_COLLECTIONS.map(([name, field]) => getDocs(query(collection(db, name), where(field, '==', uid)))));
  const refs = snapshots.flatMap(snapshot => snapshot.docs.map(item => item.ref));
  const [tokens, preferences] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'push_tokens')),
    getDocs(collection(db, 'users', uid, 'preferences')),
  ]);
  refs.push(...tokens.docs.map(item => item.ref));
  refs.push(...preferences.docs.map(item => item.ref));
  return refs;
}

async function commitDeletes(refs) {
  for (let start = 0; start < refs.length; start += 400) {
    const batch = writeBatch(db);
    refs.slice(start, start + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

export async function deleteSoilSenseAccount(user) {
  assertDb();
  if (!user?.id) throw new Error('User was not found.');
  if (user.role === 'admin' || user.id === auth?.currentUser?.uid) {
    throw new Error('The signed-in administrator account cannot be deleted here.');
  }

  const ownedRefs = await collectOwnedDocs(user.id);
  await commitDeletes(ownedRefs);

  const batch = writeBatch(db);
  if (user.isOwner) {
    batch.set(doc(db, 'system', 'device_assignment'), {
      currentOwnerUid: '',
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(db, 'deleted_accounts', user.id), {
    uid: user.id,
    name: user.name || '',
    email: user.email || '',
    previousRole: user.role || 'farmer',
    deletedAt: serverTimestamp(),
    deletedByUid: auth?.currentUser?.uid || '',
    deletedByEmail: auth?.currentUser?.email || '',
  });
  await writeAudit(batch, 'user_account_deleted', { uid: user.id, email: user.email }, { deletedRecords: ownedRefs.length });
  batch.delete(doc(db, 'users', user.id));
  await batch.commit();

  return { deletedRecords: ownedRefs.length };
}

export async function listRecentAuditLogs(max = 8) {
  assertDb();
  const snapshot = await getDocs(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(max)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export function subscribeAuditLogs(callback, onError, max = 200) {
  assertDb();
  return onSnapshot(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(max)), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function getLatestScanMetadata() {
  assertDb();
  const snapshot = await getDocs(query(collection(db, 'soil_readings'), orderBy('timestamp', 'desc'), limit(1)));
  if (snapshot.empty) return null;
  const item = snapshot.docs[0];
  const data = item.data() || {};
  return {
    id: item.id,
    ownerUid: data.ownerUid || '',
    hardwareFingerprint: data.hardwareFingerprint || '',
    firmwareVersion: data.firmwareVersion || '',
    rssi: Number.isInteger(data.rssi) ? data.rssi : null,
    timestamp: data.timestamp || null,
    source: data.source || '',
  };
}

export async function getAdminDashboardStats() {
  assertDb();
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const [usersSnap, totalScanCount, recentScanCount, reportCount, assignmentSnap, statusSnap, settingsSnap, supportCount, latestScan] = await Promise.all([
    getDocs(collection(db, 'users')),
    getCountFromServer(collection(db, 'soil_readings')),
    getCountFromServer(query(collection(db, 'soil_readings'), where('timestamp', '>=', cutoff))),
    getCountFromServer(collection(db, 'reports')),
    getDoc(doc(db, 'system', 'device_assignment')),
    getDoc(doc(db, 'system', 'device_status')),
    getDoc(doc(db, 'system', 'scan_settings')),
    getCountFromServer(query(collection(db, 'support_tickets'), where('status', 'in', ['open', 'in_progress']))).catch(() => ({ data: () => ({ count: 0 }) })),
    getLatestScanMetadata().catch(() => null),
  ]);
  const users = usersSnap.docs.map(normalizeUser);
  const farmers = users.filter(user => MOBILE_ROLES.has(user.role));
  const status = statusSnap.exists() ? statusSnap.data() : null;
  const presence = devicePresence(status);
  const currentOwnerUid = String(assignmentSnap.data()?.currentOwnerUid || '');
  return {
    farmers: farmers.length,
    activeFarmers: farmers.filter(user => user.active).length,
    inactiveFarmers: farmers.filter(user => !user.active).length,
    scansToday: recentScanCount.data().count,
    totalScans: totalScanCount.data().count,
    reports: reportCount.data().count,
    openSupport: supportCount.data().count,
    online: presence.online,
    presence,
    currentOwnerUid,
    currentOwner: farmers.find(user => user.id === currentOwnerUid) || null,
    status,
    scanSettings: settingsSnap.exists() ? settingsSnap.data() : null,
    latestScan,
  };
}

export async function getReportsAnalytics() {
  assertDb();
  const now = new Date();
  const start24h = Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const start7dDate = new Date(now);
  start7dDate.setHours(0, 0, 0, 0);
  start7dDate.setDate(start7dDate.getDate() - 6);
  const start7d = Timestamp.fromDate(start7dDate);
  const start30d = Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [usersSnap, totalScans, scans24h, scans7dSnap, scans30d, reports, alerts, unreadAlerts, supportOpen, statusSnap, assignmentSnap, latestScan] = await Promise.all([
    getDocs(collection(db, 'users')),
    getCountFromServer(collection(db, 'soil_readings')),
    getCountFromServer(query(collection(db, 'soil_readings'), where('timestamp', '>=', start24h))),
    getDocs(query(collection(db, 'soil_readings'), where('timestamp', '>=', start7d), orderBy('timestamp', 'asc'))),
    getCountFromServer(query(collection(db, 'soil_readings'), where('timestamp', '>=', start30d))),
    getCountFromServer(collection(db, 'reports')),
    getCountFromServer(collection(db, 'alerts')),
    getCountFromServer(query(collection(db, 'alerts'), where('read', '==', false))),
    getCountFromServer(query(collection(db, 'support_tickets'), where('status', 'in', ['open', 'in_progress']))).catch(() => ({ data: () => ({ count: 0 }) })),
    getDoc(doc(db, 'system', 'device_status')),
    getDoc(doc(db, 'system', 'device_assignment')),
    getLatestScanMetadata().catch(() => null),
  ]);

  const users = usersSnap.docs.map(normalizeUser);
  const mobileUsers = users.filter(user => MOBILE_ROLES.has(user.role));
  const activeUsers = mobileUsers.filter(user => user.active);
  const dailyMap = new Map();
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start7dDate);
    date.setDate(start7dDate.getDate() + i);
    const key = safeDateKey(date);
    const label = new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date);
    const entry = { key, label, count: 0 };
    days.push(entry);
    dailyMap.set(key, entry);
  }
  const hourBuckets = [
    { label: '12–3 AM', count: 0 },
    { label: '4–7 AM', count: 0 },
    { label: '8–11 AM', count: 0 },
    { label: '12–3 PM', count: 0 },
    { label: '4–7 PM', count: 0 },
    { label: '8–11 PM', count: 0 },
  ];
  scans7dSnap.docs.forEach(item => {
    const date = timestampToDate(item.data()?.timestamp);
    if (!date) return;
    const day = dailyMap.get(safeDateKey(date));
    if (day) day.count += 1;
    const bucket = Math.min(5, Math.floor(date.getHours() / 4));
    hourBuckets[bucket].count += 1;
  });

  const status = statusSnap.exists() ? statusSnap.data() : null;
  const presence = devicePresence(status);
  return {
    totalScans: totalScans.data().count,
    scans24h: scans24h.data().count,
    scans7d: scans7dSnap.size,
    scans30d: scans30d.data().count,
    reports: reports.data().count,
    alerts: alerts.data().count,
    unreadAlerts: unreadAlerts.data().count,
    openSupport: supportOpen.data().count,
    mobileUsers: mobileUsers.length,
    activeUsers: activeUsers.length,
    inactiveUsers: mobileUsers.length - activeUsers.length,
    farmers: mobileUsers.filter(user => user.role === 'farmer').length,
    technicians: mobileUsers.filter(user => user.role === 'technician').length,
    dailyScans: days,
    hourBuckets,
    deviceOnline: presence.online,
    deviceStatus: status,
    currentOwnerUid: String(assignmentSnap.data()?.currentOwnerUid || ''),
    latestScan,
    generatedAt: now,
  };
}

export function subscribeSupportTickets(callback, onError, max = 200) {
  assertDb();
  return onSnapshot(query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'), limit(max)), snapshot => {
    callback(snapshot.docs.map(normalizeTicket));
  }, onError);
}

export async function createSupportTicket(input) {
  assertDb();
  const subject = String(input?.subject || '').trim();
  const description = String(input?.description || '').trim();
  if (subject.length < 3) throw new Error('Enter a short ticket subject.');
  if (description.length < 3) throw new Error('Enter the issue description.');
  const admin = adminIdentity();
  const payload = {
    subject: subject.slice(0, 160),
    requesterName: String(input?.requesterName || '').trim().slice(0, 120),
    requesterEmail: String(input?.requesterEmail || '').trim().slice(0, 200),
    requesterUid: String(input?.requesterUid || '').trim().slice(0, 128),
    category: ['device', 'account', 'scan', 'app', 'other'].includes(input?.category) ? input.category : 'other',
    priority: ['low', 'medium', 'high'].includes(input?.priority) ? input.priority : 'medium',
    status: 'open',
    description: description.slice(0, 4000),
    adminNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: admin.uid,
    createdByEmail: admin.email,
  };
  const ref = await addDoc(collection(db, 'support_tickets'), payload);
  await addAudit('support_ticket_created', { uid: payload.requesterUid, email: payload.requesterEmail }, { ticketId: ref.id, subject: payload.subject });
  return ref.id;
}

export async function updateSupportTicket(ticket, changes) {
  assertDb();
  if (!ticket?.id) throw new Error('Ticket not found.');
  const allowedStatus = ['open', 'in_progress', 'resolved', 'closed'];
  const allowedPriority = ['low', 'medium', 'high'];
  const next = {
    subject: String(changes.subject ?? ticket.subject).trim().slice(0, 160),
    requesterName: String(changes.requesterName ?? ticket.requesterName).trim().slice(0, 120),
    requesterEmail: String(changes.requesterEmail ?? ticket.requesterEmail).trim().slice(0, 200),
    requesterUid: String(changes.requesterUid ?? ticket.requesterUid).trim().slice(0, 128),
    category: ['device', 'account', 'scan', 'app', 'other'].includes(changes.category) ? changes.category : ticket.category,
    priority: allowedPriority.includes(changes.priority) ? changes.priority : ticket.priority,
    status: allowedStatus.includes(changes.status) ? changes.status : ticket.status,
    description: String(changes.description ?? ticket.description).trim().slice(0, 4000),
    adminNote: String(changes.adminNote ?? ticket.adminNote).trim().slice(0, 4000),
    updatedAt: serverTimestamp(),
  };
  if (next.status === 'resolved' || next.status === 'closed') next.resolvedAt = serverTimestamp();
  else next.resolvedAt = null;
  await updateDoc(doc(db, 'support_tickets', ticket.id), next);
  await addAudit('support_ticket_updated', { uid: next.requesterUid, email: next.requesterEmail }, {
    ticketId: ticket.id,
    status: next.status,
    priority: next.priority,
  });
}

export function subscribeAdminPreferences(uid, callback, onError) {
  assertDb();
  if (!uid) return () => undefined;
  return onSnapshot(doc(db, 'admin_preferences', uid), snap => {
    callback({
      ...DEFAULT_ADMIN_PREFERENCES,
      ...(snap.exists() ? snap.data() : {}),
    });
  }, onError);
}

export async function saveAdminPreferences(uid, preferences) {
  assertDb();
  if (!uid) throw new Error('Administrator session is unavailable.');
  const payload = {
    darkMode: Boolean(preferences.darkMode),
    itemsPerPage: [10, 20, 50].includes(Number(preferences.itemsPerPage)) ? Number(preferences.itemsPerPage) : 20,
    alertDeviceOffline: Boolean(preferences.alertDeviceOffline),
    alertUnassignedOwner: Boolean(preferences.alertUnassignedOwner),
    alertSupport: Boolean(preferences.alertSupport),
    alertInactiveAccounts: Boolean(preferences.alertInactiveAccounts),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'admin_preferences', uid), payload, { merge: false });
  await addAudit('admin_preferences_updated', { uid, email: auth?.currentUser?.email || '' }, {
    darkMode: payload.darkMode,
    itemsPerPage: payload.itemsPerPage,
  });
  return payload;
}

export async function getPortalNotificationSnapshot() {
  const stats = await getAdminDashboardStats();
  const notifications = [];
  if (!stats.online) {
    notifications.push({ id: 'device-offline', kind: 'deviceOffline', title: 'SoilSense device offline', text: stats.presence?.reason || 'No fresh heartbeat.', to: '/admin/devices', tone: 'red' });
  }
  if (!stats.currentOwner) {
    notifications.push({ id: 'owner-missing', kind: 'unassignedOwner', title: 'No current device owner', text: 'Assign an active account before scanning.', to: '/admin/devices', tone: 'orange' });
  }
  if (stats.openSupport > 0) {
    notifications.push({ id: 'support-open', kind: 'support', title: `${stats.openSupport} support ticket${stats.openSupport === 1 ? '' : 's'} need attention`, text: 'Review open or in-progress concerns.', to: '/admin/support', tone: 'blue' });
  }
  if (stats.inactiveFarmers > 0) {
    notifications.push({ id: 'inactive-users', kind: 'inactiveAccounts', title: `${stats.inactiveFarmers} inactive account${stats.inactiveFarmers === 1 ? '' : 's'}`, text: 'Review whether access should be restored.', to: '/admin/farmers', tone: 'gray' });
  }
  return notifications;
}

export function exportUsersCsv(users) {
  downloadCsv(`soilsense-users-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Name', 'Email', 'Role', 'Status', 'Owner', 'Created', 'Updated'],
    ...users.map(user => [
      user.name,
      user.email,
      user.role,
      user.active ? 'Active' : 'Inactive',
      user.isOwner ? 'Owner' : 'Not Owner',
      formatFirestoreDate(user.createdAt),
      formatFirestoreDate(user.updatedAt),
    ]),
  ]);
}

export function exportAuditCsv(logs) {
  downloadCsv(`soilsense-admin-activity-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Date', 'Action', 'Admin', 'Target', 'Details'],
    ...logs.map(log => [
      formatFirestoreDate(log.createdAt),
      log.action || '',
      log.adminEmail || log.adminUid || '',
      log.targetEmail || log.targetUid || '',
      JSON.stringify(log.details || {}),
    ]),
  ]);
}

export function exportAnalyticsCsv(data) {
  const rows = [
    ['Metric', 'Value'],
    ['Total mobile accounts', data.mobileUsers],
    ['Active mobile accounts', data.activeUsers],
    ['Total scans', data.totalScans],
    ['Scans last 24 hours', data.scans24h],
    ['Scans last 7 days', data.scans7d],
    ['Scans last 30 days', data.scans30d],
    ['Reports generated', data.reports],
    ['Alerts generated', data.alerts],
    ['Unread alerts', data.unreadAlerts],
    ['Open support tickets', data.openSupport],
    ['Device status', data.deviceOnline ? 'Online' : 'Offline'],
    [],
    ['Day', 'Completed scans'],
    ...data.dailyScans.map(day => [day.key, day.count]),
    [],
    ['Time bucket', 'Completed scans (7d)'],
    ...data.hourBuckets.map(bucket => [bucket.label, bucket.count]),
  ];
  downloadCsv(`soilsense-system-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function downloadCsv(filename, rows) {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

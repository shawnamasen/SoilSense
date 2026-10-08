import { useEffect, useState } from 'react';
import { Mail, Moon, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../auth/context/AuthContext';
import { auth } from '../../services/firebase';
import { useAdminPreferences } from '../context/AdminPreferencesContext';

export default function AdminSettings() {
  const { user } = useAuth();
  const { preferences, loading, error: preferenceError, save } = useAdminPreferences();
  const [draft, setDraft] = useState(preferences);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setDraft(preferences), [preferences]);

  async function sendPasswordReset() {
    if (!auth || !user?.email) return;
    setPasswordMessage('');
    setPasswordLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordMessage('Password reset email sent.');
    } catch (err) {
      console.error('Admin password reset:', err?.code || err?.message);
      setPasswordMessage('Unable to send the reset email right now.');
    } finally {
      setPasswordLoading(false);
    }
  }

  async function savePreferences() {
    setSaving(true);
    setError('');
    try {
      await save(draft);
      setNotice('Admin portal preferences saved to Firestore.');
      window.setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err?.message || 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  }

  function toggle(key) {
    setDraft(current => ({ ...current, [key]: !current[key] }));
  }

  return <>
    <div className="admin-page-head">
      <div><h1>Settings</h1><p>Manage the signed-in administrator account and persistent portal preferences.</p></div>
    </div>

    {notice && <div className="admin-inline-alert success">{notice}</div>}
    {(error || preferenceError) && <div className="admin-inline-alert error">{error || preferenceError}</div>}

    <section className="admin-settings-grid">
      <div className="admin-card">
        <h2>Admin Profile</h2>
        <div className="admin-profile-big">
          <span className="admin-avatar"><UserRound /></span>
          <h2>{user?.name || 'System Administrator'}</h2>
          <p className="admin-card-sub">{user?.email || 'No email available'}</p>
          <div className="admin-profile-badges"><span className="admin-status"><ShieldCheck /> Verified Administrator</span></div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Password & Sign-In</h2>
        <p className="admin-card-sub" style={{ marginTop: 8 }}>Password changes use Firebase Authentication&apos;s secure reset flow. SoilSense does not store administrator passwords.</p>
        <button className="admin-btn primary" type="button" style={{ marginTop: 16 }} onClick={sendPasswordReset} disabled={passwordLoading}>
          <Mail /> {passwordLoading ? 'Sending…' : 'Send Password Reset Email'}
        </button>
        {passwordMessage && <p className="admin-card-sub" style={{ marginTop: 10 }}>{passwordMessage}</p>}
      </div>
    </section>

    <section className="admin-settings-grid" style={{ marginTop: 14 }}>
      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Appearance & Table Size</h2><p className="admin-card-sub">Saved per administrator account.</p></div></div>
        <div className="admin-setting-theme-preview">
          <span className="admin-theme-preview-icon">{draft.darkMode ? <Moon /> : <Sun />}</span>
          <div><strong>{draft.darkMode ? 'Dark Mode' : 'Light Mode'}</strong><small>Use a low-glare dark SoilSense theme across the admin portal.</small></div>
          <button className={`admin-toggle ${draft.darkMode ? 'on' : ''}`} type="button" onClick={() => toggle('darkMode')} aria-label="Toggle dark mode" />
        </div>
        <div className="admin-field" style={{ marginTop: 18 }}>
          <label>Items per table page</label>
          <select className="admin-input" value={draft.itemsPerPage} onChange={event => setDraft(current => ({ ...current, itemsPerPage: Number(event.target.value) }))}>
            <option value="10">10</option><option value="20">20</option><option value="50">50</option>
          </select>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><div><h2>Portal Alerts</h2><p className="admin-card-sub">Controls what appears in the bell menu. These are in-app admin alerts, not email or push notifications.</p></div></div>
        <Toggle title="Device Offline" subtitle="Show an alert when the ESP32 heartbeat is stale for more than 60 seconds." on={draft.alertDeviceOffline} onClick={() => toggle('alertDeviceOffline')} />
        <Toggle title="No Current Owner" subtitle="Show an alert when the SoilSense device is unassigned." on={draft.alertUnassignedOwner} onClick={() => toggle('alertUnassignedOwner')} />
        <Toggle title="Support Tickets" subtitle="Show an alert when open or in-progress support tickets exist." on={draft.alertSupport} onClick={() => toggle('alertSupport')} />
        <Toggle title="Inactive Accounts" subtitle="Optionally surface inactive farmer/technician accounts." on={draft.alertInactiveAccounts} onClick={() => toggle('alertInactiveAccounts')} />
      </div>
    </section>

    <section className="admin-settings-grid" style={{ marginTop: 14 }}>
      <div className="admin-card">
        <h2>System Behavior</h2>
        <div className="admin-detail-list admin-settings-detail-list">
          <Row a="Device offline threshold" b="60 seconds" />
          <Row a="Ownership model" b="1 device · 1 current owner" />
          <Row a="Analytics privacy" b="Aggregate metadata only" />
          <Row a="Support email" b="Opens admin mail client" />
        </div>
      </div>
      <div className="admin-card">
        <h2>Privacy & Data Scope</h2>
        <p className="admin-card-sub admin-settings-privacy">The admin portal uses account status, scan counts, timestamps, device metadata, reports/alert counts and audit events for administration. Analytics pages do not display individual NPK, pH, moisture, temperature or EC values.</p>
        <p className="admin-card-sub admin-settings-privacy">Historical private soil readings remain assigned to their original user when device ownership changes.</p>
      </div>
    </section>

    <div className="admin-settings-savebar">
      <span>{loading ? 'Loading preferences…' : 'Changes are not applied permanently until saved.'}</span>
      <button className="admin-btn primary" type="button" onClick={savePreferences} disabled={saving || loading}><Save /> {saving ? 'Saving…' : 'Save Portal Settings'}</button>
    </div>
  </>;
}

function Toggle({ title, subtitle, on, onClick }) {
  return <div className="admin-toggle-row">
    <div className="admin-toggle-copy"><strong>{title}</strong><small>{subtitle}</small></div>
    <button className={`admin-toggle ${on ? 'on' : ''}`} type="button" onClick={onClick} aria-label={`Toggle ${title}`} />
  </div>;
}

function Row({ a, b }) { return <div className="admin-detail-row"><span>{a}</span><strong>{b}</strong></div>; }

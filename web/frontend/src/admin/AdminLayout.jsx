import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, LogOut, Menu, Moon, Sprout, Sun, X } from 'lucide-react';
import { useAuth } from '../auth/context/AuthContext';
import { adminNavGroups } from './config/navigation';
import { useAdminPreferences } from './context/AdminPreferencesContext';
import { getPortalNotificationSnapshot } from './services/adminFirestore';
import './admin.css';

function initials(name, email) {
  const source = String(name || email || 'SA').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { preferences, setPreference } = useAdminPreferences();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');
  const notificationRef = useRef(null);
  const today = useMemo(() => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date()), []);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const next = await getPortalNotificationSnapshot();
        if (active) {
          setNotifications(next);
          setNotificationError('');
        }
      } catch (error) {
        if (active) setNotificationError(error?.message || 'Alerts unavailable.');
      }
    }
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function close(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const visibleNotifications = useMemo(() => notifications.filter(item => {
    if (item.kind === 'deviceOffline') return preferences.alertDeviceOffline;
    if (item.kind === 'unassignedOwner') return preferences.alertUnassignedOwner;
    if (item.kind === 'support') return preferences.alertSupport;
    if (item.kind === 'inactiveAccounts') return preferences.alertInactiveAccounts;
    return true;
  }), [notifications, preferences]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function toggleTheme() {
    try {
      await setPreference('darkMode', !preferences.darkMode);
    } catch {
      // The context exposes persistence errors on Settings; keep navigation usable.
    }
  }

  function openNotification(item) {
    setNotificationsOpen(false);
    navigate(item.to);
  }

  return <div className="admin-shell">
    <button className="admin-mobile-menu" type="button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
    {open && <button className="admin-sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />}

    <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
      <div className="admin-brand-row">
        <NavLink to="/" className="admin-brand" onClick={() => setOpen(false)}>
          <span className="admin-brand-mark"><Sprout /></span>
          <span><strong>Soil<span>Sense</span></strong><small>Admin Portal</small></span>
        </NavLink>
        <button className="admin-sidebar-close" type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
      </div>

      <nav className="admin-nav">
        {adminNavGroups.map(group => <div className="admin-nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.links.map(({ to, label, icon: Icon }) => <NavLink to={to} key={to} onClick={() => setOpen(false)} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
            <Icon /> <span>{label}</span>
          </NavLink>)}
        </div>)}
      </nav>

      <div className="admin-sidebar-bottom">
        <div className="admin-profile-card">
          <span className="admin-avatar">{initials(user?.name, user?.email)}</span>
          <span><strong>{user?.name || 'System Administrator'}</strong><small>System Administrator</small></span>
        </div>
        <button type="button" className="admin-logout" onClick={handleLogout}><LogOut /> Logout</button>
      </div>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div />
        <div className="admin-top-actions">
          <div className="admin-date"><CalendarDays /><span>{today}</span></div>
          <button className="admin-bell admin-theme-toggle" type="button" aria-label={preferences.darkMode ? 'Use light mode' : 'Use dark mode'} onClick={toggleTheme}>
            {preferences.darkMode ? <Sun /> : <Moon />}
          </button>
          <div className="admin-notification-wrap" ref={notificationRef}>
            <button className="admin-bell" type="button" aria-label="System notifications" onClick={() => setNotificationsOpen(value => !value)}>
              <Bell />
              {visibleNotifications.length > 0 && <span>{Math.min(9, visibleNotifications.length)}</span>}
            </button>
            {notificationsOpen && <div className="admin-notification-popover">
              <div className="admin-notification-head"><strong>System Alerts</strong><small>Live portal checks</small></div>
              {notificationError && <div className="admin-notification-empty">{notificationError}</div>}
              {!notificationError && visibleNotifications.map(item => <button key={item.id} type="button" className="admin-notification-item" onClick={() => openNotification(item)}>
                <i className={`admin-notification-dot ${item.tone || ''}`} />
                <span><strong>{item.title}</strong><small>{item.text}</small></span>
              </button>)}
              {!notificationError && !visibleNotifications.length && <div className="admin-notification-empty">No portal alerts right now.</div>}
            </div>}
          </div>
        </div>
      </header>
      <div className="admin-content"><Outlet /></div>
    </main>
  </div>;
}

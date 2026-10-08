import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import {
  DEFAULT_ADMIN_PREFERENCES,
  saveAdminPreferences,
  subscribeAdminPreferences,
} from '../services/adminFirestore';

const AdminPreferencesContext = createContext(null);

export function AdminPreferencesProvider({ children }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_ADMIN_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setPreferences(DEFAULT_ADMIN_PREFERENCES);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeAdminPreferences(user.uid, value => {
      setPreferences({ ...DEFAULT_ADMIN_PREFERENCES, ...value });
      setLoading(false);
      setError('');
    }, err => {
      setError(err?.message || 'Could not load admin preferences.');
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    document.documentElement.classList.toggle('soilsense-admin-dark', Boolean(preferences.darkMode));
    return () => document.documentElement.classList.remove('soilsense-admin-dark');
  }, [preferences.darkMode]);

  async function save(next) {
    const merged = { ...preferences, ...next };
    setPreferences(merged);
    try {
      await saveAdminPreferences(user?.uid, merged);
      setError('');
      return true;
    } catch (err) {
      setError(err?.message || 'Could not save admin preferences.');
      throw err;
    }
  }

  async function setPreference(key, value) {
    return save({ [key]: value });
  }

  const value = useMemo(() => ({
    preferences,
    loading,
    error,
    save,
    setPreference,
  }), [preferences, loading, error]);

  return <AdminPreferencesContext.Provider value={value}>{children}</AdminPreferencesContext.Provider>;
}

export function useAdminPreferences() {
  const context = useContext(AdminPreferencesContext);
  if (!context) throw new Error('useAdminPreferences must be used inside AdminPreferencesProvider');
  return context;
}

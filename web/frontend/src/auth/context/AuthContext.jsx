import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigured, googleProvider } from '../../services/firebase';

const AuthContext = createContext(null);

function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireFirebase() {
  if (!firebaseConfigured || !auth || !db) {
    throw createAuthError('auth/firebase-not-configured', 'Firebase is not configured.');
  }
}

async function buildVerifiedAdmin(firebaseUser) {
  if (!firebaseUser) return null;
  await firebaseUser.reload();
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  if (!currentUser.emailVerified) {
    throw createAuthError('auth/email-not-verified', 'Verify your email before signing in.');
  }

  const profileSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
  if (!profileSnapshot.exists()) {
    throw createAuthError('auth/admin-profile-missing', 'This account does not have a SoilSense administrator profile.');
  }
  const profile = profileSnapshot.data() || {};
  if (profile.active !== true || String(profile.role || '').toLowerCase() !== 'admin') {
    throw createAuthError('auth/not-admin', 'This account is not an active SoilSense administrator.');
  }

  return {
    uid: currentUser.uid,
    name: profile.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Administrator',
    email: profile.email || currentUser.email || '',
    photoURL: currentUser.photoURL || null,
    emailVerified: currentUser.emailVerified,
    role: 'admin',
    active: true,
    provider: currentUser.providerData?.[0]?.providerId || 'password',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !auth || !db) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    setPersistence(auth, browserLocalPersistence).catch(error => {
      console.warn('Unable to set Firebase persistence:', error?.code || error?.message);
    });

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const adminUser = await buildVerifiedAdmin(firebaseUser);
        setUser(adminUser);
      } catch (error) {
        console.warn('Admin access rejected:', error?.code || error?.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const refreshSession = useCallback(async () => {
    if (!auth?.currentUser) {
      setUser(null);
      return null;
    }
    try {
      const adminUser = await buildVerifiedAdmin(auth.currentUser);
      setUser(adminUser);
      return adminUser;
    } catch (error) {
      setUser(null);
      return null;
    }
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    requireFirebase();
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      const adminUser = await buildVerifiedAdmin(credential.user);
      setUser(adminUser);
      return adminUser;
    } catch (error) {
      await firebaseSignOut(auth).catch(() => undefined);
      setUser(null);
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    requireFirebase();
    if (!googleProvider) throw createAuthError('auth/google-not-configured', 'Google Authentication is not configured.');
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithPopup(auth, googleProvider);
    try {
      const adminUser = await buildVerifiedAdmin(credential.user);
      setUser(adminUser);
      return adminUser;
    } catch (error) {
      await firebaseSignOut(auth).catch(() => undefined);
      setUser(null);
      throw error;
    }
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    requireFirebase();
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user);
    await firebaseSignOut(auth);
    setUser(null);
    return {
      uid: credential.user.uid,
      email: credential.user.email,
      verificationSent: true,
      note: 'An existing administrator must create/promote the matching Firestore profile before this account can access the admin portal.',
    };
  }, []);

  const logout = useCallback(async () => {
    if (auth) await firebaseSignOut(auth).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    firebaseConfigured,
    loginWithEmail,
    loginWithGoogle,
    signup,
    logout,
    refreshSession,
  }), [user, loading, loginWithEmail, loginWithGoogle, signup, logout, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

/**
 * Provides authentication state to the entire app.
 * On mount, calls GET /api/auth/me to restore an existing session
 * from the HttpOnly cookie (if one exists).
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // null = not signed in
  const [loading, setLoading] = useState(true);   // true while checking session

  // Restore session on app load
  useEffect(() => {
    api.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const userData = await api.auth.signIn(email, password);
    setUser(userData);
    return userData;
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.signOut().catch(() => {});
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const userData = await api.auth.me();
    setUser(userData);
    return userData;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

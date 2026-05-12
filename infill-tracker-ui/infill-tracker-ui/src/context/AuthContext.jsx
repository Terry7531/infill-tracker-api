import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, clearAuthToken } from '../api/client';

const AuthContext = createContext(null);

// Persist token in sessionStorage so page refreshes don't log the user out.
// sessionStorage is cleared when the browser tab closes — safer than localStorage.
const TOKEN_KEY = 'it_session';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      setAuthToken(stored);
      api.auth.me()
        .then(setUser)
        .catch(() => {
          clearAuthToken();
          sessionStorage.removeItem(TOKEN_KEY);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    const userData = await api.auth.signIn(email, password);
    // Store token from response body
    if (userData.Token) {
      setAuthToken(userData.Token);
      sessionStorage.setItem(TOKEN_KEY, userData.Token);
    }
    setUser(userData);
    return userData;
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.signOut().catch(() => {});
    clearAuthToken();
    sessionStorage.removeItem(TOKEN_KEY);
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

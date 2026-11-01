import { useCallback, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '../api/client.js';
import { useToast } from '../hooks/useToast.js';
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  isTokenExpired,
  saveSession,
  saveUser,
} from '../utils/storage.js';
import { AuthContext } from './authContext.js';

function readInitialSession() {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) {
    if (token) clearSession();
    return { token: null, user: null };
  }
  return { token, user: getStoredUser() };
}

/** Holds who is logged in. The token itself is never logged or displayed. */
export default function AuthProvider({ children }) {
  const [session, setSession] = useState(readInitialSession);
  const toast = useToast();

  const login = useCallback(({ token, user }) => {
    saveSession(token, user);
    setSession({ token, user });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession({ token: null, user: null });
  }, []);

  const updateUser = useCallback((user) => {
    saveUser(user);
    setSession((current) => ({ ...current, user }));
  }, []);

  // When any API call reports an invalid/expired session, drop it. The route
  // guard then redirects to /login using React Router (no page reload).
  useEffect(() => {
    setUnauthorizedHandler((code) => {
      if (!getStoredToken()) return; // already logged out: nothing to do
      clearSession();
      setSession({ token: null, user: null });
      toast.info(
        code === 'TOKEN_EXPIRED'
          ? 'Your session has expired. Please log in again.'
          : 'Please log in again to continue.',
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      isAuthenticated: Boolean(session.token),
      login,
      logout,
      updateUser,
    }),
    [session, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "../config/api";

/*
 * Standalone replacement for the LMS's auth/auth.jsx.
 * Same contract the pages use: useAuth() -> { token, user, API, loginUser, logoutUser }.
 * Signs in against this product's own server (POST /api/auth/login).
 */
const AuthContext = createContext(null);
const STORAGE_KEY = "aia_session";

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const loginUser = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign-in failed");
    const next = { token: data.token, user: data.user };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setSession(next);
    try {
      window.parent?.postMessage({ type: "AIA_LOGIN_SUCCESS", user: data.user }, "*");
    } catch { /* cross-origin fallback */ }
    return data.user;
  }, []);

  const logoutUser = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSession(null);
    try {
      window.parent?.postMessage({ type: "AIA_LOGOUT" }, "*");
    } catch { /* cross-origin fallback */ }
  }, []);

  // Notify parent window if session is already active on mount
  useEffect(() => {
    if (session?.user) {
      try {
        window.parent?.postMessage({ type: "AIA_SESSION_ACTIVE", user: session.user }, "*");
      } catch { /* cross-origin fallback */ }
    }
  }, [session?.user]);

  // A stale token (server restarted with a new secret) signs the user out.
  useEffect(() => {
    if (!session?.token) return;
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => { if (r.status === 401) logoutUser(); })
      .catch(() => {});
  }, [session?.token, logoutUser]);

  return (
    <AuthContext.Provider value={{ token: session?.token || null, user: session?.user || null, API: API_BASE, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

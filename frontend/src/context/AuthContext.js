import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { identifyUser, resetUser, ph } from "../lib/posthog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://flourish123-production.up.railway.app";
const API = BACKEND_URL + "/api";
const TOKEN_KEY = "fl_token";

// ── Global axios defaults ─────────────────────────────────────────────────────
axios.defaults.withCredentials = true;

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Returns Authorization header for backwards compatibility with sessions that
  // still have a token in localStorage. New sessions rely on the httpOnly cookie.
  const getHeaders = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    // Hard timeout so a hung network request can't trap the PWA on the
    // loading spinner forever — after 8s we drop to unauthenticated and let
    // the user reach the auth screen.
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => source.cancel("auth_init_timeout"), 8000);

    axios.get(`${API}/auth/me`, { headers, cancelToken: source.token })
      .then(res => {
        setUser(res.data);
        identifyUser(res.data);
      })
      .catch(err => {
        // Finding 1.A — only clear token on 401 (revoked/expired). On 5xx,
        // network drop, timeout, or cancel we keep the token so the PWA
        // recovers on the next successful request rather than logging users
        // out on any Railway hiccup.
        if (err?.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        } else if (axios.isCancel(err)) {
          console.warn("[Flourish] auth init timed out — keeping token, falling back to logged-out UI");
          setUser(null);
        } else {
          console.warn("[Flourish] auth init non-401 failure — keeping token", err?.response?.status);
          setUser(null);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    // Finding 1.D — global 401 interceptor. Any request during the session
    // that returns 401 (revoked token, JWT_SECRET rotated) clears local
    // auth state so the app doesn't stay in a zombie signed-in shell.
    const interceptorId = axios.interceptors.response.use(
      (resp) => resp,
      (error) => {
        if (error?.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  const register = async (email, password, name) => {
    // Read referral code: URL param takes priority, then localStorage
    // (localStorage is set by App.js on landing and survives tab closes/refreshes).
    // Finding 7.A — normalise here as defence-in-depth even though App.js
    // now normalises on capture; direct navigation with `?ref=abc123` that
    // never hits App.js's landing effect would otherwise slip through.
    const ref = (new URLSearchParams(window.location.search).get("ref")
      || localStorage.getItem("fl_ref")
      || "").trim().toUpperCase();
    // Standalone affiliate code (independent of the user-referral system).
    // Stored under its own localStorage key so the two systems can evolve
    // independently; the backend treats each field independently.
    const affiliateCode = (localStorage.getItem("affiliate_code") || ref || "").trim().toUpperCase();
    // Build payload explicitly — no undefined values that could be mishandled
    const payload = {
      email: email.trim().toLowerCase(),
      password,
      name: name || "",
      ...(ref ? { referred_by: ref } : {}),
      ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
    };
    const res = await axios.post(`${API}/auth/register`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    const { user: u, token } = res.data;
    // Persist token in localStorage so auth survives page refreshes on any browser/PWA.
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem("fl_ref"); // consumed — clear so it doesn't affect future signups
    localStorage.removeItem("affiliate_code"); // consumed — same reason
    setUser(u);
    identifyUser(u);
    ph.userSignedUp(u);
    // Signup notification email — EmailJS v4 API uses { publicKey } object
    try {
      const emailjs = await import("@emailjs/browser");
      await emailjs.default.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID,
        process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
        {
          event_type: "New Signup",
          user_email: email,
          details: `Name: ${name || email.split("@")[0]}${ref ? ` | Ref: ${ref}` : ""}`,
          time: new Date().toLocaleString("en-GB"),
        },
        { publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY }
      );
    } catch (e) {
      console.warn("[Flourish] EmailJS signup notification failed:", e);
    }
    return u;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`,
      { email: email.trim().toLowerCase(), password },
      { headers: { "Content-Type": "application/json" } }
    );
    const { user: u, token } = res.data;
    // Persist token in localStorage so auth survives page refreshes on any browser/PWA.
    if (token) localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    identifyUser(u);
    ph.userLoggedIn();
    return u;
  };

  const logout = async () => {
    ph.userLoggedOut();
    resetUser();
    await axios.post(`${API}/auth/logout`, {}, { headers: getHeaders() }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
      setUser(res.data);
    } catch (e) {
      // Finding 1.C — a 401 here means the session is dead; the global
      // interceptor above already clears storage but we still surface a
      // console.warn for observability. On other failures (5xx, network),
      // leave state alone so the caller can retry.
      if (e?.response?.status !== 401) {
        console.warn("[Flourish] refreshUser transient failure — keeping user state:", e?.response?.status);
      }
    }
  };

  const updateProfile = async (profileData) => {
    await axios.put(`${API}/profile`, profileData, { headers: getHeaders(), withCredentials: true });
    await refreshUser();
  };

  // Admin users bypass all premium gates automatically.
  // Use this everywhere instead of user?.is_premium directly.
  const isPremium = !!(user?.is_premium || user?.is_admin);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, isPremium, getHeaders, register, login, logout, refreshUser, updateProfile, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

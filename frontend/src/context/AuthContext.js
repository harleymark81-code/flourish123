import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { identifyUser, resetUser, ph } from "../lib/posthog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://flourish123-production.up.railway.app";
const API = BACKEND_URL + "/api";

// ── Global axios defaults ─────────────────────────────────────────────────────
// withCredentials must be true globally so the httpOnly auth cookie is included
// on every request — setting it per-call is error-prone and easy to miss.
axios.defaults.withCredentials = true;

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth is handled via httpOnly cookie — no token in localStorage/headers.
  const getHeaders = () => ({});

  useEffect(() => {
    axios.get(`${API}/auth/me`)
      .then(res => { setUser(res.data); identifyUser(res.data); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const register = async (email, password, name) => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    // Build payload explicitly — no undefined values that could be mishandled
    const payload = {
      email: email.trim().toLowerCase(),
      password,
      name: name || "",
      ...(ref ? { referred_by: ref } : {}),
    };
    const res = await axios.post(`${API}/auth/register`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    const { user: u } = res.data;
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
    const { user: u } = res.data;
    setUser(u);
    identifyUser(u);
    ph.userLoggedIn();
    return u;
  };

  const logout = async () => {
    ph.userLoggedOut();
    resetUser();
    await axios.post(`${API}/auth/logout`, {}).catch(() => {});
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (e) {
      console.error("[Flourish] refreshUser failed:", e);
    }
  };

  const updateProfile = async (profileData) => {
    await axios.put(`${API}/profile`, profileData);
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

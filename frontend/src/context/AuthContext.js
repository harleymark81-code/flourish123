import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://flourish123-production.up.railway.app";
const API = BACKEND_URL + "/api";
console.log("[Flourish] API base URL:", API);

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth is handled via httpOnly cookie (secure) — no localStorage token storage
  const getHeaders = () => ({});

  useEffect(() => {
    // Attempt to restore session via cookie
    axios.get(`${API}/auth/me`, { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const register = async (email, password, name) => {
    const referred_by = new URLSearchParams(window.location.search).get("ref") || undefined;
    const res = await axios.post(`${API}/auth/register`, { email, password, name, referred_by }, { withCredentials: true });
    const { user: u } = res.data;
    setUser(u);
    // Signup confirmation email
    try {
      const emailjs = await import("@emailjs/browser");
      await emailjs.default.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID,
        process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
        {
          event_type: "New Signup",
          user_email: email,
          details: `Name: ${name || email.split("@")[0]}${referred_by ? ` | Ref: ${referred_by}` : ""}`,
          time: new Date().toLocaleString("en-GB")
        },
        process.env.REACT_APP_EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      console.warn("[Flourish] EmailJS signup notification failed:", e);
    }
    return u;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    const { user: u } = res.data;
    setUser(u);
    return u;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(res.data);
    } catch (e) {
      console.error("[Flourish] refreshUser failed:", e);
    }
  };

  const updateProfile = async (profileData) => {
    await axios.put(`${API}/profile`, profileData, { withCredentials: true });
    await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, getHeaders, register, login, logout, refreshUser, updateProfile, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

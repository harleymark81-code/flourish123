import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("flourish_token"));

  const getHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    const savedToken = localStorage.getItem("flourish_token");
    if (savedToken) {
      setToken(savedToken);
      axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
        withCredentials: true
      }).then(res => {
        setUser(res.data);
      }).catch(() => {
        localStorage.removeItem("flourish_token");
        setToken(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = async (email, password, name) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name }, { withCredentials: true });
    const { user: u, token: t } = res.data;
    localStorage.setItem("flourish_token", t);
    setToken(t);
    setUser(u);
    return u;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    const { user: u, token: t } = res.data;
    localStorage.setItem("flourish_token", t);
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    localStorage.removeItem("flourish_token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: getHeaders(), withCredentials: true });
      setUser(res.data);
    } catch (e) {}
  };

  const updateProfile = async (profileData) => {
    await axios.put(`${API}/profile`, profileData, { headers: getHeaders(), withCredentials: true });
    await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, token, getHeaders, register, login, logout, refreshUser, updateProfile, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid var(--border)", textAlign: "center" }}>
      <p style={{ fontSize: 28, fontWeight: 700, color: color || "#534AB7", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>{label}</p>
    </div>
  );
}

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(","), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("admin_token"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  const headers = { "X-Admin-Token": token };

  useEffect(() => {
    if (token) {
      loadAll();
      const interval = setInterval(loadAll, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadAll = async () => {
    try {
      const [sRes, uRes, tRes, aRes, actRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/transactions`, { headers }),
        axios.get(`${API}/admin/affiliates`, { headers }),
        axios.get(`${API}/admin/activity`, { headers }),
      ]);
      setStats(sRes.data);
      setUsers(uRes.data.users || []);
      setTransactions(tRes.data.transactions || []);
      setAffiliates(aRes.data.applications || []);
      setActivity(actRes.data.activity || []);
    } catch (e) {
      console.error("[Admin] Failed to load dashboard data:", e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/login`, { password });
      localStorage.setItem("admin_token", res.data.token);
      setToken(res.data.token);
    } catch (e) {
      setError("Invalid password");
    }
    setLoading(false);
  };

  const handleAffiliateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/admin/affiliates/${id}/status`, { status }, { headers });
      setAffiliates(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (e) {
      console.error("[Admin] Failed to update affiliate status:", e);
    }
  };

  const maxActivity = Math.max(...activity.map(a => a.count), 1);

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", padding: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Admin Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>Flourish admin access</p>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            data-testid="admin-password-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{ background: "var(--bg-card)", border: "2px solid #E8E6FF", borderRadius: 12, padding: "14px 16px", fontSize: 15, outline: "none" }}
          />
          {error && <p style={{ color: "#A32D2D", fontSize: 14 }}>{error}</p>}
          <button data-testid="admin-login-btn" type="submit" disabled={loading}
            style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  const TABS = ["overview", "users", "subscriptions", "affiliates", "activity"];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Flourish Admin</h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}>Auto-refreshes every 30 seconds</p>
        </div>
        <button onClick={() => { localStorage.removeItem("admin_token"); setToken(null); }}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "var(--text-secondary)" }}>
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: activeTab === tab ? "var(--bg-elevated)" : "transparent", fontWeight: 600, fontSize: 13, color: activeTab === tab ? "#534AB7" : "var(--text-secondary)", cursor: "pointer", textTransform: "capitalize", boxShadow: activeTab === tab ? "0 2px 8px rgba(83,74,183,0.1)" : "none" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <StatCard label="Total Users" value={stats.total_users} color="#534AB7" />
          <StatCard label="Premium Subscribers" value={stats.premium_subscribers} color="#639922" />
          <StatCard label="Monthly Revenue" value={`£${stats.monthly_revenue}`} color="#BA7517" />
          <StatCard label="Pending Affiliates" value={stats.pending_affiliates} color="#F97316" />
        </div>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Users ({users.length})</h2>
            <button onClick={() => exportCSV(users, "flourish_users.csv")} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {["Email", "Name", "Conditions", "Goals", "Premium", "Joined"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{u.email}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{u.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{(u.conditions || []).join(", ")}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{(u.goals || []).join(", ")}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: u.is_premium ? "rgba(99,153,34,0.12)" : "var(--bg-card)", color: u.is_premium ? "#639922" : "var(--text-muted)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {u.is_premium ? "Premium" : "Free"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{u.created_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {activeTab === "subscriptions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Transactions ({transactions.length})</h2>
            <button onClick={() => exportCSV(transactions, "flourish_transactions.csv")} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {["Email", "Plan", "Amount", "Status", "Date"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{t.email}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{t.plan}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>£{t.amount}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: t.payment_status === "paid" ? "rgba(99,153,34,0.12)" : "rgba(186,117,23,0.12)", color: t.payment_status === "paid" ? "#639922" : "#BA7517", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {t.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{t.created_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Affiliates */}
      {activeTab === "affiliates" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Affiliate Applications ({affiliates.length})</h2>
            <button onClick={() => exportCSV(affiliates, "flourish_affiliates.csv")} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Export CSV
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {affiliates.map(a => (
              <div key={a.id} style={{ background: "var(--bg-card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{a.name}</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0" }}>{a.email}</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Niche: {a.condition_niche} · Audience: {a.audience_size}</p>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "6px 0 0" }}>{a.description}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ background: a.status === "approved" ? "rgba(99,153,34,0.12)" : a.status === "rejected" ? "rgba(163,45,45,0.12)" : "rgba(186,117,23,0.12)", color: a.status === "approved" ? "#639922" : a.status === "rejected" ? "#A32D2D" : "#BA7517", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: "capitalize", textAlign: "center" }}>
                      {a.status}
                    </span>
                    {a.status === "pending" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button data-testid={`approve-${a.id}`} onClick={() => handleAffiliateStatus(a.id, "approved")} style={{ background: "#639922", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Approve</button>
                        <button data-testid={`reject-${a.id}`} onClick={() => handleAffiliateStatus(a.id, "rejected")} style={{ background: "#A32D2D", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {affiliates.length === 0 && <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>No affiliate applications yet.</p>}
          </div>
        </div>
      )}

      {/* Activity */}
      {activeTab === "activity" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Daily Food Ratings (Last 30 days)</h2>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, overflowX: "auto" }}>
              {activity.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 28 }}>
                  <div style={{ width: 20, background: "#534AB7", borderRadius: "4px 4px 0 0", height: `${Math.round((d.count / maxActivity) * 100)}px`, minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{d.date.slice(5)}</span>
                </div>
              ))}
              {activity.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No activity data yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

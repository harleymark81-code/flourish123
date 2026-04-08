import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trash2, ChevronLeft, ChevronRight, Lock, BookOpen } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

function getScoreColor(s) {
  if (s >= 70) return "#639922";
  if (s >= 40) return "#BA7517";
  return "#A32D2D";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function FoodDiary({ onOpenPaywall }) {
  const { user, getHeaders, API } = useAuth();
  const isPremium = user?.is_premium;

  // Always call hooks — no early return before hooks
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState([]);
  const [locked, setLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [noteEdit, setNoteEdit] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [stats, setStats] = useState(null);
  const [diaryDates, setDiaryDates] = useState([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!isPremium) return;
    loadEntries(selectedDate);
    loadDiaryDates();
    loadStats();
  }, [selectedDate, isPremium]);

  const loadEntries = async (date) => {
    try {
      const res = await axios.get(`${API}/diary?date=${date}`, { headers: getHeaders(), withCredentials: true });
      setEntries(res.data.entries || []);
      setLocked(res.data.locked || false);
    } catch (e) {}
  };

  const loadDiaryDates = async () => {
    try {
      const res = await axios.get(`${API}/diary/dates`, { headers: getHeaders(), withCredentials: true });
      setDiaryDates(res.data.dates || []);
    } catch (e) {}
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/profile/stats`, { headers: getHeaders(), withCredentials: true });
      setStats(res.data);
    } catch (e) {}
  };

  const handleSaveNote = async (entryId, note) => {
    try {
      await axios.put(`${API}/diary/note`, { entry_id: entryId, note }, { headers: getHeaders(), withCredentials: true });
    } catch (e) {}
  };

  const handleDelete = async (entryId) => {
    try {
      await axios.delete(`${API}/diary/${entryId}`, { headers: getHeaders(), withCredentials: true });
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setConfirmDelete(null);
      loadDiaryDates();
    } catch (e) {}
  };

  const filteredEntries = entries.filter(e => {
    const matchSearch = !searchQuery || (e.food_name || e.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const score = e.overall_score || 0;
    const matchFilter = filter === "all" ? true : filter === "green" ? score >= 70 : filter === "amber" ? score >= 40 && score < 70 : score < 40;
    return matchSearch && matchFilter;
  });

  const navigateDate = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    const newDate = d.toISOString().split("T")[0];
    if (newDate <= today) setSelectedDate(newDate);
  };

  const monthlyStats = (() => {
    const monthDates = diaryDates.filter(d => d.date.startsWith(new Date().toISOString().slice(0, 7)));
    if (!monthDates.length) return null;
    const best = monthDates.reduce((a, b) => a.avg_score > b.avg_score ? a : b, monthDates[0]);
    const worst = monthDates.reduce((a, b) => a.avg_score < b.avg_score ? a : b, monthDates[0]);
    const avg = Math.round(monthDates.reduce((sum, d) => sum + d.avg_score, 0) / monthDates.length);
    return { avg, best, worst };
  })();

  // Free user premium gate — AFTER all hooks
  if (!isPremium) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", paddingBottom: 80 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center" }}>
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(83,74,183,0.25)" }}>
            <BookOpen size={36} color="#fff" />
          </motion.div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1A1A24", marginBottom: 12, letterSpacing: "-0.02em" }}>Your Food Diary</h2>
          <p style={{ fontSize: 15, color: "#6B6A7C", lineHeight: 1.65, marginBottom: 28 }}>
            Your food diary is a Flourish Premium feature. Track every food you eat, see your patterns, and watch your health transform.
          </p>
          <motion.button
            data-testid="diary-unlock-btn"
            whileTap={{ scale: 0.96 }}
            onClick={() => onOpenPaywall("diary")}
            style={{ width: "100%", background: "linear-gradient(135deg, #534AB7, #756AD9)", color: "#fff", border: "none", borderRadius: 14, padding: "17px 24px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.3), inset 0 1px 0 rgba(255,255,255,0.15)", minHeight: 56 }}>
            Unlock with your 3-day free trial
          </motion.button>
          <p style={{ fontSize: 13, color: "#A09FAD", marginTop: 12 }}>Cancel anytime. No charge for 3 days.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", paddingBottom: 80, paddingTop: 56 }}>
      <div style={{ padding: "0 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1A1A24", margin: 0, letterSpacing: "-0.02em" }}>Food Diary</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Flame size={18} color={stats?.streak >= 7 ? "#534AB7" : "#F97316"} />
            <span style={{ fontWeight: 700, color: "#1A1A24", fontSize: 16 }}>{stats?.streak || 0}</span>
          </div>
        </div>

        {/* Monthly stats */}
        {monthlyStats && (
          <div style={{ background: "#F8F7FF", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid #E8E6FF", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 16px rgba(83,74,183,0.08)" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: getScoreColor(monthlyStats.avg), margin: 0 }}>{monthlyStats.avg}</p>
              <p style={{ fontSize: 11, color: "#6B6A7C", margin: 0 }}>Monthly avg</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#639922", margin: 0 }}>Best day</p>
              <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0 }}>{formatDate(monthlyStats.best?.date)} ({monthlyStats.best?.avg_score})</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#A32D2D", margin: 0 }}>Worst day</p>
              <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0 }}>{formatDate(monthlyStats.worst?.date)} ({monthlyStats.worst?.avg_score})</p>
            </div>
          </div>
        )}

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigateDate(-1)}
            style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={16} color="#534AB7" />
          </motion.button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", margin: 0 }}>
              {selectedDate === today ? "Today" : formatDate(selectedDate)}
            </p>
            <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0 }}>{entries.length} food{entries.length !== 1 ? "s" : ""} logged</p>
          </div>
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => selectedDate < today && navigateDate(1)}
            style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: selectedDate < today ? "pointer" : "not-allowed", opacity: selectedDate < today ? 1 : 0.4 }}>
            <ChevronRight size={16} color="#534AB7" />
          </motion.button>
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            data-testid="diary-search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search foods..."
            style={{ flex: 1, background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, padding: "10px 14px", fontSize: 16, outline: "none", color: "#1A1A24" }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "green", "amber", "red"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ background: filter === f ? "#534AB7" : "#F8F7FF", border: `1px solid ${filter === f ? "#534AB7" : "#E8E6FF"}`, borderRadius: 8, width: 32, height: 42, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: f === "all" ? "#534AB7" : f === "green" ? "#639922" : f === "amber" ? "#BA7517" : "#A32D2D", opacity: filter === f ? 1 : 0.4 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        <AnimatePresence>
          {filteredEntries.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "60px 20px" }}>
              <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <span style={{ fontSize: 48 }}>🍽️</span>
              </motion.div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#6B6A7C", marginTop: 12 }}>
                {searchQuery ? "No foods matching your search." : "No foods logged yet."}
              </p>
              <p style={{ fontSize: 14, color: "#A09FAD" }}>
                {searchQuery ? "Try a different name." : "Rate a food from the home screen to start tracking."}
              </p>
            </motion.div>
          ) : (
            filteredEntries.map((entry, i) => (
              <motion.div key={entry.id || i} layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }} exit={{ opacity: 0, height: 0 }}
                style={{ background: "#F8F7FF", borderRadius: 16, padding: 16, border: "1px solid #E8E6FF", marginBottom: 12, boxShadow: "0 2px 16px rgba(83,74,183,0.07)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {entry.product_image ? <img src={entry.product_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : <span style={{ fontSize: 22 }}>🍽️</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1A24", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.food_name || entry.name}</p>
                      <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0, lineHeight: 1.3 }}>{(entry.verdict || "").slice(0, 55)}...</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: getScoreColor(entry.overall_score), display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{entry.overall_score}</span>
                    </div>
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => setConfirmDelete(entry.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minHeight: 36 }}>
                      <Trash2 size={14} color="#A09FAD" />
                    </motion.button>
                  </div>
                </div>
                <textarea
                  data-testid={`diary-note-${entry.id}`}
                  value={noteEdit[entry.id] ?? (entry.note || "")}
                  onChange={e => setNoteEdit(prev => ({ ...prev, [entry.id]: e.target.value }))}
                  onBlur={e => handleSaveNote(entry.id, e.target.value)}
                  placeholder="How did you feel after eating this?"
                  style={{ width: "100%", background: "#fff", border: "1px solid #E8E6FF", borderRadius: 8, padding: "8px 10px", fontSize: 14, color: "#1A1A24", resize: "none", outline: "none", lineHeight: 1.4, boxSizing: "border-box", minHeight: 48 }}
                  rows={2}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 8 }}>Remove from diary?</p>
              <p style={{ fontSize: 14, color: "#6B6A7C", marginBottom: 20 }}>This will permanently remove this entry.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, padding: "12px", fontWeight: 600, cursor: "pointer", color: "#6B6A7C", minHeight: 44 }}>Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, background: "#A32D2D", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer", color: "#fff", minHeight: 44 }}>Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

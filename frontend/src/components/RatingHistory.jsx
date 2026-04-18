import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#A32D2D";
}

function formatDateLabel(dateStr) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  // Format as "18 April 2026"
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function RatingHistory({ onClose, onOpenRating }) {
  const { getHeaders, API } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/scan-history`, {
          headers: getHeaders(),
          withCredentials: true,
        });
        const entries = res.data.history || [];

        // Group by date
        const map = {};
        for (const entry of entries) {
          const date = entry.date || entry.logged_at?.slice(0, 10) || "Unknown";
          if (!map[date]) map[date] = [];
          map[date].push(entry);
        }

        // Sort dates descending
        const sorted = Object.keys(map)
          .sort((a, b) => b.localeCompare(a))
          .map((date) => ({ date, label: formatDateLabel(date), entries: map[date] }));

        setGroups(sorted);
      } catch (e) {
        setError("Couldn't load your rating history.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [API, getHeaders]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--bg-app)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
      }}>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "var(--nav-bg)",
          borderBottom: "1px solid var(--border)",
          padding: "14px 16px",
          paddingTop: "calc(14px + env(safe-area-inset-top, 0px))",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}>
          <X size={18} color="var(--text-primary)" />
        </motion.button>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
          Rating history
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 16px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 14 }}>
            Loading…
          </div>
        )}
        {!loading && error && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 14 }}>
            {error}
          </div>
        )}
        {!loading && !error && groups.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 14 }}>
            No ratings yet.
          </div>
        )}
        {!loading && !error && groups.map((group, gi) => (
          <div key={group.date} style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 10px 2px",
            }}>
              {group.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.entries.map((entry, i) => {
                const score = entry.overall_score ?? entry.overallScore ?? 0;
                return (
                  <motion.div
                    key={entry.id || entry._id || `${gi}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onOpenRating(entry)}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 12,
                      padding: "12px 16px",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}>
                        {entry.product_image ? (
                          <img
                            src={entry.product_image}
                            alt={entry.food_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>🍽️</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {entry.food_name || entry.name}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                          {entry.verdict && entry.verdict.length > 42
                            ? entry.verdict.slice(0, 42) + "…"
                            : entry.verdict || ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: getScoreColor(score),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{score}</span>
                      </div>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

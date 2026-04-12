import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Zap, Brain, Sun, Smile, Star, Moon, Leaf, Flame } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const SYMPTOM_ITEMS = [
  { key: "energy",    label: "Energy",     icon: <Zap size={20} />,   color: "#F59E0B" },
  { key: "bloating",  label: "Bloating",   icon: <Star size={20} />,  color: "#639922" },
  { key: "brain_fog", label: "Brain fog",  icon: <Brain size={20} />, color: "#534AB7" },
  { key: "mood",      label: "Mood",       icon: <Smile size={20} />, color: "#F97316" },
  { key: "skin",      label: "Skin",       icon: <Sun size={20} />,   color: "#EC4899" },
  { key: "sleep",     label: "Sleep",      icon: <Moon size={20} />,  color: "#756AD9" },
  { key: "pain",      label: "Pain/Cramps",icon: <Flame size={20} />, color: "#A32D2D" },
  { key: "digestive", label: "Digestive",  icon: <Leaf size={20} />,  color: "#639922" },
];

const EMOJIS = ["😫", "😕", "😐", "🙂", "😊"];

const DEFAULT_SCORES = { energy: 3, bloating: 3, brain_fog: 3, mood: 3, skin: 3, sleep: 3, pain: 3, digestive: 3 };

export default function SymptomTracker({ onClose }) {
  const { getHeaders, API } = useAuth();
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [todayData, setTodayData] = useState(null);

  useEffect(() => {
    loadToday();
  }, []);

  const loadToday = async () => {
    try {
      const res = await axios.get(`${API}/symptoms/today`, { headers: getHeaders(), withCredentials: true });
      if (res.data) {
        setTodayData(res.data);
        setScores({
          energy:    res.data.energy    || 3,
          bloating:  res.data.bloating  || 3,
          brain_fog: res.data.brain_fog || 3,
          mood:      res.data.mood      || 3,
          skin:      res.data.skin      || 3,
          sleep:     res.data.sleep     || 3,
          pain:      res.data.pain      || 3,
          digestive: res.data.digestive || 3,
        });
      }
    } catch (e) {
      console.error("[Flourish] SymptomTracker loadToday error:", e);
    }
  };

  const handleSave = async () => {
    setSaveError(false);
    try {
      await axios.post(`${API}/symptoms`, scores, { headers: getHeaders(), withCredentials: true });
      ph.symptomCheckinCompleted(scores);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (e) {
      console.error("[Flourish] SymptomTracker save error:", e);
      setSaveError(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0,
        zIndex: 9500,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 300 } }}
        exit={{ y: "100%" }}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--bg-elevated)",
          borderRadius: "24px 24px 0 0",
          display: "flex",
          flexDirection: "column",
          maxHeight: "88vh",
          /* safe area bottom padding */
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>

        {/* Fixed header */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>How are you feeling today?</h2>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <X size={16} color="#6B6A7C" />
            </motion.button>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 16px" }}>Takes under 10 seconds. Rate each from 1–5.</p>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
            {SYMPTOM_ITEMS.map(item => (
              <div key={item.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{item.label}</p>
                  <span style={{ marginLeft: "auto", fontSize: 20 }}>{EMOJIS[scores[item.key] - 1]}</span>
                </div>
                {/* Horizontally scrollable rating row */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                  {[1, 2, 3, 4, 5].map(val => (
                    <motion.button
                      key={val}
                      data-testid={`symptom-${item.key}-${val}`}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setScores(prev => ({ ...prev, [item.key]: val }))}
                      style={{
                        flexShrink: 0,
                        minWidth: 52,
                        flex: 1,
                        height: 44,
                        borderRadius: 10,
                        border: "none",
                        background: scores[item.key] >= val ? item.color : "var(--bg-card)",
                        cursor: "pointer",
                        transition: "background 0.2s",
                        opacity: scores[item.key] >= val ? 1 : 0.3,
                      }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scores[item.key] >= val ? "#fff" : "var(--text-muted)" }}>{val}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed footer button */}
        <div style={{ padding: "16px 20px 20px", flexShrink: 0 }}>
          {saveError && (
            <p style={{ fontSize: 13, color: "#A32D2D", margin: "0 0 8px", textAlign: "center" }}>
              Couldn't save your check-in. Please try again.
            </p>
          )}
          <motion.button
            data-testid="save-symptoms-btn"
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            style={{ width: "100%", background: saved ? "#639922" : saveError ? "#A32D2D" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}>
            {saved ? "Saved!" : saveError ? "Try again" : "Save check-in"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

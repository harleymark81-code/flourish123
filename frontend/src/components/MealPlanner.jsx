import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, ChevronRight } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

function getScoreColor(s) {
  if (s >= 70) return "#639922";
  if (s >= 40) return "#BA7517";
  return "#A32D2D";
}

export default function MealPlanner({ onClose, onRateFood }) {
  const { getHeaders, API } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => { fetchPlan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPlan = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await axios.post(`${API}/food/meal-plan`, {}, { headers: getHeaders(), withCredentials: true });
      setPlan(res.data);
    } catch (e) {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const meals = plan ? [
    { key: "breakfast", label: "Breakfast", ...plan.breakfast },
    { key: "lunch", label: "Lunch", ...plan.lunch },
    { key: "dinner", label: "Dinner", ...plan.dinner },
    { key: "snack", label: "Snack", ...plan.snack },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 300 } }}
        exit={{ y: "100%" }}
        style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: "var(--bg-elevated)", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Your meal plan</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={fetchPlan} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <RefreshCw size={16} color="#534AB7" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} color="#534AB7" />
            </motion.button>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>All meals are green-rated and personalised for your conditions.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw size={32} color="#534AB7" />
            </motion.div>
            <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>Getting your personalised meal plan...</p>
          </div>
        ) : fetchError ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>😔</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Couldn't load your meal plan</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>Check your connection and try again.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={fetchPlan}
              style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>
              Try again
            </motion.button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {meals.map((meal, i) => (
              <motion.div
                key={meal.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, border: "1px solid var(--border)", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>{meal.emoji}</span>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{meal.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>{meal.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{meal.description}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: getScoreColor(meal.predictedScore), display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{meal.predictedScore}</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => { ph.mealPlannerMealRated(meal.name); onClose(); onRateFood(meal.name); }}
                      style={{ background: "none", border: "none", cursor: "pointer" }}>
                      <ChevronRight size={16} color="#534AB7" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

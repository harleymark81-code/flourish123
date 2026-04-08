import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Crown, Flame, ChevronRight, Star, Heart } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import FoodRating from "./FoodRating";
import BarcodeScanner from "./BarcodeScanner";
import MealPlanner from "./MealPlanner";
import Paywall from "./Paywall";
import SymptomTracker from "./SymptomTracker";

const QUICK_PICKS = [
  { name: "Oat milk", emoji: "🥛" },
  { name: "Greek yoghurt", emoji: "🫙" },
  { name: "White bread", emoji: "🍞" },
  { name: "Wild salmon", emoji: "🐟" },
  { name: "Flaxseeds", emoji: "🌰" },
  { name: "Diet Coke", emoji: "🥤" },
  { name: "Soy protein shake", emoji: "💪" },
  { name: "Bone broth", emoji: "🍲" },
  { name: "Avocado", emoji: "🥑" },
  { name: "Blueberries", emoji: "🫐" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#A32D2D";
}

export default function HomeScreen({ onNavigate, onOpenPaywall }) {
  const { user, getHeaders, API } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState(null);
  const [dailyTip, setDailyTip] = useState("");
  const [recentRatings, setRecentRatings] = useState([]);
  const [currentRating, setCurrentRating] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showMealPlanner, setShowMealPlanner] = useState(false);
  const [showPaywallLocal, setShowPaywallLocal] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenPaywall = (entry = "default") => {
    if (onOpenPaywall) onOpenPaywall(entry);
    else setShowPaywallLocal(true);
  };
  const [streakReward, setStreakReward] = useState(null);
  const [showReward, setShowReward] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState([]);
  const [currentLoadMsg, setCurrentLoadMsg] = useState(0);
  const loadMsgInterval = useRef(null);

  const conditions = user?.conditions || [];

  const getMsgs = () => {
    if (conditions.includes("pcos")) return ["Checking insulin impact...", "Analysing estrogen effects...", "Reviewing inflammatory markers...", "Personalising for your PCOS profile..."];
    if (conditions.includes("autoimmune")) return ["Analysing inflammation triggers...", "Checking immune response factors...", "Reviewing gut permeability impact...", "Personalising for your autoimmune profile..."];
    if (conditions.includes("thyroid")) return ["Checking thyroid hormone interactions...", "Analysing iodine and selenium content...", "Reviewing metabolic impact...", "Personalising for your thyroid profile..."];
    if (conditions.includes("ibs")) return ["Analysing gut irritants...", "Checking fermentation potential...", "Reviewing microbiome impact...", "Personalising for your IBS profile..."];
    return ["Analysing ingredient quality...", "Checking nutritional density...", "Reviewing processing level...", "Building your personalised rating..."];
  };

  useEffect(() => {
    loadStats();
    loadDailyTip();
    loadRecentRatings();
    checkStreakReward();
  }, []);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/profile/stats`, { headers: getHeaders(), withCredentials: true });
      setStats(res.data);
    } catch (e) {}
  };

  const loadDailyTip = async () => {
    try {
      const res = await axios.get(`${API}/food/daily-tip`, { headers: getHeaders(), withCredentials: true });
      setDailyTip(res.data.tip);
    } catch (e) {
      setDailyTip("Focus on whole, unprocessed foods today. Your body responds best to foods it recognises.");
    }
  };

  const loadRecentRatings = async () => {
    try {
      const res = await axios.get(`${API}/diary`, { headers: getHeaders(), withCredentials: true });
      setRecentRatings((res.data.entries || []).slice(0, 3));
    } catch (e) {}
  };

  const checkStreakReward = async () => {
    try {
      const res = await axios.get(`${API}/streak/reward`, { headers: getHeaders(), withCredentials: true });
      if (res.data.reward) {
        setStreakReward(res.data.reward);
        setShowReward(true);
        // Check for milestones
        const streak = res.data.streak;
        if ([3, 7, 14, 21, 30].includes(streak)) {
          setShowMilestone(streak);
          if (streak === 7 || streak === 30) {
            setTimeout(() => setShowMilestone(false), 2000);
          }
        }
      }
    } catch (e) {}
  };

  const startLoading = () => {
    const msgs = getMsgs();
    setLoadingMessages(msgs);
    setCurrentLoadMsg(0);
    let idx = 0;
    loadMsgInterval.current = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setCurrentLoadMsg(idx);
    }, 800);
  };

  const stopLoading = () => {
    if (loadMsgInterval.current) clearInterval(loadMsgInterval.current);
  };

  const rateFood = async (foodName, ingredients = "", barcode = "", productImage = "") => {
    if (!foodName.trim()) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      return;
    }
    setLoading(true);
    startLoading();
    try {
      const res = await axios.post(`${API}/food/rate`, {
        food_name: foodName,
        ingredients,
        barcode,
        product_image: productImage
      }, { headers: getHeaders(), withCredentials: true });
      setCurrentRating(res.data);
    } catch (e) {
      if (e.response?.status === 429) {
        handleOpenPaywall();
      }
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      return;
    }
    rateFood(searchQuery);
  };

  const handleBarcodeResult = async (barcode) => {
    setShowScanner(false);
    setLoading(true);
    startLoading();
    try {
      const lookupRes = await axios.get(`${API}/food/barcode/${barcode}`, { headers: getHeaders() });
      if (lookupRes.data.found) {
        const { name, ingredients, image_url } = lookupRes.data;
        const ratingRes = await axios.post(`${API}/food/rate`, {
          food_name: name,
          ingredients,
          barcode,
          product_image: image_url
        }, { headers: getHeaders(), withCredentials: true });
        setCurrentRating(ratingRes.data);
      } else {
        alert(lookupRes.data.message || "Product not found. Try searching by name.");
      }
    } catch (e) {
      if (e.response?.status === 429) handleOpenPaywall();
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const getMilestoneMsg = (streak) => {
    const msgs = {
      3: "You are building a real habit.",
      7: "One week of making conscious choices for your health.",
      14: "Two weeks. Your body is already responding.",
      21: "Three weeks. This is becoming who you are.",
      30: "30 days. You have completely changed your relationship with food."
    };
    return msgs[streak] || "";
  };

  if (currentRating) {
    return <FoodRating
      rating={currentRating}
      onBack={() => { setCurrentRating(null); loadRecentRatings(); loadStats(); }}
      onOpenPaywall={() => handleOpenPaywall()}
    />;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", paddingBottom: 80 }}>
      {/* Streak Reward Banner */}
      <AnimatePresence>
        {showReward && streakReward && (
          <motion.div
            initial={{ y: -80 }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } }}
            exit={{ y: -80 }}
            style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setShowReward(false)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Flame size={20} color="#fff" />
              <p style={{ color: "#fff", margin: 0, fontSize: 14, fontWeight: 600 }}>{streakReward.message}</p>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone Celebration */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !([7, 30].includes(showMilestone)) && setShowMilestone(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(83,74,183,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🔥</div>
              <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{showMilestone} Day Streak!</h2>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16 }}>{getMilestoneMsg(showMilestone)}</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                style={{ marginTop: 24, background: "#fff", color: "#534AB7", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}
                onClick={() => setShowMilestone(false)}>
                Share my streak
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #F8F7FF 0%, #fff 100%)", padding: "52px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 14, color: "#6B6A7C", margin: 0 }}>{getGreeting()}</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A24", margin: "4px 0 0" }}>
              {user?.name || "there"} 🌸
            </h1>
          </div>
          <motion.button
            data-testid="crown-btn"
            whileTap={{ scale: 0.9 }}
            onClick={() => handleOpenPaywall()}
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", border: "none", borderRadius: 12, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>
            <Crown size={20} color="#fff" />
          </motion.button>
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Stats Card */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20 }}
            style={{ background: "#F8F7FF", borderRadius: 16, padding: 20, border: "1px solid #E8E6FF", boxShadow: "0 2px 12px rgba(83,74,183,0.08)", marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6B6A7C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Today at a glance</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: stats.monthly_avg >= 70 ? "#639922" : stats.monthly_avg >= 40 ? "#BA7517" : "#A32D2D", margin: 0 }}>{stats.monthly_avg}</p>
                <p style={{ fontSize: 10, color: "#6B6A7C", margin: 0 }}>Avg Score</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#534AB7", margin: 0 }}>{stats.today_ratings}</p>
                <p style={{ fontSize: 10, color: "#6B6A7C", margin: 0 }}>Logged</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <Flame size={16} color={stats.streak >= 7 ? "#534AB7" : "#F97316"} />
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#1A1A24", margin: 0 }}>{stats.streak}</p>
                </div>
                <p style={{ fontSize: 10, color: "#6B6A7C", margin: 0 }}>Streak</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#534AB7", margin: 0 }}>{stats.remaining_ratings}</p>
                <p style={{ fontSize: 10, color: "#6B6A7C", margin: 0 }}>Left today</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Daily Tip */}
        {dailyTip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, type: "spring", damping: 20 }}
            style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 4px 16px rgba(83,74,183,0.2)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Star size={18} color="#fff" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Today's insight for you</p>
                <p style={{ color: "#fff", fontSize: 14, lineHeight: 1.5, margin: 0 }}>{dailyTip}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Meal Planner Button */}
        <motion.button
          data-testid="meal-planner-btn"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring" }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowMealPlanner(true)}
          style={{ width: "100%", background: "#F8F7FF", border: "2px dashed #534AB7", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>🍽️</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#534AB7" }}>What should I eat today?</span>
          <ChevronRight size={16} color="#534AB7" />
        </motion.button>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: "spring" }}
          style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <motion.input
            data-testid="food-search-input"
            animate={inputShake ? { x: [-5, 5, -5, 5, 0] } : { x: 0 }}
            transition={{ duration: 0.3 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search any food..."
            style={{
              flex: 1, background: "#F8F7FF", border: `2px solid ${inputShake ? "#A32D2D" : "#E8E6FF"}`,
              borderRadius: 12, padding: "14px 16px", fontSize: 15, outline: "none",
              color: "#1A1A24", transition: "all 0.3s"
            }}
          />
          <motion.button
            data-testid="rate-it-btn"
            whileTap={{ scale: 0.95 }}
            onClick={handleSearch}
            disabled={loading}
            style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }}>
            {loading ? "..." : "Rate it"}
          </motion.button>
          <motion.button
            data-testid="scan-btn"
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowScanner(true)}
            style={{ background: "#F8F7FF", border: "2px solid #E8E6FF", borderRadius: 12, padding: "14px 12px", cursor: "pointer" }}>
            <Camera size={20} color="#534AB7" />
          </motion.button>
        </motion.div>

        {/* Loading Message */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: "#F8F7FF", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "center" }}>
              <div
                className="loading-spinner"
                style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #534AB7", borderTopColor: "transparent", margin: "0 auto 12px" }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentLoadMsg}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: "#534AB7", fontWeight: 600, fontSize: 14, margin: 0 }}>
                  {getMsgs()[currentLoadMsg]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Picks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring" }}
          style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 12 }}>Quick picks</p>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {QUICK_PICKS.map((food, i) => (
              <motion.button
                key={food.name}
                data-testid={`quick-pick-${food.name.replace(/\s+/g, "-").toLowerCase()}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.04 } }}
                whileTap={{ scale: 0.93 }}
                onClick={() => rateFood(food.name)}
                style={{
                  flexShrink: 0, background: "#F8F7FF", border: "1px solid #E8E6FF",
                  borderRadius: 12, padding: "10px 14px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 72
                }}>
                <span style={{ fontSize: 22 }}>{food.emoji}</span>
                <span style={{ fontSize: 10, color: "#6B6A7C", fontWeight: 600, textAlign: "center", lineHeight: 1.2, maxWidth: 60 }}>{food.name}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Recently Rated */}
        {recentRatings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 12 }}>Recently rated</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentRatings.map((entry, i) => (
                <motion.div
                  key={entry.id || i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.06 } }}
                  style={{ background: "#F8F7FF", borderRadius: 12, padding: "12px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {entry.product_image ? (
                        <img src={entry.product_image} alt={entry.food_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>🍽️</span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A24", margin: 0 }}>{entry.food_name || entry.name}</p>
                      <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0 }}>{entry.verdict?.slice(0, 40)}...</p>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: getScoreColor(entry.overall_score), display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{entry.overall_score}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Symptom check-in button */}
      <motion.button
        data-testid="symptom-checkin-btn"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring" }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowSymptoms(true)}
        style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", maxWidth: 440, width: "calc(100% - 40px)", background: "#fff", border: "2px solid #E8E6FF", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", zIndex: 8900, boxShadow: "0 4px 16px rgba(83,74,183,0.08)" }}>
        <Heart size={16} color="#534AB7" />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>How are you feeling today?</span>
      </motion.button>

      {/* Modals */}
      <AnimatePresence>
        {showScanner && <BarcodeScanner onResult={handleBarcodeResult} onClose={() => setShowScanner(false)} />}
        {showMealPlanner && <MealPlanner onClose={() => setShowMealPlanner(false)} onRateFood={rateFood} isPremium={user?.is_premium} onOpenPaywall={() => handleOpenPaywall()} />}
        {showPaywallLocal && <Paywall onClose={() => setShowPaywallLocal(false)} user={user} />}
        {showSymptoms && <SymptomTracker onClose={() => setShowSymptoms(false)} />}
      </AnimatePresence>
    </div>
  );
}

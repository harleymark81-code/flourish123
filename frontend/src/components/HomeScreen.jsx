import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Crown, Flame, ChevronRight, Star, Heart } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";
import FoodRating from "./FoodRating";
import BarcodeScanner from "./BarcodeScanner";
import MealPlanner from "./MealPlanner";
import SymptomTracker from "./SymptomTracker";
import SubscriptionScreen from "./SubscriptionScreen";
import RatingHistory from "./RatingHistory";
import BadgeToast from "./BadgeToast";

// Condition-specific food banks — randomised on each session
const FOOD_BANK = {
  pcos: [
    { name: "Spearmint tea", emoji: "🍵" }, { name: "Flaxseeds", emoji: "🌰" },
    { name: "Cinnamon oats", emoji: "🥣" }, { name: "Broccoli", emoji: "🥦" },
    { name: "Wild salmon", emoji: "🐟" }, { name: "Mixed berries", emoji: "🫐" },
    { name: "Walnuts", emoji: "🫙" }, { name: "Sweet potato", emoji: "🍠" },
    { name: "Turmeric latte", emoji: "🥛" }, { name: "Lentil soup", emoji: "🍲" },
    { name: "Pumpkin seeds", emoji: "🌻" }, { name: "Dark chocolate", emoji: "🍫" },
    { name: "Avocado", emoji: "🥑" }, { name: "Greek yoghurt", emoji: "🫙" },
    { name: "Chickpeas", emoji: "🫘" }, { name: "Edamame", emoji: "🟢" },
  ],
  thyroid: [
    { name: "Brazil nuts", emoji: "🥜" }, { name: "Seaweed snack", emoji: "🌿" },
    { name: "Scrambled eggs", emoji: "🥚" }, { name: "Chicken breast", emoji: "🍗" },
    { name: "Tinned tuna", emoji: "🐟" }, { name: "Mushrooms", emoji: "🍄" },
    { name: "Porridge oats", emoji: "🥣" }, { name: "Spinach", emoji: "🥬" },
    { name: "Natural yoghurt", emoji: "🫙" }, { name: "Cheddar cheese", emoji: "🧀" },
    { name: "Quinoa", emoji: "🌾" }, { name: "Sardines", emoji: "🐠" },
    { name: "Pumpkin seeds", emoji: "🌻" }, { name: "Bone broth", emoji: "🍲" },
    { name: "Blueberries", emoji: "🫐" }, { name: "Brown rice", emoji: "🍚" },
  ],
  autoimmune: [
    { name: "Bone broth", emoji: "🍲" }, { name: "Turmeric milk", emoji: "🥛" },
    { name: "Fresh ginger", emoji: "🫚" }, { name: "Olive oil", emoji: "🫒" },
    { name: "Wild salmon", emoji: "🐟" }, { name: "Blueberries", emoji: "🫐" },
    { name: "Kale", emoji: "🥬" }, { name: "Sauerkraut", emoji: "🥗" },
    { name: "Coconut oil", emoji: "🥥" }, { name: "Green tea", emoji: "🍵" },
    { name: "Avocado", emoji: "🥑" }, { name: "Garlic", emoji: "🧄" },
    { name: "Pomegranate", emoji: "🍷" }, { name: "Grass-fed beef", emoji: "🥩" },
    { name: "Fermented kimchi", emoji: "🌶️" }, { name: "Chia seeds", emoji: "🌱" },
  ],
  ibs: [
    { name: "Banana", emoji: "🍌" }, { name: "White rice", emoji: "🍚" },
    { name: "Ginger tea", emoji: "🍵" }, { name: "Cooked carrots", emoji: "🥕" },
    { name: "Chicken breast", emoji: "🍗" }, { name: "Plain potato", emoji: "🥔" },
    { name: "Oat milk", emoji: "🥛" }, { name: "Plain yoghurt", emoji: "🫙" },
    { name: "Peppermint tea", emoji: "🌿" }, { name: "Boiled eggs", emoji: "🥚" },
    { name: "Firm tofu", emoji: "⬜" }, { name: "Blueberries", emoji: "🫐" },
    { name: "Lactose-free milk", emoji: "🥛" }, { name: "Polenta", emoji: "🌽" },
    { name: "Canned salmon", emoji: "🐟" }, { name: "Sourdough bread", emoji: "🍞" },
  ],
  endometriosis: [
    { name: "Dark leafy greens", emoji: "🥬" }, { name: "Turmeric tea", emoji: "🍵" },
    { name: "Fresh ginger", emoji: "🫚" }, { name: "Flaxseeds", emoji: "🌰" },
    { name: "Wild salmon", emoji: "🐟" }, { name: "Broccoli", emoji: "🥦" },
    { name: "Walnuts", emoji: "🫙" }, { name: "Olive oil", emoji: "🫒" },
    { name: "Green tea", emoji: "🍵" }, { name: "Raspberries", emoji: "🍓" },
    { name: "Pumpkin", emoji: "🎃" }, { name: "Red lentils", emoji: "🫘" },
    { name: "Pomegranate seeds", emoji: "🍷" }, { name: "Celery", emoji: "🌿" },
    { name: "Artichoke", emoji: "🌱" }, { name: "Beetroot", emoji: "🔴" },
  ],
  hormonal_imbalance: [
    { name: "Maca powder", emoji: "🌾" }, { name: "Flaxseeds", emoji: "🌰" },
    { name: "Avocado", emoji: "🥑" }, { name: "Leafy greens", emoji: "🥬" },
    { name: "Wild salmon", emoji: "🐟" }, { name: "Eggs", emoji: "🥚" },
    { name: "Pumpkin seeds", emoji: "🌻" }, { name: "Soy milk", emoji: "🥛" },
    { name: "Broccoli sprouts", emoji: "🥦" }, { name: "Dark chocolate", emoji: "🍫" },
    { name: "Chia seeds", emoji: "🌱" }, { name: "Lentils", emoji: "🫘" },
    { name: "Walnuts", emoji: "🫙" }, { name: "Greek yoghurt", emoji: "🫙" },
    { name: "Tempeh", emoji: "🟫" }, { name: "Sweet potato", emoji: "🍠" },
  ],
  type2_diabetes: [
    { name: "Cinnamon tea", emoji: "🍵" }, { name: "Broccoli", emoji: "🥦" },
    { name: "Avocado", emoji: "🥑" }, { name: "Eggs", emoji: "🥚" },
    { name: "Almonds", emoji: "🥜" }, { name: "Greek yoghurt", emoji: "🫙" },
    { name: "Wild salmon", emoji: "🐟" }, { name: "Lentil soup", emoji: "🍲" },
    { name: "Blueberries", emoji: "🫐" }, { name: "Quinoa", emoji: "🌾" },
    { name: "Olive oil", emoji: "🫒" }, { name: "Chia seeds", emoji: "🌱" },
    { name: "Spinach", emoji: "🥬" }, { name: "Apple cider vinegar", emoji: "🧪" },
    { name: "Walnuts", emoji: "🫙" }, { name: "Chickpeas", emoji: "🫘" },
  ],
  general_health: [
    { name: "Avocado", emoji: "🥑" }, { name: "Greek yoghurt", emoji: "🫙" },
    { name: "Oat milk", emoji: "🥛" }, { name: "Wild salmon", emoji: "🐟" },
    { name: "Flaxseeds", emoji: "🌰" }, { name: "Blueberries", emoji: "🫐" },
    { name: "White bread", emoji: "🍞" }, { name: "Diet Coke", emoji: "🥤" },
    { name: "Bone broth", emoji: "🍲" }, { name: "Almonds", emoji: "🥜" },
    { name: "Sweet potato", emoji: "🍠" }, { name: "Dark chocolate", emoji: "🍫" },
    { name: "Eggs", emoji: "🥚" }, { name: "Kimchi", emoji: "🌶️" },
    { name: "Green tea", emoji: "🍵" }, { name: "Quinoa", emoji: "🌾" },
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getConditionPicks(conditions = []) {
  // Merge food banks for user's conditions, deduplicate, shuffle, take 10
  const primary = conditions[0] || "general_health";
  const bank = FOOD_BANK[primary] || FOOD_BANK.general_health;
  // Mix in a few from a second condition if present
  const secondary = conditions[1] ? (FOOD_BANK[conditions[1]] || []) : [];
  const combined = [...bank, ...secondary.slice(0, 4)];
  const seen = new Set();
  const unique = combined.filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
  return shuffle(unique).slice(0, 10);
}

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

const NUDGE_MESSAGES = [
  "You've already spent £4.50 on that coffee. Your hormones are still waiting.",
  "Every meal without Flourish is a guess. How many guesses can your body afford?",
  "You googled your symptoms. You deserve better than that.",
  "Counting calories while ignoring hormones is like fixing a leak with a bucket.",
  "You wouldn't take someone else's prescription. Why follow someone else's diet?",
  "Less than 43p a day. That's what knowing exactly what to eat costs.",
  "One nutritionist appointment costs £80. Flourish costs £12.99 a month. Forever.",
  "Your condition doesn't take days off. Your food intelligence shouldn't either.",
  "Every day you eat blind is a day your hormones pay the price.",
  "Still guessing? For £12.99 a month, that's the most expensive thing you own.",
];

export default function HomeScreen({ onNavigate, pendingFoodName, onPendingFoodConsumed }) {
  const { user, getHeaders, API } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState(null);
  const [dailyTip, setDailyTip] = useState("");
  const [recentRatings, setRecentRatings] = useState([]);
  const [currentRating, setCurrentRating] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showMealPlanner, setShowMealPlanner] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");


  const conditionsKey = (user?.conditions || []).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const quickPicks = useMemo(() => getConditionPicks(user?.conditions), [conditionsKey]);
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
    initBadgeBaseline();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger rating when navigating from My Foods "Rate again"
  useEffect(() => {
    if (pendingFoodName) {
      onPendingFoodConsumed && onPendingFoodConsumed();
      rateFood(pendingFoodName);
    }
  }, [pendingFoodName]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/profile/stats`, { headers: getHeaders(), withCredentials: true });
      setStats(res.data);
    } catch (e) {
      console.error("[Flourish] HomeScreen loadStats error:", e);
    }
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
      setRecentRatings(res.data.entries || []);
    } catch (e) {
      console.error("[Flourish] HomeScreen loadRecentRatings error:", e);
    }
  };

  const checkStreakReward = async () => {
    const today = new Date().toISOString().split("T")[0];
    const dismissedDate = localStorage.getItem("fl_streak_dismissed");
    if (dismissedDate === today) return;

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
    } catch (e) {
      console.error("[Flourish] HomeScreen checkStreakReward error:", e);
    }
  };

  const dismissStreakReward = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("fl_streak_dismissed", today);
    setShowReward(false);
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

  const openRecentRating = (entry) => {
    // Reconstruct the rating object from the saved diary entry.
    // FoodRating expects overallScore (camelCase); diary stores overall_score.
    setCurrentRating({
      ...entry,
      overallScore: entry.overallScore ?? entry.overall_score,
      food_name: entry.food_name || entry.name,
      name: entry.food_name || entry.name,
      id: entry.id || entry._id,
    });
  };

  const BADGE_SEEN_KEY = "fl_seen_badges";

  // On first app load, silently record which badges are already earned so we
  // don't toast for badges the user earned in previous sessions.
  const initBadgeBaseline = async () => {
    try {
      if (localStorage.getItem(BADGE_SEEN_KEY) !== null) return; // already initialised
      const res = await axios.get(`${API}/badges`, { headers: getHeaders(), withCredentials: true });
      const earnedIds = (res.data.badges || []).filter(b => b.earned).map(b => b.id);
      localStorage.setItem(BADGE_SEEN_KEY, JSON.stringify(earnedIds));
    } catch (e) { /* silent */ }
  };

  // Call after any action that could award a badge (food rating, barcode scan,
  // symptom check-in). Fetches current badge state, diffs against the seen list,
  // and queues a toast for each newly earned badge.
  const checkBadges = async () => {
    try {
      const res = await axios.get(`${API}/badges`, { headers: getHeaders(), withCredentials: true });
      const allBadges = res.data.badges || [];
      const earned = allBadges.filter(b => b.earned);
      const earnedIds = earned.map(b => b.id);
      const seen = JSON.parse(localStorage.getItem(BADGE_SEEN_KEY) || "[]");
      const newBadges = earned.filter(b => !seen.includes(b.id));
      localStorage.setItem(BADGE_SEEN_KEY, JSON.stringify(earnedIds));
      if (newBadges.length > 0) {
        setBadgeQueue(q => [...q, ...newBadges]);
      }
    } catch (e) { /* silent */ }
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
      loadStats();
      checkBadges();
    } catch (e) {
      ph.apiError("/food/rate", e.message, e.response?.status);
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
    ph.foodSearched(searchQuery);
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
        ph.barcodeScanned(name, barcode);
        const ratingRes = await axios.post(`${API}/food/rate`, {
          food_name: name,
          ingredients,
          barcode,
          product_image: image_url
        }, { headers: getHeaders(), withCredentials: true });
        setCurrentRating(ratingRes.data);
        checkBadges();
      } else {
        ph.barcodeScanFailed("product_not_found");
        ph.foodNotFound(barcode);
        setBarcodeError(lookupRes.data.message || "Product not found. Try searching by name.");
        setTimeout(() => setBarcodeError(""), 5000);
      }
    } catch (e) {
      ph.barcodeScanFailed("network_error");
      ph.apiError("/food/barcode", e.message, e.response?.status);
      setBarcodeError("Couldn't look up that barcode. Try searching by name.");
      setTimeout(() => setBarcodeError(""), 5000);
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
    ph.ratingViewed(currentRating);
    return <FoodRating
      rating={currentRating}
      onBack={() => { setCurrentRating(null); loadRecentRatings(); loadStats(); }}
      onRateFood={(name) => { setCurrentRating(null); rateFood(name); }}
    />;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Streak Reward Banner */}
      <AnimatePresence>
        {showReward && streakReward && (
          <motion.div
            initial={{ y: -80 }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } }}
            exit={{ y: -80 }}
            style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={dismissStreakReward}>
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
                style={{ marginTop: 24, background: "var(--bg-elevated)", color: "#534AB7", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}
                onClick={() => setShowMilestone(false)}>
                Share my streak
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-app) 100%)", padding: "52px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{getGreeting()}</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" }}>
              {user?.name || "there"} 🌸
            </h1>
          </div>
          <motion.button
            data-testid="crown-btn"
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSubscription(true)}
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
            style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)", boxShadow: "0 2px 12px rgba(83,74,183,0.08)", marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Today at a glance</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: stats.monthly_avg >= 70 ? "#639922" : stats.monthly_avg >= 40 ? "#BA7517" : "#A32D2D", margin: 0 }}>{stats.monthly_avg || "—"}</p>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: 0 }}>Avg Score</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <Flame size={16} color={stats.streak >= 7 ? "#534AB7" : "#F97316"} />
                  <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{stats.streak}</p>
                </div>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: 0 }}>Streak</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#534AB7", margin: 0 }}>{stats.longest_streak || 0}</p>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: 0 }}>Best streak</p>
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
          onClick={() => { setShowMealPlanner(true); ph.mealPlannerOpened(); }}
          style={{ width: "100%", background: "var(--bg-card)", border: "2px dashed #534AB7", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>🍽️</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#534AB7" }}>What should I eat today?</span>
          <ChevronRight size={16} color="#534AB7" />
        </motion.button>

        {/* Barcode error banner */}
        <AnimatePresence>
          {barcodeError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <p style={{ fontSize: 13, color: "#A32D2D", margin: 0, flex: 1 }}>{barcodeError}</p>
              <button onClick={() => setBarcodeError("")} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            </motion.div>
          )}
        </AnimatePresence>

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
              flex: 1, background: "var(--input-bg)", border: `2px solid ${inputShake ? "#A32D2D" : "var(--border)"}`,
              borderRadius: 12, padding: "14px 16px", fontSize: 15, outline: "none",
              color: "var(--input-text)", transition: "all 0.3s"
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
            onClick={() => { setShowScanner(true); ph.barcodeScannerOpened(); }}
            style={{ background: "var(--bg-card)", border: "2px solid var(--border)", borderRadius: 12, padding: "14px 12px", cursor: "pointer" }}>
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
              style={{ background: "var(--bg-card)", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "center" }}>
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

        {/* Quick Picks — condition-personalised, randomised each session */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring" }}
          style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Quick picks for you</p>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {quickPicks.map((food, i) => (
              <motion.button
                key={food.name}
                data-testid={`quick-pick-${food.name.replace(/\s+/g, "-").toLowerCase()}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.04 } }}
                whileTap={{ scale: 0.93 }}
                onClick={() => { ph.quickPickClicked(food.name); rateFood(food.name); }}
                style={{
                  flexShrink: 0, background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "10px 14px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 72
                }}>
                <span style={{ fontSize: 22 }}>{food.emoji}</span>
                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, textAlign: "center", lineHeight: 1.2, maxWidth: 60 }}>{food.name}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Symptom check-in banner — below quick picks */}
        <motion.button
          data-testid="symptom-checkin-btn"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17, type: "spring" }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setShowSymptoms(true); ph.symptomCheckinOpened(); }}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "2px solid var(--border)", borderRadius: 12, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginBottom: 20, boxShadow: "0 2px 12px rgba(83,74,183,0.07)" }}>
          <Heart size={16} color="#534AB7" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>How are you feeling today?</span>
        </motion.button>

        {/* Recently Rated */}
        {recentRatings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Recently rated</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentRatings.map((entry, i) => (
                <motion.div
                  key={entry.id || i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.06 } }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openRecentRating(entry)}
                  style={{ background: "var(--bg-card)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {entry.product_image ? (
                        <img src={entry.product_image} alt={entry.food_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>🍽️</span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{entry.food_name || entry.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{entry.verdict && entry.verdict.length > 40 ? entry.verdict.slice(0, 40) + "…" : (entry.verdict || "")}</p>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: getScoreColor(entry.overall_score), display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{entry.overall_score}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowHistory(true)}
              style={{ marginTop: 10, width: "100%", background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>View all ratings</span>
              <ChevronRight size={14} color="var(--text-muted)" />
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Badge unlock toast — floats above everything */}
      <BadgeToast badge={badgeQueue[0] || null} onDismiss={() => setBadgeQueue(q => q.slice(1))} />

      {/* Modals */}
      <AnimatePresence>
        {showScanner && <BarcodeScanner onResult={handleBarcodeResult} onClose={() => setShowScanner(false)} />}
        {showMealPlanner && <MealPlanner onClose={() => setShowMealPlanner(false)} onRateFood={rateFood} />}
        {showSymptoms && <SymptomTracker onClose={() => { setShowSymptoms(false); checkBadges(); }} />}
        {showSubscription && <SubscriptionScreen onClose={() => setShowSubscription(false)} onUpgrade={() => setShowSubscription(false)} />}
        {showHistory && (
          <RatingHistory
            onClose={() => setShowHistory(false)}
            onOpenRating={(entry) => { setShowHistory(false); openRecentRating(entry); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

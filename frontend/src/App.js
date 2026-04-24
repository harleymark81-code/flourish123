import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Scan, BookOpen, BarChart2, ShoppingBag, User, Moon, Sun } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import SplashScreen from "./components/SplashScreen";
import AuthScreen from "./components/AuthScreen";
import Onboarding from "./components/Onboarding";
import HomeScreen from "./components/HomeScreen";
import FoodDiary from "./components/FoodDiary";
import ProfileScreen from "./components/ProfileScreen";
import Paywall from "./components/Paywall";
import AdminDashboard from "./pages/AdminDashboard";
import AffiliateApplication from "./pages/AffiliateApplication";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import InsightsScreen from "./components/InsightsScreen";
import MyFoodsScreen from "./components/MyFoodsScreen";
import ResetPassword from "./components/ResetPassword";
import FreeScanScreen from "./components/FreeScanScreen";
import axios from "axios";
import "./App.css";
import "./index.css";
import { ph } from "./lib/posthog";

function ConfettiBurst() {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: i % 2 === 0 ? "#534AB7" : "#ffffff",
    x: (Math.random() - 0.5) * 500,
    y: -300 - Math.random() * 400,
    rotate: Math.random() * 720 - 360,
    size: 6 + Math.random() * 9
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ x: "50vw", y: "45vh", opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: `calc(50vw + ${p.x}px)`, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.5 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: Math.random() * 0.4 }}
          style={{ position: "absolute", width: p.size, height: p.size, background: p.color, borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

function StripeReturn() {
  const { getHeaders, API, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const success = params.get("success");
    const cancelled = params.get("cancelled");

    if (cancelled === "true") {
      navigate("/?cancelled=true");
      return;
    }

    if (sessionId && success === "true") {
      let attempts = 0;
      const poll = async () => {
        try {
          const res = await axios.get(`${API}/payments/status/${sessionId}`, {
            headers: getHeaders(), withCredentials: true
          });
          if (res.data.is_success || res.data.payment_status === "paid" || res.data.already_processed) {
            await refreshUser();
            navigate("/?upgraded=true");
            return;
          }
        } catch (e) {}
        if (attempts < 8) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          // Polling timed out — do not assume success, show pending message
          navigate("/?payment_pending=true");
        }
      };
      poll();
    } else if (success === "true") {
      refreshUser().then(() => navigate("/?upgraded=true"));
    } else {
      navigate("/");
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 20, background: "#F8F7FF" }}>
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(83,74,183,0.3)" }}>
        <span style={{ fontSize: 36 }}>🌸</span>
      </motion.div>
      <p style={{ color: "#534AB7", fontWeight: 700, fontSize: 16 }}>Activating your premium...</p>
    </div>
  );
}

function AppContent() {
  const { user, loading, refreshUser, isPremium } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(!sessionStorage.getItem("splash_shown"));
  const [activeTab, setActiveTab] = useState("scan");
  const [pendingFoodName, setPendingFoodName] = useState(null);
  const [showUpgradedModal, setShowUpgradedModal] = useState(false);
  const [showCancelledMsg, setShowCancelledMsg] = useState(false);
  const [showPaymentPending, setShowPaymentPending] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Persist referral code to localStorage so it survives tab closes,
    // page refreshes, and navigation before the visitor signs up.
    const ref = params.get("ref");
    if (ref) localStorage.setItem("fl_ref", ref);

    if (params.get("upgraded") === "true") {
      setShowUpgradedModal(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      setTimeout(() => setShowUpgradedModal(false), 5000);
      // Send EmailJS notification
      if (user?.email) {
        sendPremiumEmail(user.email, "upgraded");
      }
      window.history.replaceState({}, "", "/");
    }
    if (params.get("cancelled") === "true") {
      setShowCancelledMsg(true);
      setTimeout(() => setShowCancelledMsg(false), 6000);
      window.history.replaceState({}, "", "/");
    }
    if (params.get("payment_pending") === "true") {
      setShowPaymentPending(true);
      setTimeout(() => setShowPaymentPending(false), 8000);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const sendPremiumEmail = async (email, plan) => {
    try {
      const emailjs = await import("@emailjs/browser");
      // EmailJS v4 requires { publicKey } object as 4th argument (not a plain string)
      await emailjs.default.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID,
        process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
        {
          event_type: "New Premium Subscriber",
          user_email: email,
          details: `Plan: ${plan}`,
          time: new Date().toLocaleString("en-GB"),
        },
        { publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY }
      );
    } catch (e) {
      console.warn("EmailJS error:", e);
    }
  };

  if (showSplash) return <SplashScreen onComplete={() => { sessionStorage.setItem("splash_shown", "1"); setShowSplash(false); }} />;
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-app)" }}>
      <motion.div animate={{ scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.2, repeat: Infinity }}
        style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 30 }}>🌸</span>
      </motion.div>
    </div>
  );

  if (location.pathname === "/admin") return <AdminDashboard />;
  if (location.pathname === "/affiliate") return <AffiliateApplication />;
  if (location.pathname === "/affiliate/dashboard") return <AffiliateDashboard />;
  if (location.pathname === "/reset-password") return <ResetPassword />;

  const params = new URLSearchParams(window.location.search);
  if (params.get("session_id") && params.get("success") === "true") return <StripeReturn />;
  if (params.get("success") === "true") return <StripeReturn />;

  if (!user) return <AuthScreen />;
  if (!user.onboarding_completed) return <Onboarding onComplete={() => refreshUser()} />;
  // Free scan step — user must experience Flourish before the paywall
  if (!user.has_used_free_scan && !isPremium) {
    return <FreeScanScreen onComplete={() => refreshUser()} />;
  }
  // Hard paywall gate — no app access without active trial or subscription
  if (!isPremium) {
    return <Paywall hardGate onClose={() => {}} user={user} entryPoint="hard_gate" />;
  }
  if (editingProfile) return <Onboarding onComplete={() => setEditingProfile(false)} />;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", position: "relative" }}>

      {/* Confetti */}
      {showConfetti && <ConfettiBurst />}

      {/* Payment pending message */}
      <AnimatePresence>
        {showPaymentPending && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 400 } }}
            exit={{ y: -60, opacity: 0 }}
            style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#BA7517", padding: "12px 20px", zIndex: 9100, textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: 14, margin: 0 }}>Payment received — your account will be upgraded in the next few minutes. If it doesn't update, contact support.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancelled message */}
      <AnimatePresence>
        {showCancelledMsg && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 400 } }}
            exit={{ y: -60, opacity: 0 }}
            style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#1A1A24", padding: "12px 20px", zIndex: 9100, textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: 14, margin: 0 }}>No worries. Your free trial is still waiting whenever you are ready.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "scan" && (
          <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 280 }}>
            <HomeScreen onNavigate={(tab) => setActiveTab(tab)} pendingFoodName={pendingFoodName} onPendingFoodConsumed={() => setPendingFoodName(null)} />
          </motion.div>
        )}
        {activeTab === "diary" && (
          <motion.div key="diary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 280 }}>
            <FoodDiary />
          </motion.div>
        )}
        {activeTab === "insights" && (
          <motion.div key="insights" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 280 }}>
            <InsightsScreen />
          </motion.div>
        )}
        {activeTab === "myfoods" && (
          <motion.div key="myfoods" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 280 }}>
            <MyFoodsScreen onRateFood={(name) => { setPendingFoodName(name); setActiveTab("scan"); }} />
          </motion.div>
        )}
        {activeTab === "profile" && (
          <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 280 }}>
            <ProfileScreen onEditProfile={() => setEditingProfile(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav — 5 tabs */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "var(--nav-bg)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)", padding: "8px 4px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 9000 }}>
        {[
          { id: "scan",     icon: <Scan size={21} />,        label: "Scan"     },
          { id: "diary",    icon: <BookOpen size={21} />,    label: "Diary"    },
          { id: "insights", icon: <BarChart2 size={21} />,   label: "Insights" },
          { id: "myfoods",  icon: <ShoppingBag size={21} />, label: "My Foods" },
          { id: "profile",  icon: <User size={21} />,        label: "Profile"  },
        ].map(tab => (
          <motion.button key={tab.id} data-testid={`nav-${tab.id}`} whileTap={{ scale: 0.88 }}
            onClick={() => { setActiveTab(tab.id); ph.tabChanged(tab.id); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 10px", position: "relative", zIndex: 9001, minHeight: 44, flex: 1 }}>
            <div style={{ color: activeTab === tab.id ? "#534AB7" : "var(--text-muted)" }}>{tab.icon}</div>
            <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === tab.id ? "#534AB7" : "var(--text-muted)" }}>{tab.label}</span>
            {activeTab === tab.id && <motion.div layoutId="tab-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: "#534AB7" }} />}
          </motion.button>
        ))}
        {/* Dark mode toggle — compact */}
        <motion.button
          data-testid="theme-toggle-btn"
          whileTap={{ scale: 0.88 }}
          onClick={toggleTheme}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 10px", zIndex: 9001, minHeight: 44, flex: 1 }}>
          <div style={{ color: "var(--text-muted)" }}>
            {isDark ? <Sun size={21} /> : <Moon size={21} />}
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{isDark ? "Light" : "Dark"}</span>
        </motion.button>
      </div>

      {/* Upgrade success */}
      <AnimatePresence>
        {showUpgradedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9800, background: "rgba(83,74,183,0.96)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: 40 }}>
            <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}>
              <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
              <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, marginBottom: 10, letterSpacing: "-0.02em" }}>Welcome to Premium!</h2>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, marginBottom: 24, lineHeight: 1.5 }}>All features are now unlocked.<br />Your health journey just levelled up.</p>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowUpgradedModal(false)}
                style={{ background: "#fff", color: "#534AB7", border: "none", borderRadius: 12, padding: "14px 32px", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                Let's go!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

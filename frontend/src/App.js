import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home, BookOpen, User } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import SplashScreen from "./components/SplashScreen";
import AuthScreen from "./components/AuthScreen";
import Onboarding from "./components/Onboarding";
import HomeScreen from "./components/HomeScreen";
import FoodDiary from "./components/FoodDiary";
import ProfileScreen from "./components/ProfileScreen";
import SymptomTracker from "./components/SymptomTracker";
import Paywall from "./components/Paywall";
import AdminDashboard from "./pages/AdminDashboard";
import AffiliateApplication from "./pages/AffiliateApplication";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import axios from "axios";
import "./App.css";
import "./index.css";

// Handle Stripe redirect
function StripeReturn() {
  const { getHeaders, API, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const success = params.get("success");

    if (sessionId && success === "true") {
      // Poll for payment status
      let attempts = 0;
      const poll = async () => {
        try {
          const res = await axios.get(`${API}/payments/status/${sessionId}`, {
            headers: getHeaders(),
            withCredentials: true
          });
          if (res.data.payment_status === "paid") {
            await refreshUser();
            navigate("/?upgraded=true");
            return;
          }
        } catch (e) {}
        if (attempts < 5) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          navigate("/");
        }
      };
      poll();
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 16 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
        <div style={{ width: 48, height: 48, border: "3px solid #534AB7", borderTopColor: "transparent", borderRadius: "50%" }} />
      </motion.div>
      <p style={{ color: "#534AB7", fontWeight: 600 }}>Activating your premium...</p>
    </div>
  );
}

function AppContent() {
  const { user, loading, refreshUser } = useAuth();
  // Only show splash on FIRST app load ever (not after login/register)
  const [showSplash, setShowSplash] = useState(!sessionStorage.getItem("splash_shown"));
  const [activeTab, setActiveTab] = useState("home");
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showUpgradedModal, setShowUpgradedModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check for upgrade success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setShowUpgradedModal(true);
      setTimeout(() => setShowUpgradedModal(false), 4000);
    }
  }, []);

  if (showSplash) return <SplashScreen onComplete={() => { sessionStorage.setItem("splash_shown", "1"); setShowSplash(false); }} />;
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{ width: 60, height: 60, borderRadius: 15, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 28 }}>🌸</span>
      </motion.div>
    </div>
  );

  // Special routes
  if (location.pathname === "/admin") return <AdminDashboard />;
  if (location.pathname === "/affiliate") return <AffiliateApplication />;
  if (location.pathname === "/affiliate/dashboard") return <AffiliateDashboard />;

  // Handle Stripe return
  const params = new URLSearchParams(window.location.search);
  if (params.get("session_id") && params.get("success") === "true") return <StripeReturn />;

  if (!user) return <AuthScreen />;
  if (!user.onboarding_completed) {
    return (
      <Onboarding onComplete={() => {
        refreshUser();
      }} />
    );
  }

  if (editingProfile) {
    return (
      <Onboarding
        onComplete={() => setEditingProfile(false)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", position: "relative" }}>
      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "home" && (
          <motion.div key="home" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
            <HomeScreen onNavigate={(tab) => setActiveTab(tab)} />
          </motion.div>
        )}
        {activeTab === "diary" && (
          <motion.div key="diary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
            <FoodDiary onOpenPaywall={() => setShowPaywall(true)} />
          </motion.div>
        )}
        {activeTab === "profile" && (
          <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
            <ProfileScreen
              onOpenPaywall={() => setShowPaywall(true)}
              onEditProfile={() => setEditingProfile(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)", borderTop: "1px solid #E8E6FF",
        padding: "12px 24px 24px", display: "flex", justifyContent: "space-around",
        alignItems: "center", zIndex: 9000
      }}>
        {[
          { id: "home", icon: <Home size={22} />, label: "Home" },
          { id: "diary", icon: <BookOpen size={22} />, label: "Diary" },
          { id: "profile", icon: <User size={22} />, label: "Profile" },
        ].map(tab => (
          <motion.button
            key={tab.id}
            data-testid={`nav-${tab.id}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 20px", position: "relative", zIndex: 9001 }}>
            <div style={{ color: activeTab === tab.id ? "#534AB7" : "#A09FAD", transition: "color 0.3s" }}>
              {tab.icon}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: activeTab === tab.id ? "#534AB7" : "#A09FAD", transition: "color 0.3s" }}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <motion.div layoutId="tab-indicator" style={{ width: 4, height: 4, borderRadius: "50%", background: "#534AB7" }} />
            )}
          </motion.button>
        ))}
      </div>

      {/* Symptom Tracker Modal */}
      <AnimatePresence>
        {showSymptoms && <SymptomTracker onClose={() => setShowSymptoms(false)} />}
        {showPaywall && <Paywall onClose={() => setShowPaywall(false)} user={user} />}
      </AnimatePresence>

      {/* Upgrade Success */}
      <AnimatePresence>
        {showUpgradedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(83,74,183,0.95)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: 40 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
              <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Welcome to Premium!</h2>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16 }}>All features are now unlocked. Enjoy your journey!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

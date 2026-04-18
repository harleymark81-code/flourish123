import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingCart, Clock, Plus, Trash2, Check, X, Loader, Search } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#A32D2D";
}

function ScoreDot({ score }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: score >= 70 ? "rgba(99,153,34,0.12)" : score >= 40 ? "rgba(186,117,23,0.12)" : "rgba(163,45,45,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(score) }}>{score}</span>
    </div>
  );
}

export default function MyFoodsScreen({ onOpenPaywall, onRateFood }) {
  const { user, isPremium, getHeaders, API } = useAuth();
  const [activeTab, setActiveTab] = useState("favourites");
  const [favourites, setFavourites] = useState([]);
  const [history, setHistory] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [loadingFav, setLoadingFav] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingShop, setLoadingShop] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    loadFavourites();
    loadHistory();
    loadShoppingList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFavourites = async () => {
    try {
      const res = await axios.get(`${API}/favourites`, { headers: getHeaders(), withCredentials: true });
      setFavourites(res.data.favourites || []);
    } catch (e) {
      console.error("[Flourish] MyFoodsScreen loadFavourites error:", e);
    } finally {
      setLoadingFav(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API}/scan-history`, { headers: getHeaders(), withCredentials: true });
      setHistory(res.data.history || []);
    } catch (e) {
      console.error("[Flourish] MyFoodsScreen loadHistory error:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadShoppingList = async () => {
    try {
      const res = await axios.get(`${API}/shopping-list`, { headers: getHeaders(), withCredentials: true });
      setShoppingList(res.data.items || []);
    } catch (e) {
      console.error("[Flourish] MyFoodsScreen loadShoppingList error:", e);
    } finally {
      setLoadingShop(false);
    }
  };

  const removeFavourite = async (foodName) => {
    try {
      await axios.post(`${API}/favourites`, { food_name: foodName }, { headers: getHeaders(), withCredentials: true });
      setFavourites(prev => prev.filter(f => f.food_name !== foodName));
    } catch (e) {
      console.error("[Flourish] removeFavourite error:", e);
      setActionError("Couldn't remove favourite. Please try again.");
      setTimeout(() => setActionError(""), 3000);
    }
  };

  const addShoppingItem = async () => {
    if (!newItem.trim()) return;
    setAddingItem(true);
    try {
      const res = await axios.post(`${API}/shopping-list/add`, { name: newItem.trim() }, { headers: getHeaders(), withCredentials: true });
      setShoppingList(prev => [...prev, res.data.item]);
      ph.shoppingItemAdded(newItem.trim());
      setNewItem("");
    } catch (e) {
      console.error("[Flourish] addShoppingItem error:", e);
      ph.apiError("/shopping-list/add", e.message, e.response?.status);
      setActionError("Couldn't add item. Please try again.");
      setTimeout(() => setActionError(""), 3000);
    } finally {
      setAddingItem(false);
    }
  };

  const toggleItem = async (itemId) => {
    try {
      await axios.put(`${API}/shopping-list/${itemId}/toggle`, {}, { headers: getHeaders(), withCredentials: true });
      setShoppingList(prev => prev.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i));
    } catch (e) {
      console.error("[Flourish] toggleItem error:", e);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await axios.delete(`${API}/shopping-list/${itemId}`, { headers: getHeaders(), withCredentials: true });
      setShoppingList(prev => prev.filter(i => i.id !== itemId));
    } catch (e) {
      console.error("[Flourish] removeItem error:", e);
    }
  };

  const clearChecked = async () => {
    try {
      await axios.delete(`${API}/shopping-list`, { headers: getHeaders(), withCredentials: true });
      setShoppingList(prev => prev.filter(i => !i.checked));
    } catch (e) {
      console.error("[Flourish] clearChecked error:", e);
    }
  };

  const addFavToShopList = async (foodName) => {
    if (!isPremium) { onOpenPaywall("shopping_list"); return; }
    try {
      const res = await axios.post(`${API}/shopping-list/add`, { name: foodName, source: "favourites" }, { headers: getHeaders(), withCredentials: true });
      setShoppingList(prev => [...prev, res.data.item]);
      setActiveTab("shopping");
    } catch (e) {
      console.error("[Flourish] addFavToShopList error:", e);
    }
  };

  const tabs = [
    { id: "favourites", label: "Saved", icon: <Heart size={15} /> },
    { id: "history",    label: "History", icon: <Clock size={15} /> },
    { id: "shopping",   label: "Shopping", icon: <ShoppingCart size={15} /> },
  ];

  const filteredHistory = historyFilter
    ? history.filter(h => h.food_name?.toLowerCase().includes(historyFilter.toLowerCase()))
    : history;

  const checkedCount = shoppingList.filter(i => i.checked).length;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-card)", padding: "52px 20px 16px", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>My Foods</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {tabs.map(t => (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveTab(t.id); ph.myFoodsTabChanged(t.id); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: activeTab === t.id ? "#534AB7" : "var(--bg-elevated)",
                color: activeTab === t.id ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${activeTab === t.id ? "#534AB7" : "var(--border)"}`,
                borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>
              {t.icon}
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <AnimatePresence>
          {actionError && (
            <motion.div
              key="action-error"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#A32D2D", margin: 0 }}>{actionError}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {/* ── FAVOURITES ── */}
          {activeTab === "favourites" && (
            <motion.div key="favourites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingFav ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : favourites.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  <Heart size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>No saved foods yet.</p>
                  <p style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.4 }}>Tap the ♥ on any food rating to save it here.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 4px" }}>
                    {isPremium ? `${favourites.length} saved food${favourites.length !== 1 ? "s" : ""}` : `${favourites.length} of 3 free favourites used`}
                  </p>
                  {favourites.map(fav => {
                    const score = fav.rating_data?.overallScore ?? fav.rating_data?.overall_score ?? null;
                    return (
                      <div key={fav.id || fav.food_name} style={{ background: "var(--bg-card)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                        {score !== null && <ScoreDot score={score} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fav.food_name}</p>
                          {fav.saved_at && (
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                              Saved {new Date(fav.saved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => addFavToShopList(fav.food_name)}
                            title="Add to shopping list"
                            style={{ background: "rgba(83,74,183,0.1)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <ShoppingCart size={14} color="#534AB7" />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeFavourite(fav.food_name)}
                            title="Remove from favourites"
                            style={{ background: "rgba(163,45,45,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <X size={14} color="#A32D2D" />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                  {!isPremium && favourites.length >= 3 && (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => onOpenPaywall("favourites")}
                      style={{ background: "rgba(83,74,183,0.08)", border: "1px dashed #534AB7", borderRadius: 12, padding: "13px 16px", cursor: "pointer", color: "#534AB7", fontWeight: 700, fontSize: 13 }}>
                      🔒 Unlock unlimited favourites with Premium
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── HISTORY ── */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  value={historyFilter}
                  onChange={e => setHistoryFilter(e.target.value)}
                  placeholder="Filter history..."
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, color: "var(--input-text)", flex: 1 }}
                />
              </div>

              {loadingHistory ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  <Clock size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>{historyFilter ? "No results found." : "No scan history yet."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 4px" }}>
                    {isPremium ? `${filteredHistory.length} item${filteredHistory.length !== 1 ? "s" : ""}` : `Last ${filteredHistory.length} scans (free)`}
                  </p>
                  {filteredHistory.map((entry, i) => (
                    <div key={entry.id || i} style={{ background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                      <ScoreDot score={entry.overall_score || 0} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.food_name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{entry.date}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { ph.historyItemRerated(entry.food_name); onRateFood && onRateFood(entry.food_name); }}
                        style={{ background: "rgba(83,74,183,0.1)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#534AB7" }}>
                        Rate again
                      </motion.button>
                    </div>
                  ))}
                  {!isPremium && (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => onOpenPaywall("history")}
                      style={{ background: "rgba(83,74,183,0.08)", border: "1px dashed #534AB7", borderRadius: 12, padding: "13px 16px", cursor: "pointer", color: "#534AB7", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                      🔒 Unlock full history with Premium
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── SHOPPING LIST ── */}
          {activeTab === "shopping" && (
            <motion.div key="shopping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!isPremium ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Shopping List is Premium</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5, margin: "0 0 24px" }}>
                    Build a personalised shopping list of foods that work for your condition. Save items from your favourites or add them manually.
                  </p>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => onOpenPaywall("shopping_list")}
                    style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(83,74,183,0.25)" }}>
                    Unlock Shopping List
                  </motion.button>
                </div>
              ) : (
              <>
              {/* Add item */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addShoppingItem()}
                  placeholder="Add item to shopping list..."
                  style={{
                    flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "12px 14px", fontSize: 14,
                    color: "var(--input-text)", outline: "none"
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={addShoppingItem}
                  disabled={addingItem || !newItem.trim()}
                  style={{
                    background: "#534AB7", border: "none", borderRadius: 12,
                    width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0, opacity: newItem.trim() ? 1 : 0.5
                  }}>
                  {addingItem ? <Loader size={16} color="#fff" style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={18} color="#fff" />}
                </motion.button>
              </div>

              {loadingShop ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : shoppingList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>Your shopping list is empty.</p>
                  <p style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.4 }}>Add items manually or from your saved foods.</p>
                </div>
              ) : (
                <>
                  {checkedCount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{checkedCount} item{checkedCount !== 1 ? "s" : ""} checked</span>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={clearChecked}
                        style={{ background: "rgba(163,45,45,0.08)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#A32D2D", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={12} />
                        Clear checked
                      </motion.button>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {shoppingList.map(item => (
                      <motion.div
                        key={item.id}
                        layout
                        style={{
                          background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px",
                          border: `1px solid ${item.checked ? "rgba(99,153,34,0.3)" : "var(--border)"}`,
                          display: "flex", alignItems: "center", gap: 12,
                          opacity: item.checked ? 0.65 : 1
                        }}>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleItem(item.id)}
                          style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                            background: item.checked ? "#639922" : "transparent",
                            border: `2px solid ${item.checked ? "#639922" : "var(--border)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                          {item.checked && <Check size={13} color="#fff" />}
                        </motion.button>
                        <span style={{
                          flex: 1, fontSize: 14, color: "var(--text-primary)", fontWeight: 500,
                          textDecoration: item.checked ? "line-through" : "none"
                        }}>{item.name}</span>
                        {item.source && item.source !== "manual" && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", borderRadius: 4, padding: "2px 6px" }}>{item.source}</span>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeItem(item.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", display: "flex" }}>
                          <X size={14} />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

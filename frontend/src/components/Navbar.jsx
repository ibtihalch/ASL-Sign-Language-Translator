import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";
import { searchUsers } from "../services/api";
import API from "../services/api";
import Chat from "../pages/Chat";

// ── Icons ─────────────────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.5 3.5L5 5M11 11L12.5 12.5M3.5 12.5L5 11M11 5L12.5 3.5"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M13 8.5C12.2 11 9.9 13 7 13C3.7 13 1 10.3 1 7C1 4.1 3 1.8 5.5 1C4.2 2 3 3.7 3 5.5C3 8.5 5.5 11 8.5 11C10.3 11 12 9.8 13 8.5Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const SearchIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
    <path d="m21 21-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const FriendsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

// ── Config notifications ──────────────────────────────────────────────────────
const NOTIF_CONFIG = {
  friend_request: { icon: "bi-person-plus-fill",      bg: "#2563eb" },
  friend_accept:  { icon: "bi-people-fill",           bg: "#16a34a" },
  message:        { icon: "bi-chat-dots-fill",        bg: "#0891b2" },
  quiz:           { icon: "bi-trophy-fill",           bg: "#f59e0b" },
  badge:          { icon: "bi-star-fill",             bg: "#7c3aed" },
  call:           { icon: "bi-camera-video-fill",     bg: "#0891b2" },
  post_like:      { icon: "bi-heart-fill",            bg: "#e11d48" },
  post_comment:   { icon: "bi-chat-quote-fill",       bg: "#2563eb" },
  story_like:     { icon: "bi-heart-fill",            bg: "#f43f5e" },
  story_comment:  { icon: "bi-chat-square-dots-fill", bg: "#7c3aed" },
};
const SOCIAL_TYPES = ["post_like", "post_comment", "story_like", "story_comment"];

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function NotifIcon({ type }) {
  const cfg = NOTIF_CONFIG[type] || { icon: "bi-bell-fill", bg: "#6b7280" };
  return (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <i className={`bi ${cfg.icon}`} style={{ color: "white", fontSize: 14 }} />
    </div>
  );
}

function NotifItem({ notif, th, isDark, onRead, onDelete, onAction }) {
  const [hovered, setHovered] = useState(false);
  const cfg = NOTIF_CONFIG[notif.type] || { icon: "bi-bell-fill", bg: "#6b7280" };

  return (
    <div
      onClick={() => { onRead(notif.id); onAction(notif); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", gap: 10, padding: "10px 12px", cursor: "pointer",
        background: hovered
          ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
          : notif.read ? "transparent" : (isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.05)"),
        borderLeft: notif.read ? "3px solid transparent" : `3px solid ${cfg.bg}`,
        transition: "background 0.15s", position: "relative",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        {notif.from_name ? (
          <>
            <img
              src={notif.from_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.from_name)}&background=2563eb&color=fff&size=36`}
              alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${th.bgCard}` }}>
              <i className={`bi ${cfg.icon}`} style={{ color: "white", fontSize: 8 }} />
            </div>
          </>
        ) : <NotifIcon type={notif.type} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: notif.read ? 500 : 700, color: th.textPrimary, margin: "0 0 2px", lineHeight: 1.4 }}>{notif.title}</p>
        <p style={{ fontSize: 12, color: th.textSecondary, margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notif.body}</p>
        <span style={{ fontSize: 10, color: th.textSecondary }}>{formatTime(notif.created_at)}</span>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: th.textSecondary, cursor: "pointer", fontSize: 14, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", padding: 0 }}
      >
        <i className="bi bi-x" />
      </button>

      {!notif.read && (
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.bg, flexShrink: 0, alignSelf: "center" }} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Navbar() {
  const navigate               = useNavigate();
  const location               = useLocation();
  const { theme, toggleTheme } = useTheme();
  const th                     = themes[theme];
  const isDark                 = theme === "dark";
  const { t, language }        = useLang();
  const user                   = JSON.parse(localStorage.getItem("user") || "{}");
  const isRTL                  = language === "ar";

  // ── Search ──
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [showDrop,   setShowDrop]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // ── Notifications ──
  const [notifs,     setNotifs]     = useState([]);
  const [unread,     setUnread]     = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const pollRef  = useRef(null);

  // ── Demandes d'amis ──
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [showFriends,    setShowFriends]    = useState(false);
  const [friendActions,  setFriendActions]  = useState({});
  const friendRef  = useRef(null);
  const friendPoll = useRef(null);

  // ── Profile dropdown ──
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  // ── Chat ──
  const [chatOpen, setChatOpen] = useState(false);

  // ── Click outside ──
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current    && !wrapRef.current.contains(e.target))    { setShowDrop(false); setSearchOpen(false); setQuery(""); setResults([]); }
      if (notifRef.current   && !notifRef.current.contains(e.target))   setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (friendRef.current  && !friendRef.current.contains(e.target))  setShowFriends(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  // ── Polling notifications ──
  const loadNotifs = useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      setNotifs(res.data.notifications || []);
      setUnread(res.data.unread_count ?? res.data.unread ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    loadNotifs();
    pollRef.current = setInterval(loadNotifs, 15000);
    return () => clearInterval(pollRef.current);
  }, [loadNotifs]);

  // ── Polling demandes d'amis ──
  // ── Polling demandes d'amis ──
const loadFriendRequests = useCallback(async () => {
  try {
    const res  = await API.get("/friends/requests");
    console.log("[DEBUG] friend requests raw:", res.data); // ← voir la vraie structure
    const list = res.data.requests || res.data || [];
    setFriendRequests(list);
    const pending = list.filter(r => !r.status || r.status === "pending");
    setFriendReqCount(pending.length);
  } catch (e) {
    console.error("[DEBUG] loadFriendRequests error:", e);
  }
}, []);
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    loadFriendRequests();
    friendPoll.current = setInterval(loadFriendRequests, 30000);
    return () => clearInterval(friendPoll.current);
  }, [loadFriendRequests]);

  // ── Accepter une demande ──
  const handleAcceptFriend = useCallback(async (senderId) => {
    setFriendActions(prev => ({ ...prev, [senderId]: "loading" }));
    try {
      await API.post(`/friends/accept/${senderId}`);
      setFriendActions(prev => ({ ...prev, [senderId]: "accepted" }));
      setFriendReqCount(c => Math.max(0, c - 1));
    } catch {
      setFriendActions(prev => ({ ...prev, [senderId]: null }));
    }
  }, []);

  // ── Refuser une demande ──
  const handleDeclineFriend = useCallback(async (senderId) => {
    setFriendActions(prev => ({ ...prev, [senderId]: "loading" }));
    try {
      await API.post(`/friends/decline/${senderId}`);
      setFriendActions(prev => ({ ...prev, [senderId]: "declined" }));
      setFriendReqCount(c => Math.max(0, c - 1));
    } catch {
      setFriendActions(prev => ({ ...prev, [senderId]: null }));
    }
  }, []);

  // ── Actions notifications ──
  const handleNotifAction = (notif) => {
    setShowNotifs(false);
    switch (notif.type) {
      case "friend_request":
      case "friend_accept":
        navigate(`/users/${notif.from_user_id}`); break;
      case "message":
        navigate("/home"); break;
      case "quiz":
      case "badge":
        navigate("/profile"); break;
      case "post_like":
      case "post_comment":
      case "story_like":
      case "story_comment":
        if (notif.from_user_id) navigate(`/users/${notif.from_user_id}`); break;
      default: break;
    }
  };

  const markRead = async (id) => {
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
    try { await API.patch(`/notifications/${id}/read`); } catch {}
  };

  const markAllRead = async () => {
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    setUnread(0);
    try { await API.patch("/notifications/read-all"); } catch {}
  };

  const deleteNotif = async (id) => {
    setNotifs(n => n.filter(x => x.id !== id));
    try { await API.delete(`/notifications/${id}`); } catch {}
  };

  // ── Search ──
  const handleSearch = (val) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults([]); setShowDrop(false); return; }
    setLoading(true);
    setShowDrop(true);
    timerRef.current = setTimeout(() => {
      searchUsers(val.trim())
        .then(res => { setResults(res.data); setShowDrop(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 350);
  };

  const goToProfile = (id) => {
    setShowDrop(false); setSearchOpen(false); setQuery(""); setResults([]);
    navigate(`/users/${id}`);
  };

  const initials     = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  const navLinks = [
    { path: "/home",         label: t("nav_home")         },
    { path: "/conversation", label: t("nav_conversation") },
    { path: "/history",      label: t("nav_history")      },
    { path: "/profile",      label: t("nav_profile")      },
    { path: "/dictionary",   label: t("nav_dictionary")   },
  ];

  // Demandes en attente uniquement
  const pendingRequests = friendRequests.filter(r => !r.status || r.status === "pending");

  return (
    <>
      <style>{`
        @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css");
        .nb-link{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:400;cursor:pointer;border:none;background:transparent;transition:background 0.15s,color 0.15s;white-space:nowrap;}
        .nb-link:hover{background:${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)"};}
        .nb-link.active{background:${isDark?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.06)"};color:${th.textPrimary}!important;font-weight:500;}
        .nb-theme-btn{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid ${th.border};background:transparent;color:${th.textSecondary};transition:background 0.15s,color 0.15s;}
        .nb-theme-btn:hover{background:${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)"};color:${th.textPrimary};}
        .nb-icon-btn{position:relative;width:36px;height:36px;border-radius:9px;border:1px solid ${th.border};background:transparent;color:${th.textSecondary};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background 0.15s,color 0.15s,border-color 0.15s;}
        .nb-icon-btn:hover,.nb-icon-btn.active{background:${isDark?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.08)"};color:#2563eb;border-color:rgba(37,99,235,0.3);}
        .nb-search-input{width:100%;box-sizing:border-box;padding:7px 12px 7px 34px;border-radius:9px;border:1.5px solid ${th.border};background:${isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"};color:${th.textPrimary};font-size:13px;outline:none;transition:border-color 0.15s,background 0.15s;font-family:inherit;}
        .nb-search-input:focus{border-color:rgba(37,99,235,0.5);background:${isDark?"rgba(255,255,255,0.09)":"white"};}
        .nb-search-input::placeholder{color:${th.textSecondary};opacity:0.7;}
        .nb-drop-item{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-radius:8px;transition:background 0.12s;}
        .nb-drop-item:hover{background:${isDark?"rgba(255,255,255,0.06)":"rgba(37,99,235,0.06)"};}
        .nb-profile-item{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;font-size:13px;font-weight:500;color:${th.textPrimary};transition:background 0.12s;border:none;background:none;width:100%;text-align:left;}
        .nb-profile-item:hover{background:${isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"}}
        .nb-profile-item.danger{color:#ef4444;}
        .nb-profile-item.danger:hover{background:rgba(239,68,68,0.08);}
        .nb-user-btn{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 5px;border-radius:8px;border:none;background:transparent;cursor:pointer;transition:background 0.15s;}
        .nb-user-btn:hover{background:${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)"};}
        .notif-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${th.textSecondary};padding:8px 12px 4px;opacity:0.7;}
        .fr-item{transition:background 0.12s;}
        .fr-item:hover{background:${isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"};}
        .fr-action-btn{padding:7px 16px;border-radius:7px;font-size:12px;font-weight:700;border:none;cursor:pointer;transition:opacity 0.15s,transform 0.1s;line-height:1;}
        .fr-action-btn:active{transform:scale(0.97);}
        .fr-action-btn:disabled{opacity:0.6;cursor:not-allowed;}
        @keyframes dropDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bellRing{0%,100%{transform:rotate(0)}20%{transform:rotate(-15deg)}40%{transform:rotate(15deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(10deg)}}
        .bell-ring{animation:bellRing 0.6s ease;}
        .search-expand{animation:dropDown 0.15s ease;}
      `}</style>

      <Chat open={chatOpen} onClose={() => setChatOpen(v => !v)} />

      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexDirection: isRTL ? "row-reverse" : "row",
        padding: "0 24px", height: "56px",
        background: th.bgNav, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100, gap: "12px",
      }}>

        {/* ── Logo ── */}
        <div onClick={() => navigate("/home")} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C8 2 5 4 5 8C5 10.2 6.5 12 8 12C9.5 12 11 10.2 11 8C11 4 8 2 8 2Z" fill="#2563eb" opacity="0.9" />
              <path d="M5 8C5 8 3 7 3 9C3 11 5 12 8 12" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11 8C11 8 13 7 13 9C13 11 11 12 8 12" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "600", color: th.textPrimary }}>ASL Translator</span>
        </div>

        {/* ── Nav Links ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <button key={link.path} onClick={() => navigate(link.path)}
                className={`nb-link${isActive ? " active" : ""}`}
                style={{ color: isActive ? th.textPrimary : th.textSecondary }}>
                {link.label}
              </button>
            );
          })}
        </div>

        {/* ── Right side ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>

          {/* Search */}
          <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
            {!searchOpen ? (
              <button className="nb-icon-btn" onClick={() => setSearchOpen(true)} title="Rechercher">
                <SearchIcon color="currentColor" />
              </button>
            ) : (
              <div className="search-expand" style={{ position: "relative", width: 220 }}>
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}>
                  <SearchIcon color={th.textSecondary} />
                </div>
                <input
                  ref={inputRef}
                  className="nb-search-input"
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  onFocus={() => results.length > 0 && setShowDrop(true)}
                />
                {loading && (
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" stroke={th.border} strokeWidth="3" fill="none" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {showDrop && searchOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 260, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 200, animation: "dropDown 0.15s ease", maxHeight: 320, overflowY: "auto" }}>
                {results.length === 0 && !loading ? (
                  <div style={{ padding: "16px 12px", textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: th.textSecondary, margin: 0 }}>Aucun résultat pour "{query}"</p>
                  </div>
                ) : (
                  <div style={{ padding: "6px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: th.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", margin: "4px 6px 6px" }}>
                      {results.length} résultat{results.length > 1 ? "s" : ""}
                    </p>
                    {results.map(u => {
                      const relColor = u.relation === "friend" ? "#16a34a" : u.relation === "request_sent" ? "#f59e0b" : th.textSecondary;
                      const relLabel = u.relation === "friend" ? "Ami" : u.relation === "request_sent" ? "En attente" : u.relation === "request_received" ? "À accepter" : null;
                      return (
                        <div key={u.id} className="nb-drop-item" onClick={() => goToProfile(u.id)}>
                          <img
                            src={u.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2563eb&color=fff&size=36`}
                            alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(37,99,235,0.2)" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 1px", color: th.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
                            <p style={{ fontSize: 11, color: th.textSecondary, margin: 0 }}>{u.role === "hearing_impaired" ? "Malentendant" : "Entendant"} · {u.friends_count} ami{u.friends_count !== 1 ? "s" : ""}</p>
                          </div>
                          {relLabel && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: relColor, background: `${relColor}18`, padding: "2px 7px", borderRadius: 20, border: `1px solid ${relColor}33` }}>
                              {relLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    <div
                      onClick={() => { setShowDrop(false); setSearchOpen(false); setQuery(""); setResults([]); navigate("/users"); }}
                      style={{ padding: "8px 6px 4px", borderTop: `1px solid ${th.border}`, marginTop: 4, cursor: "pointer", textAlign: "center" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Voir tous les résultats →</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ width: "1px", height: "20px", background: th.border }} />

          <button className="nb-theme-btn" onClick={toggleTheme}>
            {isDark ? <SunIcon /> : <MoonIcon />}
            {isDark ? t("nav_light") : t("nav_dark")}
          </button>

          <div style={{ width: "1px", height: "20px", background: th.border }} />

          {/* ── Bouton Amis ── */}
          <div ref={friendRef} style={{ position: "relative" }}>
            <button
              className={`nb-icon-btn${showFriends ? " active" : ""}`}
              onClick={() => { setShowFriends(v => !v); if (!showFriends) loadFriendRequests(); }}
              title="Demandes d'amis"
            >
              <FriendsIcon />
              {friendReqCount > 0 && (
                <div style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${th.bgNav}` }}>
                  {friendReqCount > 9 ? "9+" : friendReqCount}
                </div>
              )}
            </button>

            {showFriends && (
              <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 320, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 14, boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.14)", overflow: "hidden", zIndex: 200, animation: "dropDown 0.18s ease" }}>

                {/* Header dropdown amis */}
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${th.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: th.textPrimary }}>Demandes d'amis</span>
                    {friendReqCount > 0 && (
                      <span style={{ background: "#ef4444", color: "white", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>
                        {friendReqCount}
                      </span>
                    )}
                  </div>
                  {/* ← Lien vers /users */}
                  <button
                    onClick={() => { setShowFriends(false); navigate("/users"); }}
                    style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="#2563eb" strokeWidth="2" />
                      <path d="m21 21-4.35-4.35" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Trouver des amis
                  </button>
                </div>

                {/* Liste demandes */}
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {pendingRequests.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center" }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(37,99,235,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#2563eb" }}>
                        <FriendsIcon />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: th.textPrimary, margin: "0 0 4px" }}>Aucune demande en attente</p>
                      <p style={{ fontSize: 12, color: th.textSecondary, margin: "0 0 16px", opacity: 0.7 }}>Trouvez de nouveaux amis !</p>
                      <button
                        onClick={() => { setShowFriends(false); navigate("/users"); }}
                        style={{ padding: "8px 20px", borderRadius: 8, background: "#2563eb", color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                      >
                        Trouver des amis
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, color: th.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, padding: "10px 16px 6px", opacity: 0.7 }}>
                        {pendingRequests.length} demande{pendingRequests.length > 1 ? "s" : ""}
                      </p>
                     {pendingRequests.map(req => {
  // ── Extraction robuste du senderId ──
  // Format 1 : { sender: { id, name, photo } }
  // Format 2 : { from_id, from_name, from_photo }
  // Format 3 : { from_user_id, from_name, from_photo }
  const sender      = req.sender || {};
  const senderId    = sender.id
                   || req.from_id
                   || req.from_user_id
                   || req.sender_id
                   || null;

  const senderName  = sender.name
                   || req.from_name
                   || req.sender_name
                   || "Utilisateur";

  const senderPhoto = sender.photo
                   || req.from_photo
                   || req.sender_photo
                   || null;

  const senderFriends = sender.friends_count
                     ?? req.friends_count
                     ?? null;

  // Sécurité : si on n'a pas d'id, on skip
  if (!senderId) {
    console.warn("[DEBUG] req sans senderId:", req);
    return null;
  }

  const action = friendActions[senderId];

  return (
    <div key={req.id || senderId} className="fr-item"
      style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>

      {/* Avatar */}
      <img
        src={senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=2563eb&color=fff&size=42`}
        alt=""
        onClick={() => { setShowFriends(false); navigate(`/users/${senderId}`); }}
        style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(37,99,235,0.2)", cursor: "pointer" }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Nom */}
        <p
          onClick={() => { setShowFriends(false); navigate(`/users/${senderId}`); }}
          style={{ fontSize: 13, fontWeight: 700, margin: "0 0 1px", color: th.textPrimary, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {senderName}
        </p>

        {/* Sous-titre */}
        <p style={{ fontSize: 11, color: th.textSecondary, margin: "0 0 8px", opacity: 0.8 }}>
          {senderFriends !== null
            ? `${senderFriends} ami${senderFriends > 1 ? "s" : ""} en commun`
            : formatTime(req.created_at)}
        </p>

        {/* Boutons */}
        {action === "accepted" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-check" style={{ color: "white", fontSize: 12 }} />
            </div>
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>Ami ajouté !</span>
          </div>
        ) : action === "declined" ? (
          <span style={{ fontSize: 12, color: th.textSecondary, fontWeight: 500, opacity: 0.7 }}>
            Demande refusée
          </span>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="fr-action-btn"
              disabled={action === "loading"}
              onClick={() => handleAcceptFriend(senderId)}
              style={{ background: "#2563eb", color: "white", flex: 1 }}
            >
              {action === "loading" ? "..." : "Confirmer"}
            </button>
            <button
              className="fr-action-btn"
              disabled={action === "loading"}
              onClick={() => handleDeclineFriend(senderId)}
              style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)", color: th.textPrimary, flex: 1 }}
            >
              Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
})}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: "10px 16px", borderTop: `1px solid ${th.border}`, textAlign: "center" }}>
                  <button
                    onClick={() => { setShowFriends(false); navigate("/users"); }}
                    style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer", width: "100%", padding: "4px 0" }}
                  >
                    Voir la page de recherche →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat */}
          <button className={`nb-icon-btn${chatOpen ? " active" : ""}`} onClick={() => setChatOpen(v => !v)} title="Messages">
            <i className="bi bi-chat-dots-fill" style={{ fontSize: 15 }} />
          </button>

          {/* ── Notifications ── */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              className={`nb-icon-btn${showNotifs ? " active" : ""}`}
              onClick={() => { setShowNotifs(v => !v); if (!showNotifs) loadNotifs(); }}
              title="Notifications"
            >
              <i className={`bi bi-bell${unread > 0 ? "-fill bell-ring" : ""}`} />
              {unread > 0 && (
                <div style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${th.bgNav}` }}>
                  {unread > 9 ? "9+" : unread}
                </div>
              )}
            </button>

            {showNotifs && (
              <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 340, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 14, boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.14)", overflow: "hidden", zIndex: 200, animation: "dropDown 0.18s ease" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>Notifications</span>
                    {unread > 0 && <span style={{ background: "#ef4444", color: "white", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{unread}</span>}
                  </div>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Tout marquer lu
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center" }}>
                      <i className="bi bi-bell-slash" style={{ fontSize: 28, color: th.textSecondary, opacity: 0.4, display: "block", marginBottom: 10 }} />
                      <p style={{ fontSize: 13, color: th.textSecondary, margin: 0, fontWeight: 600 }}>Aucune notification</p>
                      <p style={{ fontSize: 12, color: th.textSecondary, margin: "4px 0 0", opacity: 0.7 }}>Vous êtes à jour !</p>
                    </div>
                  ) : (
                    <>
                      {notifs.some(n => SOCIAL_TYPES.includes(n.type)) && (
                        <>
                          <div className="notif-section-label">Publications & Stories</div>
                          {notifs.filter(n => SOCIAL_TYPES.includes(n.type)).map(n => (
                            <NotifItem key={n.id} notif={n} th={th} isDark={isDark} onRead={markRead} onDelete={deleteNotif} onAction={handleNotifAction} />
                          ))}
                        </>
                      )}
                      {notifs.some(n => !SOCIAL_TYPES.includes(n.type)) && (
                        <>
                          {notifs.some(n => SOCIAL_TYPES.includes(n.type)) && <div style={{ borderTop: `1px solid ${th.border}`, margin: "4px 0" }} />}
                          <div className="notif-section-label">Activité</div>
                          {notifs.filter(n => !SOCIAL_TYPES.includes(n.type)).map(n => (
                            <NotifItem key={n.id} notif={n} th={th} isDark={isDark} onRead={markRead} onDelete={deleteNotif} onAction={handleNotifAction} />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>

                {notifs.length > 0 && (
                  <div style={{ padding: "10px 16px", borderTop: `1px solid ${th.border}`, textAlign: "center" }}>
                    <button onClick={() => setShowNotifs(false)} style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>
                      Fermer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ width: "1px", height: "20px", background: th.border }} />

          {/* ── Profil ── */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button className="nb-user-btn" onClick={() => setShowProfile(v => !v)}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: user?.photo ? "transparent" : "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "600", color: "#2563eb", overflow: "hidden", flexShrink: 0 }}>
                {user?.photo ? <img src={user.photo} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
              </div>
              <span style={{ fontSize: "13px", color: th.textPrimary, fontWeight: "500" }}>{user?.name}</span>
              <span style={{ color: th.textSecondary }}><ChevronIcon open={showProfile} /></span>
            </button>

            {showProfile && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 200, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 200, animation: "dropDown 0.15s ease" }}>
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: user?.photo ? "transparent" : "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2563eb", overflow: "hidden", flexShrink: 0 }}>
                    {user?.photo ? <img src={user.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: th.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: th.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || user?.role}</p>
                  </div>
                </div>
                <div style={{ padding: "6px" }}>
                  <button className="nb-profile-item" onClick={() => { setShowProfile(false); navigate("/profile"); }}>
                    <i className="bi bi-person-circle" style={{ fontSize: 15, color: "#2563eb" }} /> Mon profil
                  </button>
                  <button className="nb-profile-item" onClick={() => { setShowProfile(false); navigate("/profile?tab=settings"); }}>
                    <i className="bi bi-gear" style={{ fontSize: 15, color: th.textSecondary }} /> Paramètres
                  </button>
                </div>
                <div style={{ borderTop: `1px solid ${th.border}`, padding: "6px" }}>
                  <button className="nb-profile-item danger" onClick={() => { setShowProfile(false); handleLogout(); }}>
                    <i className="bi bi-box-arrow-right" style={{ fontSize: 15 }} /> Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </nav>
    </>
  );
}
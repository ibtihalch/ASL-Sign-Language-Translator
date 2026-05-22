import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";
import { searchUsers, sendFriendRequest } from "../services/api";

export default function UserSearch() {
  const navigate        = useNavigate();
  const { theme }       = useTheme();
  const th              = themes[theme];
  const isDark          = theme === "dark";
  const { language }    = useLang();
  const isRTL           = language === "ar";

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce search
  const [timer, setTimer] = useState(null);
  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timer) clearTimeout(timer);
    if (val.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    setTimer(setTimeout(() => {
      searchUsers(val.trim())
        .then(res => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400));
  };

  const handleAdd = async (userId) => {
    try {
      await sendFriendRequest(userId);
      setResults(prev => prev.map(u =>
        u.id === userId ? { ...u, relation: "request_sent" } : u
      ));
    } catch {}
  };

  const relationLabel = (rel) => {
    if (rel === "friend")           return { text: "Ami",             color: "#16a34a", canAdd: false };
    if (rel === "request_sent")     return { text: "Demande envoyée", color: "#f59e0b", canAdd: false };
    if (rel === "request_received") return { text: "Accepter",        color: "#2563eb", canAdd: false };
    return { text: "Ajouter",  color: "#2563eb", canAdd: true };
  };

  return (
    <div style={{ minHeight:"100vh", background:th.bg, color:th.textPrimary, fontFamily:"'Segoe UI',Arial,sans-serif", direction:isRTL?"rtl":"ltr" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .user-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .user-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
        .add-btn { transition: opacity 0.15s ease, transform 0.15s ease; }
        .add-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      <Navbar />

      <div style={{ maxWidth:680, margin:"0 auto", padding:"32px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom:28, animation:"fadeUp 0.4s ease" }}>
          <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 6px", color:th.textPrimary }}>
            Rechercher des utilisateurs
          </h1>
          <p style={{ fontSize:13, color:th.textSecondary, margin:0 }}>
            Trouve d'autres apprenants ASL et ajoute-les en amis
          </p>
        </div>

        {/* Barre de recherche */}
        <div style={{ position:"relative", marginBottom:24, animation:"fadeUp 0.4s ease 0.05s both" }}>
          {/* Icône loupe */}
          <svg style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}
            width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke={th.textSecondary} strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke={th.textSecondary} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={handleChange}
            placeholder="Rechercher par nom..."
            style={{
              width:"100%", boxSizing:"border-box",
              padding:"12px 16px 12px 42px",
              borderRadius:12, border:`1.5px solid ${th.border}`,
              background:th.bgCard, color:th.textPrimary,
              fontSize:14, fontFamily:"'Segoe UI',Arial,sans-serif",
              outline:"none",
              boxShadow: isDark?"none":"0 2px 8px rgba(0,0,0,0.06)",
            }}
            autoFocus
          />
          {loading && (
            <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation:"spin 0.8s linear infinite" }}>
                <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
                <circle cx="12" cy="12" r="10" stroke={th.border} strokeWidth="3" fill="none"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
          )}
        </div>

        {/* Résultats */}
        {results.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeUp 0.3s ease" }}>
            <p style={{ fontSize:11, fontWeight:700, color:th.textSecondary, textTransform:"uppercase", letterSpacing:"0.6px", margin:"0 0 4px" }}>
              {results.length} résultat{results.length > 1 ? "s" : ""}
            </p>
            {results.map((user) => {
              const rel = relationLabel(user.relation);
              return (
                <div key={user.id} className="user-card" style={{
                  display:"flex", alignItems:"center", gap:14,
                  padding:"14px 16px", borderRadius:14,
                  background:th.bgCard, border:`1px solid ${th.border}`,
                  cursor:"pointer",
                  flexDirection:isRTL?"row-reverse":"row",
                }}>
                  {/* Avatar cliquable → profil */}
                  <div onClick={()=>navigate(`/users/${user.id}`)} style={{ flexShrink:0 }}>
                    <img
                      src={user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=fff&size=48`}
                      alt=""
                      style={{ width:46, height:46, borderRadius:"50%", objectFit:"cover", border:"2px solid #2563eb" }}
                    />
                  </div>

                  {/* Infos */}
                  <div style={{ flex:1, minWidth:0, textAlign:isRTL?"right":"left" }} onClick={()=>navigate(`/users/${user.id}`)}>
                    <p style={{ fontSize:14, fontWeight:700, margin:"0 0 2px", color:th.textPrimary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {user.name}
                    </p>
                    <p style={{ fontSize:11, color:th.textSecondary, margin:"0 0 2px" }}>
                      {user.role === "hearing_impaired" ? "Malentendant" : "Entendant"} · {user.friends_count} ami{user.friends_count > 1 ? "s" : ""}
                    </p>
                    {user.bio && (
                      <p style={{ fontSize:11, color:th.textSecondary, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", opacity:0.8 }}>
                        {user.bio}
                      </p>
                    )}
                  </div>

                  {/* Bouton action */}
                  <button
                    className="add-btn"
                    disabled={!rel.canAdd}
                    onClick={(e) => { e.stopPropagation(); if (rel.canAdd) handleAdd(user.id); }}
                    style={{
                      flexShrink:0, padding:"7px 16px", borderRadius:8, border:"none",
                      background: rel.canAdd ? `linear-gradient(135deg,${rel.color},${rel.color}cc)` : isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)",
                      color: rel.canAdd ? "white" : th.textSecondary,
                      fontWeight:700, fontSize:12, cursor:rel.canAdd?"pointer":"default",
                      whiteSpace:"nowrap",
                    }}
                  >
                    {rel.text}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Etat vide après recherche */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div style={{ textAlign:"center", padding:"48px 0", animation:"fadeUp 0.3s ease" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom:12 }}>
              <circle cx="22" cy="22" r="14" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="2"/>
              <path d="m38 38-5-5" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 16v6M22 25v2" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize:14, fontWeight:700, color:th.textSecondary, margin:"0 0 4px" }}>
              Aucun utilisateur trouvé
            </p>
            <p style={{ fontSize:12, color:th.textSecondary, margin:0, opacity:0.7 }}>
              Essaie un autre nom
            </p>
          </div>
        )}

        {/* Etat initial */}
        {query.length < 2 && (
          <div style={{ textAlign:"center", padding:"48px 0", animation:"fadeUp 0.3s ease 0.1s both" }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ marginBottom:14 }}>
              <circle cx="24" cy="20" r="10" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="1.5"/>
              <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="40" cy="12" r="6" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="1.5"/>
              <path d="M37 22c1-.3 2-.5 3-.5 5.523 0 10 4.477 10 10" stroke={isDark?"#374151":"#d1d5db"} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize:14, fontWeight:700, color:th.textSecondary, margin:"0 0 4px" }}>
              Recherche des apprenants ASL
            </p>
            <p style={{ fontSize:12, color:th.textSecondary, margin:0, opacity:0.7 }}>
              Tape au moins 2 caractères pour commencer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

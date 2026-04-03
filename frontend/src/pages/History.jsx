import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getHistory, deleteMessage } from "../services/api";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

// ── SVG Icons ──────────────────────────────────────────────────
const IconSign = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a2 2 0 0 0-4 0v4"/><path d="M14 8a2 2 0 0 0-4 0v6"/>
    <path d="M10 9a2 2 0 0 0-4 0v5a7 7 0 0 0 14 0v-5"/><path d="M18 8v4"/>
  </svg>
);
const IconMic = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const IconSearch = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconTrash = ({ size = 12, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconClock = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconPlus = ({ size = 12, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconChevronLeft = ({ size = 12, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
);
const IconChevronRight = ({ size = 12, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
);
const IconHistory = ({ size = 17, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>
  </svg>
);
const IconBarChart = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconText = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);
const IconCalendar = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconVolume = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const IconHash = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);

const ASL_COLOR    = "#2563eb";
const SPEECH_COLOR = "#16a34a";
const ACCENT       = "#2563eb";
const typeColor    = (type) => type === "asl" ? ASL_COLOR : SPEECH_COLOR;

// ── ASL Background SVG ────────────────────────────────────────
const AslBackground = ({ isDark }) => (
  <svg viewBox="0 0 1200 200" xmlns="http://www.w3.org/2000/svg"
    style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"  stopColor={isDark?"#0b1120":"#eff6ff"}/>
        <stop offset="50%" stopColor={isDark?"#0f1e38":"#dbeafe"}/>
        <stop offset="100%" stopColor={isDark?"#0b1120":"#eff6ff"}/>
      </linearGradient>
      <linearGradient id="hhand" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#2563eb" stopOpacity={isDark?"0.22":"0.13"}/>
        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={isDark?"0.06":"0.04"}/>
      </linearGradient>
      <linearGradient id="hfade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="40%" stopColor={isDark?"#0b1120":"#eff6ff"} stopOpacity="0"/>
        <stop offset="100%" stopColor={isDark?"#0b1120":"#eff6ff"} stopOpacity="1"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="200" fill="url(#hbg)"/>
    {["H","I","S","T","O","R","I","Q","U","E","A","S","L"].map((l,i)=>(
      <text key={i} x={20+i*92} y={105+(i%4-1.5)*28} fontSize={i%3===0?"72":i%2===0?"54":"44"} fontWeight="900"
        fill="#2563eb" opacity={isDark?"0.045":"0.035"} fontFamily="monospace" style={{userSelect:"none"}}>{l}</text>
    ))}
    <g transform="translate(24,12) rotate(-8)" opacity={isDark?"0.17":"0.10"}>
      <ellipse cx="46" cy="80" rx="28" ry="36" fill="url(#hhand)" stroke="#2563eb" strokeWidth="1"/>
      <rect x="22" y="38" width="9" height="38" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="33" y="35" width="9" height="42" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="44" y="37" width="9" height="40" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="55" y="40" width="8" height="37" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <ellipse cx="11" cy="70" rx="7" ry="11" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8" transform="rotate(-28 11 70)"/>
    </g>
    <g transform="translate(1108,10) rotate(10)" opacity={isDark?"0.17":"0.10"}>
      <ellipse cx="46" cy="78" rx="28" ry="36" fill="url(#hhand)" stroke="#2563eb" strokeWidth="1"/>
      <ellipse cx="12" cy="68" rx="7" ry="12" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8" transform="rotate(-22 12 68)"/>
      <rect x="22" y="46" width="9" height="27" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="33" y="44" width="9" height="29" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="44" y="46" width="9" height="27" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
      <rect x="55" y="49" width="8" height="24" rx="4" fill="url(#hhand)" stroke="#2563eb" strokeWidth="0.8"/>
    </g>
    {Array.from({length:12},(_,i)=>Array.from({length:3},(_,j)=>(
      <circle key={`${i}-${j}`} cx={80+i*100} cy={35+j*50} r="1" fill="#2563eb" opacity={isDark?"0.07":"0.05"}/>
    )))}
    <rect width="1200" height="200" fill="url(#hfade)"/>
  </svg>
);

const MiniBar = ({ pct, color, isDark }) => (
  <div style={{ flex:1, height:3, background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)", borderRadius:4, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:4, transition:"width 0.6s ease" }}/>
  </div>
);

const StatCard = ({ value, label, color, sub, th, isDark }) => (
  <div style={{ flex:"1 1 90px", background:isDark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.85)", border:`1px solid ${th.border}`, borderRadius:8, padding:"8px 10px", backdropFilter:"blur(8px)", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${color},${color}88)`, borderRadius:"8px 8px 0 0" }}/>
    <span style={{ display:"block", fontSize:18, fontWeight:800, color, letterSpacing:"-0.7px", lineHeight:1, marginBottom:2 }}>{value}</span>
    <span style={{ display:"block", fontSize:9, fontWeight:700, color:th.textSecondary, textTransform:"uppercase", letterSpacing:"0.3px" }}>{label}</span>
    {sub && <span style={{ display:"block", fontSize:9, color:th.textMuted, marginTop:1 }}>{sub}</span>}
  </div>
);

const Chip = ({ icon: Icon, label, value, th }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:10, color:th.textSecondary }}>
    <Icon size={9} color={th.textMuted}/> <span style={{color:th.textMuted}}>{label}</span> <strong style={{color:th.textSecondary, fontWeight:600}}>{value}</strong>
  </span>
);

// ════════════════════════════════════════════════════════════════
export default function History() {
  const navigate        = useNavigate();
  const { theme }       = useTheme();
  const th              = themes[theme];
  const isDark          = theme === "dark";
  const { t, language } = useLang();
  const isRTL           = language === "ar";
  const dir             = isRTL ? "rtl" : "ltr";

  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [deletingId,  setDeletingId]  = useState(null);
  const [hoveredId,   setHoveredId]   = useState(null);
  const [expandedId,  setExpandedId]  = useState(null);
  const [allMessages, setAllMessages] = useState([]);

  const fetchHistory = async (p = 1, type = "") => {
    setLoading(true); setError("");
    try {
      const res = await getHistory(p, type);
      setMessages(res.data.messages);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
      setPage(p);
      if (p === 1) setAllMessages(res.data.messages);
    } catch { setError(t("hist_loading")); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchHistory(1, filter); }, [filter]);

  const handleDelete = async (id) => {
    if (!window.confirm(t("hist_delete_confirm"))) return;
    setDeletingId(id);
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      setTotal((prev) => prev - 1);
    } catch { alert("Erreur ❌"); }
    finally  { setDeletingId(null); }
  };

  const totalAsl    = allMessages.filter((m) => m.type === "asl").length;
  const totalSpeech = allMessages.filter((m) => m.type === "speech").length;
  const avgLen      = allMessages.length > 0 ? Math.round(allMessages.reduce((a,m) => a+m.text.length,0)/allMessages.length) : 0;
  const longestMsg  = allMessages.length > 0 ? Math.max(...allMessages.map((m) => m.text.length)) : 0;
  const aslPct      = total > 0 ? Math.round((totalAsl/total)*100) : 0;
  const speechPct   = total > 0 ? Math.round((totalSpeech/total)*100) : 0;

  const groupByDate = (msgs) => {
    const groups = {};
    msgs.forEach((msg) => {
      const d = new Date(msg.created_at);
      const today = new Date(); const yest = new Date(); yest.setDate(today.getDate()-1);
      let label;
      if      (d.toDateString()===today.toDateString()) label = t("hist_today");
      else if (d.toDateString()===yest.toDateString())  label = t("hist_yesterday");
      else {
        const loc = language==="ar"?"ar-MA":language==="en"?"en-GB":"fr-FR";
        label = d.toLocaleDateString(loc,{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(msg);
    });
    return groups;
  };

  const filtered = messages.filter((m) => m.text.toLowerCase().includes(search.toLowerCase()));
  const grouped  = groupByDate(filtered);

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString(language==="ar"?"ar-MA":language==="en"?"en-GB":"fr-FR",{hour:"2-digit",minute:"2-digit"});
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(language==="ar"?"ar-MA":language==="en"?"en-GB":"fr-FR",{day:"2-digit",month:"short",year:"numeric"});
  const fmtFull = (iso) => new Date(iso).toLocaleString(language==="ar"?"ar-MA":language==="en"?"en-GB":"fr-FR",{weekday:"short",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  const lbl = (fr,en,ar) => language==="ar"?ar:language==="en"?en:fr;

  return (
    <div style={{ minHeight:"100vh", background:th.bg, color:th.textPrimary, fontFamily:"'Segoe UI',Arial,sans-serif", direction:dir }}>
      <style>{`
        @keyframes spin   { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        .msg-row { transition:background 0.15s,border-color 0.15s,box-shadow 0.15s,transform 0.15s; }
        .msg-row:hover { transform:translateX(${isRTL?"-2px":"2px"}); }
        .del-btn { transition:background 0.13s,transform 0.13s; }
        .del-btn:hover:not(:disabled) { transform:scale(1.1); background:rgba(220,38,38,0.14)!important; }
        .filt-btn { transition:all 0.14s; }
        .filt-btn:hover { border-color:${ACCENT}!important; color:${ACCENT}!important; }
        .pg-btn { transition:all 0.14s; }
        .pg-btn:hover:not(:disabled) { transform:translateY(-1px); }
        input::placeholder { color:${isDark?"#4a5568":"#9ca3af"}; }
        input:focus { border-color:${ACCENT}!important; box-shadow:0 0 0 2px rgba(37,99,235,0.12)!important; outline:none; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:${isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}; border-radius:6px; }
      `}</style>

      <Navbar />

      {/* ══ HERO ══ */}
      <div style={{ position:"relative", overflow:"hidden", borderBottom:`1px solid ${th.border}` }}>
        <AslBackground isDark={isDark}/>
        <div style={{ position:"relative", zIndex:1, margin:"0 auto", padding:"18px 16px 15px" }}>

          {/* Title + button */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:12, flexDirection:isRTL?"row-reverse":"row" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:isRTL?"flex-end":"flex-start", gap:2 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, flexDirection:isRTL?"row-reverse":"row" }}>
                <div style={{ width:28, height:28, borderRadius:7, background:"rgba(37,99,235,0.15)", border:"1px solid rgba(37,99,235,0.28)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <IconHistory size={15} color={ACCENT}/>
                </div>
                <h1 style={{ fontSize:18, fontWeight:800, margin:0, letterSpacing:"-0.3px" }}>{t("hist_title")}</h1>
              </div>
              <p style={{ margin:0, fontSize:11, color:th.textSecondary }}>{total} {t("hist_messages")}</p>
            </div>
            <button onClick={() => navigate("/conversation")}
              style={{ padding:"6px 12px", borderRadius:7, border:"none", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, color:"white", fontWeight:700, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:5, boxShadow:"0 2px 8px rgba(37,99,235,0.28)", flexShrink:0, flexDirection:isRTL?"row-reverse":"row" }}>
              <IconPlus size={11} color="white"/> {t("hist_new")}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:10, animation:"fadeUp 0.5s ease 0.08s both" }}>
            <StatCard value={total}       label={lbl("Total","Total","الإجمالي")}           color={ACCENT}       th={th} isDark={isDark}/>
            <StatCard value={totalAsl}    label={t("hist_asl")}                              color={ASL_COLOR}    th={th} isDark={isDark} sub={`${aslPct}%`}/>
            <StatCard value={totalSpeech} label={t("hist_vocal")}                            color={SPEECH_COLOR} th={th} isDark={isDark} sub={`${speechPct}%`}/>
            <StatCard value={avgLen}      label={lbl("Moy. car.","Avg. chars","متوسط")}      color="#f59e0b"      th={th} isDark={isDark}/>
            <StatCard value={longestMsg}  label={lbl("Plus long","Longest","أطول")}          color="#0891b2"      th={th} isDark={isDark}/>
          </div>

          {/* Distribution */}
          {total > 0 && (
            <div style={{ background:isDark?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.7)", border:`1px solid ${th.border}`, borderRadius:7, padding:"8px 11px", backdropFilter:"blur(6px)", animation:"fadeUp 0.5s ease 0.12s both" }}>
              <p style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px", color:th.textSecondary, margin:"0 0 7px", textAlign:isRTL?"right":"left" }}>
                {lbl("Répartition","Distribution","التوزيع")}
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { label:t("hist_asl"),   val:totalAsl,    pct:aslPct,    color:ASL_COLOR    },
                  { label:t("hist_vocal"), val:totalSpeech, pct:speechPct, color:SPEECH_COLOR },
                ].map((b) => (
                  <div key={b.label}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, flexDirection:isRTL?"row-reverse":"row" }}>
                      <span style={{ fontSize:10, color:th.textSecondary, fontWeight:600 }}>{b.label}</span>
                      <div style={{ display:"flex", gap:5 }}>
                        <span style={{ fontSize:10, color:th.textMuted }}>{b.val} msg</span>
                        <span style={{ fontSize:10, fontWeight:800, color:b.color }}>{b.pct}%</span>
                      </div>
                    </div>
                    <MiniBar pct={b.pct} color={b.color} isDark={isDark}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ maxWidth:1500, margin:"0 auto", padding:"14px 16px 40px" }}>

        {/* Search + Filters */}
        <div style={{ marginBottom:12, display:"flex", flexDirection:"column", gap:6, animation:"fadeUp 0.4s ease 0.1s both" }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", [isRTL?"right":"left"]:9, top:"50%", transform:"translateY(-50%)", color:th.textSecondary, display:"flex" }}>
              <IconSearch size={12}/>
            </span>
            <input type="text" placeholder={t("hist_search")} value={search} onChange={(e)=>setSearch(e.target.value)}
              style={{ width:"100%", boxSizing:"border-box", padding:isRTL?"7px 30px 7px 24px":"7px 24px 7px 30px", borderRadius:7, border:`1.5px solid ${th.border}`, background:th.bgCard, color:th.textPrimary, fontSize:12, transition:"border-color 0.2s,box-shadow 0.2s", direction:dir }}
            />
            {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", [isRTL?"left":"right"]:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:th.textSecondary, fontSize:14, lineHeight:1 }}>×</button>}
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", flexDirection:isRTL?"row-reverse":"row" }}>
            {[
              { val:"",       Icon:IconHistory, label:t("hist_all")   },
              { val:"asl",    Icon:IconSign,    label:t("hist_asl")   },
              { val:"speech", Icon:IconMic,     label:t("hist_vocal") },
            ].map((f)=>(
              <button key={f.val} className="filt-btn" onClick={()=>{setFilter(f.val);setPage(1);}}
                style={{ padding:"4px 10px", borderRadius:12, cursor:"pointer", fontSize:11, fontWeight:600, border:`1.5px solid ${filter===f.val?ACCENT:th.border}`, background:filter===f.val?(isDark?"rgba(37,99,235,0.17)":"rgba(37,99,235,0.09)"):th.bgCard, color:filter===f.val?ACCENT:th.textSecondary, display:"flex", alignItems:"center", gap:4, flexDirection:isRTL?"row-reverse":"row" }}>
                <f.Icon size={10} color={filter===f.val?ACCENT:th.textSecondary}/>
                {f.label}
                {filter===f.val && total>0 && <span style={{ background:ACCENT, color:"white", borderRadius:20, padding:"0 5px", fontSize:9, fontWeight:700 }}>{total}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:"center", padding:"44px 0" }}>
            <div style={{ width:26, height:26, border:`3px solid ${th.border}`, borderTop:`3px solid ${ACCENT}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 10px" }}/>
            <p style={{ color:th.textSecondary, fontSize:12 }}>{t("hist_loading")}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign:"center", padding:18, background:isDark?"rgba(220,38,38,0.08)":"rgba(220,38,38,0.05)", borderRadius:9, border:"1px solid rgba(220,38,38,0.2)" }}>
            <p style={{ color:"#dc2626", fontWeight:600, marginBottom:9, fontSize:12 }}>{error}</p>
            <button onClick={()=>fetchHistory(1,filter)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:"#dc2626", color:"white", fontWeight:700, cursor:"pointer", fontSize:11 }}>{t("hist_retry")}</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length===0 && (
          <div style={{ textAlign:"center", padding:"38px 20px", animation:"fadeUp 0.4s ease" }}>
            <div style={{ width:44, height:44, borderRadius:11, background:isDark?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.07)", border:"1px solid rgba(37,99,235,0.2)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
              {search ? <IconSearch size={18} color={ACCENT}/> : <IconHistory size={18} color={ACCENT}/>}
            </div>
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{search ? t("hist_empty_search") : t("hist_empty")}</h3>
            <p style={{ color:th.textSecondary, fontSize:11, marginBottom:14 }}>{search ? `"${search}"` : t("hist_start")}</p>
            {!search && (
              <button onClick={()=>navigate("/conversation")} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, color:"white", fontWeight:700, cursor:"pointer", fontSize:11 }}>
                {t("hist_start")}
              </button>
            )}
          </div>
        )}

        {/* ── Grouped messages ── */}
        {!loading && !error && Object.entries(grouped).map(([dateLabel, msgs], gi) => (
          <div key={dateLabel} style={{ marginBottom:14, animation:`fadeUp 0.4s ease ${gi*0.06}s both` }}>

            {/* Date separator */}
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7, flexDirection:isRTL?"row-reverse":"row" }}>
              <div style={{ flex:1, height:1, background:th.border }}/>
              <span style={{ fontSize:9, color:th.textSecondary, fontWeight:700, whiteSpace:"nowrap", padding:"2px 8px", background:th.bgCard, borderRadius:10, border:`1px solid ${th.border}`, display:"flex", alignItems:"center", gap:3 }}>
                <IconCalendar size={9} color={th.textMuted}/> {dateLabel}
                <span style={{ background:isDark?"rgba(37,99,235,0.18)":"rgba(37,99,235,0.1)", color:ACCENT, borderRadius:8, padding:"0 4px", fontSize:8, fontWeight:800 }}>{msgs.length}</span>
              </span>
              <div style={{ flex:1, height:1, background:th.border }}/>
            </div>

            {/* Message cards */}
            {msgs.map((msg, mi) => {
              const isHov  = hoveredId  === msg._id;
              const isExp  = expandedId === msg._id;
              const words  = wordCount(msg.text);
              const chars  = msg.text.length;
              const tColor = typeColor(msg.type);
              const isLong = chars > 120;

              return (
                <div key={msg._id} className="msg-row"
                  onMouseEnter={()=>setHoveredId(msg._id)}
                  onMouseLeave={()=>setHoveredId(null)}
                  style={{
                    marginBottom:5, borderRadius:9, overflow:"hidden",
                    background: isHov?(isDark?"rgba(37,99,235,0.06)":"rgba(37,99,235,0.04)"):th.bgCard,
                    border:`1px solid ${isHov?"rgba(37,99,235,0.26)":th.border}`,
                    boxShadow: isHov?`0 3px 10px ${isDark?"rgba(0,0,0,0.20)":"rgba(37,99,235,0.07)"}`:`0 1px 2px ${isDark?"rgba(0,0,0,0.10)":"rgba(0,0,0,0.03)"}`,
                    animation:`fadeUp 0.35s ease ${gi*0.05+mi*0.03}s both`,
                  }}
                >
                  <div style={{ display:"flex", flexDirection:isRTL?"row-reverse":"row" }}>
                    {/* Stripe */}
                    <div style={{ width:3, background:`linear-gradient(180deg,${tColor},${tColor}55)`, flexShrink:0 }}/>
                    {/* Icon */}
                    <div style={{ width:37, display:"flex", alignItems:"center", justifyContent:"center", background:isDark?`${tColor}15`:`${tColor}0d`, flexShrink:0 }}>
                      {msg.type==="asl" ? <IconSign size={15} color={tColor}/> : <IconMic size={15} color={tColor}/>}
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, padding:"8px 10px", minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:600, margin:"0 0 5px", color:th.textPrimary, lineHeight:1.45, wordBreak:"break-word",
                        ...(isLong&&!isExp?{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}:{})
                      }}>{msg.text}</p>

                      {/* Row 1 */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3, flexDirection:isRTL?"row-reverse":"row" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:10, background:isDark?`${tColor}1e`:`${tColor}0e`, color:tColor, textTransform:"uppercase", border:`1px solid ${tColor}2e` }}>
                          {msg.type==="asl"?<IconSign size={8} color={tColor}/>:<IconMic size={8} color={tColor}/>}
                          {msg.type==="asl"?t("hist_asl"):t("hist_vocal")}
                        </span>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:10, color:th.textSecondary }}>
                          <IconClock size={9} color={th.textMuted}/> {fmtTime(msg.created_at)}
                        </span>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:10, color:th.textMuted }}>
                          <IconCalendar size={9} color={th.textMuted}/> {fmtDate(msg.created_at)}
                        </span>
                      </div>

                      {/* Row 2 */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", flexDirection:isRTL?"row-reverse":"row" }}>
                        <Chip icon={IconText}     label={lbl("mots","words","كلمة")}  value={words} th={th}/>
                        <Chip icon={IconHash}     label={lbl("car.","chars","حرف")}   value={chars} th={th}/>
                        <Chip icon={IconBarChart} label={lbl("long.","len.","الطول")} value={`${Math.round((chars/(longestMsg||1))*100)}%`} th={th}/>
                        <button onClick={()=>{ const u=new SpeechSynthesisUtterance(msg.text); u.lang=language==="ar"?"ar-SA":language==="en"?"en-US":"fr-FR"; window.speechSynthesis.speak(u); }}
                          style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:9, color:ACCENT, background:"transparent", border:"none", cursor:"pointer", padding:0, fontWeight:600 }}>
                          <IconVolume size={9} color={ACCENT}/> {lbl("Lire","Read","استمع")}
                        </button>
                        {isLong && (
                          <button onClick={()=>setExpandedId(isExp?null:msg._id)}
                            style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:9, color:th.textSecondary, background:"transparent", border:"none", cursor:"pointer", padding:0, fontWeight:600 }}>
                            {isExp?lbl("Réduire","Collapse","طي"):lbl("Voir tout","See all","رؤية الكل")}
                          </button>
                        )}
                      </div>

                      {isExp && (
                        <p style={{ fontSize:9, color:th.textMuted, margin:"4px 0 0", display:"flex", alignItems:"center", gap:3, flexDirection:isRTL?"row-reverse":"row" }}>
                          <IconClock size={9} color={th.textMuted}/> {fmtFull(msg.created_at)}
                        </p>
                      )}
                    </div>

                    {/* Delete */}
                    <div style={{ display:"flex", alignItems:"center", padding:"0 8px", flexShrink:0 }}>
                      <button className="del-btn" onClick={()=>handleDelete(msg._id)} disabled={deletingId===msg._id}
                        style={{ width:24, height:24, borderRadius:6, border:`1px solid ${isDark?"rgba(220,38,38,0.2)":"rgba(220,38,38,0.15)"}`, background:isDark?"rgba(220,38,38,0.06)":"rgba(220,38,38,0.04)", color:"#dc2626", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:deletingId===msg._id?0.4:1 }}>
                        {deletingId===msg._id
                          ? <div style={{ width:8, height:8, border:"2px solid #dc2626", borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                          : <IconTrash size={11} color="#dc2626"/>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:2, background:isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }}>
                    <div style={{ height:"100%", width:`${Math.round((chars/(longestMsg||1))*100)}%`, background:`linear-gradient(90deg,${tColor}44,${tColor}18)`, transition:"width 0.7s ease" }}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* ── Pagination ── */}
        {!loading && totalPages>1 && (
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:5, marginTop:16, flexDirection:isRTL?"row-reverse":"row" }}>
            <button className="pg-btn" onClick={()=>fetchHistory(page-1,filter)} disabled={page===1}
              style={{ padding:"5px 10px", borderRadius:7, border:`1.5px solid ${th.border}`, background:th.bgCard, color:page===1?th.textMuted:th.textPrimary, cursor:page===1?"not-allowed":"pointer", fontWeight:600, fontSize:11, opacity:page===1?0.4:1, display:"flex", alignItems:"center", gap:3 }}>
              <IconChevronLeft size={11}/> {t("hist_prev")}
            </button>
            <div style={{ display:"flex", gap:3 }}>
              {Array.from({length:Math.min(totalPages,5)},(_,i)=>{
                const pg = page<=3?i+1:page-2+i;
                if (pg>totalPages) return null;
                return <button key={pg} onClick={()=>fetchHistory(pg,filter)} style={{ width:25, height:25, borderRadius:6, border:`1.5px solid ${pg===page?ACCENT:th.border}`, background:pg===page?ACCENT:th.bgCard, color:pg===page?"white":th.textSecondary, cursor:"pointer", fontWeight:700, fontSize:11 }}>{pg}</button>;
              })}
            </div>
            <span style={{ fontSize:11, color:th.textSecondary }}>{t("hist_page")} {page} {t("hist_of")} {totalPages}</span>
            <button className="pg-btn" onClick={()=>fetchHistory(page+1,filter)} disabled={page===totalPages}
              style={{ padding:"5px 10px", borderRadius:7, border:`1.5px solid ${th.border}`, background:th.bgCard, color:page===totalPages?th.textMuted:th.textPrimary, cursor:page===totalPages?"not-allowed":"pointer", fontWeight:600, fontSize:11, opacity:page===totalPages?0.4:1, display:"flex", alignItems:"center", gap:3 }}>
              {t("hist_next")} <IconChevronRight size={11}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";
import { getStats } from "../services/api";

export default function Home() {
  const navigate    = useNavigate();
  const { theme }   = useTheme();
  const th          = themes[theme];
  const isDark      = theme === "dark";
  const { t, language } = useLang();
  const isRTL       = language === "ar";
  const user        = JSON.parse(localStorage.getItem("user") || "{}");

  const [stats, setStats] = useState({
    total_messages: 0,
    total_asl     : 0,
    total_speech  : 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getStats();
        setStats(res.data);
      } catch {
        console.error("Erreur stats");
      }
    };
    fetchStats();
  }, []);

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home_greeting_morning");
    if (h < 18) return t("home_greeting_afternoon");
    return t("home_greeting_evening");
  };

  const aslPct    = stats.total_messages > 0
    ? Math.round((stats.total_asl    / stats.total_messages) * 100) : 0;
  const speechPct = stats.total_messages > 0
    ? Math.round((stats.total_speech / stats.total_messages) * 100) : 0;

  const cards = [
    { title: t("home_card1_title"), desc: t("home_card1_desc"), btn: t("home_card1_btn"), path: "/conversation", color: "#2563eb", active: true  },
    { title: t("home_card2_title"), desc: t("home_card2_desc"), btn: t("home_card2_btn"), path: "/history",      color: "#16a34a", active: true  },
    { title: t("home_card3_title"), desc: t("home_card3_desc"), btn: t("home_card3_btn"), path: "/profile",      color: "#0891b2", active: true  },
    // ✅ Dictionary card — activée
    { title: t("home_card4_title"), desc: t("home_card4_desc"), btn: t("home_card4_btn"), path: "/dictionary",   color: "#7c3aed", active: true  },
  ];

  const dir = isRTL ? "rtl" : "ltr";

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.textPrimary, fontFamily: "'Segoe UI', Arial, sans-serif", direction: dir }}>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeLeft { from{opacity:0;transform:translateX(${isRTL?"18px":"-18px"})} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeRight{ from{opacity:0;transform:translateX(${isRTL?"-18px":"18px"})} to{opacity:1;transform:translateX(0)} }
        @keyframes countUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .home-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .home-card:hover { transform: translateY(-5px); box-shadow: 0 14px 36px rgba(0,0,0,0.13) !important; }
        .cta-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(37,99,235,0.45) !important; }
        .card-btn { transition: opacity 0.15s ease, transform 0.15s ease; }
        .card-btn:hover:not(:disabled) { opacity:0.85; transform:translateY(-1px); }
        .nav-link-home { transition: all 0.15s ease; }
        .nav-link-home:hover { opacity: 0.75; }
      `}</style>

      <Navbar />

      {/* ══ HERO ══ */}
      <div style={{ position:"relative", textAlign:"center", padding:"25px 12px 30px", borderBottom:`1px solid ${th.border}`, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, zIndex:0, overflow:"hidden" }}>
          <svg viewBox="0 0 1440 500" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%", height:"100%", objectFit:"cover" }} preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={isDark?"#0f172a":"#eff6ff"} />
                <stop offset="50%"  stopColor={isDark?"#1e3a5f":"#dbeafe"} />
                <stop offset="100%" stopColor={isDark?"#0f172a":"#eff6ff"} />
              </linearGradient>
              <linearGradient id="handGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity={isDark?"0.18":"0.12"} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={isDark?"0.06":"0.04"} />
              </linearGradient>
              <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <rect width="1440" height="500" fill="url(#bgGrad)" />
            <circle cx="150"  cy="80"  r="120" fill="url(#circleGrad)" />
            <circle cx="1300" cy="420" r="160" fill="url(#circleGrad)" />
            <circle cx="720"  cy="500" r="200" fill="url(#circleGrad)" />
            <circle cx="80"   cy="400" r="80"  fill="url(#circleGrad)" />
            <circle cx="1380" cy="60"  r="90"  fill="url(#circleGrad)" />
            <g transform="translate(120,80) rotate(-15)" opacity={isDark?"0.22":"0.14"}>
              <ellipse cx="60" cy="120" rx="45" ry="55" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.5"/>
              <ellipse cx="18" cy="100" rx="12" ry="22" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2" transform="rotate(-30 18 100)"/>
              <rect x="25" y="70" width="14" height="20" rx="7" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1"/>
              <rect x="42" y="68" width="14" height="22" rx="7" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1"/>
              <rect x="59" y="70" width="14" height="20" rx="7" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1"/>
              <rect x="75" y="73" width="13" height="18" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1"/>
              <text x="55" y="200" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2563eb" opacity="0.5" fontFamily="monospace">A</text>
            </g>
            <g transform="translate(1230,60) rotate(12)" opacity={isDark?"0.22":"0.14"}>
              <ellipse cx="60" cy="130" rx="45" ry="55" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.5"/>
              <ellipse cx="20" cy="120" rx="10" ry="18" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2" transform="rotate(-20 20 120)"/>
              <rect x="28" y="50" width="13" height="50" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <rect x="44" y="45" width="13" height="55" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <rect x="60" y="47" width="13" height="53" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <rect x="76" y="52" width="12" height="48" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <text x="55" y="215" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2563eb" opacity="0.5" fontFamily="monospace">B</text>
            </g>
            <g transform="translate(60,320) rotate(10)" opacity={isDark?"0.18":"0.1"}>
              <ellipse cx="55" cy="110" rx="40" ry="50" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.5"/>
              <path d="M 90 70 Q 110 110 90 150" stroke="#2563eb" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.6"/>
              <text x="50" y="190" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2563eb" opacity="0.5" fontFamily="monospace">C</text>
            </g>
            <g transform="translate(1310,290) rotate(-8)" opacity={isDark?"0.18":"0.1"}>
              <ellipse cx="55" cy="120" rx="40" ry="50" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.5"/>
              <rect x="40" y="50" width="13" height="55" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <rect x="20" y="105" width="45" height="13" rx="6" fill="url(#handGrad)" stroke="#2563eb" strokeWidth="1.2"/>
              <text x="50" y="205" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2563eb" opacity="0.5" fontFamily="monospace">L</text>
            </g>
            {["A","S","L","B","C","D","E","F","G","H","I","J","K"].map((letter,i)=>(
              <text key={i} x={80+(i*105)%1300} y={380+(i%3)*40} fontSize={i%3===0?"18":"14"} fontWeight="700" fill="#2563eb" opacity={isDark?"0.06":"0.04"} fontFamily="monospace">{letter}</text>
            ))}
            <line x1="0" y1="498" x2="1440" y2="498" stroke="#2563eb" strokeWidth="0.5" opacity="0.15"/>
            <line x1="0" y1="2"   x2="1440" y2="2"   stroke="#2563eb" strokeWidth="0.5" opacity="0.15"/>
          </svg>
          <div style={{ position:"absolute", inset:0, background: isDark?"linear-gradient(180deg,rgba(15,23,42,0.55) 0%,rgba(15,23,42,0.3) 50%,rgba(15,23,42,0.6) 100%)":"linear-gradient(180deg,rgba(239,246,255,0.55) 0%,rgba(219,234,254,0.2) 50%,rgba(239,246,255,0.6) 100%)" }}/>
        </div>

        <div style={{ position:"relative", zIndex:1, animation:"fadeUp 0.6s ease" }}>
          <div style={{ display:"inline-block", padding:"4px 14px", borderRadius:"20px", background:isDark?"rgba(37,99,235,0.2)":"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.35)", fontSize:"8px", fontWeight:"700", letterSpacing:"0.7px", textTransform:"uppercase", color:"#2563eb", marginBottom:"22px", backdropFilter:"blur(8px)" }}>
            ASL Translator
          </div>
          <h1 style={{ fontSize:"33px", fontWeight:"800", lineHeight:"1.1", letterSpacing:"-1px", margin:"0 0 18px", color:th.textPrimary, textShadow:isDark?"0 2px 20px rgba(0,0,0,0.5)":"0 2px 20px rgba(255,255,255,0.8)" }}>
            {greetingTime()},{" "}<span style={{ color:"#2563eb" }}>{user?.name}</span>
          </h1>
          <p style={{ fontSize:"14px", color:th.textSecondary, lineHeight:"1.75", maxWidth:"520px", margin:"0 auto 34px", backdropFilter:"blur(4px)" }}>
            {t("home_subtitle")}
          </p>
          <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
            <button className="cta-btn" onClick={()=>navigate("/conversation")} style={{ padding:"9px 30px", borderRadius:"8px", border:"none", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"white", fontWeight:"700", fontSize:"13px", cursor:"pointer", boxShadow:"0 6px 20px rgba(37,99,235,0.45)", backdropFilter:"blur(8px)" }}>
              {t("home_start")}
            </button>
            <button className="cta-btn" onClick={()=>navigate("/history")} style={{ padding:"9px 30px", borderRadius:"8px", border:`1.5px solid ${isDark?"rgba(255,255,255,0.2)":"rgba(37,99,235,0.3)"}`, background:isDark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.6)", color:th.textPrimary, fontWeight:"600", fontSize:"13px", cursor:"pointer", backdropFilter:"blur(8px)" }}>
              {t("home_history")}
            </button>
          </div>
        </div>
      </div>

      {/* ══ 3 COLONNES ══ */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr", minHeight:"calc(100vh - 420px)" }}>

        {/* ── GAUCHE ── */}
        <div style={{ borderInlineEnd:`1px solid ${th.border}`, padding:"18px 16px", display:"flex", flexDirection:"column", gap:"16px", animation:"fadeLeft 0.5s ease 0.15s both" }}>

          <div>
            <h3 style={sectionTitle(th)}>{t("home_profile")}</h3>
            <div onClick={()=>navigate("/profile")} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px", borderRadius:"12px", background:th.bgCard, border:`1px solid ${th.border}`, cursor:"pointer", flexDirection:isRTL?"row-reverse":"row" }}>
              <img src={user?.photo||`https://ui-avatars.com/api/?name=${user?.name}&background=2563eb&color=fff&size=48`} alt="avatar" style={{ width:"38px", height:"38px", borderRadius:"50%", border:"2px solid #2563eb", objectFit:"cover", flexShrink:0 }}/>
              <div style={{ textAlign:isRTL?"right":"left" }}>
                <p style={{ fontSize:"13px", fontWeight:"700", margin:"0 0 2px", color:th.textPrimary }}>{user?.name}</p>
                <p style={{ fontSize:"11px", color:th.textSecondary, margin:0 }}>{user?.role==="hearing_impaired"?t("home_role_deaf"):t("home_role_hear")}</p>
              </div>
            </div>
          </div>

          <div style={{ height:"1px", background:th.border }}/>

          <div>
            <h3 style={sectionTitle(th)}>{t("home_quick")}</h3>
            {[
              { label:t("home_card1_title"), path:"/conversation", color:"#2563eb" },
              { label:t("home_card2_title"), path:"/history",      color:"#16a34a" },
              { label:t("home_card3_title"), path:"/profile",      color:"#0891b2" },
              // ✅ Lien rapide Dictionary
              { label: "Dictionnaire",       path:"/dictionary",   color:"#7c3aed" },
            ].map((link)=>(
              <div key={link.path} className="nav-link-home" onClick={()=>navigate(link.path)} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 10px", borderRadius:"8px", cursor:"pointer", marginBottom:"3px", color:th.textSecondary, fontSize:"13px", fontWeight:"600", flexDirection:isRTL?"row-reverse":"row" }}>
                <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:link.color, flexShrink:0 }}/>
                {link.label}
              </div>
            ))}
          </div>

          <div style={{ height:"1px", background:th.border }}/>

          <div>
            <h3 style={sectionTitle(th)}>{t("home_how")}</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:"9px" }}>
              {[t("home_step1"),t("home_step2"),t("home_step3"),t("home_step4"),t("home_step5")].map((text,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px", flexDirection:isRTL?"row-reverse":"row" }}>
                  <div style={{ width:"18px", height:"18px", borderRadius:"50%", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:"800", color:"white", flexShrink:0, marginTop:"2px" }}>{i+1}</div>
                  <span style={{ fontSize:"11px", color:th.textSecondary, lineHeight:"1.6", textAlign:isRTL?"right":"left" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTRE ── */}
        <div style={{ padding:"14px 20px", animation:"fadeUp 0.5s ease 0.1s both" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"18px" }}>
            {cards.map((card,i)=>(
              <div key={i} className="home-card" onClick={()=>card.active&&card.path&&navigate(card.path)} style={{ background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:"14px", padding:"16px 14px", cursor:card.active?"pointer":"default", opacity:card.active?1:0.5, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:card.color, borderRadius:"14px 14px 0 0" }}/>
                <h3 style={{ fontSize:"14px", fontWeight:"700", margin:"0 0 6px", color:th.textPrimary, textAlign:isRTL?"right":"left" }}>{card.title}</h3>
                <p style={{ fontSize:"12px", color:th.textSecondary, lineHeight:"1.6", margin:"0 0 12px", textAlign:isRTL?"right":"left" }}>{card.desc}</p>
                <div style={{ textAlign:isRTL?"right":"left" }}>
                  <button className="card-btn" disabled={!card.active} style={{ padding:"6px 14px", borderRadius:"7px", border:"none", background:card.active?`linear-gradient(135deg,${card.color},${card.color}cc)`:"#94a3b8", color:"white", fontWeight:"700", fontSize:"12px", cursor:card.active?"pointer":"not-allowed" }}>
                    {card.btn} {card.active?(isRTL?"←":"→"):""}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderRadius:"14px", border:`1px solid ${th.border}`, overflow:"hidden", background:th.bgCard, marginBottom:"16px", animation:"countUp 0.4s ease 0.2s both" }}>
            {[
              { label:t("home_stat1"), value:stats.total_messages, color:"#2563eb" },
              { label:t("home_stat2"), value:stats.total_asl,      color:"#16a34a" },
              { label:t("home_stat3"), value:stats.total_speech,   color:"#0891b2" },
              { label:t("home_stat4"), value:"39",                  color:"#d97706" },
            ].map((s,i,arr)=>(
              <div key={i} style={{ padding:"14px 10px", textAlign:"center", borderRight:i<arr.length-1?`1px solid ${th.border}`:"none", position:"relative" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:s.color }}/>
                <p style={{ fontSize:"24px", fontWeight:"800", color:s.color, margin:"0 0 4px", lineHeight:"1", letterSpacing:"-1px" }}>{s.value}</p>
                <p style={{ fontSize:"10px", fontWeight:"600", color:th.textSecondary, margin:0, textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{ background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:"14px", padding:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px", flexDirection:isRTL?"row-reverse":"row" }}>
              <h3 style={{ fontSize:"13px", fontWeight:"700", margin:0, color:th.textPrimary }}>{t("home_repartition")}</h3>
              <span style={{ fontSize:"12px", color:th.textSecondary, background:th.bgInput, padding:"3px 10px", borderRadius:"20px", border:`1px solid ${th.border}`, fontWeight:"600" }}>{stats.total_messages} {t("home_total")}</span>
            </div>
            {stats.total_messages===0 ? (
              <div style={{ textAlign:"center", padding:"12px 0" }}>
                <p style={{ color:th.textSecondary, fontSize:"13px", margin:"0 0 14px" }}>{t("home_no_msg")}</p>
                <button onClick={()=>navigate("/conversation")} style={{ padding:"9px 20px", borderRadius:"8px", border:"none", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"white", fontWeight:"700", fontSize:"13px", cursor:"pointer" }}>
                  {t("home_start_short")} {isRTL?"←":"→"}
                </button>
              </div>
            ):(
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {[
                  { label:t("home_asl_label"),  value:stats.total_asl,    pct:aslPct,    color:"#2563eb" },
                  { label:t("home_vocal_label"), value:stats.total_speech, pct:speechPct, color:"#16a34a" },
                ].map((bar)=>(
                  <div key={bar.label}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px", flexDirection:isRTL?"row-reverse":"row" }}>
                      <span style={{ fontSize:"13px", color:th.textSecondary, fontWeight:"600" }}>{bar.label}</span>
                      <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                        <span style={{ fontSize:"12px", color:th.textSecondary }}>{bar.value} msg</span>
                        <span style={{ fontSize:"13px", fontWeight:"800", color:bar.color }}>{bar.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:"8px", background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)", borderRadius:"10px", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${bar.pct}%`, background:bar.color, borderRadius:"10px", transition:"width 0.8s ease", marginInlineStart:isRTL?"auto":"0" }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── DROITE ── */}
        <div style={{ borderInlineStart:`1px solid ${th.border}`, padding:"18px 16px", display:"flex", flexDirection:"column", gap:"16px", animation:"fadeRight 0.5s ease 0.15s both" }}>

          <div>
            <h3 style={sectionTitle(th)}>{t("home_model")}</h3>
            {[
              { label:t("home_letters"), value:26, total:39, color:"#2563eb" },
              { label:t("home_numbers"), value:10, total:39, color:"#16a34a" },
              { label:t("home_special"), value:3,  total:39, color:"#d97706" },
            ].map((item)=>(
              <div key={item.label} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px", flexDirection:isRTL?"row-reverse":"row" }}>
                  <span style={{ fontSize:"12px", color:th.textSecondary, fontWeight:"600" }}>{item.label}</span>
                  <span style={{ fontSize:"12px", fontWeight:"800", color:item.color }}>{item.value}</span>
                </div>
                <div style={{ height:"6px", background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)", borderRadius:"10px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(item.value/item.total)*100}%`, background:item.color, borderRadius:"10px", transition:"width 0.8s ease" }}/>
                </div>
              </div>
            ))}
            <div style={{ padding:"10px 12px", borderRadius:"10px", background:isDark?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.06)", border:"1px solid rgba(37,99,235,0.2)", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"4px", flexDirection:isRTL?"row-reverse":"row" }}>
              <span style={{ fontSize:"12px", fontWeight:"700", color:th.textPrimary }}>{t("home_total_classes")}</span>
              <span style={{ fontSize:"18px", fontWeight:"800", color:"#2563eb" }}>39</span>
            </div>
          </div>

          <div style={{ height:"1px", background:th.border }}/>

          <div>
            <h3 style={sectionTitle(th)}>{t("home_info")}</h3>
            {[
              { label:t("home_info_role"),    value:user?.role==="hearing_impaired"?t("home_role_deaf"):t("home_role_hear") },
              { label:t("home_info_model"),   value:"CNN — TensorFlow" },
              { label:t("home_info_classes"), value:"39 ASL" },
              { label:t("home_info_input"),   value:"64 × 64 px" },
            ].map((info)=>(
              <div key={info.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${th.border}`, flexDirection:isRTL?"row-reverse":"row" }}>
                <span style={{ fontSize:"12px", color:th.textSecondary }}>{info.label}</span>
                <span style={{ fontSize:"12px", fontWeight:"700", color:th.textPrimary }}>{info.value}</span>
              </div>
            ))}
          </div>

          <div style={{ height:"1px", background:th.border }}/>

          <div style={{ background:isDark?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.06)", border:"1px solid rgba(37,99,235,0.2)", borderRadius:"12px", padding:"14px", textAlign:"center" }}>
            <p style={{ fontSize:"13px", fontWeight:"700", color:th.textPrimary, margin:"0 0 5px" }}>{t("home_ready")}</p>
            <p style={{ fontSize:"12px", color:th.textSecondary, margin:"0 0 12px", lineHeight:"1.5" }}>{t("home_ready_sub")}</p>
            <button onClick={()=>navigate("/conversation")} style={{ width:"100%", padding:"9px", borderRadius:"8px", border:"none", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"white", fontWeight:"700", fontSize:"13px", cursor:"pointer" }}>
              {t("home_start_short")} {isRTL?"←":"→"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = (th) => ({
  fontSize:"11px", fontWeight:"700", textTransform:"uppercase",
  letterSpacing:"0.7px", color:th.textSecondary, margin:"0 0 10px",
});
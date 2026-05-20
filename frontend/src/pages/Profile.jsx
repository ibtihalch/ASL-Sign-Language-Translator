import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { getMe, updateProfile, changePassword } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

// ── SVG Icons ──────────────────────────────────────────────────
const IconCamera   = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IconUser     = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconSettings = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IconLock     = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconChart    = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconMail     = ({ s=12,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconPin      = ({ s=12,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconCal      = ({ s=12,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconSign     = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a2 2 0 0 0-4 0v4"/><path d="M14 8a2 2 0 0 0-4 0v6"/><path d="M10 9a2 2 0 0 0-4 0v5a7 7 0 0 0 14 0v-5"/><path d="M18 8v4"/></svg>;
const IconMic      = ({ s=14,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IconSun      = ({ s=16,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const IconMoon     = ({ s=16,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IconCheck    = ({ s=13,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconSave     = ({ s=13,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IconShield   = ({ s=13,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconEye      = ({ s=13,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff   = ({ s=13,c="currentColor" }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

// ── SVG Décoratifs ─────────────────────────────────────────────
const GridBg = () => (
  <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="pgrid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(37,99,235,0.18)" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#pgrid)"/>
  </svg>
);

const DiagonalAccent = () => (
  <svg style={{position:"absolute",top:0,right:0,width:"200px",height:"200px",pointerEvents:"none",opacity:0.07}} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    {Array.from({length:9},(_,i)=>(
      <line key={i} x1={i*24} y1="0" x2={200} y2={200-i*24} stroke="#60a5fa" strokeWidth="1.5"/>
    ))}
  </svg>
);

// ── Arc donut stat ─────────────────────────────────────────────
const ArcStat = ({ pct, color, label, value, size=76 }) => {
  const r = (size/2)-8;
  const circ = 2*Math.PI*r;
  const dash = (Math.min(pct,100)/100)*circ;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
      <div style={{position:"relative",width:size,height:size}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{transition:"stroke-dasharray 1s ease"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
          <span style={{fontSize:15,fontWeight:900,color:"white",lineHeight:1,fontFamily:"monospace"}}>{value}</span>
          <span style={{fontSize:8,fontWeight:700,color:"rgba(255,255,255,0.45)"}}>{pct}%</span>
        </div>
      </div>
      <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"rgba(255,255,255,0.6)"}}>{label}</span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
export default function Profile() {
  const fileRef = useRef(null);
  const { theme, applyTheme } = useTheme();
  const th = themes[theme];
  const { t, language, applyLanguage } = useLang();
  const isRTL  = language === "ar";
  const dir    = isRTL ? "rtl" : "ltr";
  const isDark = theme === "dark";

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState("info");
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");
  const [showPw,   setShowPw]   = useState({old:false,new:false,confirm:false});
  const [passwords,setPasswords]= useState({old_password:"",new_password:"",confirm:""});
  const [pwError,  setPwError]  = useState("");
  const [pwSuccess,setPwSuccess]= useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(()=>{
    (async()=>{
      try{const res=await getMe();setProfile(res.data);}
      catch{setError(t("prof_loading"));}
      finally{setLoading(false);}
    })();
  },[]);

  const handlePhotoChange=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    if(file.size>2*1024*1024){setError("Photo max 2MB");return;}
    const reader=new FileReader();
    reader.onload=()=>setProfile(p=>({...p,photo:reader.result}));
    reader.readAsDataURL(file);
  };

  const handleSave=async()=>{
    setSaving(true);setSuccess("");setError("");
    try{
      const res=await updateProfile(profile);
      const s=JSON.parse(localStorage.getItem("user")||"{}");
      localStorage.setItem("user",JSON.stringify({...s,name:res.data.user.name,photo:res.data.user.photo,theme:res.data.user.theme,language:profile.language}));
      applyTheme(profile.theme);applyLanguage(profile.language);
      setSuccess(t("prof_saved"));setTimeout(()=>setSuccess(""),3000);
    }catch{setError("Erreur sauvegarde");}
    finally{setSaving(false);}
  };

  const handleChangePassword=async()=>{
    setPwError("");setPwSuccess("");
    if(!passwords.old_password||!passwords.new_password||!passwords.confirm){setPwError("Tous les champs sont obligatoires");return;}
    if(passwords.new_password!==passwords.confirm){setPwError("Les mots de passe ne correspondent pas");return;}
    if(passwords.new_password.length<6){setPwError("Minimum 6 caractères");return;}
    setPwSaving(true);
    try{
      await changePassword({old_password:passwords.old_password,new_password:passwords.new_password});
      setPwSuccess(t("prof_pw_changed"));setPasswords({old_password:"",new_password:"",confirm:""});
      setTimeout(()=>setPwSuccess(""),3000);
    }catch(err){setPwError(err.response?.data?.error||"Erreur");}
    finally{setPwSaving(false);}
  };

  const field=(k,v)=>setProfile(p=>({...p,[k]:v}));
  const lbl=(fr,en,ar)=>language==="ar"?ar:language==="en"?en:fr;

  const formatDate=(iso)=>{
    if(!iso)return"N/A";
    const locale=language==="ar"?"ar-MA":language==="en"?"en-GB":"fr-FR";
    return new Date(iso).toLocaleDateString(locale,{day:"2-digit",month:"long",year:"numeric"});
  };

  const levelLabel={beginner:t("prof_beginner"),intermediate:t("prof_intermediate"),expert:t("prof_expert")};
  const roleLabel ={hearing_impaired:t("prof_role_deaf"),hearing:t("prof_role_hear")};

  const total     = profile?.stats?.total_messages||1;
  const aslPct    = Math.round(((profile?.stats?.total_asl||0)/total)*100);
  const speechPct = Math.round(((profile?.stats?.total_speech||0)/total)*100);

  // ── Design atoms ──────────────────────────────────────────────
  const inputBase={
    width:"100%",boxSizing:"border-box",
    padding:"9px 13px",borderRadius:8,fontSize:12,
    fontFamily:"inherit",outline:"none",direction:dir,
    background:isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",
    border:`1.5px solid ${isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,
    color:th.textPrimary,transition:"border-color 0.2s,box-shadow 0.2s",
  };

  const SectionTitle=({children})=>(
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20,flexDirection:isRTL?"row-reverse":"row"}}>
      <div style={{width:3,height:18,borderRadius:2,background:"linear-gradient(180deg,#2563eb,#60a5fa)",flexShrink:0}}/>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:th.textPrimary,letterSpacing:"-0.3px"}}>{children}</h3>
    </div>
  );

  const FieldGroup=({label,children})=>(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:9,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",
        color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)",textAlign:isRTL?"right":"left"}}>
        {label}
      </label>
      {children}
    </div>
  );

  const Pill=({selected,onClick,children})=>(
    <div onClick={onClick} className="pill" style={{
      flex:1,minWidth:70,padding:"10px 9px",borderRadius:10,cursor:"pointer",
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      background:selected?(isDark?"rgba(37,99,235,0.18)":"rgba(37,99,235,0.08)"):(isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"),
      border:`2px solid ${selected?"#2563eb":(isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)")}`,
      transition:"all 0.18s",position:"relative",overflow:"hidden",
    }}>
      {selected&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#2563eb,#60a5fa)"}}/>}
      {children}
    </div>
  );

  const SaveBtn=({onClick,loading:ld,Icon=IconSave,children})=>(
    <button onClick={onClick} disabled={ld} className="save-btn-h"
      style={{
        width:"100%",padding:"11px",borderRadius:9,border:"none",
        background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"white",
        fontWeight:700,fontSize:12,cursor:ld?"not-allowed":"pointer",fontFamily:"inherit",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        boxShadow:"0 3px 14px rgba(37,99,235,0.35)",
        transition:"all 0.2s",opacity:ld?0.7:1,marginTop:22,
      }}
    >
      {ld
        ? <div style={{width:13,height:13,border:"2px solid rgba(255,255,255,0.35)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        : <Icon s={13} c="white"/>
      }
      {children}
    </button>
  );

  const Alert=({type,msg})=>msg?(
    <div style={{
      padding:"10px 14px",borderRadius:9,marginBottom:14,fontWeight:600,fontSize:11,
      display:"flex",alignItems:"center",gap:7,animation:"slideIn 0.3s ease",
      background:type==="ok"?"rgba(22,163,74,0.1)":"rgba(220,38,38,0.1)",
      border:`1px solid ${type==="ok"?"rgba(22,163,74,0.3)":"rgba(220,38,38,0.25)"}`,
      color:type==="ok"?"#16a34a":"#dc2626",
    }}>
      {type==="ok"&&<IconCheck s={13} c="#16a34a"/>}{msg}
    </div>
  ):null;

  const StatTile=({value,label,color,sub})=>(
    <div style={{borderRadius:11,padding:"14px 14px",position:"relative",overflow:"hidden",
      background:isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.025)",
      border:`1px solid ${isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)"}`,
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2.5,background:color}}/>
      <span style={{display:"block",fontSize:28,fontWeight:900,color,fontFamily:"monospace",letterSpacing:"-1.5px",lineHeight:1}}>{value}</span>
      <span style={{display:"block",fontSize:11,fontWeight:700,color:th.textPrimary,marginTop:6}}>{label}</span>
      {sub&&<span style={{display:"block",fontSize:10,color:th.textSecondary,marginTop:2}}>{sub}</span>}
    </div>
  );

  const BarRow=({label,val,pct,color,Icon})=>(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,flexDirection:isRTL?"row-reverse":"row"}}>
        <span style={{fontSize:11,color:th.textSecondary,display:"flex",alignItems:"center",gap:6,flexDirection:isRTL?"row-reverse":"row"}}>
          {Icon&&<Icon s={12} c={color}/>}{label}
          <span style={{fontSize:10,color:th.textMuted}}>({val})</span>
        </span>
        <span style={{fontSize:13,fontWeight:800,color,fontFamily:"monospace"}}>{pct}%</span>
      </div>
      <div style={{height:6,background:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:5,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:5,transition:"width 1.2s ease"}}/>
      </div>
    </div>
  );

  if(loading) return (
    <div style={{minHeight:"100vh",background:th.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:32,height:32,border:"3px solid rgba(37,99,235,0.2)",borderTop:"3px solid #2563eb",borderRadius:"50%",animation:"spin 0.9s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const TABS=[
    {key:"info",     Icon:IconUser,     label:t("prof_info")    },
    {key:"prefs",    Icon:IconSettings, label:t("prof_prefs")   },
    {key:"security", Icon:IconLock,     label:t("prof_security")},
    {key:"stats",    Icon:IconChart,    label:t("prof_stats")   },
  ];

  return (
    <div style={{minHeight:"100vh",background:th.bg,color:th.textPrimary,fontFamily:"'Segoe UI',system-ui,sans-serif",direction:dir}}>
      <style>{`
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn {from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        .prof-input:focus{border-color:#2563eb!important;box-shadow:0 0 0 2px rgba(37,99,235,0.14)!important;}
        .tab-btn:hover{color:white!important;}
        .save-btn-h:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(37,99,235,0.45)!important;}
        .pill:hover{border-color:rgba(37,99,235,0.45)!important;}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"};border-radius:6px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(1)":"none"};opacity:0.5}
      `}</style>

      <Navbar/>

      {/* ══ HERO compact ══ */}
      <div style={{
        position:"relative",overflow:"hidden",
        background:"linear-gradient(135deg,#060e20 0%,#0c1a3c 50%,#060e20 100%)",
      }}>
        <GridBg/>
        <DiagonalAccent/>
        <div style={{position:"absolute",top:-60,left:"28%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.2) 0%,transparent 70%)",pointerEvents:"none"}}/>

        <div style={{position:"relative",zIndex:1,margin:"0 auto",padding:"22px 20px 0"}}>
          <div style={{
            display:"flex",alignItems:"flex-end",gap:24,flexWrap:"wrap",
            flexDirection:isRTL?"row-reverse":"row",
          }}>

            {/* Avatar + infos */}
            <div style={{display:"flex",alignItems:"center",gap:16,flexDirection:isRTL?"row-reverse":"row",flex:"1 1 300px",paddingBottom:18}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{
                  width:68,height:68,borderRadius:17,
                  background:"linear-gradient(135deg,#2563eb,#0891b2)",
                  padding:2,boxShadow:"0 0 0 5px rgba(37,99,235,0.12),0 10px 26px rgba(0,0,0,0.5)",
                }}>
                  <div style={{width:"100%",height:"100%",borderRadius:15,overflow:"hidden"}}>
                    <img
                      src={profile.photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1d4ed8&color=fff&size=200`}
                      alt="profil" style={{width:"100%",height:"100%",objectFit:"cover"}}
                    />
                  </div>
                </div>
                <button onClick={()=>fileRef.current.click()} style={{
                  position:"absolute",bottom:-4,right:isRTL?"auto":-4,left:isRTL?-4:"auto",
                  width:22,height:22,borderRadius:7,border:"2px solid #060e20",
                  background:"#2563eb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <IconCamera s={11} c="white"/>
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoChange}/>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:isRTL?"flex-end":"flex-start"}}>
                <h1 style={{margin:0,fontSize:18,fontWeight:900,color:"white",letterSpacing:"-0.4px",lineHeight:1.1}}>{profile.name}</h1>
                <span style={{fontSize:11,fontWeight:600,color:"#60a5fa"}}>{roleLabel[profile.role]||profile.role}</span>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,flexDirection:isRTL?"row-reverse":"row"}}>
                  {[
                    {Icon:IconMail,text:profile.email},
                    {Icon:IconCal, text:`${t("prof_member_since")} ${formatDate(profile.created_at)}`},
                    ...(profile.city&&profile.country?[{Icon:IconPin,text:`${profile.city}, ${profile.country}`}]:[]),
                  ].map((m,i)=>(
                    <div key={i} style={{
                      display:"inline-flex",alignItems:"center",gap:5,
                      background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.2)",
                      backdropFilter:"blur(8px)",borderRadius:20,padding:"3px 9px",
                      flexDirection:isRTL?"row-reverse":"row",
                    }}>
                      <m.Icon s={10} c="#93c5fd"/>
                      <span style={{fontSize:10,fontWeight:500,color:"#e2e8f0",whiteSpace:"nowrap"}}>{m.text}</span>
                    </div>
                  ))}
                  <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(37,99,235,0.3)",border:"1px solid rgba(96,165,250,0.4)",borderRadius:20,padding:"3px 10px"}}>
                    <IconSign s={10} c="#93c5fd"/>
                    <span style={{fontSize:10,fontWeight:700,color:"#bfdbfe"}}>{levelLabel[profile.asl_level]||t("prof_beginner")}</span>
                  </div>
                </div>
                {profile.bio&&(
                  <div style={{display:"inline-block",maxWidth:400,background:"rgba(15,23,42,0.55)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"5px 10px"}}>
                    <p style={{margin:0,fontSize:11,fontStyle:"italic",color:"rgba(226,232,240,0.8)",lineHeight:1.5}}>"{profile.bio}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Arc stats panel */}
            <div style={{
              display:"flex",gap:16,alignItems:"center",flexShrink:0,
              background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.15)",
              borderRadius:"14px 14px 0 0",padding:"16px 20px 20px",
              backdropFilter:"blur(12px)",
              flexDirection:isRTL?"row-reverse":"row",alignSelf:"flex-end",
            }}>
              <ArcStat pct={100}       color="#3b82f6" label={lbl("Total","Total","الإجمالي")} value={profile.stats?.total_messages||0}/>
              <div style={{width:1,height:40,background:"rgba(255,255,255,0.1)"}}/>
              <ArcStat pct={aslPct}    color="#60a5fa" label="ASL"                              value={profile.stats?.total_asl||0}/>
              <div style={{width:1,height:40,background:"rgba(255,255,255,0.1)"}}/>
              <ArcStat pct={speechPct} color="#34d399" label={lbl("Vocal","Voice","صوتي")}      value={profile.stats?.total_speech||0}/>
            </div>
          </div>

          {/* Tab strip */}
          <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(255,255,255,0.07)",flexDirection:isRTL?"row-reverse":"row"}}>
            {TABS.map(tb=>(
              <button key={tb.key} className="tab-btn" onClick={()=>setTab(tb.key)} style={{
                padding:"11px 20px",border:"none",cursor:"pointer",fontFamily:"inherit",
                fontSize:11,fontWeight:600,background:"transparent",
                color:tab===tb.key?"white":"rgba(148,163,184,0.6)",
                borderBottom:`2px solid ${tab===tb.key?"#3b82f6":"transparent"}`,
                display:"flex",alignItems:"center",gap:6,transition:"all 0.18s",
                flexDirection:isRTL?"row-reverse":"row",
              }}>
                <tb.Icon s={13} c={tab===tb.key?"#60a5fa":"rgba(148,163,184,0.4)"}/>
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CONTENU ══ */}
      <div style={{maxWidth:1500,margin:"0 auto",padding:"22px 20px 50px"}}>

        {(success||error)&&<Alert type={success?"ok":"err"} msg={success||error}/>}

        {/* ════ INFO ════ */}
        {tab==="info"&&(
          <div style={{animation:"fadeUp 0.4s ease both"}}>
            <SectionTitle>{t("prof_info")}</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:14}}>
              {[
                {key:"name",       label:t("prof_name"),    type:"text",  disabled:false},
                {key:"email",      label:t("prof_email"),   type:"email", disabled:true },
                {key:"phone",      label:t("prof_phone"),   type:"text",  disabled:false},
                {key:"birth_date", label:t("prof_birth"),   type:"date",  disabled:false},
                {key:"city",       label:t("prof_city"),    type:"text",  disabled:false},
                {key:"country",    label:t("prof_country"), type:"text",  disabled:false},
              ].map(f=>(
                <FieldGroup key={f.key} label={f.label}>
                  <input type={f.type} className="prof-input"
                    style={{...inputBase,opacity:f.disabled?0.45:1,cursor:f.disabled?"not-allowed":"text"}}
                    value={profile[f.key]||""} onChange={e=>!f.disabled&&field(f.key,e.target.value)} disabled={f.disabled}
                  />
                </FieldGroup>
              ))}
            </div>

            <FieldGroup label={t("prof_bio")}>
              <textarea className="prof-input" style={{...inputBase,resize:"vertical",minHeight:80,lineHeight:1.55}}
                value={profile.bio||""} onChange={e=>field("bio",e.target.value)} placeholder={t("prof_bio_ph")} rows={3}/>
            </FieldGroup>

            {/* Summary strip compact */}
            <div style={{
              display:"flex",gap:9,flexWrap:"wrap",marginTop:18,
              padding:"14px 16px",borderRadius:10,
              background:isDark?"rgba(255,255,255,0.03)":"rgba(37,99,235,0.04)",
              border:`1px solid ${isDark?"rgba(255,255,255,0.07)":"rgba(37,99,235,0.12)"}`,
              flexDirection:isRTL?"row-reverse":"row",
            }}>
              {[
                {label:lbl("Depuis","Since","منذ"),           val:formatDate(profile.created_at),                    color:"#60a5fa"},
                {label:t("prof_level"),                        val:levelLabel[profile.asl_level]||t("prof_beginner"), color:"#f59e0b"},
                {label:lbl("Total","Total","إجمالي"),          val:profile.stats?.total_messages||0,                  color:"#3b82f6"},
                {label:"ASL",                                  val:profile.stats?.total_asl||0,                       color:"#60a5fa"},
                {label:lbl("Vocal","Voice","صوتي"),            val:profile.stats?.total_speech||0,                    color:"#34d399"},
              ].map((s,i)=>(
                <div key={i} style={{
                  display:"flex",flexDirection:"column",gap:2,padding:"8px 13px",flex:"1 1 100px",
                  borderRadius:8,background:isDark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.8)",
                  border:`1px solid ${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)"}`,
                }}>
                  <span style={{fontSize:16,fontWeight:900,color:s.color,fontFamily:"monospace"}}>{s.val}</span>
                  <span style={{fontSize:9,fontWeight:600,color:th.textSecondary,letterSpacing:"0.3px"}}>{s.label}</span>
                </div>
              ))}
            </div>
            <SaveBtn onClick={handleSave} loading={saving}>{saving?t("prof_saving"):t("prof_save")}</SaveBtn>
          </div>
        )}

        {/* ════ PREFS ════ */}
        {tab==="prefs"&&(
          <div style={{animation:"fadeUp 0.4s ease both"}}>
            <SectionTitle>{t("prof_prefs")}</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>
              <div style={{display:"flex",flexDirection:"column",gap:20}}>

                <FieldGroup label={t("prof_theme")}>
                  <div style={{display:"flex",gap:9}}>
                    {[
                      {val:"dark", Icon:IconMoon, label:t("prof_dark") },
                      {val:"light",Icon:IconSun,  label:t("prof_light")},
                    ].map(opt=>(
                      <Pill key={opt.val} selected={profile.theme===opt.val} onClick={()=>field("theme",opt.val)}>
                        <opt.Icon s={18} c={profile.theme===opt.val?"#2563eb":th.textSecondary}/>
                        <span style={{fontSize:11,fontWeight:700,color:profile.theme===opt.val?"#2563eb":th.textSecondary}}>{opt.label}</span>
                      </Pill>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label={t("prof_lang")}>
                  <div style={{display:"flex",gap:9}}>
                    {[
                      {val:"fr",code:"FR",label:"Français"},
                      {val:"en",code:"EN",label:"English" },
                      {val:"ar",code:"AR",label:"العربية" },
                    ].map(opt=>(
                      <Pill
                        key={opt.val}
                        selected={profile.language===opt.val}
                        onClick={() => {
                          field("language", opt.val);
                          applyLanguage(opt.val);
                        }}
                      >
                        <span style={{fontSize:13,fontWeight:900,fontFamily:"monospace",color:profile.language===opt.val?"#2563eb":th.textSecondary}}>{opt.code}</span>
                        <span style={{fontSize:10,fontWeight:600,color:profile.language===opt.val?"#2563eb":th.textSecondary}}>{opt.label}</span>
                      </Pill>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label={t("prof_disability")}>
                  <select className="prof-input" style={{...inputBase}} value={profile.disability_type||""} onChange={e=>field("disability_type",e.target.value)}>
                    <option value="">--</option>
                    <option value="deaf">{lbl("Sourd","Deaf","أصم")}</option>
                    <option value="hard_of_hearing">{t("prof_role_deaf")}</option>
                    <option value="mute">{lbl("Muet","Mute","أبكم")}</option>
                    <option value="deaf_mute">{lbl("Sourd-Muet","Deaf-Mute","أصم أبكم")}</option>
                    <option value="none">{lbl("Aucun","None","لا شيء")}</option>
                  </select>
                </FieldGroup>

                <FieldGroup label={t("prof_device")}>
                  <div style={{display:"flex",gap:9}}>
                    {[{val:true,label:t("prof_yes")},{val:false,label:t("prof_no")}].map(opt=>(
                      <Pill key={String(opt.val)} selected={profile.hearing_device===opt.val} onClick={()=>field("hearing_device",opt.val)}>
                        <span style={{fontSize:12,fontWeight:700,color:profile.hearing_device===opt.val?"#2563eb":th.textSecondary}}>{opt.label}</span>
                      </Pill>
                    ))}
                  </div>
                </FieldGroup>
              </div>

              <FieldGroup label={t("prof_level")}>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {[
                    {val:"beginner",     num:"01",label:t("prof_beginner"),     desc:lbl("Débutant en ASL","ASL beginner","مبتدئ في ASL"),    color:"#34d399"},
                    {val:"intermediate", num:"02",label:t("prof_intermediate"), desc:lbl("Connaissances solides","Solid knowledge","معرفة جيدة"), color:"#f59e0b"},
                    {val:"expert",       num:"03",label:t("prof_expert"),       desc:lbl("Maîtrise complète","Full mastery","إتقان كامل"),       color:"#ef4444"},
                  ].map(opt=>(
                    <div key={opt.val} onClick={()=>field("asl_level",opt.val)} style={{
                      display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,cursor:"pointer",
                      background:profile.asl_level===opt.val?(isDark?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.07)"):(isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"),
                      border:`2px solid ${profile.asl_level===opt.val?"#2563eb":(isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)")}`,
                      transition:"all 0.18s",flexDirection:isRTL?"row-reverse":"row",
                    }}>
                      <div style={{width:33,height:33,borderRadius:9,background:`${opt.color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontSize:11,fontWeight:900,color:opt.color,fontFamily:"monospace"}}>{opt.num}</span>
                      </div>
                      <div style={{flex:1,textAlign:isRTL?"right":"left"}}>
                        <span style={{display:"block",fontSize:12,fontWeight:700,color:profile.asl_level===opt.val?"#2563eb":th.textPrimary}}>{opt.label}</span>
                        <span style={{display:"block",fontSize:10,color:th.textSecondary,marginTop:1}}>{opt.desc}</span>
                      </div>
                      {profile.asl_level===opt.val&&<IconCheck s={14} c="#2563eb"/>}
                    </div>
                  ))}
                </div>
              </FieldGroup>
            </div>
            <SaveBtn onClick={handleSave} loading={saving}>{saving?t("prof_saving"):t("prof_save")}</SaveBtn>
          </div>
        )}

        {/* ════ SECURITY ════ */}
        {tab==="security"&&(
          <div style={{animation:"fadeUp 0.4s ease both"}}>
            <SectionTitle>{t("prof_security")}</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
              <div>
                <Alert type="ok"  msg={pwSuccess}/>
                <Alert type="err" msg={pwError}/>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {[
                    {key:"old_password",label:t("prof_old_pw"),    pk:"old"    },
                    {key:"new_password",label:t("prof_new_pw"),    pk:"new"    },
                    {key:"confirm",     label:t("prof_confirm_pw"),pk:"confirm"},
                  ].map(f=>(
                    <FieldGroup key={f.key} label={f.label}>
                      <div style={{position:"relative"}}>
                        <input type={showPw[f.pk]?"text":"password"} className="prof-input"
                          style={{...inputBase,paddingRight:40}}
                          value={passwords[f.key]} onChange={e=>setPasswords({...passwords,[f.key]:e.target.value})}
                          placeholder="••••••••"
                        />
                        <button onClick={()=>setShowPw(p=>({...p,[f.pk]:!p[f.pk]}))}
                          style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:th.textSecondary,display:"flex",padding:0}}>
                          {showPw[f.pk]?<IconEyeOff s={13}/>:<IconEye s={13}/>}
                        </button>
                      </div>
                    </FieldGroup>
                  ))}
                </div>

                {passwords.new_password&&(()=>{
                  const len=passwords.new_password.length;
                  const pct=len>=10?100:len>=8?66:len>=6?33:10;
                  const col=len>=10?"#16a34a":len>=8?"#d97706":"#dc2626";
                  const lv =len>=10?t("prof_strong"):len>=8?t("prof_medium"):t("prof_weak");
                  return(
                    <div style={{marginTop:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase",color:th.textMuted}}>{lbl("Force","Strength","القوة")}</span>
                        <span style={{fontSize:10,fontWeight:700,color:col}}>{lv}</span>
                      </div>
                      <div style={{height:5,background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:4,transition:"all 0.35s"}}/>
                      </div>
                    </div>
                  );
                })()}

                <SaveBtn onClick={handleChangePassword} loading={pwSaving} Icon={IconShield}>
                  {pwSaving?t("prof_changing"):t("prof_change_pw")}
                </SaveBtn>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:11}}>
                <div style={{borderRadius:13,padding:18,overflow:"hidden",position:"relative",background:"linear-gradient(135deg,#060e20,#0c1a3c)",border:"1px solid rgba(96,165,250,0.15)"}}>
                  <GridBg/><DiagonalAccent/>
                  <div style={{position:"relative",zIndex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:13,flexDirection:isRTL?"row-reverse":"row"}}>
                      <div style={{width:29,height:29,borderRadius:8,background:"rgba(37,99,235,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <IconShield s={14} c="#60a5fa"/>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:"white"}}>{lbl("État du compte","Account status","حالة الحساب")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:8,background:"rgba(22,163,74,0.18)",border:"1px solid rgba(22,163,74,0.35)",flexDirection:isRTL?"row-reverse":"row"}}>
                      <IconCheck s={13} c="#4ade80"/>
                      <div style={{textAlign:isRTL?"right":"left"}}>
                        <span style={{display:"block",fontSize:11,fontWeight:700,color:"#4ade80"}}>{lbl("Email vérifié","Email verified","البريد موثق")}</span>
                        <span style={{display:"block",fontSize:10,color:"rgba(74,222,128,0.75)",fontFamily:"monospace",marginTop:1}}>{profile.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{borderRadius:13,padding:16,background:isDark?"rgba(255,255,255,0.03)":"white",border:`1px solid ${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.08)"}`}}>
                  <p style={{margin:"0 0 11px",fontSize:9,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",color:th.textSecondary}}>
                    {lbl("Conseils sécurité","Security tips","نصائح الأمان")}
                  </p>
                  {[
                    lbl("8 caractères minimum","Minimum 8 characters","8 أحرف على الأقل"),
                    lbl("Mélangez majuscules, chiffres et symboles","Mix uppercase, numbers and symbols","امزج الأحرف والأرقام والرموز"),
                    lbl("Évitez les mots courants","Avoid common words","تجنب الكلمات الشائعة"),
                    lbl("Mot de passe unique par service","Unique password per service","كلمة مرور فريدة لكل خدمة"),
                  ].map((tip,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:7,marginBottom:8,flexDirection:isRTL?"row-reverse":"row"}}>
                      <div style={{width:17,height:17,borderRadius:5,background:"rgba(37,99,235,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                        <span style={{fontSize:9,fontWeight:800,color:"#2563eb"}}>{i+1}</span>
                      </div>
                      <span style={{fontSize:11,color:th.textSecondary,lineHeight:1.45}}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ STATS ════ */}
        {tab==="stats"&&(
          <div style={{animation:"fadeUp 0.4s ease both"}}>
            <SectionTitle>{t("prof_stats")}</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
              <StatTile value={profile.stats?.total_messages||0} label={t("prof_total_msg")} color="#2563eb" sub={lbl("messages envoyés","messages sent","رسالة مرسلة")}/>
              <StatTile value={profile.stats?.total_asl||0}      label={t("prof_asl_msg")}   color="#3b82f6" sub={`${aslPct}% ${lbl("du total","of total","من الإجمالي")}`}/>
              <StatTile value={profile.stats?.total_speech||0}   label={t("prof_vocal_msg")} color="#34d399" sub={`${speechPct}% ${lbl("du total","of total","من الإجمالي")}`}/>
              <StatTile value={levelLabel[profile.asl_level]||t("prof_beginner")} label={t("prof_level")} color="#f59e0b"/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div style={{borderRadius:13,padding:20,background:isDark?"rgba(255,255,255,0.03)":"white",border:`1px solid ${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.08)"}`}}>
                <p style={{margin:"0 0 16px",fontSize:9,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",color:th.textSecondary}}>{t("prof_repartition")}</p>
                <BarRow label="ASL"                 val={profile.stats?.total_asl||0}    pct={aslPct}    color="#3b82f6" Icon={IconSign}/>
                <BarRow label={t("prof_vocal_msg")} val={profile.stats?.total_speech||0} pct={speechPct} color="#34d399" Icon={IconMic}/>
                <div style={{marginTop:14,height:8,borderRadius:6,overflow:"hidden",display:"flex"}}>
                  <div style={{width:`${aslPct}%`,background:"#3b82f6",transition:"width 1s ease"}}/>
                  <div style={{flex:1,background:"#34d399"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                  <span style={{fontSize:10,color:"#3b82f6",fontWeight:700}}>ASL {aslPct}%</span>
                  <span style={{fontSize:10,color:"#34d399",fontWeight:700}}>{lbl("Vocal","Voice","صوتي")} {speechPct}%</span>
                </div>
              </div>

              <div style={{borderRadius:13,padding:20,background:isDark?"rgba(255,255,255,0.03)":"white",border:`1px solid ${isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.08)"}`}}>
                <p style={{margin:"0 0 16px",fontSize:9,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",color:th.textSecondary}}>{lbl("Informations","Account info","معلومات")}</p>
                {[
                  {label:t("prof_member_since"),         val:formatDate(profile.created_at),                       color:"#60a5fa"},
                  {label:t("prof_level"),                 val:levelLabel[profile.asl_level]||t("prof_beginner"),    color:"#f59e0b"},
                  {label:lbl("Langue","Language","اللغة"),val:profile.language?.toUpperCase()||"FR",                color:"#a78bfa"},
                  {label:t("prof_device"),                val:profile.hearing_device?t("prof_yes"):t("prof_no"),    color:"#34d399"},
                  {label:lbl("Rôle","Role","الدور"),      val:roleLabel[profile.role]||profile.role,               color:"#f87171"},
                ].map((row,i,arr)=>(
                  <div key={i} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 0",
                    borderBottom:i<arr.length-1?`1px solid ${isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`:  "none",
                    flexDirection:isRTL?"row-reverse":"row",
                  }}>
                    <span style={{fontSize:11,color:th.textSecondary}}>{row.label}</span>
                    <span style={{fontSize:11,fontWeight:700,color:row.color,fontFamily:"monospace"}}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Récapitulatif sombre */}
            <div style={{
              borderRadius:14,padding:"22px 28px",
              background:"linear-gradient(135deg,#060e20,#0c1a3c)",
              border:"1px solid rgba(96,165,250,0.12)",
              position:"relative",overflow:"hidden",
              display:"flex",alignItems:"center",justifyContent:"space-between",
              flexWrap:"wrap",gap:18,flexDirection:isRTL?"row-reverse":"row",
            }}>
              <GridBg/><DiagonalAccent/>
              <div style={{position:"relative",zIndex:1,display:"flex",gap:22,flexWrap:"wrap"}}>
                <ArcStat pct={aslPct}    color="#3b82f6" label="ASL"                         value={profile.stats?.total_asl||0}/>
                <ArcStat pct={speechPct} color="#34d399" label={lbl("Vocal","Voice","صوتي")} value={profile.stats?.total_speech||0}/>
                <ArcStat pct={100}       color="#60a5fa" label="Total"                        value={profile.stats?.total_messages||0}/>
              </div>
              <div style={{position:"relative",zIndex:1,textAlign:isRTL?"right":"left"}}>
                <p style={{margin:"0 0 4px",fontSize:9,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",color:"rgba(148,163,184,0.5)"}}>{lbl("Niveau actuel","Current level","المستوى الحالي")}</p>
                <p style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"white",letterSpacing:"-0.5px"}}>{levelLabel[profile.asl_level]||t("prof_beginner")}</p>
                <p style={{margin:0,fontSize:11,color:"rgba(148,163,184,0.6)",fontFamily:"monospace"}}>{profile.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

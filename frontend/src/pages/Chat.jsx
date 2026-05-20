import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import VideoCall from "./VideoCall";
import "bootstrap-icons/font/bootstrap-icons.css";

const API_BASE = "http://localhost:5000/api";
const ACCENT        = "#2563eb";
const SENT_BG       = "#2563eb";
const SENT_BG2      = "#1d4ed8";
const RECV_BG_LIGHT = "#ffffff";
const RECV_BG_DARK  = "#2a2a2a";

function api(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
    ...opts,
  }).then((r) => r.json());
}

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size = 36 }) {
  const url = photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=2563eb&color=fff&size=${size * 2}`;
  return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
}

// ── ASL Sign Picker ─────────────────────────────────────────────────────────
const ASL_WORDS = ["Hello","Thank you","Please","Yes","No","Help","Sorry","Good","Bad","Love","Friend","Family","Water","Food","Stop"];

function AslPicker({ onSelect, onClose, th }) {
  return (
    <div style={{ position:"absolute", bottom:"100%", left:0, right:0, background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:"12px", padding:"12px", marginBottom:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.15)", zIndex:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <span style={{ fontSize:"12px", fontWeight:"700", color:th.textSecondary }}>Send ASL Sign</span>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"16px", color:th.textSecondary }}>×</button>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
        {ASL_WORDS.map((word) => (
          <button key={word} onClick={() => onSelect(word)}
            style={{ padding:"5px 12px", borderRadius:"20px", border:`1px solid ${ACCENT}`, background:`rgba(37,99,235,0.08)`, color:ACCENT, fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
            ✋ {word}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Audio Message ───────────────────────────────────────────────────────────
function AudioMessage({ src, isMe, th }) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const audioRef   = useRef(null);
  const playingRef = useRef(false);

  const bars = useRef(Array.from({ length: 32 }, () => Math.random() * 0.7 + 0.3)).current;

  useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  const onMeta = () => {
    const d = audio.duration;
    if (d && isFinite(d)) setDuration(d);  // ← vérifier avant de setter
  };
  
  // ← Ajouter cet événement en backup
  const onCanPlay = () => {
    const d = audio.duration;
    if (d && isFinite(d) && duration === 0) setDuration(d);
  };

  const onTime = () => {
    setCurrent(audio.currentTime);
    setProgress(audio.duration && isFinite(audio.duration) 
      ? audio.currentTime / audio.duration 
      : 0);
  };
  
  const onEnd = () => {
    playingRef.current = false;
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
  };

  audio.addEventListener("loadedmetadata", onMeta);
  audio.addEventListener("canplay", onCanPlay);  // ← backup
  audio.addEventListener("timeupdate", onTime);
  audio.addEventListener("ended", onEnd);
  
  return () => {
    audio.removeEventListener("loadedmetadata", onMeta);
    audio.removeEventListener("canplay", onCanPlay);
    audio.removeEventListener("timeupdate", onTime);
    audio.removeEventListener("ended", onEnd);
  };
}, [duration]);  // ← ajouter duration en dépendance

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingRef.current) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
    } else {
      try {
        playingRef.current = true;
        setPlaying(true);
        await audio.play();
      } catch {
        playingRef.current = false;
        setPlaying(false);
      }
    }
  };

  const fmt = (s) => {
    if (!s || isNaN(s) || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const waveActive = isMe ? "rgba(255,255,255,0.95)" : ACCENT;
  const waveDim    = isMe ? "rgba(255,255,255,0.3)"  : "rgba(37,99,235,0.2)";
  const btnColor   = isMe ? "white" : ACCENT;
  const timeColor  = isMe ? "rgba(255,255,255,0.75)" : th.textSecondary;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:"200px" }}>
      {/* FIX: src peut être base64 ou URL — les deux fonctionnent avec <audio> */}
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle}
        style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${btnColor}`, background:"transparent", color:btnColor, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
        <i className={`bi bi-${playing ? "pause-fill" : "play-fill"}`} />
      </button>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ display:"flex", alignItems:"center", gap:1.5, height:28 }}>
          {bars.map((h, i) => (
            <div key={i} style={{
              width:3, borderRadius:2, flexShrink:0,
              height:`${h * 100}%`,
              background: i / bars.length < progress ? waveActive : waveDim,
              transition:"background 0.08s",
            }} />
          ))}
        </div>
       <span style={{ fontSize:10, color:timeColor }}>
  {playing ? fmt(current) : (duration && isFinite(duration) ? fmt(duration) : "0:00")}
</span> </div>
    </div>
  );
}

// ── Timestamp + double checkmarks ───────────────────────────────────────────
function TimeStamp({ time, isMe, read, timeColor }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0, marginLeft:"auto", alignSelf:"flex-end" }}>
      <span style={{ fontSize:10, color:timeColor, whiteSpace:"nowrap" }}>{time}</span>
      {isMe && (
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ flexShrink:0 }}>
          <path d="M1 5.5L4.5 9L10 2" stroke={read ? "#60a5fa" : timeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 5.5L8.5 9L14 2" stroke={read ? "#60a5fa" : timeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={read ? 1 : 0.5} />
        </svg>
      )}
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────
function Bubble({ msg, isMe, th, isDark, onDelete }) {
  const [hover, setHover] = useState(false);

  // ✅ isMe=true  → bleu (mes messages)
  // ✅ isMe=false → blanc/gris (messages reçus)
  const bubbleBg  = isMe
    ? `linear-gradient(135deg, ${SENT_BG}, ${SENT_BG2})`
    : (isDark ? RECV_BG_DARK : RECV_BG_LIGHT);
  const textColor = isMe ? "white" : th.textPrimary;
  const timeColor = isMe ? "rgba(255,255,255,0.7)" : th.textSecondary;

  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
    : "";

  const tailStyle = isMe
    ? { position:"absolute", bottom:0, right:-7, width:0, height:0,
        borderLeft:"8px solid #1d4ed8", borderTop:"8px solid transparent" }
    : { position:"absolute", bottom:0, left:-7, width:0, height:0,
        borderRight:`8px solid ${isDark ? RECV_BG_DARK : RECV_BG_LIGHT}`,
        borderTop:"8px solid transparent" };

  const shadowStyle = isMe
    ? "0 2px 8px rgba(37,99,235,0.35)"
    : isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.1)";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:"flex",
        justifyContent: isMe ? "flex-end" : "flex-start",
        marginBottom:"4px",
        paddingLeft: isMe ? 0 : 8,
        paddingRight: isMe ? 8 : 0,
      }}>
      <div style={{ maxWidth:"72%", position:"relative" }}>
        <div style={{
          background: bubbleBg,
          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          padding: msg.type==="photo" ? "4px" : msg.type==="audio" ? "10px 14px" : "8px 12px 6px 12px",
          boxShadow: shadowStyle,
          position:"relative",
          border: (!isMe && !isDark) ? "1px solid rgba(0,0,0,0.06)" : "none",
        }}>
          <div style={tailStyle} />

          {msg.type === "text" && msg.text && (
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:"6px" }}>
              <p style={{ margin:0, fontSize:"13.5px", color:textColor, lineHeight:"1.45", wordBreak:"break-word", flex:1 }}>
                {msg.text}
              </p>
              <TimeStamp time={time} isMe={isMe} read={msg.read} timeColor={timeColor} />
            </div>
          )}

          {msg.type === "asl" && (
            <div>
              <div style={{ fontSize:"11px", fontWeight:"700", color:isMe?"rgba(255,255,255,0.6)":th.textSecondary, marginBottom:"4px" }}>
                Signe ASL
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:6, flexWrap:"wrap" }}>
                <div style={{ fontSize:"22px", fontWeight:"900", color:textColor }}>✋ {msg.asl_word}</div>
                {msg.text && <p style={{ margin:0, fontSize:"12px", color:isMe?"rgba(255,255,255,0.8)":th.textSecondary }}>{msg.text}</p>}
                <TimeStamp time={time} isMe={isMe} read={msg.read} timeColor={timeColor} />
              </div>
            </div>
          )}

          {msg.type === "photo" && msg.media_url && (
            <div style={{ position:"relative" }}>
              <img src={msg.media_url} alt="photo"
                style={{ maxWidth:"220px", maxHeight:"200px", borderRadius:"12px", display:"block", objectFit:"cover" }} />
              <div style={{ position:"absolute", bottom:6, right:8, display:"flex", alignItems:"center", gap:3, background:"rgba(0,0,0,0.4)", borderRadius:8, padding:"2px 5px" }}>
                <span style={{ fontSize:10, color:"white" }}>{time}</span>
                {isMe && (
                  <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                    <path d="M1 5.5L4.5 9L10 2" stroke={msg.read?"#60a5fa":"rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 5.5L8.5 9L14 2" stroke={msg.read?"#60a5fa":"rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={msg.read?1:0.5}/>
                  </svg>
                )}
              </div>
            </div>
          )}

          {msg.type === "audio" && msg.media_url && (
            <div>
              <AudioMessage src={msg.media_url} isMe={isMe} th={th} />
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:2 }}>
                <TimeStamp time={time} isMe={isMe} read={msg.read} timeColor={timeColor} />
              </div>
            </div>
          )}
        </div>

        {hover && isMe && (
          <button onClick={() => onDelete(msg.id)}
            style={{ position:"absolute", top:"-8px", right:"-8px", width:20, height:20, borderRadius:"50%", background:"#ef4444", border:"none", color:"white", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>
            <i className="bi bi-x" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Audio Recorder ──────────────────────────────────────────────────────────
function AudioRecorder({ onSend, onCancel, th, isDark }) {
  const [seconds, setSeconds]   = useState(0);
  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      // FIX: utiliser audio/webm;codecs=opus si supporté, sinon fallback audio/webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => onSend(reader.result); // envoie base64 dataURL
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(100); // collecte toutes les 100ms
    }).catch((err) => {
      console.error("Microphone access denied:", err);
      onCancel();
    });
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const stop   = () => { if (mediaRef.current?.state !== "inactive") mediaRef.current?.stop(); clearInterval(intervalRef.current); };
  const cancel = () => { if (mediaRef.current?.state !== "inactive") mediaRef.current?.stop(); clearInterval(intervalRef.current); onCancel(); };
  const fmt    = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, background:isDark?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.06)", borderRadius:20, padding:"4px 12px" }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", animation:"pulse 1s infinite" }} />
      <span style={{ fontSize:13, color:"#ef4444", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fmt(seconds)}</span>
      <span style={{ fontSize:12, color:th.textSecondary, flex:1 }}>Enregistrement…</span>
      <button onClick={cancel} style={{ background:"none", border:"none", cursor:"pointer", color:th.textSecondary, fontSize:18 }}>✕</button>
      <button onClick={stop} style={{ background:"#ef4444", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"white", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <i className="bi bi-stop-fill" />
      </button>
    </div>
  );
}

// ── Incoming Call Popup ─────────────────────────────────────────────────────
function IncomingCall({ notif, onAccept, onDecline, th, isDark }) {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => {
      if (s <= 1) { onDecline(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onDecline]);

  return (
    <>
      <style>{`
        @keyframes slideIn{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes ringPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.4)}70%{box-shadow:0 0 0 12px rgba(37,99,235,0)}}
      `}</style>
      <div style={{ position:"fixed", top:24, right:24, zIndex:2000, width:300, background:isDark?"#1e293b":"white", borderRadius:16, border:`1px solid ${th.border}`, boxShadow:"0 12px 40px rgba(0,0,0,0.25)", animation:"slideIn 0.3s ease", overflow:"hidden" }}>
        <div style={{ height:3, background:isDark?"rgba(255,255,255,0.1)":"#f1f5f9" }}>
          <div style={{ height:"100%", background:ACCENT, width:`${(seconds/30)*100}%`, transition:"width 1s linear" }} />
        </div>
        <div style={{ padding:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <div style={{ position:"relative" }}>
              <img src={notif.from_photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(notif.from_name||"?")}&background=2563eb&color=fff&size=40`}
                alt="" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", animation:"ringPulse 1.5s infinite" }} />
              <div style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:"#2563eb", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${isDark?"#1e293b":"white"}` }}>
                <i className="bi bi-camera-video-fill" style={{ color:"white", fontSize:8 }} />
              </div>
            </div>
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:800, color:th.textPrimary }}>Appel vidéo entrant</p>
              <p style={{ margin:0, fontSize:12, color:th.textSecondary }}>{notif.from_name} vous appelle…</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onDecline} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#ef4444", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <i className="bi bi-telephone-x-fill" /> Refuser
            </button>
            <button onClick={onAccept} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, color:"white", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <i className="bi bi-camera-video-fill" /> Accepter
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CHAT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Chat({ open, onClose }) {
  const { theme } = useTheme();
  const th     = themes[theme];
  const isDark = theme === "dark";

  // FIX: parse me une seule fois, s'assurer que me.id est bien une string
  const me = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch { return {}; }
  })();
  // Normaliser me.id en string pour la comparaison
  const meId = String(me.id || me._id || "");

  const [convs,       setConvs]       = useState([]);
  const [activeConv,  setActiveConv]  = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState("");
  const [showAsl,     setShowAsl]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [photoPreview,setPhotoPreview]= useState(null);
  const [recording,   setRecording]   = useState(false);
  const [calling,     setCalling]     = useState(false);
  const [incomingCall,setIncomingCall]= useState(null);
  const [incomingChannel,setIncomingChannel] = useState(null);
  const [incomingFriend, setIncomingFriend]  = useState(null);

  const bottomRef    = useRef(null);
  const fileRef      = useRef(null);
  const pollRef      = useRef(null);
  const callPollRef  = useRef(null);
  const lastNotifIds = useRef(new Set());

  const loadConvs = useCallback(async () => {
    try {
      const data = await api("/chat/conversations");
      if (Array.isArray(data)) setConvs(data);
      const u = await api("/chat/unread");
      if (u.unread !== undefined) setUnread(u.unread);
    } catch {}
  }, []);

  useEffect(() => { if (open) loadConvs(); }, [open, loadConvs]);

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    const checkCalls = async () => {
      try {
        const data = await api("/notifications");
        const notifs = data.notifications || [];
        const callNotif = notifs.find((n) => n.type === "call" && !n.read && !lastNotifIds.current.has(n.id));
        if (callNotif) {
          lastNotifIds.current.add(callNotif.id);
          setIncomingCall(callNotif);
          setIncomingChannel(callNotif.channel);
          setIncomingFriend({ id:callNotif.from_id, name:callNotif.from_name, photo:callNotif.from_photo });
          await api(`/notifications/read/${callNotif.id}`, { method:"POST" });
        }
      } catch {}
    };
    callPollRef.current = setInterval(checkCalls, 3000);
    return () => clearInterval(callPollRef.current);
  }, []);

  const loadMessages = useCallback(async (friendId) => {
    if (!friendId) return;
    try {
      const data = await api(`/chat/messages/${friendId}`);
      if (Array.isArray(data)) { setMessages(data); loadConvs(); }
    } catch {}
  }, [loadConvs]);

  useEffect(() => {
    if (activeConv) {
      setLoading(true);
      loadMessages(activeConv.friend_id).finally(() => setLoading(false));
      pollRef.current = setInterval(() => loadMessages(activeConv.friend_id), 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [activeConv, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const sendText = async () => {
    if (!text.trim() && !photoPreview) return;
    setSending(true);
    try {
      const payload = photoPreview
        ? { to_id:activeConv.friend_id, type:"photo", photo_b64:photoPreview, text }
        : { to_id:activeConv.friend_id, type:"text", text };
      const msg = await api("/chat/messages", { method:"POST", body:JSON.stringify(payload) });
      setMessages((m) => [...m, msg]);
      setText(""); setPhotoPreview(null);
      loadConvs();
    } catch {}
    setSending(false);
  };

  const sendAsl = async (word) => {
    setShowAsl(false); setSending(true);
    try {
      const msg = await api("/chat/messages", { method:"POST", body:JSON.stringify({ to_id:activeConv.friend_id, type:"asl", asl_word:word, text:"" }) });
      setMessages((m) => [...m, msg]);
      loadConvs();
    } catch {}
    setSending(false);
  };

  const sendAudio = async (audioB64) => {
    setRecording(false); setSending(true);
    try {
      const msg = await api("/chat/messages", {
        method:"POST",
        body:JSON.stringify({ to_id:activeConv.friend_id, type:"audio", audio_b64:audioB64 })
      });
      if (msg && msg.id) {
        setMessages((m) => [...m, msg]);
        loadConvs();
      } else {
        console.error("Audio send failed:", msg);
      }
    } catch (e) {
      console.error("Audio send error:", e);
    }
    setSending(false);
  };

  const deleteMsg = async (id) => {
    try {
      await api(`/chat/messages/${id}`, { method:"DELETE" });
      setMessages((m) => m.filter((msg) => msg.id !== id));
    } catch {}
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const acceptCall = () => {
    setIncomingCall(null); setCalling(true);
    if (!activeConv || activeConv.friend_id !== incomingFriend?.id)
      setActiveConv({ friend_id:incomingFriend.id, friend_name:incomingFriend.name, friend_photo:incomingFriend.photo });
  };
  const declineCall = () => { setIncomingCall(null); setIncomingChannel(null); setIncomingFriend(null); };

  const chatBg = isDark
  ? "linear-gradient(135deg,#0d1117 0%,#161b22 100%)"
  : "#f0f2f5";  // ← gris neutre style WhatsApp
  if (!open) return (
    <>
      {incomingCall && <IncomingCall notif={incomingCall} onAccept={acceptCall} onDecline={declineCall} th={th} isDark={isDark} />}
      {calling && incomingFriend && <VideoCall friend={incomingFriend} channelName={incomingChannel} onClose={() => setCalling(false)} />}
      <button onClick={onClose}
        style={{ position:"fixed", bottom:"24px", right:"24px", width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, border:"none", color:"white", fontSize:22, cursor:"pointer", boxShadow:"0 6px 20px rgba(37,99,235,0.4)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <i className="bi bi-chat-dots-fill" />
        {unread > 0 && (
          <div style={{ position:"absolute", top:-4, right:-4, background:"#ef4444", color:"white", borderRadius:"50%", width:18, height:18, fontSize:10, fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>
    </>
  );
  // DEBUG — à retirer après
if (messages.length > 0) {
  console.log("meId:", meId);
  console.log("msg.from_id sample:", messages[0].from_id);
  console.log("match?", String(messages[0].from_id) === meId);
}

  return (
    <>
      <style>{`
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .msg-bubble { animation: fadeIn 0.18s ease; }
        .conv-row:hover { background: ${isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)"} !important; }
      `}</style>

      {incomingCall && <IncomingCall notif={incomingCall} onAccept={acceptCall} onDecline={declineCall} th={th} isDark={isDark} />}
      {calling && (
        <VideoCall
          friend={incomingFriend || (activeConv ? { id:activeConv.friend_id, name:activeConv.friend_name, photo:activeConv.friend_photo } : null)}
          channelName={incomingChannel || undefined}
          onClose={() => { setCalling(false); setIncomingChannel(null); setIncomingFriend(null); }}
        />
      )}

      <div style={{ position:"fixed", bottom:0, right:"24px", width:"360px", height:"560px", background:th.bgCard, border:`1px solid ${th.border}`, borderRadius:"16px 16px 0 0", boxShadow:"0 -4px 32px rgba(0,0,0,0.18)", zIndex:999, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"12px 16px", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
          {activeConv && (
            <button onClick={() => { setActiveConv(null); setMessages([]); }}
              style={{ background:"none", border:"none", color:"white", cursor:"pointer", fontSize:16, padding:0 }}>
              <i className="bi bi-chevron-left" />
            </button>
          )}
          {activeConv ? (
            <>
              <Avatar name={activeConv.friend_name} photo={activeConv.friend_photo} size={34} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"white" }}>{activeConv.friend_name}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.65)" }}>En ligne</div>
              </div>
              <button onClick={() => { setIncomingFriend(null); setIncomingChannel(null); setCalling(true); }}
                title="Appel vidéo"
                style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:8, color:"white", cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                <i className="bi bi-camera-video-fill" />
              </button>
            </>
          ) : (
            <>
              <i className="bi bi-chat-dots-fill" style={{ color:"white", fontSize:16 }} />
              <span style={{ fontSize:14, fontWeight:700, color:"white", flex:1 }}>Messages</span>
              {unread > 0 && <span style={{ background:"#ef4444", color:"white", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:800 }}>{unread}</span>}
            </>
          )}
          <button onClick={onClose} style={{ background:"none", border:"none", color:"white", cursor:"pointer", fontSize:18, padding:0 }}>×</button>
        </div>

        {/* Conversation list */}
        {!activeConv && (
          <div style={{ flex:1, overflowY:"auto", padding:"6px 0" }}>
            {convs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", color:th.textSecondary }}>
                <i className="bi bi-people" style={{ fontSize:32, marginBottom:12, display:"block", opacity:0.3 }} />
                <p style={{ fontSize:13, fontWeight:600, margin:"0 0 6px" }}>Aucune conversation</p>
                <p style={{ fontSize:12, margin:0, opacity:0.7 }}>Ajoutez des amis pour chatter</p>
              </div>
            ) : convs.map((conv) => (
              <div key={conv.friend_id} className="conv-row"
                onClick={() => setActiveConv({ friend_id:conv.friend_id, friend_name:conv.friend_name, friend_photo:conv.friend_photo })}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer", borderBottom:`1px solid ${th.border}20`, transition:"background 0.15s" }}>
                <div style={{ position:"relative" }}>
                  <Avatar name={conv.friend_name} photo={conv.friend_photo} size={44} />
                  {conv.unread > 0 && (
                    <div style={{ position:"absolute", bottom:-2, right:-2, background:"#25d366", color:"white", borderRadius:"50%", width:17, height:17, fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {conv.unread}
                    </div>
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <span style={{ fontSize:13.5, fontWeight:conv.unread>0?"800":"600", color:th.textPrimary }}>{conv.friend_name}</span>
                    {conv.last_message && (
                      <span style={{ fontSize:11, color:th.textSecondary }}>
                        {new Date(conv.last_message.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p style={{ fontSize:12, color:th.textSecondary, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:conv.unread>0?"700":"400" }}>
                      {conv.last_message.type==="asl"   ? `✋ ${conv.last_message.asl_word}` :
                       conv.last_message.type==="photo" ? "📷 Photo" :
                       conv.last_message.type==="audio" ? "🎤 Message vocal" :
                       conv.last_message.text}
                    </p>
                  )}
                </div>
                {conv.unread > 0 && (
                  <div style={{ background:"#25d366", color:"white", borderRadius:"50%", width:20, height:20, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {activeConv && (
          <>
            <div style={{ flex:1, overflowY:"auto", padding:"12px 8px", display:"flex", flexDirection:"column", background:chatBg }}>
              {loading ? (
                <div style={{ textAlign:"center", padding:20, color:th.textSecondary }}>
                  <i className="bi bi-arrow-repeat" style={{ fontSize:20, animation:"spin 1s linear infinite" }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px", color:th.textSecondary }}>
                  <div style={{ background:isDark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.7)", borderRadius:12, padding:"12px 20px", display:"inline-block" }}>
                    <p style={{ fontSize:12, margin:0 }}>Dites bonjour à {activeConv.friend_name} ! 👋</p>
                  </div>
                </div>
              ) : messages.map((msg) => (
                <div key={msg.id} className="msg-bubble">
                  {/*
                    FIX COULEURS: comparer String(msg.from_id) === meId
                    car MongoDB renvoie parfois des ObjectId sérialisés différemment
                  */}
                  <Bubble
                    msg={msg}
                    isMe={String(msg.from_id) === meId}
                    th={th}
                    isDark={isDark}
                    onDelete={deleteMsg}
                  />
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {photoPreview && (
              <div style={{ padding:"8px 12px", borderTop:`1px solid ${th.border}`, display:"flex", alignItems:"center", gap:8, background:th.bgCard }}>
                <img src={photoPreview} alt="preview" style={{ height:48, borderRadius:8, objectFit:"cover" }} />
                <button onClick={() => setPhotoPreview(null)} style={{ background:"#ef4444", border:"none", color:"white", borderRadius:"50%", width:20, height:20, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding:"8px 10px", borderTop:`1px solid ${th.border}`, position:"relative", background:isDark?"#1a1a2e":"#f0f0f0", flexShrink:0 }}>
              {showAsl && <AslPicker onSelect={sendAsl} onClose={() => setShowAsl(false)} th={th} />}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {!recording && (
                  <button onClick={() => setShowAsl((v)=>!v)}
                    style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${showAsl?ACCENT:th.border}`, background:showAsl?`rgba(37,99,235,0.1)`:"transparent", color:showAsl?ACCENT:th.textSecondary, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    ✋
                  </button>
                )}
                {!recording && (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${th.border}`, background:"transparent", color:th.textSecondary, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <i className="bi bi-image" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />

                {recording ? (
                  <AudioRecorder onSend={sendAudio} onCancel={() => setRecording(false)} th={th} isDark={isDark} />
                ) : (
                  <input value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key==="Enter" && !e.shiftKey && sendText()}
                    placeholder="Message…"
                    style={{ flex:1, padding:"9px 14px", borderRadius:22, border:`1px solid ${th.border}`, background:isDark?"rgba(255,255,255,0.08)":"white", color:th.textPrimary, fontSize:13, outline:"none", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }} />
                )}

                {!recording && (text.trim() || photoPreview) ? (
                  <button onClick={sendText} disabled={sending}
                    style={{ width:36, height:36, borderRadius:"50%", border:"none", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, color:"white", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 8px rgba(37,99,235,0.35)" }}>
                    <i className="bi bi-send-fill" />
                  </button>
                ) : !recording && (
                  <button onClick={() => setRecording(true)}
                    style={{ width:36, height:36, borderRadius:"50%", border:"none", background:`linear-gradient(135deg,${ACCENT},#1d4ed8)`, color:"white", cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 8px rgba(37,99,235,0.35)" }}>
                    <i className="bi bi-mic-fill" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
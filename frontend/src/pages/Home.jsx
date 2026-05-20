import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";
import {
  getStats, getLeaderboard,
  getFeedPosts,
  createPost, toggleLike,
  getComments, addComment, deletePost,
  recordView, reactToPost,
} from "../services/api";
import Chat from "../pages/Chat";

// ── Bootstrap Icons CDN ────────────────────────────────────────
const BI_CDN = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
if (!document.querySelector('link[data-bi]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = BI_CDN; link.setAttribute("data-bi", "1");
  document.head.appendChild(link);
}

// Google Fonts
const GF_CDN = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap";
if (!document.querySelector('link[data-gf]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = GF_CDN; link.setAttribute("data-gf", "1");
  document.head.appendChild(link);
}

const Bi = ({ name, size = 15, color, style: s, className = "" }) => (
  <i
    className={`bi bi-${name} ${className}`}
    style={{ fontSize: size, color, lineHeight: 1, display: "inline-flex", alignItems: "center", ...s }}
  />
);

// ── Helpers ────────────────────────────────────────────────────
const avatar = (name, photo) =>
  photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=2563eb&color=fff&size=80`;

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60)    return "à l'instant";
  if (d < 3600)  return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return `${Math.floor(d / 86400)} j`;
};

const REACTIONS = [
  { key: "like",  icon: "hand-thumbs-up-fill", color: "#2563eb", label: "J'aime",  emoji: "👍" },
  { key: "love",  icon: "heart-fill",           color: "#ef4444", label: "J'adore", emoji: "❤️" },
  { key: "haha",  icon: "emoji-laughing-fill",  color: "#f59e0b", label: "Haha",    emoji: "😂" },
  { key: "wow",   icon: "emoji-surprise-fill",  color: "#f59e0b", label: "Wouah",   emoji: "😮" },
  { key: "sad",   icon: "emoji-frown-fill",     color: "#f59e0b", label: "Triste",  emoji: "😢" },
  { key: "angry", icon: "emoji-angry-fill",     color: "#e9710f", label: "Grrr",    emoji: "😡" },
];

const ASL_TIPS = [
  "La langue des signes américaine (ASL) utilise l'espace en 3D devant le corps.",
  "Le signe 'ILY' (I Love You) combine les lettres I, L et Y en un seul geste.",
  "En ASL, le contact visuel est essentiel — c'est la base de la communication.",
  "Le manuel de l'alphabet ASL comporte 26 signes pour les lettres A–Z.",
  "Il existe plus de 300 langues des signes différentes dans le monde.",
  "L'ASL est une langue à part entière avec sa propre grammaire et syntaxe.",
  "La vitesse d'exécution des signes augmente avec la pratique quotidienne.",
  "L'expression du visage est une partie intégrante de la grammaire ASL.",
];

// ── Section title style ────────────────────────────────────────
const ST = (textSecondary) => ({
  fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
  letterSpacing: "1px", color: textSecondary, margin: "0 0 10px",
  display: "flex", alignItems: "center", gap: 6,
});

// ══════════════════════════════════════════════════════════════
export default function Home() {
  const navigate        = useNavigate();
  const { theme }       = useTheme();
  const th              = themes[theme];
  const isDark          = theme === "dark";
  const { t, language } = useLang();
  const isRTL           = language === "ar";
  const user            = JSON.parse(localStorage.getItem("user") || "{}");

  const [stats,       setStats]       = useState({ total_messages: 0, total_asl: 0, total_speech: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading,   setLbLoading]   = useState(true);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [dailyTip,    setDailyTip]    = useState("");

  // Feed : posts + stories séparés mais tous via /feed
  const [feedPosts,   setFeedPosts]   = useState([]);
  const [feedStories, setFeedStories] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newMedia,   setNewMedia]   = useState(null);
  const [newType,    setNewType]    = useState("post");
  const [posting,    setPosting]    = useState(false);
  const filePostRef = useRef(null);

  const [commentPost,  setCommentPost]  = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentText,  setCommentText]  = useState("");
  const [sendingCmt,   setSendingCmt]   = useState(false);

  const [storyViewer, setStoryViewer] = useState(null);

  const dir         = isRTL ? "rtl" : "ltr";
  const medalColors = ["#f59e0b", "#94a3b8", "#cd7c2f"];
  const podiumH     = [56, 40, 28];

  const aslPct    = stats.total_messages > 0 ? Math.round((stats.total_asl    / stats.total_messages) * 100) : 0;
  const speechPct = stats.total_messages > 0 ? Math.round((stats.total_speech / stats.total_messages) * 100) : 0;

  // Couleurs thème
  const bg            = isDark ? "#0f1117" : "#f0f2f5";
  const cardBg        = isDark ? "#1a1d27" : "#ffffff";
  const cardBg2       = isDark ? "#1e2130" : "#f8f9fb";
  const border        = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const textPrimary   = isDark ? "#e8eaf0" : "#111827";
  const textSecondary = isDark ? "#8b90a0" : "#6b7280";
  const accent        = "#2563eb";
  const accentLight   = isDark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.08)";

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    setDailyTip(ASL_TIPS[Math.floor(Math.random() * ASL_TIPS.length)]);
    getStats().then(r => setStats(r.data)).catch(() => {});
    getLeaderboard()
      .then(r => setLeaderboard(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));

    // Charger posts ET stories depuis le feed (moi + amis)
    const loadPosts   = getFeedPosts("post").then(r => r.data || []).catch(() => []);
    const loadStories = getFeedPosts("story").then(r => r.data || []).catch(() => []);

    Promise.all([loadPosts, loadStories])
      .then(([posts, stories]) => {
        setFeedPosts(posts);
        setFeedStories(stories);
      })
      .finally(() => setFeedLoading(false));
  }, []);

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home_greeting_morning");
    if (h < 18) return t("home_greeting_afternoon");
    return t("home_greeting_evening");
  };

  // ── Feed actions ───────────────────────────────────────────
  const handleLike = async (post) => {
    setFeedPosts(prev => prev.map(p =>
      p._id === post._id
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
    try { await toggleLike(post._id); } catch {
      setFeedPosts(prev => prev.map(p =>
        p._id === post._id ? { ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count } : p
      ));
    }
  };

  const openComments = async (post) => {
    setCommentPost(post); setCommentsList([]);
    try { const r = await getComments(post._id); setCommentsList(r.data); } catch {}
  };

  const sendComment = async () => {
    if (!commentText.trim() || sendingCmt) return;
    setSendingCmt(true);
    try {
      const r = await addComment(commentPost._id, commentText);
      setCommentsList(p => [...p, r.data]);
      setCommentText("");
      setFeedPosts(p => p.map(x => x._id === commentPost._id ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x));
    } catch {}
    setSendingCmt(false);
  };

  const handleDeletePost = async (pid) => {
    if (!window.confirm("Supprimer ce post ?")) return;
    try { await deletePost(pid); setFeedPosts(p => p.filter(x => x._id !== pid)); } catch {}
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewMedia(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if ((!newContent.trim() && !newMedia) || posting) return;
    setPosting(true);
    try {
      const res = await createPost({ content: newContent, media: newMedia, type: newType });
      const newPost = {
        _id: res.data.id, user_id: user.id,
        author_name: user.name, author_photo: user.photo,
        content: newContent, media: newMedia, type: newType,
        likes_count: 0, liked_by_me: false, comments_count: 0,
        created_at: new Date().toISOString(),
      };
      if (newType === "post")  setFeedPosts(p  => [newPost, ...p]);
      if (newType === "story") setFeedStories(p => [newPost, ...p]);
      setShowCreate(false); setNewContent(""); setNewMedia(null); setNewType("post");
    } catch {}
    setPosting(false);
  };

  // ── Leaderboard Row ────────────────────────────────────────
  const LbRow = ({ entry, rank }) => {
    const isMe = entry.name === user?.name;
    const rankColors = ["#f59e0b", "#94a3b8", "#cd7c2f"];
    return (
      <div
        onClick={() => entry.id && navigate(`/users/${entry.id}`)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 10,
          background: isMe ? accentLight : "transparent",
          border: `1px solid ${isMe ? "rgba(37,99,235,0.2)" : "transparent"}`,
          flexDirection: isRTL ? "row-reverse" : "row",
          cursor: entry.id ? "pointer" : "default",
          transition: "all 0.15s",
        }}
        className="lb-row"
      >
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: rank <= 3 ? rankColors[rank - 1] : isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
          fontSize: 10, fontWeight: 800,
          color: rank <= 3 ? "white" : textSecondary,
        }}>
          {rank <= 3 ? <Bi name="trophy-fill" size={10} color="white" /> : rank}
        </div>
        <img
          src={entry.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name || "?")}&background=2563eb&color=fff&size=32`}
          alt=""
          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
        <span style={{
          fontSize: 12, fontWeight: isMe ? 700 : 500,
          color: isMe ? accent : textPrimary,
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {entry.name}{isMe ? " (moi)" : ""}
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          background: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.2)",
          padding: "2px 8px", borderRadius: 20,
        }}>
          <Bi name="star-fill" size={9} color="#f59e0b" />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>{entry.xp}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh", background: bg, color: textPrimary,
      fontFamily: "'DM Sans', 'Segoe UI', Arial, sans-serif", direction: dir,
    }}>
      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeLeft  { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeRight { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes scaleIn   { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer   { from{background-position:-200% 0} to{background-position:200% 0} }
        @keyframes storyPulse{ 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.4)} 50%{box-shadow:0 0 0 6px rgba(37,99,235,0)} }

        .home-card { transition:transform 0.2s,box-shadow 0.2s; }
        .home-card:hover { transform:translateY(-3px); box-shadow:0 10px 30px rgba(0,0,0,0.12) !important; }
        .cta-btn { transition:all 0.15s; }
        .cta-btn:hover { transform:translateY(-2px); filter:brightness(1.08); }
        .lb-row:hover { background:${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"} !important; transform:translateX(${isRTL ? "-3px" : "3px"}); }
        .post-action-btn { transition:background 0.12s; }
        .post-action-btn:hover { background:${isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"} !important; }
        .compose-input:hover { background:${isDark ? "rgba(255,255,255,0.08)" : "#e9ebee"} !important; }
        .story-item { transition:transform 0.2s; cursor:pointer; }
        .story-item:hover { transform:scale(1.04); }
        .nav-link-item { transition:all 0.15s; border-radius:10px; cursor:pointer; }
        .nav-link-item:hover { background:${isDark ? "rgba(255,255,255,0.05)" : "rgba(37,99,235,0.05)"} !important; color:${accent} !important; }
        .skeleton { background:linear-gradient(90deg,${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 25%,${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"} 50%,${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        .progress-fill { transition:width 1s cubic-bezier(0.4,0,0.2,1); }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}; border-radius:4px; }
        .divider { height:1px; background:${border}; margin:4px 0; }
        .badge-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
      `}</style>

      <Navbar />

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <div style={{
        position: "relative", textAlign: "center",
        padding: "36px 16px 40px",
        borderBottom: `1px solid ${border}`, overflow: "hidden",
      }}>
        {/* Background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: isDark
              ? "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.08) 0%, transparent 50%), #0f1117"
              : "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.05) 0%, transparent 50%), #f0f2f5",
          }} />
          {/* Decorative grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: isDark ? 0.04 : 0.03 }} xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? "white" : "#2563eb"} strokeWidth="1"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div style={{ position: "relative", zIndex: 1, animation: "fadeUp 0.5s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: accentLight, border: `1px solid rgba(37,99,235,0.25)`, fontSize: 11, fontWeight: 700, color: accent, marginBottom: 20, letterSpacing: "0.5px" }}>
            <Bi name="hand-index-thumb-fill" size={12} color={accent} />
            ASL TRANSLATOR
          </div>

          <h1 style={{ fontSize: "32px", fontWeight: "800", lineHeight: "1.15", letterSpacing: "-0.8px", margin: "0 0 14px", color: textPrimary }}>
            {greetingTime()},{" "}
            <span style={{ color: accent }}>{user?.name}</span>
          </h1>
          <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.7", maxWidth: "480px", margin: "0 auto 32px" }}>
            {t("home_subtitle")}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => navigate("/conversation")} style={{
              padding: "10px 28px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <Bi name="camera-video-fill" size={14} color="white" />
              {t("home_start")}
            </button>
            <button className="cta-btn" onClick={() => navigate("/history")} style={{
              padding: "10px 28px", borderRadius: 10,
              border: `1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(37,99,235,0.2)"}`,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
              color: textPrimary, fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <Bi name="clock-history" size={14} color={textSecondary} />
              {t("home_history")}
            </button>
          </div>
        </div>
      </div>

      {/* ══ 3 COLONNES ═════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 280px", minHeight: "calc(100vh - 400px)", maxWidth: 1440, margin: "0 auto" }}>

        {/* ── COLONNE GAUCHE ──────────────────────────────────── */}
        <div style={{
          borderRight: `1px solid ${border}`, padding: "20px 14px",
          display: "flex", flexDirection: "column", gap: "6px",
          animation: "fadeLeft 0.5s ease 0.1s both",
          position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 64px)", overflowY: "auto",
        }}>

          {/* Profil card */}
          <div
            onClick={() => navigate("/profile")}
            className="home-card"
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px",
              borderRadius: 14, background: cardBg, border: `1px solid ${border}`,
              cursor: "pointer", marginBottom: 8, boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={user?.photo || `https://ui-avatars.com/api/?name=${user?.name}&background=2563eb&color=fff&size=56`}
                alt="avatar"
                style={{ width: 46, height: 46, borderRadius: "50%", border: `2px solid ${accent}`, objectFit: "cover" }}
              />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: `2px solid ${cardBg}` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px", color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</p>
              <p style={{ fontSize: 11, color: textSecondary, margin: 0 }}>
                {user?.role === "hearing_impaired" ? t("home_role_deaf") : t("home_role_hear")}
              </p>
            </div>
            <Bi name="chevron-right" size={13} color={textSecondary} />
          </div>

          {/* Stats card */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px", marginBottom: 8, boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ ...ST(textSecondary), marginBottom: 14 }}>
              <Bi name="bar-chart-fill" size={11} color={accent} />
              MES STATISTIQUES ASL
            </p>
            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bi name="chat-dots-fill" size={15} color={accent} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: textSecondary, fontWeight: 600 }}>Messages total</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}>{stats.total_messages}</p>
                </div>
              </div>
            </div>
            {/* ASL bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Bi name="hand-index-thumb-fill" size={11} color={accent} />
                  <span style={{ fontSize: 11, color: textSecondary, fontWeight: 600 }}>Traductions ASL</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: accent }}>{aslPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb", overflow: "hidden" }}>
                <div className="progress-fill" style={{ height: "100%", width: `${aslPct}%`, background: "linear-gradient(90deg,#2563eb,#60a5fa)", borderRadius: 3 }} />
              </div>
            </div>
            {/* Speech bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Bi name="mic-fill" size={11} color="#16a34a" />
                  <span style={{ fontSize: 11, color: textSecondary, fontWeight: 600 }}>Parole vers Texte</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a" }}>{speechPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb", overflow: "hidden" }}>
                <div className="progress-fill" style={{ height: "100%", width: `${speechPct}%`, background: "linear-gradient(90deg,#16a34a,#4ade80)", borderRadius: 3 }} />
              </div>
            </div>
          </div>

          {/* Navigation rapide */}
          <div style={{ marginBottom: 8 }}>
            <p style={{ ...ST(textSecondary), marginBottom: 6 }}>
              <Bi name="grid-fill" size={11} color={accent} />
              NAVIGATION
            </p>
            {[
              { icon: "camera-video-fill",      label: "Traducteur ASL",  path: "/conversation", color: accent },
              { icon: "clock-history",           label: "Historique",      path: "/history",      color: "#16a34a" },
              { icon: "person-circle",           label: "Mon profil",      path: "/profile",      color: "#0891b2" },
              { icon: "book-fill",               label: "Dictionnaire ASL",path: "/dictionary",   color: "#7c3aed" },
              { icon: "people-fill",             label: "Communauté",      path: "/users",        color: "#f59e0b" },
            ].map((link) => (
              <div
                key={link.path}
                className="nav-link-item"
                onClick={() => navigate(link.path)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", color: textSecondary,
                  fontSize: 13, fontWeight: 600, marginBottom: 2,
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${link.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bi name={link.icon} size={14} color={link.color} />
                </div>
                {link.label}
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* Astuce du jour */}
          {dailyTip && (
            <div style={{
              background: accentLight, border: `1px solid rgba(37,99,235,0.2)`,
              borderRadius: 12, padding: "12px 14px", marginTop: 6,
            }}>
              <p style={{ ...ST(accent), marginBottom: 6 }}>
                <Bi name="lightbulb-fill" size={11} color={accent} />
                ASTUCE DU JOUR
              </p>
              <p style={{ fontSize: 12, color: textSecondary, margin: 0, lineHeight: 1.7 }}>{dailyTip}</p>
            </div>
          )}

          <div className="divider" />

          {/* Comment ça marche */}
          <div style={{ marginTop: 6 }}>
            <p style={{ ...ST(textSecondary), marginBottom: 8 }}>
              <Bi name="info-circle-fill" size={11} color={accent} />
              COMMENT CA MARCHE
            </p>
            {[t("home_step1"), t("home_step2"), t("home_step3"), t("home_step4"), t("home_step5")].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "white",
                }}>{i + 1}</div>
                <span style={{ fontSize: 11, color: textSecondary, lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COLONNE CENTRE — FEED ────────────────────────────── */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px", animation: "fadeUp 0.5s ease 0.05s both" }}>

          {/* Stories bar */}
          <StoriesBar
            stories={feedStories}
            loading={feedLoading}
            user={user}
            isDark={isDark}
            cardBg={cardBg}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            accent={accent}
            onAddStory={() => { setNewType("story"); setShowCreate(true); }}
            onViewStory={(i) => setStoryViewer(i)}
            navigate={navigate}
          />

          {/* Compose box */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 16px", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <img
                src={avatar(user.name, user.photo)} alt=""
                style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0, cursor: "pointer", border: `2px solid ${border}` }}
                onClick={() => navigate("/profile")}
              />
              <div
                className="compose-input"
                onClick={() => { setNewType("post"); setShowCreate(true); }}
                style={{
                  flex: 1, height: 42, borderRadius: 22,
                  background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6",
                  border: `1px solid ${border}`, cursor: "pointer",
                  display: "flex", alignItems: "center", paddingLeft: 18,
                  fontSize: 13, color: textSecondary, transition: "background 0.15s",
                }}
              >
                Quoi de neuf ? Partage quelque chose...
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, display: "flex", gap: 0 }}>
              {[
                { icon: "camera-video-fill",      color: "#ef4444", label: "Story",   type: "story" },
                { icon: "image-fill",              color: "#22c55e", label: "Photo",   type: "post"  },
                { icon: "hand-index-thumb-fill",   color: accent,    label: "Signe ASL", type: "post" },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => { setNewType(btn.type); setShowCreate(true); }}
                  className="post-action-btn"
                  style={{
                    flex: 1, padding: "7px 4px", border: "none", background: "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 6, borderRadius: 8, fontSize: 12, fontWeight: 600, color: textSecondary,
                  }}
                >
                  <Bi name={btn.icon} size={15} color={btn.color} /> {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Séparateur feed */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: cardBg2, border: `1px solid ${border}` }}>
              <Bi name="globe2" size={11} color={textSecondary} />
              <span style={{ fontSize: 11, fontWeight: 700, color: textSecondary }}>Publications de la communauté</span>
            </div>
            <div style={{ flex: 1, height: 1, background: border }} />
          </div>

          {/* Posts */}
          {feedLoading ? (
            Array.from({ length: 3 }).map(i => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%" }} className="skeleton" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 13, width: "35%" }} className="skeleton" />
                    <div style={{ height: 10, width: "20%" }} className="skeleton" />
                  </div>
                </div>
                <div style={{ height: 13, marginBottom: 8 }} className="skeleton" />
                <div style={{ height: 13, width: "75%" }} className="skeleton" />
              </div>
            ))
          ) : feedPosts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              background: cardBg, borderRadius: 14, border: `1px solid ${border}`,
              boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.05)",
            }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Bi name="people-fill" size={28} color={accent} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: textPrimary }}>Aucune publication dans votre réseau</p>
              <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 20px", lineHeight: 1.6 }}>
                Ajoutez des amis ou créez votre première publication
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setShowCreate(true)} style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: accent, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                  <Bi name="pencil-fill" size={13} color="white" />
                  Créer une publication
                </button>
                <button onClick={() => navigate("/users")} style={{ padding: "9px 22px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: textPrimary, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                  <Bi name="person-plus-fill" size={13} color={textSecondary} />
                  Trouver des amis
                </button>
              </div>
            </div>
          ) : (
            feedPosts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                me={user}
                isDark={isDark}
                cardBg={cardBg}
                border={border}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                accent={accent}
                accentLight={accentLight}
                onLike={() => handleLike(post)}
                onComment={() => openComments(post)}
                onDelete={() => handleDeletePost(post._id)}
                navigate={navigate}
              />
            ))
          )}
        </div>

        {/* ── COLONNE DROITE ───────────────────────────────────── */}
        <div style={{
          borderLeft: `1px solid ${border}`, padding: "20px 14px",
          display: "flex", flexDirection: "column", gap: "14px",
          animation: "fadeRight 0.5s ease 0.1s both",
          position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 64px)", overflowY: "auto",
        }}>

          {/* Leaderboard */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bi name="trophy-fill" size={14} color="#f59e0b" />
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textPrimary }}>Leaderboard ASL</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="badge-pill" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  <Bi name="star-fill" size={9} color="#f59e0b" /> TOP 10
                </span>
                <button onClick={() => navigate("/users")} style={{ fontSize: 11, fontWeight: 600, color: accent, background: "none", border: "none", cursor: "pointer" }}>
                  Voir tout
                </button>
              </div>
            </div>

            <div style={{ padding: "12px 10px" }}>
              {lbLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ height: 38, marginBottom: 6 }} className="skeleton" />
                ))
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 10px" }}>
                  <Bi name="trophy" size={36} color={textSecondary} style={{ opacity: 0.4, display: "block", margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: textSecondary, margin: "0 0 4px" }}>Aucun score pour l'instant</p>
                  <p style={{ fontSize: 11, color: textSecondary, margin: "0 0 14px", opacity: 0.7 }}>Complète un quiz pour apparaître ici</p>
                  <button onClick={() => navigate("/dictionary")} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Commencer
                  </button>
                </div>
              ) : (
                <>
                  {/* Podium top 3 */}
                  {leaderboard.length >= 3 && (
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6, padding: "10px 6px 16px", background: isDark ? "rgba(245,158,11,0.04)" : "rgba(245,158,11,0.03)", borderRadius: 12, border: `1px solid ${isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.12)"}`, marginBottom: 10 }}>
                      {[1, 0, 2].map(idx => {
                        const entry = leaderboard[idx];
                        const color = medalColors[idx];
                        const h     = podiumH[idx];
                        const rank  = idx + 1;
                        return (
                          <div key={idx} onClick={() => entry?.id && navigate(`/users/${entry.id}`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, cursor: entry?.id ? "pointer" : "default" }}>
                            <div style={{ position: "relative" }}>
                              <img
                                src={entry?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry?.name || "?")}&background=${color.replace("#","")}&color=fff&size=40`}
                                alt=""
                                style={{ width: rank === 1 ? 44 : 36, height: rank === 1 ? 44 : 36, borderRadius: "50%", border: `2.5px solid ${color}`, objectFit: "cover", boxShadow: rank === 1 ? `0 0 12px ${color}66` : "none", display: "block" }}
                              />
                              <div style={{ position: "absolute", bottom: -4, right: -3, width: 15, height: 15, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", border: `2px solid ${cardBg}` }}>
                                {rank === 1 ? <Bi name="star-fill" size={7} color="white" /> : rank}
                              </div>
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: rank === 1 ? color : textSecondary, textAlign: "center", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry?.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 800, color, fontFamily: "monospace" }}>{entry?.xp} XP</span>
                            <div style={{ width: "85%", height: h, background: `linear-gradient(180deg,${color},${color}88)`, borderRadius: "4px 4px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "white", opacity: 0.9 }}>{rank}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Reste du leaderboard */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {(leaderboard.length >= 3 ? leaderboard.slice(3) : leaderboard).map((entry, i) => (
                      <LbRow key={i} entry={entry} rank={leaderboard.length >= 3 ? i + 4 : i + 1} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Niveaux ASL */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ ...ST(textSecondary), marginBottom: 12 }}>
              <Bi name="mortarboard-fill" size={11} color={accent} />
              NIVEAUX ASL
            </p>
            {[
              { level: "Débutant",      color: "#16a34a", desc: "Alphabet & salutations",  icon: "1-circle-fill",       pct: 33 },
              { level: "Intermédiaire", color: "#f59e0b", desc: "Phrases courantes",        icon: "2-circle-fill",       pct: 66 },
              { level: "Expert",        color: "#2563eb", desc: "Conversation fluide",      icon: "3-circle-fill",       pct: 100 },
            ].map((lvl, i) => (
              <div key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <Bi name={lvl.icon} size={16} color={lvl.color} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: lvl.color }}>{lvl.level}</span>
                  <span style={{ fontSize: 10, color: textSecondary, marginLeft: "auto" }}>{lvl.desc}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${lvl.pct}%`, background: lvl.color, borderRadius: 3, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* CTA Quiz */}
          <div style={{
            background: isDark ? "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(37,99,235,0.1))" : "linear-gradient(135deg,rgba(124,58,237,0.07),rgba(37,99,235,0.05))",
            border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: "16px", textAlign: "center",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
              <Bi name="controller" size={20} color="white" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: textPrimary, margin: "0 0 5px" }}>{t("home_ready")}</p>
            <p style={{ fontSize: 12, color: textSecondary, margin: "0 0 14px", lineHeight: 1.6 }}>{t("home_ready_sub")}</p>
            <button onClick={() => navigate("/dictionary")} style={{
              width: "100%", padding: "10px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Bi name="book-fill" size={14} color="white" />
              Commencer les leçons
            </button>
          </div>

          {/* Signes du jour */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ ...ST(textSecondary), marginBottom: 12 }}>
              <Bi name="hand-index-thumb-fill" size={11} color={accent} />
              SIGNES DU JOUR
            </p>
            {[
              { sign: "Bonjour",       desc: "Main ouverte vers l'avant",      icon: "hand-wave" },
              { sign: "Merci",         desc: "Main sur les lèvres puis avant", icon: "heart" },
              { sign: "S'il vous plaît", desc: "Cercle sur la poitrine",       icon: "hand-thumbs-up" },
              { sign: "Oui",           desc: "Poing qui hoche de haut en bas", icon: "check-circle" },
              { sign: "Non",           desc: "Index et majeur se ferment",     icon: "x-circle" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? `1px solid ${border}` : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bi name={item.icon} size={16} color={accent} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: textPrimary }}>{item.sign}</p>
                  <p style={{ margin: 0, fontSize: 10, color: textSecondary, lineHeight: 1.4 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MODAL: Créer post/story ════════════════════════════ */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div style={{ width: "100%", maxWidth: 520, background: cardBg, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", animation: "scaleIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bi name={newType === "story" ? "camera-video-fill" : "pencil-fill"} size={16} color={accent} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: textPrimary }}>
                  {newType === "story" ? "Créer une story" : "Nouvelle publication"}
                </h3>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6", border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={14} color={textPrimary} />
              </button>
            </div>
            <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
              {[{ val: "post", icon: "pencil-square", label: "Publication" }, { val: "story", icon: "camera-video", label: "Story 24h" }].map(tb => (
                <button key={tb.val} onClick={() => setNewType(tb.val)} style={{
                  flex: 1, padding: "12px", border: "none", background: "transparent", cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  color: newType === tb.val ? accent : textSecondary,
                  borderBottom: `3px solid ${newType === tb.val ? accent : "transparent"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "color 0.15s",
                }}>
                  <Bi name={tb.icon} size={14} color={newType === tb.val ? accent : textSecondary} />
                  {tb.label}
                </button>
              ))}
            </div>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <img src={avatar(user.name, user.photo)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{user.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, padding: "2px 8px", borderRadius: 6, background: accentLight, width: "fit-content" }}>
                    <Bi name="globe2" size={10} color={accent} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: accent }}>Public</span>
                  </div>
                </div>
              </div>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder={newType === "story" ? "Partage un signe ASL ou une astuce..." : "Partage ton expérience en langue des signes..."}
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 120,
                  padding: "12px 0", border: "none", borderBottom: `1px solid ${border}`,
                  background: "transparent", color: textPrimary, fontSize: 15,
                  fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6,
                }}
              />
              {newMedia && (
                <div style={{ position: "relative", marginTop: 12 }}>
                  <img src={newMedia} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />
                  <button onClick={() => setNewMedia(null)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bi name="x-lg" size={12} color="white" />
                  </button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                <button onClick={() => filePostRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: `1px solid ${border}`, borderRadius: 9, padding: "8px 14px", cursor: "pointer", color: textSecondary, fontSize: 13, fontWeight: 600 }}>
                  <Bi name="image-fill" size={15} color="#22c55e" /> Photo / Signe
                </button>
                <input type="file" accept="image/*" ref={filePostRef} style={{ display: "none" }} onChange={handleMediaSelect} />
                <button
                  onClick={handleCreate}
                  disabled={posting || (!newContent.trim() && !newMedia)}
                  style={{
                    padding: "9px 24px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                    color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                    opacity: (posting || (!newContent.trim() && !newMedia)) ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  {posting
                    ? <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    : <Bi name="send-fill" size={13} color="white" />
                  }
                  Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Commentaires ════════════════════════════════ */}
      {commentPost && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setCommentPost(null)}
        >
          <div style={{ width: "100%", maxWidth: 600, background: cardBg, borderRadius: "18px 18px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 -10px 40px rgba(0,0,0,0.4)", animation: "fadeUp 0.25s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bi name="chat-dots-fill" size={16} color={accent} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: textPrimary }}>Commentaires ({commentsList.length})</h3>
              </div>
              <button onClick={() => setCommentPost(null)} style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6", border: "none", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={13} color={textSecondary} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {commentsList.length === 0 && (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <Bi name="chat" size={32} color={textSecondary} style={{ opacity: 0.3, display: "block", margin: "0 auto 10px" }} />
                  <p style={{ color: textSecondary, fontSize: 13, margin: 0 }}>Sois le premier à commenter</p>
                </div>
              )}
              {commentsList.map((c, i) => (
                <div key={c.id || c._id || i} style={{ display: "flex", gap: 9 }}>
                  <img src={avatar(c.author_name, c.author_photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", borderRadius: "0 14px 14px 14px", padding: "9px 13px" }}>
                      <span
                        onClick={() => c.author_id && navigate(`/users/${c.author_id}`)}
                        style={{ fontSize: 12, fontWeight: 700, color: accent, cursor: "pointer" }}
                      >{c.author_name} </span>
                      <span style={{ fontSize: 13, color: textPrimary }}>{c.text}</span>
                    </div>
                    <span style={{ fontSize: 11, color: textSecondary, marginLeft: 8 }}>{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, display: "flex", gap: 9, alignItems: "center", flexShrink: 0 }}>
              <img src={avatar(user.name, user.photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
                placeholder="Écrire un commentaire..."
                style={{ flex: 1, padding: "10px 16px", borderRadius: 22, border: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", color: textPrimary, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <button
                onClick={sendComment}
                disabled={sendingCmt || !commentText.trim()}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !commentText.trim() ? 0.4 : 1 }}
              >
                <Bi name="send-fill" size={13} color="white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Story Viewer ══════════════════════════════════════ */}
      {storyViewer !== null && feedStories[storyViewer] && (
        <InstaStoryViewer
          stories={feedStories}
          index={storyViewer}
          setIndex={setStoryViewer}
          onClose={() => setStoryViewer(null)}
          me={user}
          isDark={isDark}
          cardBg={cardBg}
          border={border}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      )}

      {/* ══ Chat sidebar ══════════════════════════════════════ */}
      <Chat open={chatOpen} onClose={() => setChatOpen(v => !v)} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// StoriesBar
// ══════════════════════════════════════════════════════════════
function StoriesBar({ stories, loading, user, isDark, cardBg, border, textPrimary, textSecondary, accent, onAddStory, onViewStory, navigate }) {
  const myStories     = stories.filter(s => String(s.user_id) === String(user.id));
  const friendStories = stories.filter(s => String(s.user_id) !== String(user.id));

  // Grouper par auteur
  const groups = Object.values(
    friendStories.reduce((acc, s) => {
      const uid = String(s.user_id);
      if (!acc[uid]) acc[uid] = { uid, name: s.author_name, photo: s.author_photo, author_id: s.user_id, stories: [] };
      acc[uid].stories.push(s);
      return acc;
    }, {})
  );

  const ringStyle = (seen) => ({
    background: seen ? (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") : "linear-gradient(135deg,#2563eb,#7c3aed)",
    padding: "2px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  });

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: "12px", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
        <style>{"div::-webkit-scrollbar{display:none}"}</style>

        {/* Ma story */}
        <div className="story-item" onClick={onAddStory} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"}` }}>
              <img
                src={user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "?")}&background=2563eb&color=fff&size=80`}
                alt=""
                style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover" }}
              />
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: "50%", background: accent, border: `2px solid ${cardBg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bi name="plus-lg" size={11} color="white" />
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: textSecondary, textAlign: "center", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {myStories.length > 0 ? "Ma story" : "Créer"}
          </span>
        </div>

        {/* Mes stories (si j'en ai) */}
        {myStories.length > 0 && (
          <div className="story-item" onClick={() => onViewStory(stories.indexOf(myStories[0]))} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={ringStyle(false)}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: cardBg }}>
                {myStories[0].media
                  ? <img src={myStories[0].media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bi name="hand-index-thumb-fill" size={24} color="white" />
                  </div>
                }
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: textPrimary, textAlign: "center", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Ma story
            </span>
          </div>
        )}

        {/* Stories des amis */}
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 62, height: 62, borderRadius: "50%" }} className="skeleton" />
              <div style={{ width: 50, height: 10, borderRadius: 5 }} className="skeleton" />
            </div>
          ))
          : groups.map((g, i) => {
            const storyIdx = stories.indexOf(g.stories[0]);
            return (
              <div key={i} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div className="story-item" onClick={() => onViewStory(storyIdx)} style={{ position: "relative" }}>
                  <div style={ringStyle(false)}>
                    <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: cardBg }}>
                      {g.stories[0].media
                        ? <img src={g.stories[0].media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, hsl(${(i * 55) % 360},60%,40%), hsl(${(i * 55 + 45) % 360},70%,55%))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Bi name="hand-index-thumb-fill" size={22} color="white" />
                        </div>
                      }
                    </div>
                  </div>
                  {g.stories.length > 1 && (
                    <div style={{ position: "absolute", top: 0, right: 0, background: accent, color: "white", fontSize: 9, fontWeight: 800, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${cardBg}` }}>
                      {g.stories.length}
                    </div>
                  )}
                </div>
                <span
                  onClick={() => navigate(`/users/${g.author_id}`)}
                  style={{ fontSize: 11, fontWeight: 600, color: textPrimary, textAlign: "center", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                  title={g.name}
                >
                  {g.name}
                </span>
              </div>
            );
          })
        }

        {/* Vide + aucun ami */}
        {!loading && groups.length === 0 && myStories.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: textSecondary }}>
            <Bi name="info-circle" size={14} color={textSecondary} />
            <span style={{ fontSize: 12 }}>Ajoutez des amis pour voir leurs stories</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PostCard
// ══════════════════════════════════════════════════════════════
function PostCard({ post, me, isDark, cardBg, border, textPrimary, textSecondary, accent, accentLight, onLike, onComment, onDelete, navigate }) {
  const canDelete = String(me.id) === String(post.user_id);
  const isMyPost  = String(me.id) === String(post.user_id);
  const [showReactions, setShowReactions] = useState(false);
  const [reaction,      setReaction]      = useState(post.my_reaction || (post.liked_by_me ? "like" : null));
  const [showMenu,      setShowMenu]      = useState(false);
  const hoverTimer = useRef(null);

  const handleReactionHover = () => { hoverTimer.current = setTimeout(() => setShowReactions(true), 400); };
  const handleReactionLeave = () => { clearTimeout(hoverTimer.current); setTimeout(() => setShowReactions(false), 300); };
  const handleReactionClick = (r) => {
    setReaction(prev => prev === r ? null : r);
    setShowReactions(false);
    onLike();
  };

  const currentReaction = REACTIONS.find(r => r.key === reaction);

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: "visible", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        <img
          src={post.author_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || "?")}&background=2563eb&color=fff&size=40`}
          alt=""
          style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, cursor: isMyPost ? "default" : "pointer", border: `2px solid ${border}` }}
          onClick={() => !isMyPost && post.user_id && navigate(`/users/${post.user_id}`)}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <p
              style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isMyPost ? textPrimary : accent, cursor: isMyPost ? "default" : "pointer" }}
              onClick={() => !isMyPost && post.user_id && navigate(`/users/${post.user_id}`)}
            >
              {post.author_name}
            </p>
            {isMyPost && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: accentLight, color: accent }}>Moi</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <Bi name="clock" size={10} color={textSecondary} />
            <span style={{ fontSize: 11, color: textSecondary }}>{timeAgo(post.created_at)}</span>
            <span style={{ color: textSecondary, fontSize: 10 }}>·</span>
            <Bi name="globe2" size={10} color={textSecondary} />
          </div>
        </div>
        {canDelete && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}>
              <Bi name="three-dots" size={17} color={textSecondary} />
            </button>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: "100%", background: cardBg, border: `1px solid ${border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 50, minWidth: 160, overflow: "hidden", animation: "scaleIn 0.15s ease" }}>
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#ef4444", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
                >
                  <Bi name="trash-fill" size={14} color="#ef4444" /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.content && (
        <p style={{ margin: "0 16px 14px", fontSize: 14, color: textPrimary, lineHeight: 1.7 }}>{post.content}</p>
      )}
      {post.media && (
        <img src={post.media} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
      )}

      {/* Compteurs */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderTop: post.media ? `1px solid ${border}` : "none" }}>
          {post.likes_count > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: currentReaction ? currentReaction.color : accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name={currentReaction ? currentReaction.icon : "hand-thumbs-up-fill"} size={11} color="white" />
              </div>
              <span style={{ fontSize: 12, color: textSecondary }}>{post.likes_count}</span>
            </div>
          )}
          {post.comments_count > 0 && (
            <button onClick={onComment} style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <Bi name="chat-dots" size={13} color={textSecondary} />
              {post.comments_count} commentaire{post.comments_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", borderTop: `1px solid ${border}`, padding: "4px 8px", position: "relative" }}>
        {/* Like avec reaction picker */}
        <div style={{ flex: 1, position: "relative" }} onMouseEnter={handleReactionHover} onMouseLeave={handleReactionLeave}>
          {showReactions && (
            <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, display: "flex", gap: 4, background: isDark ? "rgba(20,20,30,0.98)" : "white", padding: "8px 12px", borderRadius: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", border: `1px solid ${border}`, animation: "scaleIn 0.15s ease", zIndex: 100 }}>
              {REACTIONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => handleReactionClick(r.key)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "transform 0.1s", padding: "2px 3px" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.4) translateY(-4px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  title={r.label}
                >
                  {r.emoji}
                  <span style={{ fontSize: 8, color: isDark ? "rgba(255,255,255,0.5)" : "#9ca3af", fontWeight: 600 }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setReaction(r => r ? null : "like"); onLike(); }}
            className="post-action-btn"
            style={{
              width: "100%", padding: "9px 8px", background: "none", border: "none", cursor: "pointer",
              borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              color: currentReaction ? currentReaction.color : textSecondary, fontSize: 13, fontWeight: 700,
            }}
          >
            {currentReaction
              ? <><span style={{ fontSize: 16 }}>{currentReaction.emoji}</span> {currentReaction.label}</>
              : <><Bi name="hand-thumbs-up" size={16} color={textSecondary} /> J'aime</>
            }
          </button>
        </div>

        <button
          onClick={onComment}
          className="post-action-btn"
          style={{ flex: 1, padding: "9px 8px", background: "none", border: "none", cursor: "pointer", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: textSecondary, fontSize: 13, fontWeight: 700 }}
        >
          <Bi name="chat-left" size={15} color={textSecondary} /> Commenter
        </button>

        <button
          className="post-action-btn"
          style={{ flex: 1, padding: "9px 8px", background: "none", border: "none", cursor: "pointer", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: textSecondary, fontSize: 13, fontWeight: 700 }}
        >
          <Bi name="share" size={15} color={textSecondary} /> Partager
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// InstaStoryViewer
// ══════════════════════════════════════════════════════════════
function InstaStoryViewer({ stories, index, setIndex, onClose, me, isDark, cardBg, border, textPrimary, textSecondary }) {
  const story = stories[index];
  const [progress,           setProgress]           = useState(0);
  const [paused,             setPaused]             = useState(false);
  const [reaction,           setReaction]           = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPanel,          setShowPanel]          = useState(null);
  const [cmtList,            setCmtList]            = useState([]);
  const [cmtText,            setCmtText]            = useState("");
  const [msgText,            setMsgText]            = useState("");

  const DURATION = 5000;
  const indexRef      = useRef(index);
  const onCloseRef    = useRef(onClose);
  const storiesLenRef = useRef(stories.length);
  useEffect(() => { indexRef.current = index; },            [index]);
  useEffect(() => { onCloseRef.current = onClose; },        [onClose]);
  useEffect(() => { storiesLenRef.current = stories.length; }, [stories.length]);

  useEffect(() => {
    if (!story) return;
    setProgress(0); setReaction(null); setShowPanel(null); setCmtList([]);
    recordView && recordView(story._id).catch(() => {});
  }, [index]);

  useEffect(() => {
    if (paused || showPanel) return;
    setProgress(0);
    const step = 100 / (DURATION / 50);
    const iv = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearInterval(iv);
          if (indexRef.current < storiesLenRef.current - 1) setIndex(i => i + 1);
          else onCloseRef.current();
          return 100;
        }
        return p + step;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [index, paused, showPanel]);

  const goNext = useCallback(() => index < stories.length - 1 ? setIndex(i => i + 1) : onClose(), [index, stories.length, setIndex, onClose]);
  const goPrev = useCallback(() => { if (index > 0) setIndex(i => i - 1); }, [index, setIndex]);

  const handleReaction = (r) => {
    setReaction(prev => prev === r ? null : r);
    setShowReactionPicker(false);
    reactToPost && reactToPost(story._id, r).catch(() => {});
  };

  const sendStoryComment = async () => {
    if (!cmtText.trim()) return;
    const opt = { id: Date.now(), author_name: me.name, author_photo: me.photo, text: cmtText, created_at: new Date().toISOString() };
    setCmtList(l => [...l, opt]);
    setCmtText("");
    try {
      const res = await addComment(story._id, opt.text);
      setCmtList(l => l.map(c => c.id === opt.id ? { ...opt, ...res.data } : c));
    } catch {
      setCmtList(l => l.filter(c => c.id !== opt.id));
    }
  };

  const av = (name, photo) => photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=1877f2&color=fff&size=80`;
  const reactionEmoji = REACTIONS.find(r => r.key === reaction)?.emoji;

  if (!story) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes reactionFloat { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-80px) scale(1.5)} }
        @keyframes slideUpPanel  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes scaleIn       { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Blurred bg */}
      <div style={{ position: "absolute", inset: 0, background: `url(${story.media || ""}) center/cover no-repeat`, filter: "blur(30px) brightness(0.3)" }} />

      <div
        style={{ position: "relative", width: 420, height: "100vh", maxHeight: 900, display: "flex", flexDirection: "column", background: "#000", overflow: "hidden" }}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", gap: 3, padding: "10px 10px 0" }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: i < index ? "100%" : i === index ? `${progress}%` : "0%", background: "white", borderRadius: 2, transition: i < index ? "none" : undefined }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ position: "absolute", top: 18, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
          <img src={av(story.author_name, story.author_photo)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", border: "2.5px solid white", objectFit: "cover" }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.author_name}</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{timeAgo(story.created_at)}</p>
          </div>
          <button onClick={() => setPaused(p => !p)} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bi name={paused ? "play-fill" : "pause-fill"} size={16} color="white" />
          </button>
          <button onClick={e => { e.stopPropagation(); onClose(); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bi name="x-lg" size={14} color="white" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {story.media
            ? <img src={story.media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" }}>
              <p style={{ fontSize: 22, color: "white", textAlign: "center", lineHeight: 1.7, fontWeight: 600, margin: 0 }}>{story.content}</p>
            </div>
          }
          {story.media && story.content && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 16px 16px", background: "linear-gradient(transparent,rgba(0,0,0,0.75))" }}>
              <p style={{ margin: 0, fontSize: 15, color: "white", lineHeight: 1.6 }}>{story.content}</p>
            </div>
          )}
          {reaction && (
            <div key={`${reaction}-${index}`} style={{ position: "absolute", bottom: 130, left: "50%", transform: "translateX(-50%)", fontSize: 52, animation: "reactionFloat 1.5s ease forwards", pointerEvents: "none" }}>
              {reactionEmoji}
            </div>
          )}
          {/* Nav zones */}
          <div onClick={goPrev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
          <div onClick={goNext} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
        </div>

        {/* Bottom bar */}
        <div style={{ flexShrink: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.9))", padding: "20px 12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setShowPanel(p => p === "comments" ? null : "comments")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 22, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", color: "white", fontSize: 12, fontWeight: 600 }}
            >
              <Bi name="chat-fill" size={13} color="white" />
              {cmtList.length > 0 ? cmtList.length : "Commenter"}
            </button>
            <div style={{ flex: 1 }} />
            {/* Reaction btn */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowReactionPicker(p => !p)}
                style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", background: reaction ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}
              >
                {reaction ? reactionEmoji : <Bi name="heart" size={20} color="white" />}
              </button>
              {showReactionPicker && (
                <div style={{ position: "absolute", bottom: 52, right: 0, display: "flex", gap: 6, background: "rgba(15,15,25,0.97)", padding: "10px 14px", borderRadius: 34, boxShadow: "0 4px 24px rgba(0,0,0,0.7)", animation: "scaleIn 0.2s ease", zIndex: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => handleReaction(r.key)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26 }}>{r.emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Message input */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <img src={av(me.name, me.photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative" }}>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Envoyer un message..."
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 44px 10px 16px", borderRadius: 26, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              {msgText && (
                <button onClick={() => setMsgText("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#2563eb", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Bi name="send-fill" size={12} color="white" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Comments panel */}
        {showPanel === "comments" && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: isDark ? "#16181f" : "#fff", borderRadius: "16px 16px 0 0", maxHeight: "60%", display: "flex", flexDirection: "column", animation: "slideUpPanel 0.25s ease", zIndex: 30, boxShadow: "0 -8px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.15)" : "#d1d5db" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Bi name="chat-dots-fill" size={15} color={isDark ? "white" : "#111827"} />
                <span style={{ fontSize: 15, fontWeight: 800, color: isDark ? "white" : "#111827" }}>Commentaires</span>
              </div>
              <button onClick={() => setShowPanel(null)} style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={12} color={isDark ? "white" : "#111827"} />
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
              {cmtList.length === 0
                ? <p style={{ textAlign: "center", color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af", fontSize: 13, padding: "20px 0" }}>Sois le premier à commenter</p>
                : cmtList.map((c, i) => (
                  <div key={c.id || i} style={{ display: "flex", gap: 9 }}>
                    <img src={av(c.author_name, c.author_photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", borderRadius: "0 12px 12px 12px", padding: "8px 12px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>{c.author_name} </span>
                        <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.85)" : "#111827" }}>{c.text}</span>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", alignItems: "center", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
              <img src={av(me.name, me.photo)} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
              <input
                value={cmtText}
                onChange={e => setCmtText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendStoryComment()}
                placeholder="Commenter..."
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                style={{ flex: 1, padding: "8px 14px", borderRadius: 20, border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"}`, background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: isDark ? "white" : "#111827", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <button onClick={sendStoryComment} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#2563eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: cmtText.trim() ? 1 : 0.4 }}>
                <Bi name="send-fill" size={13} color="white" />
              </button>
            </div>
          </div>
        )}

        {/* Nav arrows */}
        {index > 0 && (
          <button onClick={goPrev} style={{ position: "absolute", left: 8, top: "45%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 15 }}>
            <Bi name="chevron-left" size={16} color="white" />
          </button>
        )}
        {index < stories.length - 1 && (
          <button onClick={goNext} style={{ position: "absolute", right: 8, top: "45%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 15 }}>
            <Bi name="chevron-right" size={16} color="white" />
          </button>
        )}
      </div>
    </div>
  );
}
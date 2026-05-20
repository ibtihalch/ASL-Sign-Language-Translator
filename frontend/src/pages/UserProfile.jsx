import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";
import {
  getUserProfile, getUserFriends,
  sendFriendRequest, acceptFriend, removeFriend,
  getUserPosts, createPost, toggleLike,
  getComments, addComment, deletePost,
  recordView, getViews, reactToPost, getReactions
} from "../services/api";

// Bootstrap Icons
const BI_CDN = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
if (!document.querySelector('link[data-bi]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = BI_CDN; link.setAttribute("data-bi", "1");
  document.head.appendChild(link);
}
const Bi = ({ name, size = 15, color, style: s }) => (
  <i className={`bi bi-${name}`} style={{ fontSize: size, color, lineHeight: 1, display: "inline-flex", ...s }} />
);

// ── Helpers ────────────────────────────────────────────────────
const avatar = (name, photo) =>
  photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=2563eb&color=fff&size=80`;

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
};

const REACTIONS = [
  { key: "like",  icon: "hand-thumbs-up-fill", color: "#2563eb", label: "J'aime",  emoji: "👍" },
  { key: "love",  icon: "heart-fill",           color: "#ef4444", label: "J'adore", emoji: "❤️" },
  { key: "haha",  icon: "emoji-laughing-fill",  color: "#f59e0b", label: "Haha",    emoji: "😂" },
  { key: "wow",   icon: "emoji-surprise-fill",  color: "#f59e0b", label: "Wouah",   emoji: "😮" },
  { key: "sad",   icon: "emoji-frown-fill",     color: "#f59e0b", label: "Triste",  emoji: "😢" },
  { key: "angry", icon: "emoji-angry-fill",     color: "#e9710f", label: "Grrr",    emoji: "😡" },
];

// ══════════════════════════════════════════════════════════════
export default function UserProfile() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { theme }    = useTheme();
  const th           = themes[theme];
  const isDark       = theme === "dark";
  const { language } = useLang();
  const isRTL        = language === "ar";
  const me           = JSON.parse(localStorage.getItem("user") || "{}");
  const isMe         = String(me.id) === String(id);

  const [user,       setUser]       = useState(null);
  const [friends,    setFriends]    = useState([]);
  const [posts,      setPosts]      = useState([]);
  const [stories,    setStories]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [actionFr,   setActionFr]   = useState(false);
  const [activeTab,  setActiveTab]  = useState("posts");

  const [storyViewer,  setStoryViewer]  = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [newContent,   setNewContent]   = useState("");
  const [newMedia,     setNewMedia]     = useState(null);
  const [newType,      setNewType]      = useState("post");
  const [posting,      setPosting]      = useState(false);
  const fileInputRef = useRef(null);

  const [commentPost,  setCommentPost]  = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentText,  setCommentText]  = useState("");
  const [sendingCmt,   setSendingCmt]   = useState(false);

  // ── Fetch ───────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getUserProfile(id),
      getUserFriends(id),
      getUserPosts(id, "post"),
      getUserPosts(id, "story"),
    ])
      .then(([uRes, fRes, pRes, sRes]) => {
        setUser(uRes.data);
        setFriends(fRes.data || []);
        setPosts(pRes.data || []);
        setStories(sRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // ── Friend actions ───────────────────────────────────────────
  const handleFriend = async () => {
    if (!user || actionFr) return;
    setActionFr(true);
    try {
      if (user.relation === "none") {
        await sendFriendRequest(id);
        setUser(u => ({ ...u, relation: "request_sent" }));
      } else if (user.relation === "request_received") {
        await acceptFriend(id);
        setUser(u => ({ ...u, relation: "friend", friends_count: u.friends_count + 1 }));
      } else if (user.relation === "friend") {
        await removeFriend(id);
        setUser(u => ({ ...u, relation: "none", friends_count: Math.max(0, u.friends_count - 1) }));
      }
    } catch {}
    setActionFr(false);
  };

  const friendBtn = () => {
    if (!user) return {};
    const m = {
      none:             { label: "Ajouter en ami",   color: "#2563eb", outlined: false },
      request_sent:     { label: "Demande envoyée",  color: "#f59e0b", outlined: true  },
      request_received: { label: "Accepter",         color: "#16a34a", outlined: false },
      friend:           { label: "Retirer des amis", color: "#ef4444", outlined: true  },
    };
    return m[user.relation] || m.none;
  };

  // ── Like (optimistic update) ──────────────────────────────────
  const handleLike = async (post) => {
    // Optimistic update immédiat
    setPosts(prev => prev.map(p =>
      p._id === post._id
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
    try {
      await toggleLike(post._id);
    } catch {
      // Rollback si erreur
      setPosts(prev => prev.map(p =>
        p._id === post._id ? { ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count } : p
      ));
    }
  };

  // ── Comments ─────────────────────────────────────────────────
  const openComments = async (post) => {
    setCommentPost(post);
    setCommentsList([]);
    try { const res = await getComments(post._id); setCommentsList(res.data); } catch {}
  };

  const sendComment = async () => {
    if (!commentText.trim() || sendingCmt) return;
    setSendingCmt(true);
    try {
      const res = await addComment(commentPost._id, commentText);
      setCommentsList(prev => [...prev, res.data]);
      setCommentText("");
      // Optimistic update du compteur
      setPosts(prev => prev.map(p =>
        p._id === commentPost._id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      ));
    } catch {}
    setSendingCmt(false);
  };

  // ── Create post/story ────────────────────────────────────────
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
        _id: res.data.id, user_id: me.id,
        author_name: me.name, author_photo: me.photo,
        content: newContent, media: newMedia, type: newType,
        likes_count: 0, liked_by_me: false, comments_count: 0,
        created_at: new Date().toISOString(),
      };
      if (newType === "post")  setPosts(prev   => [newPost, ...prev]);
      if (newType === "story") setStories(prev => [newPost, ...prev]);
      setShowCreate(false); setNewContent(""); setNewMedia(null); setNewType("post");
    } catch {}
    setPosting(false);
  };

  const handleDeletePost = async (pid) => {
    if (!window.confirm("Supprimer ce post ?")) return;
    try { await deletePost(pid); setPosts(prev => prev.filter(p => p._id !== pid)); } catch {}
  };

  // ── Theme shortcuts ──────────────────────────────────────────
  const bg            = isDark ? "#18191a" : "#f0f2f5";
  const cardBg        = isDark ? "#242526" : "#fff";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "#ddd";
  const textPrimary   = isDark ? "#e4e6eb" : "#050505";
  const textSecondary = isDark ? "#b0b3b8" : "#65676b";

  // Vérifie si l'utilisateur a des stories actives (pour l'anneau Instagram)
  const hasStories = stories.length > 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(37,99,235,0.2)", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <Navbar />
      <div style={{ textAlign: "center", padding: "80px 16px" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: textSecondary }}>Utilisateur introuvable</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" }}>Retour</button>
      </div>
    </div>
  );

  const btn = friendBtn();

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Segoe UI',system-ui,sans-serif", direction: isRTL ? "rtl" : "ltr" }}>
      <style>{`
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes storyRing { 0%,100%{opacity:1} 50%{opacity:0.7} }
        .post-card:hover   { box-shadow:0 4px 20px rgba(0,0,0,0.12) !important; }
        .story-thumb:hover { transform:scale(1.06) !important; }
        .friend-card:hover { transform:translateY(-2px); }
        .action-btn:hover  { background:${isDark ? "rgba(255,255,255,0.08)" : "#f0f2f5"} !important; }
        .avatar-story-ring { cursor:pointer; }
        .avatar-story-ring:hover img { transform:scale(1.04); }
        ::-webkit-scrollbar{ width:4px }
        ::-webkit-scrollbar-thumb{ background:${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}; border-radius:4px }
      `}</style>
      <Navbar />

      {/* ════ COVER + HEADER ════ */}
      <div style={{ background: cardBg, maxWidth: 950, margin: "0 auto" }}>

        {/* Bannière */}
        <div style={{
          height: 200,
          background: user.banner
            ? `url(${user.banner}) center/cover no-repeat`
            : "linear-gradient(135deg,#1e3a5f 0%,#2563eb 50%,#7c3aed 100%)",
          position: "relative",
          borderRadius: "0 0 0 0",
        }}>
          <button onClick={() => navigate(-1)} style={{
            position: "absolute", top: 16, left: 16,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
            border: "none", borderRadius: 8,
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "7px 14px",
          }}>
            <Bi name="arrow-left" size={14} color="white" /> Retour
          </button>
        </div>

        {/* ── Identity row — FIX décalage avatar/nom ── */}
        <div style={{ padding: "0 24px 16px", position: "relative" }}>

          {/* Avatar — positionné pour chevaucher la bannière */}
          <div style={{
            position: "absolute",
            top: -68,           /* remonte de 68px au-dessus du bas de la bannière */
            left: 24,
            zIndex: 10,
          }}>
            {/* Anneau Instagram si stories */}
            <div
              className="avatar-story-ring"
              onClick={hasStories ? () => setStoryViewer(0) : undefined}
              style={{
                width: 168,
                height: 168,
                borderRadius: "50%",
                padding: hasStories ? 4 : 0,
                background: hasStories
                  ? "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"
                  : "transparent",
                boxSizing: "border-box",
                transition: "transform 0.2s",
              }}
            >
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: hasStories ? `3px solid ${cardBg}` : `4px solid ${cardBg}`,
                overflow: "hidden",
                background: cardBg,
                boxSizing: "border-box",
                boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              }}>
                <img
                  src={avatar(user.name, user.photo)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s", display: "block" }}
                />
              </div>
            </div>
            {/* Badge stories count */}
            {hasStories && (
              <div style={{
                position: "absolute", bottom: 6, right: 6,
                background: "#2563eb", color: "white",
                fontSize: 11, fontWeight: 800,
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${cardBg}`,
                zIndex: 2,
              }}>
                {stories.length}
              </div>
            )}
          </div>

          {/* Infos — poussées à droite de l'avatar */}
          <div style={{
            paddingLeft: 192,   /* largeur avatar (168) + gap (24) */
            paddingTop: 16,     /* espace depuis le bas de la bannière */
            paddingBottom: 12,
            minHeight: 100,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>

              {/* Nom + meta */}
              <div>
                <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: textPrimary, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                  {user.name}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: textSecondary, fontWeight: 600 }}>
                    {user.role === "hearing_impaired" ? "Malentendant" : "Entendant"}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: textSecondary, display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>
                    {user.asl_level === "beginner" ? "Débutant" : user.asl_level === "intermediate" ? "Intermédiaire" : "Expert"}
                  </span>
                </div>
                {user.bio && (
                  <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 6px", lineHeight: 1.6, maxWidth: 500 }}>{user.bio}</p>
                )}
                <p style={{ fontSize: 13, color: textSecondary, margin: 0, fontWeight: 600 }}>
                  {user.friends_count || 0} ami{(user.friends_count || 0) > 1 ? "s" : ""}
                </p>
                {/* Overlapping friend avatars */}
                {friends.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
                    {friends.slice(0, 8).map((f, i) => (
                      <img key={i} src={avatar(f.name, f.photo)} alt="" style={{
                        width: 28, height: 28, borderRadius: "50%", objectFit: "cover",
                        border: `2px solid ${cardBg}`, marginLeft: i > 0 ? -8 : 0,
                        zIndex: 8 - i, position: "relative",
                      }} />
                    ))}
                    {friends.length > 8 && (
                      <span style={{ fontSize: 11, color: textSecondary, marginLeft: 10 }}>+{friends.length - 8}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Boutons action */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
                {!isMe && (
                  <button onClick={handleFriend} disabled={actionFr || user.relation === "request_sent"}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
                      border: btn.outlined ? `1.5px solid ${btn.color}` : "none",
                      background: btn.outlined ? "transparent" : btn.color,
                      color: btn.outlined ? btn.color : "white",
                      opacity: actionFr ? 0.6 : 1, transition: "opacity 0.15s",
                    }}>
                    <Bi name={user.relation === "friend" ? "person-dash-fill" : "person-plus-fill"} size={14} color={btn.outlined ? btn.color : "white"} />
                    {actionFr ? "..." : btn.label}
                  </button>
                )}
                {user.relation === "friend" && !isMe && (
                  <button onClick={() => navigate(`/messages/${user.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: isDark ? "#3a3b3c" : "#e4e6eb", color: textPrimary, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    <Bi name="chat-fill" size={14} color={textPrimary} /> Message
                  </button>
                )}
                {isMe && (
                  <button onClick={() => navigate("/profile")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#3a3b3c" : "#e4e6eb", color: textPrimary, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    <Bi name="pencil-fill" size={13} color={textPrimary} /> Modifier le profil
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div style={{ display: "flex", gap: 32, padding: "12px 24px", borderTop: `1px solid ${border}` }}>
          {[
            { val: posts.length,            label: "Publications" },
            { val: user.friends_count || 0, label: "Amis"         },
          ].map((s, i) => (
            <div key={i}>
              <p style={{ fontSize: 18, fontWeight: 900, color: textPrimary, margin: "0 0 2px", fontFamily: "monospace" }}>{s.val}</p>
              <p style={{ fontSize: 11, color: textSecondary, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px", borderTop: `1px solid ${border}` }}>
          {[
            { key: "posts",   label: `Publications (${posts.length})` },
            { key: "friends", label: `Amis (${friends.length})`       },
          ].map(tb => (
            <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
              padding: "14px 16px", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: "transparent",
              color: activeTab === tb.key ? "#2563eb" : textSecondary,
              borderBottom: `3px solid ${activeTab === tb.key ? "#2563eb" : "transparent"}`,
              transition: "all 0.15s",
            }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════ MAIN CONTENT ════ */}
      <div style={{ maxWidth: 950, margin: "0 auto", padding: "16px 0 60px" }}>

        {/* ── FEED (posts + sidebar) ── */}
        {activeTab === "posts" && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>

            {/* Sidebar gauche */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Intro card */}
              <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: textPrimary }}>Intro</h3>
                {user.bio && (
                  <p style={{ margin: "0 0 12px", fontSize: 14, color: textPrimary, lineHeight: 1.6, textAlign: "center" }}>{user.bio}</p>
                )}
                {[
                  user.city && { icon: "geo-alt-fill",    text: `Habite à ${user.city}${user.country ? `, ${user.country}` : ""}` },
                  user.created_at && { icon: "calendar3", text: `Membre depuis ${new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` },
                  { icon: "person-fill",    text: user.role === "hearing_impaired" ? "Malentendant" : "Entendant" },
                  { icon: "mortarboard-fill", text: user.asl_level === "beginner" ? "Niveau débutant" : user.asl_level === "intermediate" ? "Niveau intermédiaire" : "Niveau expert" },
                ].filter(Boolean).filter(x => x.text).map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Bi name={row.icon} size={18} color={textSecondary} />
                    <span style={{ fontSize: 14, color: textSecondary }}>{row.text}</span>
                  </div>
                ))}
              </div>

              {/* Friends card (mini) */}
              {friends.length > 0 && (
                <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPrimary }}>Ami(e)s</h3>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: textSecondary }}>{friends.length} ami{friends.length > 1 ? "s" : ""}</p>
                    </div>
                    <button onClick={() => setActiveTab("friends")} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Tous
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {friends.slice(0, 9).map((f, i) => (
                      <div key={i} className="friend-card" onClick={() => navigate(`/users/${f.id}`)} style={{ cursor: "pointer", transition: "transform 0.15s" }}>
                        <img src={avatar(f.name, f.photo)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 8, objectFit: "cover", display: "block" }} />
                        <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 700, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

             
            </div>

            {/* Colonne droite */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Compose box (si c'est moi) */}
              {isMe && (
                <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={avatar(me.name, me.photo)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    <div onClick={() => { setNewType("post"); setShowCreate(true); }}
                      style={{ flex: 1, height: 40, borderRadius: 20, background: isDark ? "rgba(255,255,255,0.07)" : "#f0f2f5", border: `1px solid ${border}`, cursor: "pointer", display: "flex", alignItems: "center", paddingLeft: 16 }}>
                      <span style={{ fontSize: 14, color: textSecondary }}>Quoi de neuf ? Publie quelque chose...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Posts */}
              {posts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0", color: textSecondary, background: cardBg, borderRadius: 12, border: `1px solid ${border}` }}>
                  <Bi name="inbox" size={44} color={textSecondary} />
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "12px 0 0" }}>Aucune publication pour l'instant</p>
                </div>
              ) : posts.map(post => (
                <PostCard
                  key={post._id}
                  post={post}
                  me={me}
                  isMe={isMe}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  cardBg={cardBg}
                  border={border}
                  onLike={() => handleLike(post)}
                  onComment={() => openComments(post)}
                  onDelete={() => handleDeletePost(post._id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── FRIENDS TAB ── */}
        {activeTab === "friends" && (
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: textPrimary }}>Ami(e)s · {friends.length}</h3>
            {friends.length === 0 ? (
              <p style={{ textAlign: "center", color: textSecondary, fontSize: 14, padding: "30px 0" }}>Aucun ami pour l'instant</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                {friends.map(f => (
                  <div key={f.id} className="friend-card" onClick={() => navigate(`/users/${f.id}`)}
                    style={{ cursor: "pointer", transition: "transform 0.15s" }}>
                    <img src={avatar(f.name, f.photo)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover", display: "block" }} />
                    <p style={{ margin: "6px 0 2px", fontSize: 13, fontWeight: 700, color: textPrimary }}>{f.name}</p>
                    {f.mutual_friends > 0 && <p style={{ margin: 0, fontSize: 11, color: textSecondary }}>{f.mutual_friends} ami(s) en commun</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      
      </div>

      {/* ════ MODAL: Créer post/story ════ */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ width: "100%", maxWidth: 520, background: cardBg, borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${border}` }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPrimary }}>
                {newType === "story" ? "Créer une story" : "Nouvelle publication"}
              </h3>
              <button onClick={() => setShowCreate(false)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#e4e6eb", border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={15} color={textPrimary} />
              </button>
            </div>
            <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
              {[{ val: "post", label: "📝 Publication" }, { val: "story", label: "⚡ Story (24h)" }].map(t => (
                <button key={t.val} onClick={() => setNewType(t.val)} style={{
                  flex: 1, padding: "11px", border: "none", background: "transparent", cursor: "pointer",
                  fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                  color: newType === t.val ? "#2563eb" : textSecondary,
                  borderBottom: `3px solid ${newType === t.val ? "#2563eb" : "transparent"}`,
                }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <img src={avatar(me.name, me.photo)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{me.name}</span>
              </div>
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder={newType === "story" ? "Ta story du jour..." : "Que voulez-vous partager ?"}
                style={{ width: "100%", boxSizing: "border-box", minHeight: 110, padding: "10px 0", border: "none", borderBottom: `1px solid ${border}`, background: "transparent", color: textPrimary, fontSize: 16, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6 }} />
              {newMedia && (
                <div style={{ position: "relative", marginTop: 10 }}>
                  <img src={newMedia} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
                  <button onClick={() => setNewMedia(null)} style={{ position: "absolute", top: 7, right: 7, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bi name="x-lg" size={12} color="white" />
                  </button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: textSecondary, fontSize: 13, fontWeight: 600 }}>
                  <Bi name="image-fill" size={15} color="#45bd62" /> Photo
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleMediaSelect} />
                <button onClick={handleCreate} disabled={posting || (!newContent.trim() && !newMedia)}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (posting || (!newContent.trim() && !newMedia)) ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  {posting && <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                  Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Commentaires ════ */}
      {commentPost && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setCommentPost(null)}>
          <div style={{ width: "100%", maxWidth: 600, background: cardBg, borderRadius: "18px 18px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 -10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: textPrimary }}>Commentaires ({commentsList.length})</h3>
              <button onClick={() => setCommentPost(null)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#f0f2f5", border: "none", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={13} color={textSecondary} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {commentsList.length === 0 && (
                <p style={{ textAlign: "center", color: textSecondary, fontSize: 13, marginTop: 20 }}>Sois le premier à commenter</p>
              )}
              {commentsList.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 9 }}>
                  <img src={avatar(c.author_name, c.author_photo)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f0f2f5", borderRadius: "0 14px 14px 14px", padding: "8px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>{c.author_name} </span>
                      <span style={{ fontSize: 13, color: textPrimary }}>{c.text}</span>
                    </div>
                    <span style={{ fontSize: 11, color: textSecondary, marginLeft: 8 }}>{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, display: "flex", gap: 9, alignItems: "center", flexShrink: 0 }}>
              <img src={avatar(me.name, me.photo)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
                placeholder="Écrire un commentaire..."
                style={{ flex: 1, padding: "9px 16px", borderRadius: 20, border: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.06)" : "#f0f2f5", color: textPrimary, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <button onClick={sendComment} disabled={sendingCmt || !commentText.trim()} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#2563eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !commentText.trim() ? 0.5 : 1 }}>
                <Bi name="send-fill" size={13} color="white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ STORY VIEWER ════ */}
      {storyViewer !== null && stories[storyViewer] && (
        <InstaStoryViewer
          stories={stories}
          index={storyViewer}
          setIndex={setStoryViewer}
          onClose={() => setStoryViewer(null)}
          me={me}
          isOwner={isMe}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          border={border}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// InstaStoryViewer — vues visibles pour tous, liste détaillée
// uniquement pour le propriétaire
// ══════════════════════════════════════════════════════════════
function InstaStoryViewer({ stories, index, setIndex, onClose, me, isOwner, isDark, textPrimary, textSecondary, cardBg, border }) {
  const story = stories[index];

  const [progress,           setProgress]           = useState(0);
  const [paused,             setPaused]             = useState(false);
  const [reaction,           setReaction]           = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPanel,          setShowPanel]          = useState(null); // "views"|"likes"|"comments"
  const [viewers,            setViewers]            = useState([]);
  const [reactionMap,        setReactionMap]        = useState({});
  const [cmtList,            setCmtList]            = useState([]);
  const [cmtText,            setCmtText]            = useState("");
  const [msgText,            setMsgText]            = useState("");
  const [viewCount,          setViewCount]          = useState(story?.views_count || 0);
  const [loadingPanel,       setLoadingPanel]       = useState(false);

  const DURATION = 5000;

  const timeAgoL = (iso) => {
    if (!iso) return "";
    const d = (Date.now() - new Date(iso)) / 1000;
    if (d < 60)    return "à l'instant";
    if (d < 3600)  return `${Math.floor(d / 60)} min`;
    if (d < 86400) return `${Math.floor(d / 3600)} h`;
    return `${Math.floor(d / 86400)} j`;
  };

  const av = (name, photo) =>
    photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=2563eb&color=fff&size=80`;

  // ── Reset + enregistrer vue + charger réactions existantes ──
  useEffect(() => {
    if (!stories[index]) return;
    const s = stories[index];
    setProgress(0);
    setReaction(null);
    setShowPanel(null);
    setViewers([]);
    setReactionMap({});
    setCmtList([]);
    setViewCount(s?.views_count || 0);

    // Enregistrer la vue
    recordView(s._id)
      .then(r => setViewCount(r.data?.views_count ?? (s?.views_count || 0) + 1))
      .catch(() => { setViewCount(v => v + 1); });

    // Charger les réactions existantes pour savoir si l'user a déjà réagi
    getReactions(s._id)
      .then(r => {
        const map = r.data || {};
        setReactionMap(map);
        // Trouver la réaction de l'user courant
        for (const [rtype, users] of Object.entries(map)) {
          if ((users || []).some(u => String(u.id) === String(me.id))) {
            setReaction(rtype);
            break;
          }
        }
      })
      .catch(() => {});
  }, [index]);

  // ── Charger données panel ──
  useEffect(() => {
    if (!showPanel || !story) return;
    setLoadingPanel(true);

    if (showPanel === "views") {
      // Seul le propriétaire peut voir la liste détaillée
      if (!isOwner) { setLoadingPanel(false); return; }
      getViews(story._id)
        .then(r => setViewers(r.data || []))
        .catch(() => {})
        .finally(() => setLoadingPanel(false));

    } else if (showPanel === "likes") {
      getReactions(story._id)
        .then(r => setReactionMap(r.data || {}))
        .catch(() => {})
        .finally(() => setLoadingPanel(false));

    } else if (showPanel === "comments") {
      getComments(story._id)
        .then(r => setCmtList(r.data || []))
        .catch(() => {})
        .finally(() => setLoadingPanel(false));
    }
  }, [showPanel, index]);

  // ── Progress bar ──
  useEffect(() => {
    if (paused || showPanel) return;
    const step = 100 / (DURATION / 50);
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(iv); goNext(); return 100; }
        return p + step;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [index, paused, showPanel]);

  const goNext = () => index < stories.length - 1 ? setIndex(i => i + 1) : onClose();
  const goPrev = () => { if (index > 0) setIndex(i => i - 1); };

  const handleReaction = (r) => {
    const next = r === reaction ? null : r;
    setReaction(next);
    setShowReactionPicker(false);
    // Optimistic update dans reactionMap
    setReactionMap(prev => {
      const updated = { ...prev };
      // Retire l'ancienne réaction
      if (reaction) {
        updated[reaction] = (updated[reaction] || []).filter(u => String(u.id) !== String(me.id));
        if (!updated[reaction].length) delete updated[reaction];
      }
      // Ajoute la nouvelle
      if (next) {
        updated[next] = [...(updated[next] || []), { id: me.id, name: me.name, photo: me.photo }];
      }
      return updated;
    });
    reactToPost(story._id, r).catch(() => {});
  };

  const sendStoryComment = async () => {
    if (!cmtText.trim()) return;
    const optimistic = {
      id: Date.now(),
      author_name: me.name,
      author_photo: me.photo,
      text: cmtText,
      created_at: new Date().toISOString(),
    };
    setCmtList(l => [...l, optimistic]);
    setCmtText("");
    try {
      const res = await addComment(story._id, optimistic.text);
      setCmtList(l => l.map(c => c.id === optimistic.id ? { ...optimistic, ...res.data } : c));
    } catch {
      setCmtList(l => l.filter(c => c.id !== optimistic.id));
    }
  };

  const reactionEmoji  = REACTIONS.find(r => r.key === reaction)?.emoji;
  const allReactors    = Object.entries(reactionMap).flatMap(([rtype, users]) => (users || []).map(u => ({ ...u, reacted: rtype })));
  const likeCount      = allReactors.length;
  const cmtCount       = cmtList.length;

  if (!story) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
      <style>{`
        @keyframes reactionPop   { 0%{transform:scale(0) translateY(20px);opacity:0} 60%{transform:scale(1.3) translateY(-5px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes reactionFloat { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-80px) scale(1.5)} }
        @keyframes slideUpPanel  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeIn        { from{opacity:0} to{opacity:1} }
        @keyframes spin          { to{transform:rotate(360deg)} }
      `}</style>

      {/* Blur background */}
      <div style={{ position: "absolute", inset: 0, background: `url(${story.media || ""}) center/cover no-repeat`, filter: "blur(30px) brightness(0.3)" }} />

      {/* Story card */}
      <div
        style={{ position: "relative", width: 420, height: "100vh", maxHeight: 900, display: "flex", flexDirection: "column", background: "#000", overflow: "hidden" }}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", gap: 4, padding: "10px 10px 0" }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: i < index ? "100%" : i === index ? `${progress}%` : "0%", background: "white", borderRadius: 2 }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ position: "absolute", top: 18, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
          <img src={av(story.author_name, story.author_photo)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid white", objectFit: "cover" }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.author_name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{timeAgoL(story.created_at)}</p>
          </div>
          <button onClick={() => setPaused(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <i className={`bi bi-${paused ? "play-fill" : "pause-fill"}`} style={{ fontSize: 20, color: "white" }} />
          </button>
          <button onClick={e => { e.stopPropagation(); onClose(); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-x-lg" style={{ fontSize: 14, color: "white" }} />
          </button>
        </div>

        {/* Media */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {story.media
            ? <img src={story.media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" }}>
              <p style={{ fontSize: 22, color: "white", textAlign: "center", lineHeight: 1.7, fontWeight: 600, margin: 0 }}>{story.content}</p>
            </div>
          }
          {story.media && story.content && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 16px 16px", background: "linear-gradient(transparent,rgba(0,0,0,0.7))" }}>
              <p style={{ margin: 0, fontSize: 16, color: "white", lineHeight: 1.5 }}>{story.content}</p>
            </div>
          )}
          {reaction && (
            <div key={`${reaction}-${index}`} style={{ position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)", fontSize: 48, animation: "reactionFloat 1.5s ease forwards", pointerEvents: "none" }}>
              {reactionEmoji}
            </div>
          )}
          {/* Navigation zones */}
          <div onClick={goPrev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
          <div onClick={goNext} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
        </div>

        {/* Bottom bar */}
        <div style={{ flexShrink: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "20px 12px 16px" }}>
          {/* Stats row — seulement commentaires + reaction picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>

            {/* Commentaires */}
            <button onClick={() => setShowPanel(p => p === "comments" ? null : "comments")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
              <i className="bi bi-chat-fill" style={{ fontSize: 14 }} />
              {cmtCount > 0 ? cmtCount : "Commenter"}
            </button>

            <div style={{ flex: 1 }} />

            {/* Reaction picker — bouton cœur */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowReactionPicker(p => !p)}
                style={{
                  width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: reaction ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, transition: "transform 0.15s, background 0.15s",
                  transform: reaction ? "scale(1.15)" : "scale(1)",
                  boxShadow: reaction ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
                }}>
                {reaction ? reactionEmoji : <i className="bi bi-heart" style={{ fontSize: 20, color: "white" }} />}
              </button>
              {showReactionPicker && (
                <div style={{ position: "absolute", bottom: 52, right: 0, display: "flex", gap: 6, background: "rgba(20,20,20,0.96)", padding: "10px 14px", borderRadius: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "reactionPop 0.2s ease", zIndex: 10 }}>
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => handleReaction(r.key)} title={r.label}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 28, transform: reaction === r.key ? "scale(1.35)" : "scale(1)", transition: "transform 0.15s", outline: "none" }}>
                      {r.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message input */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <img src={av(me.name, me.photo)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative" }}>
              <input value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder="Envoyer un message..."
                onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 44px 9px 16px", borderRadius: 24, border: "2px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              {msgText && (
                <button onClick={() => setMsgText("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#2563eb", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <i className="bi bi-send-fill" style={{ fontSize: 12, color: "white" }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sliding Panel ── */}
        {showPanel && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: isDark ? "#1e1e2e" : "#fff", borderRadius: "16px 16px 0 0", maxHeight: "60%", display: "flex", flexDirection: "column", animation: "slideUpPanel 0.25s ease", zIndex: 30, boxShadow: "0 -8px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.2)" : "#ccc" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 8px" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: isDark ? "white" : "#050505" }}>
                💬 Commentaires {cmtCount > 0 ? `(${cmtCount})` : ""}
              </span>
              <button onClick={() => setShowPanel(null)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#e4e6eb", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="bi bi-x-lg" style={{ fontSize: 12, color: isDark ? "white" : "#050505" }} />
              </button>
            </div>
            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "#eee", margin: "0 16px 8px" }} />

            {loadingPanel ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 30 }}>
                <div style={{ width: 24, height: 24, border: "3px solid rgba(37,99,235,0.2)", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : (
              <>
                {/* COMMENTS UNIQUEMENT */}
                {showPanel === "comments" && (
                  <>
                    <div style={{ overflowY: "auto", flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {cmtList.length === 0
                        ? <p style={{ textAlign: "center", color: isDark ? "rgba(255,255,255,0.4)" : "#999", fontSize: 14, padding: "20px 0" }}>Sois le premier à commenter</p>
                        : cmtList.map((c, i) => (
                          <div key={c.id || i} style={{ display: "flex", gap: 9 }}>
                            <img src={av(c.author_name, c.author_photo)} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f0f2f5", borderRadius: "0 12px 12px 12px", padding: "7px 11px" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#60a5fa" : "#2563eb" }}>{c.author_name} </span>
                                <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.85)" : "#050505" }}>{c.text}</span>
                              </div>
                              <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.35)" : "#999", marginLeft: 6 }}>{timeAgoL(c.created_at)}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8, padding: "10px 16px", alignItems: "center", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#eee"}` }}>
                      <img src={av(me.name, me.photo)} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                      <input value={cmtText} onChange={e => setCmtText(e.target.value)}
                        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                        onKeyDown={e => e.key === "Enter" && sendStoryComment()}
                        placeholder="Commenter..."
                        style={{ flex: 1, padding: "8px 14px", borderRadius: 20, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#ddd"}`, background: isDark ? "rgba(255,255,255,0.07)" : "#f0f2f5", color: isDark ? "white" : "#050505", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <button onClick={sendStoryComment} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#2563eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: cmtText.trim() ? 1 : 0.4, flexShrink: 0 }}>
                        <i className="bi bi-send-fill" style={{ fontSize: 13, color: "white" }} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Nav arrows */}
        {index > 0 && (
          <button onClick={goPrev} style={{ position: "absolute", left: 8, top: "45%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 15 }}>
            <i className="bi bi-chevron-left" style={{ fontSize: 16, color: "white" }} />
          </button>
        )}
        {index < stories.length - 1 && (
          <button onClick={goNext} style={{ position: "absolute", right: 8, top: "45%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 15 }}>
            <i className="bi bi-chevron-right" style={{ fontSize: 16, color: "white" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PostCard avec reaction picker au hover
// ══════════════════════════════════════════════════════════════
function PostCard({ post, me, isMe, isDark, textPrimary, textSecondary, cardBg, border, onLike, onComment, onDelete }) {
  const canDelete = isMe || String(me.id) === String(post.user_id);
  const [showReactions, setShowReactions] = useState(false);
  const [reaction,      setReaction]      = useState(post.my_reaction || (post.liked_by_me ? "like" : null));
  const hoverTimer = useRef(null);

  const handleReactionHover = () => { hoverTimer.current = setTimeout(() => setShowReactions(true), 400); };
  const handleReactionLeave = () => { clearTimeout(hoverTimer.current); setTimeout(() => setShowReactions(false), 300); };
  const handleReactionClick = (r) => {
    setReaction(prev => prev === r ? null : r);
    setShowReactions(false);
    onLike();
  };

  const currentReaction = REACTIONS.find(r => r.key === reaction);

  const av = (name, photo) =>
    photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=2563eb&color=fff&size=40`;

  return (
    <div className="post-card" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: "visible", transition: "box-shadow 0.2s" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        <img src={av(post.author_name, post.author_photo)} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textPrimary }}>{post.author_name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <p style={{ margin: 0, fontSize: 11, color: textSecondary }}>{timeAgo(post.created_at)}</p>
            <span style={{ color: textSecondary, fontSize: 10 }}>·</span>
            <i className="bi bi-globe2" style={{ fontSize: 11, color: textSecondary }} />
          </div>
        </div>
        {canDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, opacity: 0.6 }}>
            <i className="bi bi-three-dots" style={{ fontSize: 17, color: textSecondary }} />
          </button>
        )}
      </div>

      {post.content && <p style={{ margin: "0 16px 12px", fontSize: 14, color: textPrimary, lineHeight: 1.65 }}>{post.content}</p>}
      {post.media   && <img src={post.media} alt="" style={{ width: "100%", maxHeight: 500, objectFit: "cover", display: "block" }} />}

      {/* Reaction summary */}
      {post.likes_count > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {["like", "love", "haha"].map((r, i) => (
              <span key={r} style={{ fontSize: 15, marginLeft: i > 0 ? -3 : 0 }}>{REACTIONS.find(x => x.key === r)?.emoji}</span>
            ))}
            <span style={{ fontSize: 13, color: textSecondary, marginLeft: 4 }}>{post.likes_count}</span>
          </div>
          {post.comments_count > 0 && (
            <button onClick={onComment} style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, fontSize: 13 }}>
              {post.comments_count} commentaire{post.comments_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", borderTop: `1px solid ${border}`, padding: "2px 8px", position: "relative" }}>

        {/* Like with reaction picker */}
        <div style={{ flex: 1, position: "relative" }} onMouseEnter={handleReactionHover} onMouseLeave={handleReactionLeave}>
          {showReactions && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0,
              display: "flex", gap: 6, background: isDark ? "rgba(30,30,30,0.97)" : "white",
              padding: "8px 12px", borderRadius: 30,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: `1px solid ${border}`,
              animation: "scaleIn 0.15s ease", zIndex: 100, marginBottom: 6,
            }}>
              {REACTIONS.map(r => (
                <button key={r.key} onClick={() => handleReactionClick(r.key)} title={r.label}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "transform 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.4) translateY(-4px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                  {r.emoji}
                  <span style={{ fontSize: 9, color: isDark ? "rgba(255,255,255,0.6)" : "#666", fontWeight: 600 }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { setReaction(r => r ? null : "like"); onLike(); }}
            style={{ width: "100%", padding: "9px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: currentReaction ? currentReaction.color : textSecondary, fontSize: 13, fontWeight: 700, transition: "background 0.1s" }}
            className="action-btn">
            {currentReaction
              ? <><span style={{ fontSize: 17 }}>{currentReaction.emoji}</span> {currentReaction.label}</>
              : <><i className="bi bi-hand-thumbs-up" style={{ fontSize: 16, color: textSecondary }} /> J'aime</>
            }
          </button>
        </div>

        <button onClick={onComment} className="action-btn"
          style={{ flex: 1, padding: "9px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: textSecondary, fontSize: 13, fontWeight: 700, transition: "background 0.1s" }}>
          <i className="bi bi-chat-left" style={{ fontSize: 15, color: textSecondary }} /> Commenter
        </button>

        <button className="action-btn"
          style={{ flex: 1, padding: "9px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: textSecondary, fontSize: 13, fontWeight: 700, transition: "background 0.1s" }}>
          <i className="bi bi-share" style={{ fontSize: 15, color: textSecondary }} /> Partager
        </button>
      </div>
    </div>
  );
}
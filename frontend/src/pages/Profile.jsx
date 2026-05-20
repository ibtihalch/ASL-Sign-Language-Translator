import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "../components/Navbar";
import {
  getMe, updateProfile, changePassword, getUserStats,
  getUserPosts, createPost, toggleLike, getComments, addComment, deletePost,
  getUserFriends, recordView, getViews, reactToPost, getReactions, addComment as addStoryComment
} from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

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

const avatar = (name, photo) =>
  photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=1877f2&color=fff&size=200`;

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return `${Math.floor(d / 86400)} j`;
};

const REACTIONS = [
  { key: "like",  icon: "hand-thumbs-up-fill", color: "#1877f2", label: "J'aime",  emoji: "👍" },
  { key: "love",  icon: "heart-fill",           color: "#f02849", label: "J'adore", emoji: "❤️" },
  { key: "haha",  icon: "emoji-laughing-fill",  color: "#f7b125", label: "Haha",    emoji: "😂" },
  { key: "wow",   icon: "emoji-surprise-fill",  color: "#f7b125", label: "Wouah",   emoji: "😮" },
  { key: "sad",   icon: "emoji-frown-fill",     color: "#f7b125", label: "Triste",  emoji: "😢" },
  { key: "angry", icon: "emoji-angry-fill",     color: "#e9710f", label: "Grrr",    emoji: "😡" },
];

export default function Profile() {
  const fileRef     = useRef(null);
  const bannerRef   = useRef(null);
  const filePostRef = useRef(null);
  const { theme, applyTheme } = useTheme();
  const th  = themes[theme];
  const { t, language, applyLanguage } = useLang();
  const isRTL = language === "ar";
  const dir   = isRTL ? "rtl" : "ltr";
  const isDark = theme === "dark";
  const me = JSON.parse(localStorage.getItem("user") || "{}");

  const [profile,   setProfile]   = useState(null);
  const [gameStats, setGameStats] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState("");
  const [error,     setError]     = useState("");
  const [friends,   setFriends]   = useState([]);
  const [banner,    setBanner]    = useState(null);
  const [savingPhoto,  setSavingPhoto]  = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const [activeTab,   setActiveTab]   = useState("feed");
  const [settingsTab, setSettingsTab] = useState("info");
  const [showPw,    setShowPw]    = useState({ old: false, new: false, confirm: false });
  const [passwords, setPasswords] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwError,   setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving,  setPwSaving]  = useState(false);

  const [posts,   setPosts]   = useState([]);
  const [stories, setStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newMedia,   setNewMedia]   = useState(null);
  const [newType,    setNewType]    = useState("post");
  const [posting,    setPosting]    = useState(false);
  const [storyViewer,  setStoryViewer]  = useState(null);
  const [commentPost,  setCommentPost]  = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentText,  setCommentText]  = useState("");
  const [sendingCmt,   setSendingCmt]   = useState(false);
  const [activePostTab, setActivePostTab] = useState("list");

  useEffect(() => {
    (async () => {
      try { const res = await getMe(); setProfile(res.data); }
      catch { setError("Erreur chargement"); }
      finally { setLoading(false); }
    })();
    getUserStats().then(r => setGameStats(r.data)).catch(() => {});
    const uid = me.id;
    if (uid) {
      getUserPosts(uid, "post").then(r => setPosts(r.data)).catch(() => {});
      getUserPosts(uid, "story").then(r => setStories(r.data)).catch(() => {});
      getUserFriends(uid).then(r => setFriends(r.data || [])).catch(() => {});
    }
  }, []);

  const field = (k, v) => setProfile(p => ({ ...p, [k]: v }));
  const lbl = (fr, en, ar) => language === "ar" ? ar : language === "en" ? en : fr;
  const formatDate = (iso) => {
    if (!iso) return "N/A";
    const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
    return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
  };

  const levelLabel = { beginner: t("prof_beginner"), intermediate: t("prof_intermediate"), expert: t("prof_expert") };
  const roleLabel  = { hearing_impaired: t("prof_role_deaf"), hearing: t("prof_role_hear") };
  const xp      = gameStats?.xp || 0;
  const level   = gameStats?.level || 1;
  const streak  = gameStats?.streak || 0;
  const badges  = gameStats?.badges || [];
  const xpInLvl = xp % 100;

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Photo max 3MB"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const photoData = reader.result;
      setProfile(p => ({ ...p, photo: photoData }));
      setSavingPhoto(true);
      try {
        const res = await updateProfile({ ...profile, photo: photoData });
        const s = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...s, photo: res.data.user.photo }));
        setSuccess(lbl("Photo de profil mise à jour !", "Profile photo updated!", "تم تحديث الصورة!"));
        setTimeout(() => setSuccess(""), 3000);
      } catch { setError("Erreur lors de la mise à jour de la photo"); }
      finally { setSavingPhoto(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const bannerData = reader.result;
      setBanner(bannerData);
      setSavingBanner(true);
      try {
        await updateProfile({ ...profile, banner: bannerData });
        setSuccess(lbl("Photo de couverture mise à jour !", "Cover photo updated!", "تم تحديث الغلاف!"));
        setTimeout(() => setSuccess(""), 3000);
      } catch { setError("Erreur lors de la mise à jour de la couverture"); }
      finally { setSavingBanner(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true); setSuccess(""); setError("");
    try {
      const res = await updateProfile({ ...profile, banner });
      const s = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...s, name: res.data.user.name, photo: res.data.user.photo }));
      applyTheme(profile.theme); applyLanguage(profile.language);
      setSuccess(t("prof_saved")); setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Erreur sauvegarde"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwError(""); setPwSuccess("");
    if (!passwords.old_password || !passwords.new_password || !passwords.confirm) { setPwError("Tous les champs sont obligatoires"); return; }
    if (passwords.new_password !== passwords.confirm) { setPwError("Les mots de passe ne correspondent pas"); return; }
    if (passwords.new_password.length < 6) { setPwError("Minimum 6 caractères"); return; }
    setPwSaving(true);
    try {
      await changePassword({ old_password: passwords.old_password, new_password: passwords.new_password });
      setPwSuccess(t("prof_pw_changed")); setPasswords({ old_password: "", new_password: "", confirm: "" });
      setTimeout(() => setPwSuccess(""), 3000);
    } catch (err) { setPwError(err.response?.data?.error || "Erreur"); }
    finally { setPwSaving(false); }
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
        _id: res.data.id, user_id: me.id, author_name: profile.name, author_photo: profile.photo,
        content: newContent, media: newMedia, type: newType,
        likes_count: 0, liked_by_me: false, comments_count: 0,
        created_at: new Date().toISOString(),
      };
      if (newType === "post") setPosts(p => [newPost, ...p]);
      else setStories(p => [newPost, ...p]);
      setShowCreate(false); setNewContent(""); setNewMedia(null); setNewType("post");
    } catch {}
    setPosting(false);
  };

  const handleLike = async (post) => {
    setPosts(prev => prev.map(p =>
      p._id === post._id
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
    try { await toggleLike(post._id); } catch {}
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
      setCommentsList(p => [...p, r.data]); setCommentText("");
      setPosts(p => p.map(x => x._id === commentPost._id ? { ...x, comments_count: x.comments_count + 1 } : x));
    } catch {}
    setSendingCmt(false);
  };

  const handleDeletePost = async (pid) => {
    if (!window.confirm("Supprimer ce post ?")) return;
    try { await deletePost(pid); setPosts(p => p.filter(x => x._id !== pid)); } catch {}
  };

  const inputBase = {
    width: "100%", boxSizing: "border-box", padding: "9px 13px", borderRadius: 8, fontSize: 13,
    fontFamily: "inherit", outline: "none", direction: dir,
    background: isDark ? "rgba(255,255,255,0.06)" : "#f0f2f5",
    border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#ddd"}`,
    color: isDark ? "#e4e6eb" : "#050505", transition: "border-color 0.2s",
  };

  const bg = isDark ? "#18191a" : "#f0f2f5";
  const cardBg = isDark ? "#242526" : "#fff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#ddd";
  const textPrimary = isDark ? "#e4e6eb" : "#050505";
  const textSecondary = isDark ? "#b0b3b8" : "#65676b";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(24,119,242,0.2)", borderTop: "3px solid #1877f2", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  const COVER_H = 350;
  const AVATAR_SIZE = 168;

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Segoe UI',system-ui,sans-serif", direction: dir }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
        .hover-btn:hover { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} !important; }
        .prof-input:focus { border-color: #1877f2 !important; box-shadow: 0 0 0 2px rgba(24,119,242,0.14) !important; }
        .post-action:hover { background: ${isDark ? "rgba(255,255,255,0.08)" : "#f0f2f5"} !important; }
        .story-ring:hover { transform: scale(1.04) !important; }
        .friend-card:hover { opacity: 0.9; }
        .tab-active { color: #1877f2 !important; border-bottom: 3px solid #1877f2 !important; }
        .reaction-picker { display:none !important; }
        .reaction-trigger:hover .reaction-picker { display:flex !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}; border-radius: 4px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: ${isDark ? "invert(1)" : "none"}; opacity: 0.5 }
        select option { background: ${isDark ? "#3a3b3c" : "#fff"}; color: ${textPrimary}; }
      `}</style>
      <Navbar />

      {/* ════ COVER + PROFILE HEADER ════ */}
      <div style={{ background: cardBg, maxWidth: 980, margin: "0 auto" }}>

        {/* Cover Photo */}
        <div style={{ position: "relative", height: 230, overflow: "hidden", cursor: "pointer" }}
          onClick={() => bannerRef.current?.click()}>
          <div style={{
            position: "absolute", inset: 0,
            background: banner
              ? `url(${banner}) center/cover no-repeat`
              : isDark
                ? "linear-gradient(160deg,#0a1628,#1a3a5c 60%,#2d6a9f)"
                : "linear-gradient(160deg,#c8d6e5,#a8c5da,#8bb5d0)",
          }} />
          {savingBanner && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "rgba(0,0,0,0.7)", borderRadius: 10, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: 13, fontWeight: 600 }}>
                <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Enregistrement...
              </div>
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); bannerRef.current?.click(); }}
            style={{
              position: "absolute", bottom: 16, right: 16,
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: isDark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.92)",
              color: "#050505", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <Bi name="camera-fill" size={14} /> {lbl("Changer la photo de couverture", "Change cover photo", "تغيير صورة الغلاف")}
          </button>
          <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerChange} />
        </div>

        {/* Identity Section */}
        <div style={{ padding: "0 20px 0", maxWidth: 980, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: -AVATAR_SIZE * 0.25 - 8, paddingBottom: 14, flexWrap: "wrap" }}>

            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: "50%",
                border: `4px solid ${cardBg}`,
                overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                background: isDark ? "#3a3b3c" : "#e4e6eb",
                cursor: "pointer", position: "relative",
              }}
                onClick={() => fileRef.current?.click()}
              >
                <img src={avatar(profile.name, profile.photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {savingPhoto && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                    <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.3)", borderTop: "3px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  position: "absolute", bottom: 6, right: 6,
                  width: 36, height: 36, borderRadius: "50%",
                  border: `3px solid ${cardBg}`,
                  background: isDark ? "#4e4f50" : "#e4e6eb",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}
              >
                <Bi name="camera-fill" size={15} color={isDark ? "#fff" : "#050505"} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>

            {/* Name + info */}
            <div style={{ flex: 1, minWidth: 200, paddingBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: textPrimary, letterSpacing: "-0.5px" }}>
                  {profile.name}
                </h1>
                {gameStats && (
                  <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 20, padding: "2px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                    <Bi name="lightning-charge-fill" size={11} color="#f59e0b" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>LVL {level}</span>
                  </span>
                )}
              </div>
              <p style={{ margin: "3px 0 6px", fontSize: 15, fontWeight: 600, color: textSecondary }}>
                {friends.length > 0 ? `${friends.length} ami(e)s` : ""}
              </p>
              {profile.bio && (
                <p style={{ margin: "0 0 6px", fontSize: 14, color: textSecondary, fontStyle: "italic" }}>
                  {profile.bio}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {profile.city && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: textSecondary }}>
                    <Bi name="geo-alt-fill" size={13} color={textSecondary} />
                    {profile.city}{profile.country ? `, ${profile.country}` : ""}
                  </span>
                )}
                {profile.city && <span style={{ color: textSecondary, fontSize: 13 }}>·</span>}
                {streak > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#ef4444" }}>
                    <Bi name="fire" size={13} color="#ef4444" /> {streak} jours de suite
                  </span>
                )}
              </div>
              {friends.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 2 }}>
                  {friends.slice(0, 8).map((f, i) => (
                    <img key={i} src={avatar(f.name, f.photo)} alt="" style={{
                      width: 32, height: 32, borderRadius: "50%", objectFit: "cover",
                      border: `2px solid ${cardBg}`, marginLeft: i > 0 ? -8 : 0, zIndex: 8 - i,
                      position: "relative",
                    }} />
                  ))}
                  {friends.length > 8 && <span style={{ fontSize: 12, color: textSecondary, marginLeft: 6 }}>+{friends.length - 8}</span>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 6 }}>
              <button
                onClick={() => { setNewType("story"); setShowCreate(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "#1877f2", color: "white",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                <Bi name="plus-lg" size={15} color="white" /> {lbl("Ajouter à la story", "Add to story", "أضف إلى القصة")}
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8,
                  border: `1px solid ${border}`,
                  background: isDark ? "#3a3b3c" : "#e4e6eb",
                  color: textPrimary, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                <Bi name="pencil-fill" size={13} color={textPrimary} /> {lbl("Modifier le profil", "Edit profile", "تعديل الملف")}
              </button>
              <button style={{
                width: 36, height: 36, borderRadius: 8,
                border: `1px solid ${border}`,
                background: isDark ? "#3a3b3c" : "#e4e6eb",
                color: textPrimary, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bi name="chevron-down" size={16} color={textPrimary} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderTop: `1px solid ${border}`, padding: "0 20px", display: "flex", gap: 0, maxWidth: 980, margin: "0 auto" }}>
          {[
            { key: "feed",     label: lbl("Tout", "All", "الكل") },
            { key: "about",    label: lbl("À propos", "About", "نبذة") },
            { key: "friends",  label: lbl("Ami(e)s", "Friends", "الأصدقاء") },
            { key: "photos",   label: lbl("Photos", "Photos", "الصور") },
            { key: "settings", label: lbl("Paramètres", "Settings", "الإعدادات") },
          ].map(tb => (
            <button
              key={tb.key}
              onClick={() => setActiveTab(tb.key)}
              style={{
                padding: "14px 16px", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                background: "transparent",
                color: activeTab === tb.key ? "#1877f2" : textSecondary,
                borderBottom: `3px solid ${activeTab === tb.key ? "#1877f2" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════ MAIN CONTENT ════ */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 0 60px" }}>

        {(success || error) && (
          <div style={{
            margin: "12px 20px 0",
            padding: "10px 16px", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
            background: success ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
            border: `1px solid ${success ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.25)"}`,
            color: success ? "#16a34a" : "#dc2626",
          }}>
            <Bi name={success ? "check-circle-fill" : "x-circle-fill"} size={14} color={success ? "#16a34a" : "#dc2626"} />
            {success || error}
          </div>
        )}

        {/* ═══ FEED TAB ═══ */}
        {activeTab === "feed" && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, paddingTop: 14, padding: "14px 0 0" }}>

            {/* Left sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 0 }}>

              <FbCard isDark={isDark} cardBg={cardBg} border={border}>
                <h3 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, color: textPrimary }}>Intro</h3>
                {profile.bio
                  ? <p style={{ margin: "0 0 12px", fontSize: 15, color: textPrimary, lineHeight: 1.6, textAlign: "center" }}>{profile.bio}</p>
                  : <button onClick={() => setActiveTab("settings")} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: isDark ? "rgba(255,255,255,0.08)" : "#e4e6eb", color: textPrimary, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
                    + {lbl("Ajouter une bio", "Add a bio", "أضف نبذة")}
                  </button>
                }
                {[
                  profile.city && { icon: "geo-alt-fill", text: `Habite à ${profile.city}${profile.country ? `, ${profile.country}` : ""}` },
                  { icon: "emoji-heart-eyes-fill", text: lbl("Célibataire", "Single", "أعزب/عزباء"), color: "#e91e63" },
                  { icon: "calendar3", text: `${lbl("Membre depuis", "Joined", "عضو منذ")} ${formatDate(profile.created_at)}` },
                  gameStats && { icon: "lightning-charge-fill", text: `${xp} XP · Level ${level}`, color: "#f59e0b" },
                  streak > 0 && { icon: "fire", text: `${streak} ${lbl("jours de suite", "day streak", "أيام")}`, color: "#ef4444" },
                ].filter(Boolean).filter(x => x.text).map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Bi name={row.icon} size={18} color={row.color || textSecondary} />
                    <span style={{ fontSize: 15, color: textSecondary }}>{row.text}</span>
                  </div>
                ))}
                <button
                  onClick={() => setActiveTab("settings")}
                  style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: isDark ? "rgba(255,255,255,0.08)" : "#e4e6eb", color: textPrimary, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
                >
                  {lbl("Modifier le profil", "Edit profile", "تعديل الملف الشخصي")}
                </button>
              </FbCard>

              <FbCard isDark={isDark} cardBg={cardBg} border={border}>
                <h3 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("À la une", "Featured", "المميز")}</h3>
                <button style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px dashed ${border}`, background: "transparent", color: textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Bi name="plus-circle" size={16} color={textSecondary} /> {lbl("Ajouter des éléments à la une", "Add featured items", "إضافة عناصر مميزة")}
                </button>
              </FbCard>

              {friends.length > 0 && (
                <FbCard isDark={isDark} cardBg={cardBg} border={border}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("Ami(e)s", "Friends", "الأصدقاء")}</h3>
                      <p style={{ margin: "2px 0 0", fontSize: 14, color: textSecondary }}>{friends.length} {lbl("ami(e)s", "friends", "صديق")}</p>
                    </div>
                    <button onClick={() => setActiveTab("friends")} style={{ background: "none", border: "none", color: "#1877f2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                      {lbl("Tou(te)s les ami(e)s", "All friends", "جميع الأصدقاء")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {friends.slice(0, 9).map((f, i) => (
                      <div key={i} className="friend-card" style={{ cursor: "pointer", transition: "opacity 0.15s" }}>
                        <img src={avatar(f.name, f.photo)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover", display: "block" }} />
                        <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                      </div>
                    ))}
                  </div>
                </FbCard>
              )}

              {posts.filter(p => p.media).length > 0 && (
                <FbCard isDark={isDark} cardBg={cardBg} border={border}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("Photos", "Photos", "الصور")}</h3>
                    <button onClick={() => setActiveTab("photos")} style={{ background: "none", border: "none", color: "#1877f2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                      {lbl("Voir toutes les photos", "See all photos", "عرض الكل")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                    {posts.filter(p => p.media).slice(0, 9).map((p, i) => (
                      <img key={i} src={p.media} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, cursor: "pointer", display: "block" }} />
                    ))}
                  </div>
                </FbCard>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingRight: 0 }}>

              {/* Stories Bar */}
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                <div
                  onClick={() => { setNewType("story"); setShowCreate(true); }}
                  style={{ flexShrink: 0, width: 112, height: 196, borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                >
                  <div style={{ position: "absolute", inset: 0, background: cardBg, border: `1px solid ${border}`, borderRadius: 14 }} />
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "66%", overflow: "hidden", borderRadius: "14px 14px 0 0" }}>
                    <img src={avatar(profile.name, profile.photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.3))" }} />
                  </div>
                  <div style={{
                    position: "absolute", bottom: "30%", left: "50%", transform: "translate(-50%, 50%)",
                    width: 36, height: 36, borderRadius: "50%",
                    background: "#1877f2", border: `3px solid ${cardBg}`,
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
                  }}>
                    <i className="bi bi-plus-lg" style={{ fontSize: 17, color: "white" }} />
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 6px 10px", textAlign: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: textPrimary, display: "block", marginTop: 14 }}>
                      {lbl("Créer une story", "Create story", "إنشاء قصة")}
                    </span>
                  </div>
                </div>

                {stories.map((s, i) => (
                  <div
                    key={s._id || i}
                    onClick={() => setStoryViewer(i)}
                    style={{ flexShrink: 0, width: 112, height: 196, borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                  >
                    {s.media
                      ? <img src={s.media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, hsl(${(i * 60) % 360},60%,35%), hsl(${(i * 60 + 40) % 360},70%,50%))`, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
                        <p style={{ margin: 0, fontSize: 12, color: "white", textAlign: "center", fontWeight: 700, lineHeight: 1.4 }}>{s.content?.slice(0, 60)}</p>
                      </div>
                    }
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
                    <div style={{
                      position: "absolute", top: 10, left: 10,
                      width: 40, height: 40, borderRadius: "50%",
                      border: "3px solid #1877f2",
                      overflow: "hidden", boxShadow: "0 0 0 2px white",
                    }}>
                      <img src={avatar(s.author_name, s.author_photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px 10px" }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.author_name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(255,255,255,0.75)" }}>{timeAgo(s.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compose box */}
              <FbCard isDark={isDark} cardBg={cardBg} border={border}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <img src={avatar(profile.name, profile.photo)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  <div
                    onClick={() => { setNewType("post"); setShowCreate(true); }}
                    style={{
                      flex: 1, height: 40, borderRadius: 20,
                      background: isDark ? "rgba(255,255,255,0.07)" : "#f0f2f5",
                      border: `1px solid ${border}`,
                      cursor: "pointer", display: "flex", alignItems: "center", paddingLeft: 16,
                    }}
                  >
                    <span style={{ fontSize: 15, color: textSecondary }}>
                      {lbl("Que voulez-vous dire ?", "What's on your mind?", "ماذا تريد أن تشارك؟")}
                    </span>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, display: "flex", gap: 0 }}>
                  {[
                    { icon: "camera-video-fill", color: "#f02849", label: lbl("Vidéo en direct", "Live video", "بث مباشر"), type: "story" },
                    { icon: "image-fill",        color: "#45bd62", label: lbl("Photo/Vidéo", "Photo/Video", "صورة"), type: "post" },
                    { icon: "emoji-smile-fill",  color: "#f7b125", label: lbl("Activité", "Activity", "نشاط"), type: "post" },
                  ].map((btn, i) => (
                    <button key={i} onClick={() => { setNewType(btn.type); setShowCreate(true); }} className="hover-btn" style={{
                      flex: 1, padding: "8px 4px", border: "none", background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      borderRadius: 8, fontSize: 14, fontWeight: 700, color: textSecondary, transition: "background 0.15s",
                    }}>
                      <Bi name={btn.icon} size={18} color={btn.color} /> {btn.label}
                    </button>
                  ))}
                </div>
              </FbCard>

              {/* Publications filter bar */}
              <FbCard isDark={isDark} cardBg={cardBg} border={border} pad="12px 16px">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("Publications", "Posts", "المنشورات")}</h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: isDark ? "rgba(255,255,255,0.08)" : "#e4e6eb", color: textPrimary, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Bi name="sliders" size={14} color={textPrimary} /> {lbl("Filtres", "Filters", "تصفية")}
                    </button>
                    <button style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: isDark ? "rgba(255,255,255,0.08)" : "#e4e6eb", color: textPrimary, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Bi name="gear-fill" size={14} color={textPrimary} /> {lbl("Gérer les publications", "Manage posts", "إدارة")}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", marginTop: 8, borderBottom: `2px solid ${border}` }}>
                  {[
                    { key: "list", icon: "list-ul", label: lbl("Vue Liste", "List View", "قائمة") },
                    { key: "grid", icon: "grid-3x3-gap-fill", label: lbl("Vue Grille", "Grid View", "شبكة") },
                  ].map(v => (
                    <button key={v.key} onClick={() => setActivePostTab(v.key)} style={{
                      flex: 1, padding: "8px", border: "none", background: "transparent", cursor: "pointer",
                      fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                      color: activePostTab === v.key ? "#1877f2" : textSecondary,
                      borderBottom: `3px solid ${activePostTab === v.key ? "#1877f2" : "transparent"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      <Bi name={v.icon} size={15} color={activePostTab === v.key ? "#1877f2" : textSecondary} /> {v.label}
                    </button>
                  ))}
                </div>
              </FbCard>

              {/* Posts */}
              {posts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0", color: textSecondary, background: cardBg, borderRadius: 12, border: `1px solid ${border}` }}>
                  <Bi name="inbox" size={44} color={textSecondary} />
                  <p style={{ fontSize: 16, fontWeight: 600, margin: "12px 0 0" }}>{lbl("Aucune publication disponible", "No posts available", "لا توجد منشورات")}</p>
                </div>
              ) : activePostTab === "grid" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                  {posts.map(post => post.media && (
                    <img key={post._id} src={post.media} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", cursor: "pointer", display: "block" }} />
                  ))}
                  {posts.every(p => !p.media) && (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: textSecondary, fontSize: 14 }}>
                      {lbl("Aucune photo dans les publications", "No photos in posts", "لا توجد صور")}
                    </div>
                  )}
                </div>
              ) : (
                posts.map(post => (
                  <PostCard
                    key={post._id}
                    post={post}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    cardBg={cardBg}
                    border={border}
                    canDelete={true}
                    onLike={() => handleLike(post)}
                    onComment={() => openComments(post)}
                    onDelete={() => handleDeletePost(post._id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══ ABOUT TAB ═══ */}
        {activeTab === "about" && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, paddingTop: 14 }}>
            <FbCard isDark={isDark} cardBg={cardBg} border={border} pad="8px">
              {[
                { key: "intro", label: "Intro" },
                { key: "perso", label: lbl("Informations personnelles", "Personal info", "معلومات شخصية") },
                { key: "work",  label: lbl("Expériences professionnelles", "Work", "العمل") },
                { key: "edu",   label: lbl("Formation", "Education", "التعليم") },
                { key: "loisirs", label: lbl("Loisirs", "Hobbies", "الهوايات") },
                { key: "interet", label: lbl("Centres d'intérêt", "Interests", "الاهتمامات") },
                { key: "voyage", label: lbl("Voyage", "Travel", "السفر") },
                { key: "liens", label: lbl("Liens", "Links", "روابط") },
                { key: "contact", label: lbl("Coordonnées", "Contact", "معلومات الاتصال") },
              ].map((item, i) => (
                <button key={i} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: item.key === "intro" ? (isDark ? "rgba(24,119,242,0.15)" : "#e7f3ff") : "transparent",
                  color: item.key === "intro" ? "#1877f2" : textSecondary,
                  fontSize: 15, fontWeight: item.key === "intro" ? 700 : 500, textAlign: "left",
                  fontFamily: "inherit", display: "block", marginBottom: 2,
                }}>
                  {item.label}
                </button>
              ))}
            </FbCard>
            <FbCard isDark={isDark} cardBg={cardBg} border={border}>
              <h3 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: textPrimary }}>Bio</h3>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                <Bi name="hand-index-thumb" size={20} color={textSecondary} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, color: textPrimary }}>{profile.bio || lbl("Aucune bio", "No bio", "لا توجد نبذة")}</span>
                </div>
              </div>
              <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: textPrimary }}>{lbl("Détails épinglés", "Pinned details", "التفاصيل المثبتة")}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Bi name="geo-alt-fill" size={20} color={textSecondary} />
                <span style={{ fontSize: 15, color: textPrimary }}>
                  {profile.city ? `${profile.city}${profile.country ? `, ${profile.country}` : ""}` : lbl("Ville non renseignée", "No city", "لا توجد مدينة")}
                </span>
                <button onClick={() => setActiveTab("settings")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                  <Bi name="pencil" size={14} color={textSecondary} />
                </button>
              </div>
            </FbCard>
          </div>
        )}

        {/* ═══ FRIENDS TAB ═══ */}
        {activeTab === "friends" && (
          <div style={{ paddingTop: 14 }}>
            <FbCard isDark={isDark} cardBg={cardBg} border={border}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("Ami(e)s", "Friends", "الأصدقاء")} · {friends.length}</h3>
              </div>
              {friends.length === 0 ? (
                <p style={{ textAlign: "center", color: textSecondary, fontSize: 15, padding: "30px 0" }}>{lbl("Aucun ami pour le moment", "No friends yet", "لا يوجد أصدقاء")}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                  {friends.map((f, i) => (
                    <div key={i} className="friend-card" style={{ cursor: "pointer", transition: "opacity 0.15s" }}>
                      <img src={avatar(f.name, f.photo)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover", display: "block" }} />
                      <p style={{ margin: "6px 0 2px", fontSize: 14, fontWeight: 700, color: textPrimary }}>{f.name}</p>
                      {f.mutual_friends > 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: textSecondary }}>{f.mutual_friends} ami(s) en commun</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FbCard>
          </div>
        )}

        {/* ═══ PHOTOS TAB ═══ */}
        {activeTab === "photos" && (
          <div style={{ paddingTop: 14 }}>
            <FbCard isDark={isDark} cardBg={cardBg} border={border}>
              <h3 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, color: textPrimary }}>{lbl("Photos", "Photos", "الصور")}</h3>
              {posts.filter(p => p.media).length === 0 ? (
                <p style={{ textAlign: "center", color: textSecondary, fontSize: 15, padding: "30px 0" }}>{lbl("Aucune photo", "No photos", "لا توجد صور")}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 4 }}>
                  {posts.filter(p => p.media).map((p, i) => (
                    <img key={i} src={p.media} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4, cursor: "pointer" }} />
                  ))}
                </div>
              )}
            </FbCard>
          </div>
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === "settings" && (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, paddingTop: 14 }}>
            <FbCard isDark={isDark} cardBg={cardBg} border={border} pad="8px">
              {[
                { key: "info",     icon: "person-fill",     label: t("prof_info") },
                { key: "prefs",    icon: "sliders",         label: t("prof_prefs") },
                { key: "security", icon: "shield-lock-fill", label: t("prof_security") },
              ].map(tb => (
                <button key={tb.key} onClick={() => setSettingsTab(tb.key)} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 9, border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 10,
                  background: settingsTab === tb.key ? (isDark ? "rgba(24,119,242,0.15)" : "#e7f3ff") : "transparent",
                  color: settingsTab === tb.key ? "#1877f2" : textSecondary,
                  transition: "all 0.15s", textAlign: "left", marginBottom: 2,
                }}>
                  <Bi name={tb.icon} size={16} color={settingsTab === tb.key ? "#1877f2" : textSecondary} />
                  {tb.label}
                </button>
              ))}
            </FbCard>

            <FbCard isDark={isDark} cardBg={cardBg} border={border} pad="24px">
              {settingsTab === "info" && (
                <div>
                  <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: textPrimary }}>{t("prof_info")}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    {[
                      { key: "name",       label: t("prof_name"),    type: "text",  disabled: false },
                      { key: "email",      label: t("prof_email"),   type: "email", disabled: true },
                      { key: "phone",      label: t("prof_phone"),   type: "text",  disabled: false },
                      { key: "birth_date", label: t("prof_birth"),   type: "date",  disabled: false },
                      { key: "city",       label: t("prof_city"),    type: "text",  disabled: false },
                      { key: "country",    label: t("prof_country"), type: "text",  disabled: false },
                    ].map(f => (
                      <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>{f.label}</label>
                        <input type={f.type} className="prof-input" style={{ ...inputBase, opacity: f.disabled ? 0.5 : 1, cursor: f.disabled ? "not-allowed" : "text" }}
                          value={profile[f.key] || ""} onChange={e => !f.disabled && field(f.key, e.target.value)} disabled={f.disabled} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>{t("prof_bio")}</label>
                    <textarea className="prof-input" style={{ ...inputBase, resize: "vertical", minHeight: 80, lineHeight: 1.55 }}
                      value={profile.bio || ""} onChange={e => field("bio", e.target.value)} placeholder={t("prof_bio_ph")} rows={3} />
                  </div>
                  <button onClick={handleSave} disabled={saving} style={{
                    padding: "10px 22px", borderRadius: 8, border: "none",
                    background: "#1877f2", color: "white", fontWeight: 700, fontSize: 15,
                    cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 8, opacity: saving ? 0.7 : 1,
                    boxShadow: "0 2px 8px rgba(24,119,242,0.3)",
                  }}>
                    {saving && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                    {saving ? t("prof_saving") : t("prof_save")}
                  </button>
                </div>
              )}

              {settingsTab === "prefs" && (
                <div>
                  <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: textPrimary }}>{t("prof_prefs")}</h3>
                  <div style={{ marginBottom: 22 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: textSecondary, display: "block", marginBottom: 10 }}>{t("prof_theme")}</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ val: "dark", icon: "moon-fill", label: t("prof_dark") }, { val: "light", icon: "sun-fill", label: t("prof_light") }].map(opt => (
                        <div key={opt.val} onClick={() => field("theme", opt.val)} style={{
                          flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          background: profile.theme === opt.val ? (isDark ? "rgba(24,119,242,0.15)" : "#e7f3ff") : (isDark ? "rgba(255,255,255,0.04)" : "#f7f8fa"),
                          border: `2px solid ${profile.theme === opt.val ? "#1877f2" : border}`,
                        }}>
                          <Bi name={opt.icon} size={20} color={profile.theme === opt.val ? "#1877f2" : textSecondary} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: profile.theme === opt.val ? "#1877f2" : textSecondary }}>{opt.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 22 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: textSecondary, display: "block", marginBottom: 10 }}>{t("prof_lang")}</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ val: "fr", code: "FR", label: "Français" }, { val: "en", code: "EN", label: "English" }, { val: "ar", code: "AR", label: "العربية" }].map(opt => (
                        <div key={opt.val} onClick={() => field("language", opt.val)} style={{
                          flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          background: profile.language === opt.val ? (isDark ? "rgba(24,119,242,0.15)" : "#e7f3ff") : (isDark ? "rgba(255,255,255,0.04)" : "#f7f8fa"),
                          border: `2px solid ${profile.language === opt.val ? "#1877f2" : border}`,
                        }}>
                          <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: profile.language === opt.val ? "#1877f2" : textSecondary }}>{opt.code}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: profile.language === opt.val ? "#1877f2" : textSecondary }}>{opt.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#1877f2", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
                    {saving ? t("prof_saving") : t("prof_save")}
                  </button>
                </div>
              )}

              {settingsTab === "security" && (
                <div>
                  <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: textPrimary }}>{t("prof_security")}</h3>
                  {pwSuccess && <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 14, background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Bi name="check-circle-fill" size={14} color="#16a34a" /> {pwSuccess}</div>}
                  {pwError && <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 14, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{pwError}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
                    {[
                      { key: "old_password", label: t("prof_old_pw"), pk: "old" },
                      { key: "new_password", label: t("prof_new_pw"), pk: "new" },
                      { key: "confirm",      label: t("prof_confirm_pw"), pk: "confirm" },
                    ].map(f => (
                      <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>{f.label}</label>
                        <div style={{ position: "relative" }}>
                          <input type={showPw[f.pk] ? "text" : "password"} className="prof-input"
                            style={{ ...inputBase, paddingRight: 40 }} value={passwords[f.key]}
                            onChange={e => setPasswords({ ...passwords, [f.key]: e.target.value })} placeholder="••••••••" />
                          <button onClick={() => setShowPw(p => ({ ...p, [f.pk]: !p[f.pk] }))}
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                            <Bi name={showPw[f.pk] ? "eye-slash" : "eye"} size={14} color={textSecondary} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {passwords.new_password && (() => {
                      const len = passwords.new_password.length;
                      const pct = len >= 10 ? 100 : len >= 8 ? 66 : len >= 6 ? 33 : 10;
                      const col = len >= 10 ? "#16a34a" : len >= 8 ? "#d97706" : "#dc2626";
                      const lv = len >= 10 ? t("prof_strong") : len >= 8 ? t("prof_medium") : t("prof_weak");
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: textSecondary }}>Force</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{lv}</span>
                          </div>
                          <div style={{ height: 5, background: isDark ? "rgba(255,255,255,0.07)" : "#e4e6eb", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 4, transition: "all 0.35s" }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button onClick={handleChangePassword} disabled={pwSaving} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#1877f2", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginTop: 20 }}>
                    {pwSaving ? t("prof_changing") : t("prof_change_pw")}
                  </button>
                </div>
              )}
            </FbCard>
          </div>
        )}
      </div>

      {/* ════ MODAL: Create post/story ════ */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ width: "100%", maxWidth: 520, background: cardBg, borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${border}` }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPrimary }}>
                {newType === "story" ? lbl("Créer une story", "Create story", "إنشاء قصة") : lbl("Créer une publication", "Create post", "إنشاء منشور")}
              </h3>
              <button onClick={() => setShowCreate(false)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#e4e6eb", border: "none", cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={16} color={textPrimary} />
              </button>
            </div>
            <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
              {[
                { val: "post",  label: lbl("Publication", "Post", "منشور") },
                { val: "story", label: lbl("Story", "Story", "قصة") },
              ].map(tb => (
                <button key={tb.val} onClick={() => setNewType(tb.val)} style={{
                  flex: 1, padding: "12px", border: "none", background: "transparent", cursor: "pointer",
                  fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                  color: newType === tb.val ? "#1877f2" : textSecondary,
                  borderBottom: `3px solid ${newType === tb.val ? "#1877f2" : "transparent"}`,
                }}>
                  {tb.label}
                </button>
              ))}
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <img src={avatar(profile.name, profile.photo)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: textPrimary }}>{profile.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, background: isDark ? "rgba(255,255,255,0.08)" : "#e4e6eb", borderRadius: 6, padding: "2px 8px", marginTop: 3, width: "fit-content", cursor: "pointer" }}>
                    <Bi name="globe2" size={11} color={textSecondary} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSecondary }}>{newType === "story" ? lbl("Visible 24h", "24h visible", "مرئية 24س") : lbl("Public", "Public", "عام")}</span>
                    <Bi name="chevron-down" size={10} color={textSecondary} />
                  </div>
                </div>
              </div>
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder={lbl("Que voulez-vous dire ?", "What's on your mind?", "ماذا تريد أن تشارك؟")}
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 120, padding: "10px 0",
                  border: "none", borderBottom: `1px solid ${border}`,
                  background: "transparent", color: textPrimary,
                  fontSize: 18, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6,
                }} />
              {newMedia && (
                <div style={{ position: "relative", marginTop: 10 }}>
                  <img src={newMedia} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
                  <button onClick={() => setNewMedia(null)} style={{
                    position: "absolute", top: 7, right: 7, width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Bi name="x-lg" size={12} color="white" />
                  </button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{lbl("Ajouter à votre publication", "Add to your post", "أضف إلى منشورك")}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { icon: "image-fill", color: "#45bd62", action: () => filePostRef.current?.click() },
                    { icon: "person-plus-fill", color: "#1877f2", action: () => {} },
                    { icon: "emoji-smile-fill", color: "#f7b125", action: () => {} },
                    { icon: "geo-alt-fill", color: "#f02849", action: () => {} },
                    { icon: "three-dots", color: textSecondary, action: () => {} },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} className="hover-btn" style={{
                      width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Bi name={btn.icon} size={18} color={btn.color} />
                    </button>
                  ))}
                </div>
              </div>
              <input type="file" accept="image/*" ref={filePostRef} style={{ display: "none" }} onChange={handleMediaSelect} />
              <button onClick={handleCreate} disabled={posting || (!newContent.trim() && !newMedia)} style={{
                width: "100%", padding: "10px", borderRadius: 8, border: "none",
                background: (posting || (!newContent.trim() && !newMedia)) ? (isDark ? "rgba(255,255,255,0.1)" : "#e4e6eb") : "#1877f2",
                color: (posting || (!newContent.trim() && !newMedia)) ? textSecondary : "white",
                fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 12, fontFamily: "inherit",
              }}>
                {posting ? lbl("Publication...", "Posting...", "جاري النشر...") : lbl("Publier", "Post", "نشر")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Comments ════ */}
      {commentPost && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setCommentPost(null)}>
          <div style={{ width: "100%", maxWidth: 600, background: cardBg, borderRadius: "18px 18px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 -10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPrimary }}>
                {lbl("Commentaires", "Comments", "التعليقات")} ({commentsList.length})
              </h3>
              <button onClick={() => setCommentPost(null)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#f0f2f5", border: "none", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bi name="x-lg" size={14} color={textSecondary} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {commentsList.length === 0 && (
                <p style={{ textAlign: "center", color: textSecondary, fontSize: 14, marginTop: 16 }}>{lbl("Sois le premier à commenter", "Be the first to comment", "كن أول من يعلق")}</p>
              )}
              {/* ✅ FIX 2 — key using c.id || c._id || index pour éviter les doublons vides */}
              {commentsList.map((c, i) => (
                <div key={c.id || c._id || i} style={{ display: "flex", gap: 9 }}>
                  <img src={avatar(c.author_name, c.author_photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f0f2f5", borderRadius: "0 14px 14px 14px", padding: "8px 12px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{c.author_name} </span>
                      <span style={{ fontSize: 14, color: textPrimary }}>{c.text}</span>
                    </div>
                    <span style={{ fontSize: 11, color: textSecondary, marginLeft: 8 }}>{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, display: "flex", gap: 9, alignItems: "center", flexShrink: 0 }}>
              <img src={avatar(profile.name, profile.photo)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
                placeholder={lbl("Écrire un commentaire...", "Write a comment...", "اكتب تعليقاً...")}
                style={{ flex: 1, padding: "9px 16px", borderRadius: 20, border: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.06)" : "#f0f2f5", color: textPrimary, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
              <button onClick={sendComment} disabled={sendingCmt || !commentText.trim()} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#1877f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !commentText.trim() ? 0.5 : 1 }}>
                <Bi name="send-fill" size={14} color="white" />
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
          profile={profile}
          lbl={lbl}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Instagram-style Story Viewer
// ─────────────────────────────────────────────────────────
function InstaStoryViewer({ stories, index, setIndex, onClose, profile, lbl, isDark }) {
  const story = stories[index];
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPanel, setShowPanel] = useState(null);
  const [cmtText, setCmtText] = useState("");
  const [cmtList, setCmtList] = useState([]);
  const [msgText, setMsgText] = useState("");

  const [viewers, setViewers] = useState([]);
  const [reactionMap, setReactionMap] = useState({});
  const [viewCount, setViewCount] = useState(story.views_count || 0);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const DURATION = 5000;

  // ✅ FIX 1 — Utiliser des refs pour éviter la stale closure dans setInterval
  const indexRef   = useRef(index);
  const onCloseRef = useRef(onClose);
  const storiesLenRef = useRef(stories.length);

  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { storiesLenRef.current = stories.length; }, [stories.length]);

  // Reset au changement de story
  useEffect(() => {
    setProgress(0);
    setReaction(null);
    setShowPanel(null);
    setViewers([]);
    setReactionMap({});
    setCmtList([]);

    recordView(story._id)
      .then(r => setViewCount(r.data.views_count))
      .catch(() => {});
  }, [index]);

  // Ouvrir un panel → charger les données
  useEffect(() => {
    if (!showPanel) return;
    setLoadingPanel(true);

    if (showPanel === "views") {
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

  // ✅ FIX 1 — Progress bar sans stale closure
  useEffect(() => {
    if (paused || showPanel) return;
    setProgress(0);
    const step = 100 / (DURATION / 50);
    const iv = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearInterval(iv);
          // Utilise les refs pour lire les valeurs courantes sans capturer la closure
          if (indexRef.current < storiesLenRef.current - 1) {
            setIndex(i => i + 1);
          } else {
            onCloseRef.current();
          }
          return 100;
        }
        return p + step;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [index, paused, showPanel]);

  const goNext = () => {
    if (index < stories.length - 1) setIndex(i => i + 1);
    else onClose();
  };
  const goPrev = () => { if (index > 0) setIndex(i => i - 1); };

  const handleReaction = (r) => {
    const newReaction = r === reaction ? null : r;
    setReaction(newReaction);
    setShowReactionPicker(false);
    reactToPost(story._id, r).catch(() => {});
  };

  const sendStoryComment = async () => {
    if (!cmtText.trim()) return;
    try {
      const res = await addComment(story._id, cmtText);
      setCmtList(l => [...l, res.data]);
      setCmtText("");
    } catch {}
  };

  const av = (name, photo) =>
    photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=1877f2&color=fff&size=80`;

  const timeAgoL = (iso) => {
    if (!iso) return "";
    const d = (Date.now() - new Date(iso)) / 1000;
    if (d < 60) return "à l'instant";
    if (d < 3600) return `${Math.floor(d / 60)} min`;
    if (d < 86400) return `${Math.floor(d / 3600)} h`;
    return `${Math.floor(d / 86400)} j`;
  };

  const reactionEmoji = REACTIONS.find(r => r.key === reaction)?.emoji;

  const allReactors = Object.entries(reactionMap).flatMap(([rtype, users]) =>
    users.map(u => ({ ...u, reacted: rtype }))
  );
  const likeCount = allReactors.length;
  const cmtCount = cmtList.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <style>{`
        @keyframes reactionPop { 0%{transform:scale(0) translateY(20px);opacity:0} 60%{transform:scale(1.3) translateY(-5px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes reactionFloat { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-80px) scale(1.5)} }
        @keyframes slideUpPanel { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ position: "absolute", inset: 0, background: `url(${story.media || ""}) center/cover no-repeat`, filter: "blur(30px) brightness(0.3)" }} />

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
            : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" }}>
                <p style={{ fontSize: 22, color: "white", textAlign: "center", lineHeight: 1.7, fontWeight: 600, margin: 0 }}>{story.content}</p>
              </div>
            )
          }
          {story.media && story.content && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 16px 16px", background: "linear-gradient(transparent,rgba(0,0,0,0.7))" }}>
              <p style={{ margin: 0, fontSize: 16, color: "white", lineHeight: 1.5 }}>{story.content}</p>
            </div>
          )}
          {reaction && (
            <div key={reaction} style={{ position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)", fontSize: 48, animation: "reactionFloat 1.5s ease forwards", pointerEvents: "none" }}>
              {reactionEmoji}
            </div>
          )}
          <div onClick={goPrev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
          <div onClick={goNext} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer", zIndex: 5 }} />
        </div>

        {/* Bottom bar */}
        <div style={{ flexShrink: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "20px 12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>

            <button onClick={() => setShowPanel(p => p === "views" ? null : "views")}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
              <i className="bi bi-eye-fill" style={{ fontSize: 13 }} /> {viewCount}
            </button>

            {likeCount > 0 && (
              <button onClick={() => setShowPanel(p => p === "likes" ? null : "likes")}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
                <span style={{ fontSize: 14 }}>
                  {Object.keys(reactionMap).filter(k => reactionMap[k]?.length > 0).map(k => REACTIONS.find(r => r.key === k)?.emoji).join("")}
                </span>
                {likeCount}
              </button>
            )}

            <button onClick={() => setShowPanel(p => p === "comments" ? null : "comments")}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
              <i className="bi bi-chat-fill" style={{ fontSize: 13 }} /> {cmtCount}
            </button>

            <div style={{ flex: 1 }} />

            <div style={{ position: "relative" }}>
              <button onClick={() => setShowReactionPicker(p => !p)}
                style={{ width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", background: reaction ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "transform 0.15s", transform: reaction ? "scale(1.1)" : "scale(1)" }}>
                {reaction ? reactionEmoji : <i className="bi bi-heart" style={{ fontSize: 18, color: "white" }} />}
              </button>
              {showReactionPicker && (
                <div style={{ position: "absolute", bottom: 50, right: 0, display: "flex", gap: 6, background: "rgba(30,30,30,0.95)", padding: "8px 12px", borderRadius: 30, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", animation: "reactionPop 0.2s ease" }}>
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => handleReaction(r.key)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, transform: reaction === r.key ? "scale(1.3)" : "scale(1)", transition: "transform 0.15s" }} title={r.label}>
                      {r.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <img src={av(profile.name, profile.photo)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative" }}>
              <input value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder={lbl("Envoyer un message...", "Send a message...", "أرسل رسالة...")}
                onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 44px 9px 16px", borderRadius: 24, border: "2px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              {msgText && (
                <button onClick={() => setMsgText("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#1877f2", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
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
                {showPanel === "views"    && `👁 ${lbl("Vues", "Views", "المشاهدات")} (${viewCount})`}
                {showPanel === "likes"    && `❤️ ${lbl("Réactions", "Reactions", "التفاعلات")} (${likeCount})`}
                {showPanel === "comments" && `💬 ${lbl("Commentaires", "Comments", "التعليقات")} (${cmtCount})`}
              </span>
              <button onClick={() => setShowPanel(null)} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#e4e6eb", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="bi bi-x-lg" style={{ fontSize: 12, color: isDark ? "white" : "#050505" }} />
              </button>
            </div>
            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "#eee", margin: "0 16px 8px" }} />

            {loadingPanel ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 30 }}>
                <div style={{ width: 24, height: 24, border: "3px solid rgba(24,119,242,0.2)", borderTop: "3px solid #1877f2", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : (
              <>
                {showPanel === "views" && (
                  <div style={{ overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {viewers.length === 0 ? (
                      <p style={{ textAlign: "center", color: isDark ? "rgba(255,255,255,0.4)" : "#999", fontSize: 14, padding: "20px 0" }}>
                        {lbl("Aucune vue enregistrée", "No views yet", "لا مشاهدات بعد")}
                      </p>
                    ) : viewers.map((v, i) => (
                      <div key={v.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={av(v.name, v.photo)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.85)" : "#050505" }}>{v.name}</span>
                        <i className="bi bi-eye-fill" style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.3)" : "#999" }} />
                      </div>
                    ))}
                  </div>
                )}

                {showPanel === "likes" && (
                  <div style={{ overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {allReactors.length === 0 ? (
                      <p style={{ textAlign: "center", color: isDark ? "rgba(255,255,255,0.4)" : "#999", fontSize: 14, padding: "20px 0" }}>
                        {lbl("Aucune réaction encore", "No reactions yet", "لا تفاعلات بعد")}
                      </p>
                    ) : allReactors.map((u, i) => (
                      <div key={u.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img src={av(u.name, u.photo)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                          <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 16 }}>
                            {REACTIONS.find(r => r.key === u.reacted)?.emoji}
                          </span>
                        </div>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.85)" : "#050505" }}>{u.name}</span>
                        <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.4)" : "#999" }}>{REACTIONS.find(r => r.key === u.reacted)?.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {showPanel === "comments" && (
                  <>
                    <div style={{ overflowY: "auto", flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {cmtList.length === 0
                        ? <p style={{ textAlign: "center", color: isDark ? "rgba(255,255,255,0.4)" : "#999", fontSize: 14, padding: "20px 0" }}>
                          {lbl("Sois le premier à commenter", "Be first", "كن أول من يعلق")}
                        </p>
                        // ✅ FIX 2 — key normalisé c.id || c._id || index
                        : cmtList.map((c, i) => (
                          <div key={c.id || c._id || i} style={{ display: "flex", gap: 9 }}>
                            <img src={av(c.author_name, c.author_photo)} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f0f2f5", borderRadius: "0 12px 12px 12px", padding: "7px 11px" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#60a5fa" : "#1877f2" }}>{c.author_name} </span>
                                <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.85)" : "#050505" }}>{c.text}</span>
                              </div>
                              <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.35)" : "#999", marginLeft: 6 }}>{timeAgoL(c.created_at)}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8, padding: "10px 16px", alignItems: "center" }}>
                      <img src={av(profile.name, profile.photo)} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                      <input value={cmtText} onChange={e => setCmtText(e.target.value)}
                        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                        onKeyDown={e => e.key === "Enter" && sendStoryComment()}
                        placeholder={lbl("Commenter...", "Comment...", "تعليق...")}
                        style={{ flex: 1, padding: "8px 14px", borderRadius: 20, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#ddd"}`, background: isDark ? "rgba(255,255,255,0.07)" : "#f0f2f5", color: isDark ? "white" : "#050505", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <button onClick={sendStoryComment} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#1877f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: cmtText.trim() ? 1 : 0.4, flexShrink: 0 }}>
                        <i className="bi bi-send-fill" style={{ fontSize: 13, color: "white" }} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

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

// ── PostCard ──────────────────────────────────────────────────
function PostCard({ post, isDark, textPrimary, textSecondary, cardBg, border, canDelete, onLike, onComment, onDelete }) {
  const [showReactions, setShowReactions] = useState(false);
  const [reaction, setReaction] = useState(post.liked_by_me ? "like" : null);
  const hoverTimer = useRef(null);

  const handleReactionHover = () => {
    hoverTimer.current = setTimeout(() => setShowReactions(true), 400);
  };
  const handleReactionLeave = () => {
    clearTimeout(hoverTimer.current);
    setTimeout(() => setShowReactions(false), 300);
  };
  const handleReactionClick = (r) => {
    setReaction(prev => prev === r ? null : r);
    setShowReactions(false);
    onLike();
  };

  const currentReaction = REACTIONS.find(r => r.key === reaction);

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: "visible", boxShadow: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        <img src={post.author_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || "?")}&background=1877f2&color=fff&size=40`}
          alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: textPrimary }}>{post.author_name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <p style={{ margin: 0, fontSize: 12, color: textSecondary }}>{timeAgo(post.created_at)}</p>
            <span style={{ color: textSecondary, fontSize: 10 }}>·</span>
            <i className="bi bi-globe2" style={{ fontSize: 11, color: textSecondary }} />
          </div>
        </div>
        {canDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, opacity: 0.5 }}>
            <i className="bi bi-three-dots" style={{ fontSize: 18, color: textSecondary }} />
          </button>
        )}
      </div>

      {post.content && <p style={{ margin: "0 16px 12px", fontSize: 15, color: textPrimary, lineHeight: 1.65 }}>{post.content}</p>}
      {post.media && <img src={post.media} alt="" style={{ width: "100%", maxHeight: 500, objectFit: "cover", display: "block" }} />}

      {/* ✅ FIX 3 — Réactions : affiche l'emoji de la réaction actuelle (pas hardcodé like/love/haha) */}
      {post.likes_count > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 16 }}>
              {currentReaction?.emoji || "👍"}
            </span>
            <span style={{ fontSize: 13, color: textSecondary }}>{post.likes_count}</span>
          </div>
          {post.comments_count > 0 && (
            <button onClick={onComment} style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, fontSize: 13 }}>
              {post.comments_count} commentaire{post.comments_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", borderTop: `1px solid ${border}`, padding: "2px 8px", position: "relative" }}>
        <div
          style={{ flex: 1, position: "relative" }}
          onMouseEnter={handleReactionHover}
          onMouseLeave={handleReactionLeave}
        >
          {showReactions && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0,
              display: "flex", gap: 6, background: isDark ? "rgba(30,30,30,0.97)" : "white",
              padding: "8px 12px", borderRadius: 30,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              border: `1px solid ${border}`,
              animation: "scaleIn 0.15s ease",
              zIndex: 100, marginBottom: 6,
            }}>
              {REACTIONS.map(r => (
                <button key={r.key} onClick={() => handleReactionClick(r.key)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 26, transition: "transform 0.1s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.4) translateY(-4px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  title={r.label}
                >
                  {r.emoji}
                  <span style={{ fontSize: 9, color: isDark ? "rgba(255,255,255,0.6)" : "#666", fontWeight: 600 }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setReaction(r => r ? null : "like"); onLike(); }}
            style={{
              width: "100%", padding: "9px 10px",
              background: "none", border: "none", cursor: "pointer", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              color: currentReaction ? currentReaction.color : textSecondary,
              fontSize: 14, fontWeight: 700, transition: "background 0.1s",
            }}
          >
            {currentReaction
              ? <><span style={{ fontSize: 18 }}>{currentReaction.emoji}</span> {currentReaction.label}</>
              : <><i className="bi bi-hand-thumbs-up" style={{ fontSize: 17, color: textSecondary }} /> J'aime</>
            }
          </button>
        </div>

        <button onClick={onComment} style={{
          flex: 1, padding: "9px 10px",
          background: "none", border: "none", cursor: "pointer", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          color: textSecondary, fontSize: 14, fontWeight: 700,
        }}>
          <i className="bi bi-chat-left" style={{ fontSize: 16, color: textSecondary }} /> Commenter
        </button>

        <button style={{
          flex: 1, padding: "9px 10px",
          background: "none", border: "none", cursor: "pointer", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          color: textSecondary, fontSize: 14, fontWeight: 700,
        }}>
          <i className="bi bi-share" style={{ fontSize: 16, color: textSecondary }} /> Partager
        </button>
      </div>
    </div>
  );
}

function FbCard({ isDark, cardBg, border, children, pad = "16px" }) {
  return (
    <div style={{ borderRadius: 12, padding: pad, background: cardBg, border: `1px solid ${border}`, boxShadow: "none" }}>
      {children}
    </div>
  );
}
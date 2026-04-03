import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, googleLogin } from "../services/api";
import { GoogleLogin } from "@react-oauth/google";

const ILYHand = ({ style }) => (
  <svg viewBox="0 0 180 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <defs>
      <linearGradient id="lh1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5BB8FF" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#2E86E8" stopOpacity="0.5"/>
      </linearGradient>
      <linearGradient id="lh2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2ECFA0" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#0F9E75" stopOpacity="0.5"/>
      </linearGradient>
    </defs>
    <ellipse cx="90" cy="175" rx="50" ry="40" fill="url(#lh1)"/>
    <path d="M42 168 Q18 148 26 120 Q34 98 50 108 Q55 130 60 155Z" fill="url(#lh2)"/>
    <path d="M62 155 Q58 115 64 88 Q70 60 80 68 Q86 84 84 115 Q82 138 76 155Z" fill="url(#lh1)"/>
    <path d="M81 152 Q80 124 84 106 Q89 88 98 94 Q102 108 100 130 Q98 146 91 153Z" fill="url(#lh1)" opacity="0.5"/>
    <path d="M98 154 Q99 128 103 112 Q109 96 117 102 Q120 115 118 136 Q116 150 108 156Z" fill="url(#lh1)" opacity="0.5"/>
    <path d="M115 158 Q118 130 124 112 Q131 94 140 100 Q143 114 140 136 Q137 152 128 160Z" fill="url(#lh2)"/>
  </svg>
);

const SignIllustration = ({ style }) => (
  <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <circle cx="200" cy="150" r="110" stroke="rgba(91,184,255,0.08)" strokeWidth="1" fill="none"/>
    <circle cx="200" cy="150" r="75" stroke="rgba(91,184,255,0.05)" strokeWidth="1" fill="none"/>
    <g transform="translate(40, 30) scale(0.85)">
      <ellipse cx="80" cy="190" rx="45" ry="38" fill="rgba(91,184,255,0.15)" stroke="rgba(91,184,255,0.4)" strokeWidth="1.5"/>
      <path d="M38 182 Q18 165 26 142 Q34 124 48 134 Q52 152 56 172Z" fill="rgba(91,184,255,0.12)" stroke="rgba(91,184,255,0.32)" strokeWidth="1.5"/>
      <path d="M62 168 Q58 130 62 105 Q67 80 76 86 Q82 100 80 128 Q78 148 73 165Z" fill="rgba(91,184,255,0.22)" stroke="rgba(91,184,255,0.5)" strokeWidth="1.5"/>
      <path d="M78 165 Q76 140 80 122 Q85 104 92 110 Q96 122 94 144 Q92 158 86 167Z" fill="rgba(91,184,255,0.1)" stroke="rgba(91,184,255,0.28)" strokeWidth="1.5"/>
      <path d="M93 167 Q93 144 97 128 Q102 112 108 118 Q111 130 109 150 Q107 163 100 169Z" fill="rgba(91,184,255,0.1)" stroke="rgba(91,184,255,0.28)" strokeWidth="1.5"/>
      <path d="M109 170 Q112 144 116 128 Q122 112 128 116 Q132 128 130 148 Q127 164 120 172Z" fill="rgba(46,207,160,0.22)" stroke="rgba(46,207,160,0.5)" strokeWidth="1.5"/>
    </g>
    <path d="M160 95 Q200 70 240 95" stroke="rgba(91,184,255,0.15)" strokeWidth="1" strokeDasharray="4,5"/>
    <path d="M168 118 Q200 102 232 118" stroke="rgba(91,184,255,0.1)" strokeWidth="1" strokeDasharray="4,5"/>
    <g transform="translate(220, 30) scale(0.85)">
      <ellipse cx="80" cy="190" rx="45" ry="38" fill="rgba(46,207,160,0.12)" stroke="rgba(46,207,160,0.32)" strokeWidth="1.5"/>
      <path d="M122 182 Q142 165 134 142 Q126 124 112 134 Q108 152 104 172Z" fill="rgba(46,207,160,0.12)" stroke="rgba(46,207,160,0.3)" strokeWidth="1.5"/>
      <path d="M98 168 Q102 130 98 105 Q93 80 84 86 Q78 100 80 128 Q82 148 87 165Z" fill="rgba(46,207,160,0.2)" stroke="rgba(46,207,160,0.45)" strokeWidth="1.5"/>
      <path d="M82 165 Q84 140 80 122 Q75 104 68 110 Q64 122 66 144 Q68 158 74 167Z" fill="rgba(46,207,160,0.08)" stroke="rgba(46,207,160,0.22)" strokeWidth="1.5"/>
      <path d="M67 167 Q67 144 63 128 Q58 112 52 118 Q49 130 51 150 Q53 163 60 169Z" fill="rgba(46,207,160,0.08)" stroke="rgba(46,207,160,0.22)" strokeWidth="1.5"/>
      <path d="M51 170 Q48 144 44 128 Q38 112 32 116 Q28 128 30 148 Q33 164 40 172Z" fill="rgba(91,184,255,0.18)" stroke="rgba(91,184,255,0.4)" strokeWidth="1.5"/>
    </g>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/home");
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    try {
      const res = await googleLogin(credential);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/home");
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      overflow: "hidden",
      background: "#ffffff",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatSlow { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulseGlow { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        html, body, #root { height: 100%; overflow: hidden; margin: 0; padding: 0; }
        .l-panel { font-family: 'DM Sans', sans-serif; }
        .l-input {
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .l-input:focus {
          border-color: #5BB8FF !important;
          box-shadow: 0 0 0 3px rgba(91,184,255,0.18) !important;
          outline: none;
          background: #f7fbff !important;
          color: #0a1628 !important;
        }
        .l-btn {
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
        }
        .l-btn:hover:not(:disabled) {
          background: #3A9BE0 !important;
          box-shadow: 0 6px 24px rgba(91,184,255,0.25) !important;
          transform: translateY(-1px);
        }
        .l-btn:active:not(:disabled) { transform: translateY(0); }
        .l-link { color: #5BB8FF; font-weight: 500; text-decoration: none; font-family: 'DM Sans', sans-serif; }
        .l-link:hover { text-decoration: underline; opacity: 0.85; }
        .stat-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.12); }
        .badge-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 99px;
          background: rgba(91,184,255,0.1);
          border: 1px solid rgba(91,184,255,0.2);
          font-size: 11px; color: #8DCFFF;
          font-weight: 500; letter-spacing: 1.2px;
          text-transform: uppercase;
          font-family: 'DM Sans', sans-serif;
        }
        .glow-circle {
          position: absolute; border-radius: 50%;
          animation: pulseGlow 4s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {/* LEFT PANEL — BEIGE CLAIR (55%) */}
      <div style={{
        flex: "0 0 55%",
        background: "linear-gradient(160deg, #f4f2ee 0%, #ece9e4 60%, #f0ede8 100%)",
        position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 52px",
        overflow: "hidden",
      }}>
        {/* Ambient glows beige */}
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(55,138,221,0.06) 0%, transparent 70%)", top: "10%", left: "10%", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,158,117,0.06) 0%, transparent 70%)", bottom: "15%", right: "5%", pointerEvents: "none" }}/>

        {/* Decorative dots grid */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(rgba(160,130,90,0.07) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }}/>

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: "100%", maxWidth: 420 }}>

          {/* Badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 99,
            background: "#e6f1fb", border: "1px solid #c0d9f0",
            fontSize: 11, color: "#185FA5", fontWeight: 500,
            letterSpacing: "1.2px", textTransform: "uppercase",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#378ADD" }}/>
            AI SIGN LANGUAGE
          </div>

          <div style={{ animation: "floatSlow 6s ease-in-out infinite" }}>
            <SignIllustration style={{ width: 420, height: 200 }}/>
          </div>

          <div style={{ textAlign: "center" }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 30, fontWeight: 700,
              color: "#1a1915",
              margin: "0 0 6px",
              lineHeight: 1.15,
              letterSpacing: "-0.5px",
            }}>
              Breaking<br/>
              <span style={{ fontStyle: "italic", color: "#185FA5" }}>the silence</span>
            </h2>
            <p style={{
              fontSize: 14, color: "#6b6963",
              lineHeight: 1.7, margin: "12px 0 0",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
            }}>
              Real-time ASL translation so everyone<br/>is included in the conversation.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 4 }}>
            {[["10k+", "USERS"], ["99%", "ACCURACY"], ["3", "LANGUAGES"]].map(([v, l], i) => (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ width: 1, height: 28, background: "#d4cfc8" }}/>}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "#1a1915" }}>{v}</div>
                  <div style={{ fontSize: 10, color: "#9e8c78", marginTop: 3, letterSpacing: "1px", fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — WHITE (45%) */}
      <div className="l-panel" style={{
        flex: "0 0 45%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 44px",
        background: "#ffffff",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp 0.5s ease both", position: "relative", zIndex: 1 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "#eaf4ff",
              border: "1px solid #c5e0f8",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ILYHand style={{ width: 18, height: 22 }}/>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0a1628", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.2px" }}>ASL Translator</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 26, fontWeight: 700,
            color: "#0a1628", margin: "0 0 5px",
            letterSpacing: "-0.5px",
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: "#8a8f9a", margin: "0 0 26px", fontWeight: 300, fontFamily: "'DM Sans', sans-serif" }}>
            Sign in to continue on ASL Translator
          </p>

          {error && (
            <div style={{
              padding: "10px 13px", borderRadius: 8, marginBottom: 18,
              background: "#fff0f0", border: "1px solid #fcc",
              color: "#b33", fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {[
              { name: "email",    label: "Email",    type: "email",    ph: "you@example.com" },
              { name: "password", label: "Password", type: "password", ph: "••••••••" },
            ].map(f => (
              <div key={f.name} style={{ marginBottom: 15 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#4a5062", marginBottom: 6, letterSpacing: "0.3px", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
                  {f.label}
                </label>
                <input
                  className="l-input"
                  type={f.type} name={f.name}
                  placeholder={f.ph}
                  value={form[f.name]}
                  onChange={handleChange}
                  onFocus={() => setFocused(f.name)}
                  onBlur={() => setFocused("")}
                  style={{
                    width: "100%", padding: "10px 13px", borderRadius: 9,
                    border: `1.5px solid ${focused === f.name ? "#5BB8FF" : "#e2e6ec"}`,
                    background: "#fafbfc",
                    color: "#0a1628", fontSize: 13,
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>
            ))}

            <button
              type="submit"
              className="l-btn"
              disabled={loading}
              style={{
                width: "100%", padding: "11px", borderRadius: 9, border: "none",
                background: "#1868c4", color: "#ffffff",
                fontSize: 13, fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 6,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 16px rgba(24,104,196,0.2)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {loading
                ? <><div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/> Signing in...</>
                : "Sign in"
              }
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#eaecf0" }}/>
            <span style={{ fontSize: 11, color: "#b0b5c0", fontFamily: "'DM Sans', sans-serif" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#eaecf0" }}/>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in failed. Please try again.")}
              width="340"
              text="continue_with"
              shape="rectangular"
              theme="outline"
              locale="en"
            />
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "#9b9faa", marginTop: 22, fontFamily: "'DM Sans', sans-serif" }}>
            Don't have an account?{" "}
            <Link to="/register" className="l-link">Create an account</Link>
          </p>

          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #f0f1f4", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 10, color: "#c8cad0", letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              ASL Translator — Powered by AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
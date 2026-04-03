import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, googleLogin } from "../services/api";
import { GoogleLogin } from "@react-oauth/google";

const ILYHand = ({ style }) => (
  <svg viewBox="0 0 180 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <defs>
      <linearGradient id="rh1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#378ADD" stopOpacity="0.85"/>
        <stop offset="100%" stopColor="#185FA5" stopOpacity="0.5"/>
      </linearGradient>
      <linearGradient id="rh2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.85"/>
        <stop offset="100%" stopColor="#0F6E56" stopOpacity="0.5"/>
      </linearGradient>
    </defs>
    <ellipse cx="90" cy="175" rx="50" ry="40" fill="url(#rh1)"/>
    <path d="M42 168 Q18 148 26 120 Q34 98 50 108 Q55 130 60 155Z" fill="url(#rh2)"/>
    <path d="M62 155 Q58 115 64 88 Q70 60 80 68 Q86 84 84 115 Q82 138 76 155Z" fill="url(#rh1)"/>
    <path d="M81 152 Q80 124 84 106 Q89 88 98 94 Q102 108 100 130 Q98 146 91 153Z" fill="url(#rh1)" opacity="0.4"/>
    <path d="M98 154 Q99 128 103 112 Q109 96 117 102 Q120 115 118 136 Q116 150 108 156Z" fill="url(#rh1)" opacity="0.4"/>
    <path d="M115 158 Q118 130 124 112 Q131 94 140 100 Q143 114 140 136 Q137 152 128 160Z" fill="url(#rh2)"/>
  </svg>
);

const ASLAlphabetIllustration = ({ style }) => (
  <svg viewBox="0 0 360 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <circle cx="180" cy="140" r="110" stroke="rgba(55,138,221,0.1)" strokeWidth="1" fill="none"/>
    <circle cx="180" cy="140" r="80" stroke="rgba(55,138,221,0.07)" strokeWidth="1" fill="none"/>
    <g transform="translate(105, 55) scale(0.82)">
      <ellipse cx="90" cy="175" rx="50" ry="40" fill="rgba(55,138,221,0.1)" stroke="rgba(55,138,221,0.3)" strokeWidth="1.5"/>
      <path d="M50 162 Q46 122 52 96 Q58 68 68 74 Q74 90 72 120 Q70 142 64 160Z" fill="rgba(55,138,221,0.15)" stroke="rgba(55,138,221,0.35)" strokeWidth="1.5"/>
      <path d="M68 158 Q65 115 70 88 Q76 60 86 66 Q92 82 90 114 Q88 138 81 158Z" fill="rgba(55,138,221,0.15)" stroke="rgba(55,138,221,0.35)" strokeWidth="1.5"/>
      <path d="M86 157 Q84 116 88 90 Q94 64 104 70 Q109 86 107 116 Q105 140 98 158Z" fill="rgba(55,138,221,0.15)" stroke="rgba(55,138,221,0.35)" strokeWidth="1.5"/>
      <path d="M104 158 Q104 118 108 92 Q114 66 124 72 Q128 88 126 116 Q124 140 116 160Z" fill="rgba(55,138,221,0.15)" stroke="rgba(55,138,221,0.35)" strokeWidth="1.5"/>
      <path d="M46 168 Q26 150 34 126 Q42 104 56 114 Q60 134 62 158Z" fill="rgba(55,138,221,0.1)" stroke="rgba(55,138,221,0.25)" strokeWidth="1.5"/>
    </g>
    {[
      { x: 55,  y: 60,  l: "A", c: "#185FA5" },
      { x: 295, y: 65,  l: "S", c: "#0F6E56" },
      { x: 30,  y: 200, l: "L", c: "#854F0B" },
      { x: 310, y: 200, l: "R", c: "#A32D2D" },
      { x: 170, y: 22,  l: "I", c: "#533089" },
      { x: 170, y: 258, l: "G", c: "#185FA5" },
    ].map(({ x, y, l, c }, i) => (
      <g key={i}>
        <circle cx={x + 12} cy={y + 12} r="18" fill={`${c}14`} stroke={`${c}55`} strokeWidth="1"/>
        <text x={x + 12} y={y + 17} textAnchor="middle" fill={c} fontSize="12" fontWeight="600" fontFamily="system-ui,sans-serif">{l}</text>
      </g>
    ))}
  </svg>
);

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "deaf" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");
  const [step, setStep] = useState(1);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred. Please try again.");
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
      setError("Google sign-up failed. Please try again.");
    }
  };

  const pwStrength = () => {
    const l = form.password.length;
    if (l === 0) return null;
    if (l < 6)  return { pct: 25, color: "#E24B4A", label: "Weak" };
    if (l < 10) return { pct: 60, color: "#EF9F27", label: "Medium" };
    return { pct: 100, color: "#1D9E75", label: "Strong" };
  };
  const strength = pwStrength();

  const roles = [
    {
      val: "deaf",
      label: "Deaf / Hard of Hearing",
      desc: "I communicate in sign language",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 8a2 2 0 0 0-4 0v4"/><path d="M14 8a2 2 0 0 0-4 0v6"/>
          <path d="M10 9a2 2 0 0 0-4 0v5a7 7 0 0 0 14 0v-5"/><path d="M18 8v4"/>
        </svg>
      ),
    },
    {
      val: "hearing",
      label: "Hearing",
      desc: "I am learning sign language",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>
      ),
    },
  ];

  const features = [
    { icon: "M9 12l2 2 4-4", label: "Real-time translation", badge: "AI", badgeColor: "#185FA5", badgeBg: "#deeeff" },
    { icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", label: "Active community", badge: "10k+", badgeColor: "#0F6E56", badgeBg: "#d6f5ec" },
    { icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", label: "99% accuracy", badge: "Top", badgeColor: "#854F0B", badgeBg: "#fef3d8" },
  ];

  const step1Valid = form.name && form.email && form.password.length >= 6;

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes floatUp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        html, body, #root { height: 100%; overflow: hidden; margin: 0; padding: 0; }
        .r-input {
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .r-input:focus {
          border-color: #378ADD !important;
          box-shadow: 0 0 0 3px rgba(55,138,221,0.12) !important;
          outline: none;
          background: #f7fbff !important;
          color: #1a1915 !important;
        }
        .r-btn {
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
        }
        .r-btn:hover:not(:disabled) {
          background: #1558a0 !important;
          box-shadow: 0 6px 20px rgba(24,95,165,0.22) !important;
          transform: translateY(-1px);
        }
        .r-btn:active:not(:disabled) { transform: translateY(0); }
        .r-link { color: #185FA5; font-weight: 500; text-decoration: none; }
        .r-link:hover { text-decoration: underline; }
        .r-role { transition: all 0.18s; cursor: pointer; }
        .r-role:hover { border-color: #b5d4f4 !important; background: #f5f9fe !important; }
        .r-back { transition: color 0.15s, border-color 0.15s; }
        .r-back:hover { color: #1a1915 !important; border-color: #bbb !important; }
        .feature-row { transition: background 0.15s, transform 0.15s; }
        .feature-row:hover { background: #f0f6ff !important; transform: translateX(2px); }
      `}</style>

      {/* LEFT PANEL — LIGHT (55%) */}
      <div style={{
        flex: "0 0 55%",                /* ← 50% → 55% */
        background: "linear-gradient(160deg, #f4f2ee 0%, #ece9e4 60%, #f0ede8 100%)",
        position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 52px",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(55,138,221,0.06) 0%, transparent 70%)", top: "20%", right: "-5%", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,158,117,0.06) 0%, transparent 70%)", bottom: "15%", left: "5%", pointerEvents: "none" }}/>

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%", maxWidth: 400 }}>

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 99,
            background: "#e6f1fb", border: "1px solid #c0d9f0",
            fontSize: 10, color: "#185FA5", fontWeight: 500,
            letterSpacing: "1.2px", textTransform: "uppercase",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Join the community
          </div>

          <div style={{ animation: "floatUp 6s ease-in-out infinite" }}>
            <ASLAlphabetIllustration style={{ width: 290, height: 170 }}/>
          </div>

          <div style={{ textAlign: "center" }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 35, fontWeight: 700,
              color: "#1a1915", margin: "0 0 6px",
              letterSpacing: "-0.4px", lineHeight: 1.2,
            }}>
              Join the<br/>
              <span style={{ fontStyle: "italic", color: "#185FA5" }}>community</span>
            </h2>
            <p style={{ fontSize: 13, color: "#6b6963", lineHeight: 1.6, margin: 0, fontWeight: 300, fontFamily: "'DM Sans', sans-serif" }}>
              Deaf, hard of hearing or hearing —<br/>learn and communicate together.
            </p>
          </div>

          {/* Feature rows */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
            {features.map((f, i) => (
              <div key={i} className="feature-row" style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 12px", borderRadius: 10,
                background: "#ffffff",
                border: "1px solid #e8e4de",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: "#f0f6ff", border: "1px solid #deeeff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon}/>
                  </svg>
                </div>
                <span style={{ flex: 1, fontSize: 12, color: "#3d3d3a", fontWeight: 400, fontFamily: "'DM Sans', sans-serif" }}>{f.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
                  color: f.badgeColor, background: f.badgeBg,
                  fontFamily: "'DM Sans', sans-serif",
                }}>{f.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — WHITE (45%) — plus compact */}
      <div style={{
        flex: "0 0 45%",                /* ← flex:1 → flex: 0 0 45% */
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 40px",           /* ← padding réduit */
        background: "#ffffff",
        overflow: "hidden",
      }}>
        <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp 0.5s ease both" }}>  {/* ← 640 → 380 */}

          

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: s <= step ? "#185FA5" : "#f1f0ed",
                  border: `1px solid ${s <= step ? "#185FA5" : "#d4d3cc"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600,
                  color: s <= step ? "#ffffff" : "#9b9992",
                  transition: "all 0.3s",
                  flexShrink: 0,
                }}>
                  {s < step
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : s
                  }
                </div>
                <span style={{ fontSize: 12, color: s <= step ? "#3d3d3a" : "#9b9992", fontWeight: s <= step ? 500 : 400, fontFamily: "'DM Sans', sans-serif" }}>
                  {s === 1 ? "Information" : "Profile"}
                </span>
                {s < 2 && (
                  <div style={{
                    flex: 1, height: "1px",
                    background: step > 1 ? "#185FA5" : "#e3e2dd",
                    transition: "background 0.4s",
                  }}/>
                )}
              </React.Fragment>
            ))}
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20, fontWeight: 700,
            color: "#1a1915", margin: "0 0 2px",
            letterSpacing: "-0.4px",
          }}>
            Create an account
          </h1>
          <p style={{ fontSize: 12, color: "#8a8f9a", margin: "0 0 12px", fontWeight: 300, fontFamily: "'DM Sans', sans-serif" }}>
            {step === 1 ? "A few seconds to join the community" : "Tell us about yourself"}
          </p>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 14,
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
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeSlide 0.3s ease both" }}>
                {[
                  { name: "name",     label: "Full name",  type: "text",     ph: "Your first and last name" },
                  { name: "email",    label: "Email",       type: "email",    ph: "you@example.com" },
                  { name: "password", label: "Password",    type: "password", ph: "At least 6 characters" },
                ].map(f => (
                  <div key={f.name}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#4a5062", marginBottom: 5, letterSpacing: "0.3px", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
                      {f.label}
                    </label>
                    <input
                      className="r-input"
                      type={f.type} name={f.name}
                      placeholder={f.ph}
                      value={form[f.name]}
                      onChange={handleChange}
                      onFocus={() => setFocused(f.name)}
                      onBlur={() => setFocused("")}
                      style={{
                        width: "100%", padding: "9px 12px", borderRadius: 9,
                        border: `1.5px solid ${focused === f.name ? "#378ADD" : "#e2e6ec"}`,
                        background: "#fafbfc",
                        color: "#1a1915", fontSize: 13,
                        boxSizing: "border-box",
                      }}
                      required
                    />
                    {f.name === "password" && strength && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 3, background: "#e8eaed", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${strength.pct}%`, background: strength.color, borderRadius: 2, transition: "width 0.35s" }}/>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: strength.color, fontFamily: "'DM Sans', sans-serif" }}>{strength.label}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                  <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="r-btn"
                  style={{
                    padding: "10px", borderRadius: 9, border: "none",
                    background: "#185FA5", color: "#ffffff",
                    fontSize: 13, fontWeight: 500,
                    cursor: step1Valid ? "pointer" : "not-allowed",
                    opacity: step1Valid ? 1 : 0.4,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 16px rgba(24,95,165,0.18)",
                  }}
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: "1px", background: "#eaecf0" }}/>
                  <span style={{ fontSize: 12, color: "#b0b5c0", fontFamily: "'DM Sans', sans-serif" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "#eaecf0" }}/>
                </div>
                

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-up failed. Please try again.")}
                    width="340"
                    text="signup_with"
                    shape="rectangular"
                    theme="outline"
                    locale="en"
                  />
                </div>

              
              </div>
            )}

            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeSlide 0.3s ease both" }}>
                {roles.map(r => {
                  const selected = form.role === r.val;
                  return (
                    <div
                      key={r.val}
                      className="r-role"
                      onClick={() => setForm({ ...form, role: r.val })}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "14px 16px", borderRadius: 10,
                        background: selected ? "#e6f1fb" : "#fafbfc",
                        border: selected ? "1.5px solid #185FA5" : "1.5px solid #e2e6ec",
                        transition: "all 0.18s",
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 9, flexShrink: 0,
                        background: selected ? "#ffffff" : "#f1f0ed",
                        border: `1px solid ${selected ? "#c0d9f0" : "#e3e2dd"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: selected ? "#185FA5" : "#6b6963",
                      }}>
                        {r.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: selected ? "#185FA5" : "#1a1915", fontFamily: "'DM Sans', sans-serif" }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: "#8a8f9a", marginTop: 2, fontWeight: 300, fontFamily: "'DM Sans', sans-serif" }}>{r.desc}</div>
                      </div>
                      {selected && (
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#185FA5", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="r-back"
                    style={{
                      padding: "11px 16px", borderRadius: 9,
                      border: "1.5px solid #e2e6ec",
                      background: "transparent", color: "#6b6963",
                      fontSize: 13, fontWeight: 500, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="r-btn"
                    style={{
                      flex: 1, padding: "12px", borderRadius: 9, border: "none",
                      background: "#185FA5", color: "#ffffff",
                      fontSize: 13, fontWeight: 500,
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: loading ? 0.7 : 1,
                      boxShadow: "0 4px 16px rgba(24,95,165,0.18)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {loading
                      ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/> Creating...</>
                      : "Create my account"
                    }
                  </button>
                </div>
              </div>
            )}
          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: "#9b9faa", marginTop: 12, fontFamily: "'DM Sans', sans-serif" }}>
            Already have an account?{" "}
            <Link to="/login" className="r-link">Sign in</Link>
          </p>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f1f4", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 10, color: "#c8cad0", letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              ASL Translator — AI Sign Language
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
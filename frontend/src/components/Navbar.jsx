import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.5 3.5L5 5M11 11L12.5 12.5M3.5 12.5L5 11M11 5L12.5 3.5"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M13 8.5C12.2 11 9.9 13 7 13C3.7 13 1 10.3 1 7C1 4.1 3 1.8 5.5 1C4.2 2 3 3.7 3 5.5C3 8.5 5.5 11 8.5 11C10.3 11 12 9.8 13 8.5Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const ChevronIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export default function Navbar() {
  const navigate               = useNavigate();
  const location               = useLocation();
  const { theme, toggleTheme } = useTheme();
  const th                     = themes[theme];
  const isDark                 = theme === "dark";
  const { t, language }        = useLang();
  const user                   = JSON.parse(localStorage.getItem("user") || "{}");
  const isRTL                  = language === "ar";

  const initials = (user?.name || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navLinks = [
    { path: "/home",         label: t("nav_home")         },
    { path: "/conversation", label: t("nav_conversation") },
    { path: "/history",      label: t("nav_history")      },
    { path: "/profile",      label: t("nav_profile")      },
    { path: "/dictionary",   label: t("nav_dictionary")   },
  ];

  return (
    <>
      <style>{`
        .nb-link {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          border: none;
          background: transparent;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          font-family: ${isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "inherit"};
        }
        .nb-link:hover {
          background: ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"};
        }
        .nb-link.active {
          background: ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)"};
          color: ${th.textPrimary} !important;
          font-weight: 500;
        }
        .nb-theme-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px; font-size: 12px;
          font-weight: 500; cursor: pointer;
          border: 1px solid ${th.border};
          background: transparent;
          color: ${th.textSecondary};
          transition: background 0.15s, color 0.15s;
          font-family: ${isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "inherit"};
        }
        .nb-theme-btn:hover {
          background: ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"};
          color: ${th.textPrimary};
        }
        .nb-user-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px 5px 5px; border-radius: 8px;
          border: none; background: transparent; cursor: pointer;
          transition: background 0.15s;
          flex-direction: ${isRTL ? "row-reverse" : "row"};
        }
        .nb-user-btn:hover {
          background: ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"};
        }
        .nb-logout {
          padding: 6px 12px; border-radius: 8px; font-size: 12px;
          font-weight: 500; cursor: pointer;
          border: 1px solid rgba(229,57,53,0.35);
          background: transparent; color: #e53935;
          transition: background 0.15s;
          font-family: ${isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "inherit"};
        }
        .nb-logout:hover { background: rgba(229,57,53,0.08); }
      `}</style>

      <nav style={{
        display       : "flex",
        alignItems    : "center",
        justifyContent: "space-between",
        flexDirection : isRTL ? "row-reverse" : "row",
        padding       : "0 32px",
        height        : "56px",
        background    : th.bgNav,
        borderBottom  : `1px solid ${th.border}`,
        backdropFilter: "blur(12px)",
        position      : "sticky",
        top           : 0,
        zIndex        : 100,
        gap           : "16px",
        fontFamily    : isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "inherit",
      }}>

        {/* Logo */}
        <div
          onClick={() => navigate("/home")}
          style={{
            display      : "flex",
            alignItems   : "center",
            gap          : "10px",
            cursor       : "pointer",
            flexShrink   : 0,
            flexDirection: isRTL ? "row-reverse" : "row",
          }}
        >
          <div style={{
            width         : "30px",
            height        : "30px",
            borderRadius  : "8px",
            background    : "rgba(37,99,235,0.15)",
            border        : "1px solid rgba(37,99,235,0.25)",
            display       : "flex",
            alignItems    : "center",
            justifyContent: "center",
            flexShrink    : 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C8 2 5 4 5 8C5 10.2 6.5 12 8 12C9.5 12 11 10.2 11 8C11 4 8 2 8 2Z"
                fill="#2563eb" opacity="0.9"/>
              <path d="M5 8C5 8 3 7 3 9C3 11 5 12 8 12"
                stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 8C11 8 13 7 13 9C13 11 11 12 8 12"
                stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{
            fontSize     : "15px",
            fontWeight   : "600",
            color        : th.textPrimary,
            letterSpacing: "-0.2px",
          }}>
            ASL Translator
          </span>
        </div>

        {/* Links */}
        <div style={{
          display       : "flex",
          alignItems    : "center",
          gap           : "2px",
          flex          : 1,
          justifyContent: "center",
          flexDirection : isRTL ? "row-reverse" : "row",
        }}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`nb-link${isActive ? " active" : ""}`}
                style={{
                  color: isActive ? th.textPrimary : th.textSecondary,
                }}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{
          display      : "flex",
          alignItems   : "center",
          gap          : "8px",
          flexShrink   : 0,
          flexDirection: isRTL ? "row-reverse" : "row",
        }}>

          {/* Theme toggle */}
          <button className="nb-theme-btn" onClick={toggleTheme}>
            {isDark ? <SunIcon /> : <MoonIcon />}
            {isDark ? t("nav_light") : t("nav_dark")}
          </button>

          {/* Separator */}
          <div style={{ width: "1px", height: "20px", background: th.border }} />

          {/* User */}
          <button className="nb-user-btn" onClick={() => navigate("/profile")}>
            <div style={{
              width         : "28px",
              height        : "28px",
              borderRadius  : "50%",
              background    : user?.photo ? "transparent" : "rgba(37,99,235,0.15)",
              border        : "1px solid rgba(37,99,235,0.25)",
              display       : "flex",
              alignItems    : "center",
              justifyContent: "center",
              fontSize      : "11px",
              fontWeight    : "600",
              color         : "#2563eb",
              overflow      : "hidden",
              flexShrink    : 0,
            }}>
              {user?.photo
                ? <img src={user.photo} alt="avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials
              }
            </div>
            <span style={{ fontSize: "13px", color: th.textPrimary, fontWeight: "500" }}>
              {user?.name}
            </span>
            <span style={{ color: th.textSecondary }}>
              <ChevronIcon />
            </span>
          </button>

          {/* Logout */}
          <button className="nb-logout" onClick={handleLogout}>
            {t("nav_logout")}
          </button>
        </div>
      </nav>
    </>
  );
}
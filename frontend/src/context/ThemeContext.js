import React, { createContext, useContext, useState, useEffect } from "react";
import { updateProfile } from "../services/api";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {

  const [theme, setTheme] = useState(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.theme || "dark";
  });

  // ─── Appliquer le thème au body ──────────────────────
  useEffect(() => {
    document.body.style.background = theme === "dark" ? "#1a1a2e" : "#f0f2f5";
    document.body.style.color      = theme === "dark" ? "white"   : "#1a1a2e";
  }, [theme]);

  // ─── Changer le thème (toggle depuis Navbar) ─────────
  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    try {
      await updateProfile({ theme: newTheme });
    } catch {
      console.error("Erreur sauvegarde thème");
    }
  };

  // ─── Changer le thème depuis Profile ─────────────────
  // Appelé quand l'utilisateur sauvegarde son profil
  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...user, theme: newTheme }));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
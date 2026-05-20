import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";

const LanguageContext = createContext();

const normalizeLanguage = (value) => {
  if (!value || typeof value !== "string") return "fr";
  const v = value.toLowerCase();
  if (v.startsWith("ar")) return "ar";
  if (v.startsWith("en")) return "en";
  if (v.startsWith("fr")) return "fr";
  return "fr";
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return normalizeLanguage(user.language);
    } catch {
      return "fr";
    }
  });

  // RTL pour l'arabe
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const applyLanguage = (lang) => {
    const normalized = normalizeLanguage(lang);
    setLanguage(normalized);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...user, language: normalized }));
    } catch {
      localStorage.setItem("user", JSON.stringify({ language: normalized }));
    }
  };

  // t("nav_home") → retourne la traduction
  const t = (key) => translations[language]?.[key] || translations["fr"][key] || key;

  return (
    <LanguageContext.Provider value={{ language, applyLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";
import { updateProfile } from "../services/api";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.language || "fr";
  });

  // RTL pour l'arabe
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const applyLanguage = (lang) => {
    setLanguage(lang);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...user, language: lang }));
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
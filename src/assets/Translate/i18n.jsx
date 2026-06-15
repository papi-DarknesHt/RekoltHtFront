import { createContext, useContext, useEffect, useMemo, useState } from "react";
import ht from "./ht.json";
import fr from "./fr.json";
import en from "./en.json";

const TranslationContext = createContext(null);

const TRANSLATIONS = { ht, fr, en };

export function TranslationProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ht");

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t(path, params) {
      const keys = path.split(".");
      let current = TRANSLATIONS[lang];
      for (const key of keys) {
        if (!current || typeof current !== "object") {
          current = undefined;
          break;
        }
        current = current[key];
      }
      if (typeof current !== "string") {
        return path;
      }
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          current = current.replace(`{${key}}`, value);
        });
      }
      return current;
    },
    languages: {
      ht: "Kreyòl Ayisyen",
      fr: "Français",
      en: "English",
    },
  }), [lang]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}

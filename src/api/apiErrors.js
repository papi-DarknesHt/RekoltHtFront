import fr from "../assets/Translate/fr.json";
import en from "../assets/Translate/en.json";
import ht from "../assets/Translate/ht.json";

const DICTIONNAIRES = { fr, en, ht };

export function traduireErreurApi(code, params) {
  if (!code) return null;
  const lang = localStorage.getItem("lang") || "ht";
  let message = DICTIONNAIRES[lang]?.apiErrors?.[code];
  if (typeof message !== "string") return null;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });
  }
  return message;
}

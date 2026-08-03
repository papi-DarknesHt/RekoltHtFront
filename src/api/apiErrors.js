import fr from "../assets/Translate/fr.json";
import en from "../assets/Translate/en.json";
import ht from "../assets/Translate/ht.json";

// traduit un error_code renvoyé par le backend (voir apiErrors.* dans les
// fichiers de traduction, et error_code sur les JsonResponse d'erreur côté
// Django) — utilisé par api/client.js, en dehors de tout composant React,
// donc pas d'accès au contexte de i18n.jsx : on relit la langue directement
// depuis localStorage (même clé que TranslationProvider) et on pioche
// directement dans les dictionnaires JSON plutôt que via useTranslation().
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

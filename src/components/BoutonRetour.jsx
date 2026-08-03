import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/BoutonRetour.css";

// bouton "Retour" générique, réutilisé dans l'en-tête de la plupart des
// pages (voir DetailProduit.jsx, MesProduits.jsx, DevenirVendeur.jsx...) —
// navigate(-1) plutôt qu'une route fixe : chaque page ayant plusieurs points
// d'entrée possibles (catalogue, accueil, profil vendeur...), revenir dans
// l'historique du navigateur reste correct quel que soit le chemin emprunté
export default function BoutonRetour({ className = "" }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={`bouton-retour ${className}`.trim()}
      onClick={() => navigate(-1)}
    >
      <ArrowLeft size={16} strokeWidth={2.2} />
      {t("common.back")}
    </button>
  );
}

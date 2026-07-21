import { MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import "../assets/CSS/ProductCard.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// Carte produit réutilisable : affiche un produit (photo ou emoji, prix,
// nom, lieu) avec des actions "Détails" / "Contacter".
export default function ProductCard({ produit, onDetails, onContact }) {
  const { t } = useTranslation();
  const { nom, lieu, prix, emoji, image } = produit;

  return (
    <div className="produit-card">
      <div className="produit-img">
        {image ? (
          <img className="produit-photo" src={image} alt={nom} loading="lazy" />
        ) : (
          <span className="produit-emoji">{emoji}</span>
        )}
        <span className="produit-prix-badge">
          {prix}
          <small>{t("home.priceSuffix")}</small>
        </span>
      </div>

      <div className="produit-info">
        <p className="produit-nom">{nom}</p>
        <p className="produit-lieu">
          <MapPin size={13} strokeWidth={2.2} />
          {lieu}
        </p>

        <div className="produit-btns">
          <button className="btn-detay" onClick={() => onDetails?.(produit)}>
            {t("home.details")}
            <ArrowUpRight size={15} strokeWidth={2.2} />
          </button>
          <button className="btn-kontakte" onClick={() => onContact?.(produit)}>
            <MessageCircle size={15} strokeWidth={2.2} />
            {t("home.contact")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { MapPin, MessageCircle, ArrowUpRight, Store } from "lucide-react";
import "../assets/CSS/ProductCard.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// Carte produit réutilisable : affiche un produit (photo ou emoji, prix,
// nom, vendeur, lieu) avec des actions "Détails" / "Contacter". `extra` :
// contenu optionnel inséré sous le lieu (ex: badge disponibilité + nombre de
// contacts sur "Mes produits", voir Produits/mesProduits.jsx) — ProductCard
// n'a pas besoin de connaître ces champs propres au contexte vendeur.
export default function ProductCard({ produit, onDetails, onContact, extra, detailsLabel, detailsIcon }) {
  const { t } = useTranslation();
  const { nom, lieu, prix, devise, emoji, image, vendeurNom } = produit;

  return (
    <div className="produit-card">
      <div className="produit-img">
        {image ? (
          <img className="produit-photo" src={image} alt={nom} loading="lazy" />
        ) : (
          <span className="produit-emoji">{emoji || "🌾"}</span>
        )}
        {prix != null && (
          <span className="produit-prix-badge">
            {prix}
            <small>{devise ? ` ${devise}` : t("home.priceSuffix")}</small>
          </span>
        )}
      </div>

      <div className="produit-info">
        <p className="produit-nom">{nom}</p>
        {vendeurNom && (
          <p className="produit-vendeur">
            <Store size={13} strokeWidth={2.2} />
            {vendeurNom}
          </p>
        )}
        <p className="produit-lieu">
          <MapPin size={13} strokeWidth={2.2} />
          {lieu}
        </p>

        {extra}

        <div className="produit-btns">
          <button className="btn-detay" onClick={() => onDetails?.(produit)}>
            {detailsLabel || t("home.details")}
            {detailsIcon || <ArrowUpRight size={15} strokeWidth={2.2} />}
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

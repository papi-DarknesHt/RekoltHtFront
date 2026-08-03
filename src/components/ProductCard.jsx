import { Link, useNavigate } from "react-router-dom";
import { MapPin, MessageCircle, ArrowUpRight, Store, Phone } from "lucide-react";
import "../assets/CSS/ProductCard.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { construireLienWhatsApp, construireMessageWhatsApp, normaliserNumeroWhatsApp } from "../utils/whatsapp.js";
import StarRating from "./StarRating.jsx";
import logoSite from "../assets/Images/Asset5.svg";

// glyphe générique "contact via messagerie téléphonique" (pas le logo
// WhatsApp officiel) — couleur de marque reconnaissable, sans reproduire
// l'asset propriétaire
function IconeWhatsApp({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18a7.94 7.94 0 0 1-4.06-1.11l-.29-.17-3.01.79.8-2.93-.19-.3A7.95 7.95 0 1 1 12 20Zm4.36-5.96c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14 0-.3-.02-.46-.02-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

// Carte produit réutilisable : affiche un produit (photo, ou logo du site en
// repli si le produit n'en a aucune — voir versProduitAffiche dans les pages
// appelantes) avec des actions "Détails" / "Contacter" / "Appeler" /
// "WhatsApp". Les trois actions de contact sont masquées d'un seul coup si
// `utilisateurId` correspond à `produit.vendeurId` : un vendeur ne doit
// jamais pouvoir se contacter lui-même (message interne, appel ou WhatsApp)
// sur son propre produit, quelle que soit la page (catalogue, accueil,
// fiche détail...). `extra` : contenu optionnel inséré sous le lieu (ex:
// badge disponibilité + nombre de contacts sur "Mes produits", voir
// Produits/mesProduits.jsx).
export default function ProductCard({ produit, onDetails, onContact, onWhatsapp, utilisateurId, extra, detailsLabel, detailsIcon }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { nom, lieu, prix, devise, image, vendeurNom, description, vendeurTelephone, vendeurId, noteMoyenne, nombreAvis } = produit;

  const estMonProduit = utilisateurId != null && vendeurId != null && String(vendeurId) === String(utilisateurId);
  // un visiteur non connecté doit d'abord se connecter avant de pouvoir
  // contacter un vendeur, quel que soit le moyen (message, appel, WhatsApp) —
  // voir Produits/views/produitsViews.py::contacterProduit, qui refuse
  // désormais toute requête anonyme
  const estConnecte = utilisateurId != null;

  const lienProduit = typeof window !== "undefined" ? `${window.location.origin}/produits/detail?id=${produit.id}` : "";
  const lienWhatsApp = !estMonProduit && estConnecte && vendeurTelephone
    ? construireLienWhatsApp(vendeurTelephone, construireMessageWhatsApp(t, { nom, description, prix, devise, lieu, lien: lienProduit }))
    : null;
  const numeroAppel = !estMonProduit && estConnecte ? normaliserNumeroWhatsApp(vendeurTelephone) : null;
  const demanderConnexionPourContacter = !estMonProduit && !estConnecte && !!vendeurTelephone;
  const peutContacter = !estMonProduit && !!onContact;

  return (
    <div className="produit-card">
      <div className="produit-img">
        {image ? (
          <img className="produit-photo" src={image} alt={nom} loading="lazy" />
        ) : (
          <img className="produit-photo produit-photo--logo" src={logoSite} alt={nom} loading="lazy" />
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
        {nombreAvis > 0 && (
          <p className="produit-note">
            <StarRating note={noteMoyenne} />
            <span className="produit-note__compte">({nombreAvis})</span>
          </p>
        )}
        {vendeurNom && (
          <p className="produit-vendeur">
            <Store size={13} strokeWidth={2.2} />
            {vendeurId != null ? (
              <Link
                to={`/vendeur/detail?id=${vendeurId}`}
                className="produit-vendeur__lien"
                onClick={(e) => e.stopPropagation()}
              >
                {vendeurNom}
              </Link>
            ) : vendeurNom}
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
          {peutContacter && (
            <button
              className="btn-kontakte"
              onClick={() => onContact(produit)}
              title={t("home.contact")}
              aria-label={t("home.contact")}
            >
              <MessageCircle size={15} strokeWidth={2.2} />
            </button>
          )}
          {numeroAppel && (
            <a
              className="btn-appel"
              href={`tel:+${numeroAppel}`}
              title={t("productDetail.call")}
              aria-label={t("productDetail.call")}
            >
              <Phone size={15} strokeWidth={2.2} />
            </a>
          )}
          {lienWhatsApp && (
            <a
              className="btn-whatsapp"
              href={lienWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              title={t("home.contactWhatsapp")}
              aria-label={t("home.contactWhatsapp")}
              onClick={() => onWhatsapp?.(produit)}
            >
              <IconeWhatsApp size={16} />
            </a>
          )}
          {demanderConnexionPourContacter && (
            <>
              <button
                type="button"
                className="btn-appel"
                onClick={() => navigate("/auth")}
                title={t("productDetail.call")}
                aria-label={t("productDetail.call")}
              >
                <Phone size={15} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="btn-whatsapp"
                onClick={() => navigate("/auth")}
                title={t("home.contactWhatsapp")}
                aria-label={t("home.contactWhatsapp")}
              >
                <IconeWhatsApp size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, MessageCircle, Plus, CheckCircle2, XCircle, Pencil } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import VendeurTabs from "./VendeurTabs.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/MesProduits.css";

// Convertit un produit tel que renvoyé par l'API (voir _serialiseProduit,
// Produits/views/produitsViews.py) au format attendu par ProductCard.jsx
function versProduitAffiche(p, texteNonPrecise) {
  return {
    id: p.id,
    nom: p.nom,
    lieu: [p.commune, p.departement].filter(Boolean).join(", ") || p.region || texteNonPrecise,
    prix: p.prix,
    devise: p.unitePrix,
    image: p.photos?.[0]?.url_photo || null,
  };
}

export default function MesProduits() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const produitEvent = useGlobalStore((s) => s.produitEvent);

  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    ProduitsApi.mesProduits()
      .then((res) => setProduits(res.produits || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend) : le compteur
  // nombre_contacts (et la disponibilité) se met à jour sans rechargement —
  // filtré à ce vendeur, produitEvent diffuse les produits de tout le monde
  useEffect(() => {
    if (!produitEvent) return;
    const { type, data } = produitEvent;
    if (data.vendeur_id !== undefined && data.vendeur_id !== utilisateur?.id) return;
    setProduits((liste) => {
      if (type === "produit.deleted") {
        return liste.filter((p) => p.id !== data.id);
      }
      const existe = liste.some((p) => p.id === data.id);
      return existe
        ? liste.map((p) => (p.id === data.id ? { ...p, ...data } : p))
        : liste;
    });
  }, [produitEvent, utilisateur?.id]);

  const totalContacts = produits.reduce((somme, p) => somme + (p.nombre_contacts || 0), 0);
  const totalDisponibles = produits.filter((p) => p.est_disponible).length;

  return (
    <div className="mp-page">
      <NavBar />

      <div className="mp-container">
        <BoutonRetour />
        <VendeurTabs />

        <div className="mp-header">
          <div className="mp-header__icon"><Package size={22} /></div>
          <div className="mp-header__texte">
            <h1 className="mp-header__title">{t("myProducts.title")}</h1>
            <p className="mp-header__subtitle">{t("myProducts.subtitle")}</p>
          </div>
          <button className="mp-btn mp-btn--primary" onClick={() => navigate("/produits/ajouter")}>
            <Plus size={16} />
            {t("myProducts.addProduct")}
          </button>
        </div>

        {chargement && <p className="mp-hint">{t("profile.loading")}</p>}
        {!chargement && erreur && <p className="mp-alert mp-alert--error">{erreur}</p>}

        {!chargement && !erreur && (
          <>
            <div className="mp-stats">
              <div className="mp-stat">
                <p className="mp-stat__value">{produits.length}</p>
                <p className="mp-stat__label">{t("myProducts.totalProducts")}</p>
              </div>
              <div className="mp-stat">
                <p className="mp-stat__value">{totalDisponibles}</p>
                <p className="mp-stat__label">{t("myProducts.availableProducts")}</p>
              </div>
              <div className="mp-stat">
                <p className="mp-stat__value">{totalContacts}</p>
                <p className="mp-stat__label">{t("myProducts.totalContacts")}</p>
              </div>
            </div>

            {produits.length === 0 ? (
              <div className="mp-card mp-empty">
                <p className="mp-hint">{t("myProducts.noProducts")}</p>
                <button className="mp-btn mp-btn--primary" onClick={() => navigate("/produits/ajouter")}>
                  <Plus size={16} />
                  {t("myProducts.addProduct")}
                </button>
              </div>
            ) : (
              <div className="mp-grid">
                {produits.map((p) => (
                  <ProductCard
                    key={p.id}
                    produit={versProduitAffiche(p, t("profile.notSpecified"))}
                    extra={
                      <div className="mp-card-extra">
                        <span className={`mp-badge ${p.est_disponible ? "mp-badge--dispo" : "mp-badge--indispo"}`}>
                          {p.est_disponible ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {p.est_disponible ? t("myProducts.available") : t("myProducts.unavailable")}
                        </span>
                        <span className="mp-contacts">
                          <MessageCircle size={14} />
                          {p.nombre_contacts || 0} {t("myProducts.contactsLabel")}
                        </span>
                      </div>
                    }
                    onDetails={(pr) => navigate(`/produits/modifier?id=${pr.id}`)}
                    detailsLabel={t("myProducts.editProduct")}
                    detailsIcon={<Pencil size={15} strokeWidth={2.2} />}
                    utilisateurId={utilisateur?.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

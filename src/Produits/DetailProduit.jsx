import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, MessageCircle, Store, BadgeCheck, CalendarDays, Package, Sprout, Phone } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/DetailProduit.css";

// même conversion que afficherProduits.jsx/HomePage.jsx (voir _serialiseProduit,
// Produits/views/produitsViews.py) pour réutiliser ProductCard dans les
// sections "produits similaires"
function versProduitAffiche(p, texteNonPrecise) {
  return {
    id: p.id,
    nom: p.nom,
    vendeurId: p.vendeur_id,
    vendeurNom: p.vendeur_nom,
    lieu: [p.commune, p.departement].filter(Boolean).join(", ") || p.region || texteNonPrecise,
    prix: p.prix,
    devise: p.unitePrix,
    image: p.photos?.[0]?.url_photo || null,
  };
}

export default function DetailProduit() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const isConnected = useAuthStore((s) => s.isConnected);
  const produitEvent = useGlobalStore((s) => s.produitEvent);

  const [produit, setProduit] = useState(null);
  const [vendeur, setVendeur] = useState(null);
  const [produitsVendeur, setProduitsVendeur] = useState([]);
  const [produitsSimilaires, setProduitsSimilaires] = useState([]);
  const [photoActive, setPhotoActive] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [messageContact, setMessageContact] = useState(null);

  useEffect(() => {
    if (!id) {
      // clé de traduction stockée telle quelle, résolue au rendu (voir
      // t(erreur) plus bas) — évite de dépendre de `t` dans cet effet
      setErreur("productDetail.missingId");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);
    setPhotoActive(0);

    ProduitsApi.detailProduit(id)
      .then((res) => {
        const p = res.produit;
        setProduit(p);

        const sousCategorieId = p.sous_categorie?.id;
        Promise.all([
          ProduitsApi.infoVendeur(p.vendeur_id).catch(() => null),
          ProduitsApi.listerProduits({ vendeur_id: p.vendeur_id, exclure_id: p.id, disponible: "true" }).catch(() => ({ produits: [] })),
          sousCategorieId
            ? ProduitsApi.listerProduits({ sous_categorie_id: sousCategorieId, exclure_id: p.id, disponible: "true" }).catch(() => ({ produits: [] }))
            : ProduitsApi.listerProduits({ categorie_id: p.categorie.id, exclure_id: p.id, disponible: "true" }).catch(() => ({ produits: [] })),
        ]).then(([venRes, memeVendeurRes, similairesRes]) => {
          setVendeur(venRes?.vendeur || null);
          setProduitsVendeur(memeVendeurRes.produits || []);
          setProduitsSimilaires(similairesRes.produits || []);
        });
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, [id]);

  // réactivité temps réel (voir Produits/signals.py côté backend) : si ce
  // produit est modifié/rendu indisponible/supprimé par son vendeur pendant
  // la consultation, la fiche reflète le changement sans rechargement
  useEffect(() => {
    if (!produitEvent || !produit) return;
    const { type, data } = produitEvent;
    if (data.id !== produit.id) return;
    if (type === "produit.deleted") {
      setErreur("productDetail.noLongerAvailable");
      setProduit(null);
      return;
    }
    setProduit((p) => (p ? { ...p, ...data } : p));
  }, [produitEvent, produit]);

  // partagé entre le produit principal (vendeurId/id directs) et les cartes
  // des sections "produits similaires" (format ProductCard, voir versProduitAffiche)
  const contacterVendeur = (vendeurId, produitId) => {
    ProduitsApi.contacterProduit(produitId).catch(() => {});
    if (isConnected) {
      navigate(`/messages?avec=${vendeurId}&produit=${produitId}`);
      return;
    }
    setMessageContact(t("home.contactRecorded"));
    setTimeout(() => setMessageContact(null), 3000);
  };

  const voirDetail = (p) => navigate(`/produits/detail?id=${p.id}`);

  const photos = produit?.photos || [];
  const lieu = produit
    ? [produit.commune, produit.departement].filter(Boolean).join(", ") || produit.region || t("profile.notSpecified")
    : "";

  const produitsVendeurAffiches = produitsVendeur.map((p) => versProduitAffiche(p, t("profile.notSpecified")));
  const produitsSimilairesAffiches = produitsSimilaires.map((p) => versProduitAffiche(p, t("profile.notSpecified")));

  return (
    <div className="pd-page">
      <NavBar />

      <div className="pd-container">
        {chargement && <p className="pd-hint">{t("home.loadingProducts")}</p>}
        {!chargement && erreur && <p className="pd-alert pd-alert--error">{t(erreur)}</p>}

        {!chargement && !erreur && produit && (
          <>
            <div className="pd-main">
              <div className="pd-gallery">
                <div className="pd-gallery__main">
                  {photos.length > 0 ? (
                    <img src={photos[photoActive]?.url_photo} alt={produit.nom} />
                  ) : (
                    <span className="pd-gallery__emoji"><Sprout size={48} /></span>
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="pd-gallery__thumbs">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        className={`pd-gallery__thumb ${index === photoActive ? "pd-gallery__thumb--active" : ""}`}
                        onClick={() => setPhotoActive(index)}
                      >
                        <img src={photo.url_photo} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pd-info">
                {produit.sous_categorie && <span className="pd-badge">{produit.sous_categorie.nom}</span>}
                <h1 className="pd-title">{produit.nom}</h1>

                <p className="pd-price">
                  {produit.prix != null ? (
                    <>
                      {produit.prix} <small>{produit.unitePrix}{produit.unite_De_Mesure ? ` / ${produit.unite_De_Mesure}` : ""}</small>
                    </>
                  ) : (
                    t("productDetail.priceOnRequest")
                  )}
                </p>

                <span className={`pd-availability ${produit.est_disponible ? "pd-availability--yes" : "pd-availability--no"}`}>
                  {produit.est_disponible ? t("myProducts.available") : t("myProducts.unavailable")}
                </span>

                {produit.description && <p className="pd-description">{produit.description}</p>}

                <p className="pd-meta">
                  <MapPin size={15} />
                  {[lieu, produit.adresse].filter(Boolean).join(" — ")}
                </p>

                <div className="pd-actions">
                  <button className="pd-contact-btn" onClick={() => contacterVendeur(produit.vendeur_id, produit.id)}>
                    <MessageCircle size={16} />
                    {t("home.contact")}
                  </button>
                  {vendeur?.telephone && (
                    <a className="pd-call-btn" href={`tel:${vendeur.telephone}`}>
                      <Phone size={16} />
                      {t("productDetail.call")}
                    </a>
                  )}
                </div>
                {messageContact && <p className="pd-alert pd-alert--succes">{messageContact}</p>}
              </div>
            </div>

            {vendeur && (
              <div className="pd-seller">
                <div className="pd-seller__avatar">
                  {vendeur.photo ? <img src={vendeur.photo} alt={vendeur.nom} /> : <Store size={22} />}
                </div>
                <div className="pd-seller__body">
                  <p className="pd-seller__nom">
                    {vendeur.nom}
                    {vendeur.est_entreprise && (
                      <span className="pd-seller__badge"><BadgeCheck size={14} />{t("productDetail.company")}</span>
                    )}
                  </p>
                  {vendeur.bio && <p className="pd-seller__bio">{vendeur.bio}</p>}
                  <div className="pd-seller__infos">
                    {(vendeur.commune || vendeur.pays) && (
                      <span><MapPin size={13} />{[vendeur.commune, vendeur.pays].filter(Boolean).join(", ")}</span>
                    )}
                    {vendeur.telephone && (
                      <span><Phone size={13} />{vendeur.telephone}</span>
                    )}
                    <span><CalendarDays size={13} />{t("productDetail.memberSince", { date: new Date(vendeur.date_inscription).toLocaleDateString() })}</span>
                    <span><Package size={13} />{t("productDetail.sellerProductCount", { nombre: vendeur.nombre_produits })}</span>
                  </div>
                </div>
              </div>
            )}

            {produitsVendeurAffiches.length > 0 && (
              <section className="pd-section">
                <h2 className="pd-section__title">{t("productDetail.sameSeller")}</h2>
                <div className="pd-grid">
                  {produitsVendeurAffiches.map((p) => (
                    <ProductCard
                      key={p.id}
                      produit={p}
                      onDetails={voirDetail}
                      onContact={(pr) => contacterVendeur(pr.vendeurId, pr.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {produitsSimilairesAffiches.length > 0 && (
              <section className="pd-section">
                <h2 className="pd-section__title">{t("productDetail.similarProducts")}</h2>
                <div className="pd-grid">
                  {produitsSimilairesAffiches.map((p) => (
                    <ProductCard
                      key={p.id}
                      produit={p}
                      onDetails={voirDetail}
                      onContact={(pr) => contacterVendeur(pr.vendeurId, pr.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

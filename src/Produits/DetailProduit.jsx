import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { MapPin, MessageCircle, Store, BadgeCheck, CalendarDays, Package, Phone, Flag, X, Star, Trash2 } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import StarRating from "../components/StarRating.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import logoSite from "../assets/Images/Asset5.svg";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import { useConfirmStore } from "../api/confirmStore.js";
import { construireLienWhatsApp, construireMessageWhatsApp } from "../utils/whatsapp.js";
import "../assets/CSS/DetailProduit.css";

const TYPES_PROBLEME = ["information_incorrecte", "produit_obsolete", "contenu_inapproprie", "autre"];
const TYPES_PROBLEME_AVIS = ["contenu_inapproprie", "faux_avis", "hors_sujet", "autre"];

// même conversion que afficherProduits.jsx/HomePage.jsx (voir _serialiseProduit,
// Produits/views/produitsViews.py) pour réutiliser ProductCard dans les
// sections "produits similaires"
function versProduitAffiche(p, texteNonPrecise) {
  return {
    id: p.id,
    nom: p.nom,
    description: p.description,
    vendeurId: p.vendeur_id,
    vendeurNom: p.vendeur_nom,
    vendeurTelephone: p.vendeur_telephone,
    noteMoyenne: p.note_moyenne,
    nombreAvis: p.nombre_avis,
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
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const avisEvent = useGlobalStore((s) => s.avisEvent);
  const demanderConfirmation = useConfirmStore((s) => s.demander);

  const [produit, setProduit] = useState(null);
  const [vendeur, setVendeur] = useState(null);
  const [produitsVendeur, setProduitsVendeur] = useState([]);
  const [produitsSimilaires, setProduitsSimilaires] = useState([]);
  const [photoActive, setPhotoActive] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  // signalement d'un produit incorrect/obsolète OU d'un avis — transmis
  // directement aux admins (jamais au vendeur/auteur concerné), réservé aux
  // comptes connectés (voir Produits/views/signalementsViews.py::
  // signalerProduit/signalerAvis). Un seul jeu d'états/modale pour les deux
  // cibles : signalementCible = { type: "produit"|"avis", id }.
  const [signalementCible, setSignalementCible] = useState(null);
  const [signalementForm, setSignalementForm] = useState({ type_probleme: "", motif: "" });
  const [signalementEnCours, setSignalementEnCours] = useState(false);
  const [signalementErreur, setSignalementErreur] = useState(null);
  const [signalementEnvoye, setSignalementEnvoye] = useState(false);

  // avis (note + commentaire) — voir Produits/views/avisViews.py. Un seul
  // avis par (produit, auteur) : soumettre à nouveau modifie celui déjà posé
  // (avisForm est pré-rempli avec l'avis existant du compte connecté, s'il y en a un)
  const [avis, setAvis] = useState([]);
  const [avisForm, setAvisForm] = useState({ note: 0, commentaire: "" });
  const [avisEnCours, setAvisEnCours] = useState(false);
  const [avisErreur, setAvisErreur] = useState(null);
  const [suppressionAvisEnCoursId, setSuppressionAvisEnCoursId] = useState(null);

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
          ProduitsApi.listerAvisProduit(p.id).catch(() => ({ avis: [] })),
        ]).then(([venRes, memeVendeurRes, similairesRes, avisRes]) => {
          setVendeur(venRes?.vendeur || null);
          setProduitsVendeur(memeVendeurRes.produits || []);
          setProduitsSimilaires(similairesRes.produits || []);
          setAvis(avisRes.avis || []);
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

  // réactivité temps réel des avis (voir Produits/signals.py côté backend,
  // groupe "global") — note_moyenne/nombre_avis du produit se mettent aussi
  // à jour automatiquement via produitEvent ci-dessus (même broadcast)
  useEffect(() => {
    if (!avisEvent || !produit) return;
    const { type, data } = avisEvent;
    if (data.produit_id !== produit.id) return;
    if (type === "avis.deleted") {
      setAvis((liste) => liste.filter((a) => a.id !== data.id));
      return;
    }
    setAvis((liste) => (liste.some((a) => a.id === data.id) ? liste.map((a) => (a.id === data.id ? data : a)) : [data, ...liste]));
  }, [avisEvent, produit]);

  // pré-remplit le formulaire avec l'avis déjà posé par ce compte, s'il existe
  useEffect(() => {
    if (!utilisateur) return;
    const monAvis = avis.find((a) => a.auteur_id === utilisateur.id);
    if (monAvis) setAvisForm({ note: monAvis.note, commentaire: monAvis.commentaire });
  }, [avis, utilisateur]);

  // partagé entre le produit principal (vendeurId/id directs) et les cartes
  // des sections "produits similaires" (format ProductCard, voir versProduitAffiche) —
  // un visiteur non connecté est redirigé vers la connexion plutôt que de
  // pouvoir contacter le vendeur
  const contacterVendeur = (vendeurId, produitId) => {
    if (!isConnected) {
      navigate("/auth");
      return;
    }
    ProduitsApi.contacterProduit(produitId).catch(() => {});
    navigate(`/messages?avec=${vendeurId}&produit=${produitId}`);
  };

  // le clic ouvre directement WhatsApp (lien <a>, voir ProductCard.jsx et le
  // bouton WhatsApp de la fiche principale ci-dessous) — ici on ne fait
  // qu'enregistrer le contact pour les stats du vendeur
  const contacterViaWhatsapp = (produitId) => {
    ProduitsApi.contacterProduit(produitId).catch(() => {});
  };

  const voirDetail = (p) => navigate(`/produits/detail?id=${p.id}`);

  const ouvrirSignalement = (cible) => {
    setSignalementForm({ type_probleme: "", motif: "" });
    setSignalementErreur(null);
    setSignalementEnvoye(false);
    setSignalementCible(cible);
  };

  const soumettreSignalement = async (e) => {
    e.preventDefault();
    if (!signalementForm.type_probleme) {
      setSignalementErreur(t("productDetail.reportTypeRequired"));
      return;
    }
    if (!signalementForm.motif.trim()) {
      setSignalementErreur(t("productDetail.reportReasonRequired"));
      return;
    }
    setSignalementEnCours(true);
    setSignalementErreur(null);
    try {
      if (signalementCible.type === "avis") {
        await ProduitsApi.signalerAvis(signalementCible.id, signalementForm.type_probleme, signalementForm.motif.trim());
      } else {
        await ProduitsApi.signalerProduit(signalementCible.id, signalementForm.type_probleme, signalementForm.motif.trim());
      }
      setSignalementEnvoye(true);
    } catch (err) {
      setSignalementErreur(err.message);
    } finally {
      setSignalementEnCours(false);
    }
  };

  const soumettreAvis = async (e) => {
    e.preventDefault();
    if (!avisForm.note) {
      setAvisErreur(t("productDetail.reviewRatingRequired"));
      return;
    }
    const modifieUnAvisExistant = avis.some((a) => a.auteur_id === utilisateur?.id);
    if (modifieUnAvisExistant && !(await demanderConfirmation(t("productDetail.reviewEditConfirm")))) return;
    setAvisEnCours(true);
    setAvisErreur(null);
    try {
      await ProduitsApi.creerModifierAvis(produit.id, avisForm.note, avisForm.commentaire.trim());
      // le WS avis.created/avis.updated (groupe "global") patchera la liste —
      // pas besoin de le faire ici, y compris pour ce même onglet
    } catch (err) {
      setAvisErreur(err.message);
    } finally {
      setAvisEnCours(false);
    }
  };

  const supprimerMonAvis = async (avisId) => {
    if (!(await demanderConfirmation(t("productDetail.reviewDeleteConfirm"), { danger: true }))) return;
    setSuppressionAvisEnCoursId(avisId);
    setAvisErreur(null);
    try {
      await ProduitsApi.supprimerAvis(avisId);
      setAvisForm({ note: 0, commentaire: "" });
    } catch (err) {
      setAvisErreur(err.message);
    } finally {
      setSuppressionAvisEnCoursId(null);
    }
  };

  const photos = produit?.photos || [];
  const lieu = produit
    ? [produit.commune, produit.departement].filter(Boolean).join(", ") || produit.region || t("profile.notSpecified")
    : "";

  // un vendeur consultant sa propre fiche ne doit pas pouvoir se contacter
  // lui-même (message interne, appel ou WhatsApp) — voir aussi ProductCard.jsx
  const estMonProduit = !!produit && !!utilisateur && String(produit.vendeur_id) === String(utilisateur.id);

  // un visiteur non connecté doit d'abord se connecter avant de pouvoir
  // contacter un vendeur (message, appel ou WhatsApp) — voir aussi
  // ProductCard.jsx et Produits/views/produitsViews.py::contacterProduit
  const lienWhatsApp = produit && vendeur?.telephone && !estMonProduit && isConnected
    ? construireLienWhatsApp(vendeur.telephone, construireMessageWhatsApp(t, {
        nom: produit.nom,
        description: produit.description,
        prix: produit.prix,
        devise: produit.unitePrix,
        lieu,
        lien: typeof window !== "undefined" ? window.location.href : "",
      }))
    : null;

  const produitsVendeurAffiches = produitsVendeur.map((p) => versProduitAffiche(p, t("profile.notSpecified")));
  const produitsSimilairesAffiches = produitsSimilaires.map((p) => versProduitAffiche(p, t("profile.notSpecified")));

  return (
    <div className="pd-page">
      <NavBar />

      <div className="pd-container">
        <BoutonRetour />
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
                    <img className="pd-gallery__logo" src={logoSite} alt={produit.nom} />
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

                {produit.nombre_avis > 0 && (
                  <p className="produit-note">
                    <StarRating note={produit.note_moyenne} taille={15} />
                    <span className="produit-note__compte">
                      {t("productDetail.ratingCount", { note: produit.note_moyenne, nombre: produit.nombre_avis })}
                    </span>
                  </p>
                )}

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
                  {!estMonProduit && (
                    <button className="pd-contact-btn" onClick={() => contacterVendeur(produit.vendeur_id, produit.id)}>
                      <MessageCircle size={16} />
                      {t("home.contact")}
                    </button>
                  )}
                  {vendeur?.telephone && !estMonProduit && (
                    isConnected ? (
                      <a className="pd-call-btn" href={`tel:${vendeur.telephone}`}>
                        <Phone size={16} />
                        {t("productDetail.call")}
                      </a>
                    ) : (
                      <button type="button" className="pd-call-btn" onClick={() => navigate("/auth")}>
                        <Phone size={16} />
                        {t("productDetail.call")}
                      </button>
                    )
                  )}
                  {lienWhatsApp && (
                    <a
                      className="pd-whatsapp-btn"
                      href={lienWhatsApp}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => contacterViaWhatsapp(produit.id)}
                    >
                      {t("home.contactWhatsapp")}
                    </a>
                  )}
                  {!lienWhatsApp && !isConnected && vendeur?.telephone && !estMonProduit && (
                    <button type="button" className="pd-whatsapp-btn" onClick={() => navigate("/auth")}>
                      {t("home.contactWhatsapp")}
                    </button>
                  )}
                </div>

                {!estMonProduit && (
                  <button type="button" className="pd-report-trigger" onClick={() => ouvrirSignalement({ type: "produit", id: produit.id })}>
                    <Flag size={13} />
                    {t("productDetail.reportProduct")}
                  </button>
                )}
              </div>
            </div>

            {vendeur && (
              <div className="pd-seller">
                <div className="pd-seller__avatar">
                  {vendeur.photo ? <img src={vendeur.photo} alt={vendeur.nom} /> : <Store size={22} />}
                </div>
                <div className="pd-seller__body">
                  <p className="pd-seller__nom">
                    <Link to={`/vendeur/detail?id=${vendeur.id}`} className="pd-seller__lien">{vendeur.nom}</Link>
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
                  <Link to={`/vendeur/detail?id=${vendeur.id}`} className="pd-seller__voir-profil">
                    {t("productDetail.viewFullProfile")}
                  </Link>
                </div>
              </div>
            )}

            <section className="pd-section">
              <h2 className="pd-section__title">{t("productDetail.reviewsTitle", { nombre: avis.length })}</h2>

              {!estMonProduit && (
                <div className="pd-avis-form">
                  {!isConnected ? (
                    <p className="pd-modal__texte">{t("productDetail.reviewRequiresLogin")}</p>
                  ) : (
                    <form onSubmit={soumettreAvis}>
                      <div className="pd-avis-form__etoiles">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="pd-avis-form__etoile-btn"
                            onClick={() => setAvisForm((f) => ({ ...f, note: n }))}
                            aria-label={`${n}/5`}
                          >
                            <Star size={22} strokeWidth={1.5} fill={n <= avisForm.note ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="rk-input pd-modal__textarea"
                        value={avisForm.commentaire}
                        onChange={(e) => setAvisForm((f) => ({ ...f, commentaire: e.target.value }))}
                        placeholder={t("productDetail.reviewCommentPlaceholder")}
                      />
                      {avisErreur && <p className="rk-error">✗ {avisErreur}</p>}
                      <button type="submit" className="rk-btn" disabled={avisEnCours} style={{ maxWidth: "220px" }}>
                        {avisEnCours ? t("seller.saving") : t("productDetail.reviewSubmit")}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {avis.length === 0 ? (
                <p className="pd-hint">{t("productDetail.noReviews")}</p>
              ) : (
                <ul className="pd-avis-liste">
                  {avis.map((a) => (
                    <li className="pd-avis-item" key={a.id}>
                      <div className="pd-avis-item__entete">
                        <StarRating note={a.note} taille={14} />
                        <span className="pd-avis-item__auteur">{a.auteur_nom || t("profile.notSpecified")}</span>
                        <span className="pd-avis-item__date">{new Date(a.date_avis).toLocaleDateString()}</span>
                        {a.auteur_id === utilisateur?.id ? (
                          <button
                            type="button"
                            className="pd-avis-item__supprimer"
                            disabled={suppressionAvisEnCoursId === a.id}
                            onClick={() => supprimerMonAvis(a.id)}
                            aria-label={t("productDetail.reviewDelete")}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          isConnected && (
                            <button
                              type="button"
                              className="pd-avis-item__supprimer"
                              onClick={() => ouvrirSignalement({ type: "avis", id: a.id })}
                              aria-label={t("productDetail.reportReview")}
                              title={t("productDetail.reportReview")}
                            >
                              <Flag size={14} />
                            </button>
                          )
                        )}
                      </div>
                      {a.commentaire && <p className="pd-avis-item__texte">{a.commentaire}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

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
                      onWhatsapp={(pr) => contacterViaWhatsapp(pr.id)}
                      utilisateurId={utilisateur?.id}
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
                      onWhatsapp={(pr) => contacterViaWhatsapp(pr.id)}
                      utilisateurId={utilisateur?.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {signalementCible && (
        <div className="pd-modal-overlay" onClick={() => setSignalementCible(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__entete">
              <h3><Flag size={16} />{t(signalementCible.type === "avis" ? "productDetail.reportReview" : "productDetail.reportProduct")}</h3>
              <button type="button" className="pd-modal__fermer" onClick={() => setSignalementCible(null)} aria-label={t("admin.dashboard.cancel")}>
                <X size={18} />
              </button>
            </div>

            {!isConnected ? (
              <>
                <p className="pd-modal__texte">{t("productDetail.reportRequiresLogin")}</p>
                <button type="button" className="rk-btn" onClick={() => navigate("/auth")}>
                  {t("seller.goToLogin")}
                </button>
              </>
            ) : signalementEnvoye ? (
              <p className="pd-modal__texte">{t("productDetail.reportSent")}</p>
            ) : (
              <form onSubmit={soumettreSignalement}>
                <p className="pd-modal__texte">{t("productDetail.reportIntro")}</p>
                <div className="rk-field">
                  <label className="rk-label">{t("productDetail.reportTypeLabel")}</label>
                  <select
                    className="rk-select"
                    value={signalementForm.type_probleme}
                    onChange={(e) => setSignalementForm((f) => ({ ...f, type_probleme: e.target.value }))}
                  >
                    <option value="">— {t("productDetail.reportTypeLabel")} —</option>
                    {(signalementCible.type === "avis" ? TYPES_PROBLEME_AVIS : TYPES_PROBLEME).map((type) => (
                      <option key={type} value={type}>
                        {t(`admin.dashboard.${signalementCible.type === "avis" ? "reportAvisType" : "reportType"}.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("productDetail.reportReasonLabel")}</label>
                  <textarea
                    className="rk-input pd-modal__textarea"
                    value={signalementForm.motif}
                    onChange={(e) => setSignalementForm((f) => ({ ...f, motif: e.target.value }))}
                    placeholder={t("productDetail.reportReasonPlaceholder")}
                  />
                </div>
                {signalementErreur && <p className="rk-error">✗ {signalementErreur}</p>}
                <button type="submit" className="rk-btn" disabled={signalementEnCours}>
                  {signalementEnCours ? t("seller.saving") : t("productDetail.reportSubmit")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

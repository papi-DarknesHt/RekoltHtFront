import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { MapPin, Store, BadgeCheck, CalendarDays, Package, Phone, MessageCircle, Flag, X } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import { applyListEvent } from "../api/applyListEvent.js";
import { formaterLocalisationProduit } from "../utils/localisationProduit.js";
import "../assets/CSS/DetailProduit.css";

const TYPES_PROBLEME_VENDEUR = ["arnaque_fraude", "produits_non_conformes", "comportement_inapproprie", "non_reponse", "autre"];

// même conversion que DetailProduit.jsx/afficherProduits.jsx (voir
// _serialiseProduit, Produits/views/produitsViews.py)
function versProduitAffiche(p, texteNonPrecise, texteHaiti) {
  return {
    id: p.id,
    nom: p.nom,
    description: p.description,
    vendeurId: p.vendeur_id,
    vendeurNom: p.vendeur_nom,
    vendeurTelephone: p.vendeur_telephone,
    noteMoyenne: p.note_moyenne,
    nombreAvis: p.nombre_avis,
    lieu: formaterLocalisationProduit(p, texteHaiti) || texteNonPrecise,
    prix: p.prix,
    devise: p.unitePrix,
    image: p.photos?.[0]?.url_photo || null,
  };
}

export default function ProfilVendeur() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const isConnected = useAuthStore((s) => s.isConnected);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const profilEvent = useGlobalStore((s) => s.profilEvent);
  const utilisateurEvent = useGlobalStore((s) => s.utilisateurEvent);

  const [vendeur, setVendeur] = useState(null);
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  // true si l'erreur vient d'un compte bloqué (voir Utilisateur.bloquer,
  // Registration/models.py) — affiche un renvoi vers "Contacter admin"
  // plutôt qu'une simple erreur générique
  const [accesRestreint, setAccesRestreint] = useState(false);

  // signalement du vendeur — même principe que le signalement produit de
  // DetailProduit.jsx (modal, transmis directement aux admins)
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [signalementForm, setSignalementForm] = useState({ type_probleme: "", motif: "" });
  const [signalementEnCours, setSignalementEnCours] = useState(false);
  const [signalementErreur, setSignalementErreur] = useState(null);
  const [signalementEnvoye, setSignalementEnvoye] = useState(false);

  useEffect(() => {
    if (!id) {
      setErreur("productDetail.missingId");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);
    setAccesRestreint(false);

    Promise.all([
      ProduitsApi.infoVendeur(id),
      ProduitsApi.listerProduits({ vendeur_id: id, disponible: "true" }),
    ])
      .then(([venRes, produitsRes]) => {
        setVendeur(venRes.vendeur);
        setProduits(produitsRes.produits || []);
      })
      .catch((err) => {
        setErreur(err.message);
        setAccesRestreint(err.code === "COMPTE_BLOQUE");
      })
      .finally(() => setChargement(false));
  }, [id]);

  // réactivité temps réel (voir Produits/signals.py côté backend) : les
  // produits de ce vendeur se mettent à jour sans rechargement — un produit
  // rendu indisponible ou supprimé disparaît, un nouveau (ou redevenu
  // disponible) apparaît, à condition qu'il s'agisse bien de ce vendeur
  useEffect(() => {
    if (!produitEvent || !vendeur) return;
    const { type, data } = produitEvent;
    if (String(data.vendeur_id) !== String(vendeur.id) && type !== "produit.deleted") return;
    if (type === "produit.deleted" || data.est_disponible === false) {
      setProduits((liste) => liste.filter((p) => p.id !== data.id));
      return;
    }
    setProduits((liste) => applyListEvent(liste, produitEvent));
  }, [produitEvent, vendeur]);

  // réactivité temps réel de la fiche vendeur elle-même (nom, photo, bio,
  // localisation, blocage...) — voir Registration/signals.py::broadcast_profil
  // (individuel : commune/pays/photo) et broadcast_utilisateur (nom/prenom/
  // telephone/est_bloquer). Les champs affichés (voir infoVendeur,
  // Produits/views/produitsViews.py) ne correspondent pas 1:1 au payload de
  // ces évènements (nom combiné prénom+nom, photo/logo selon compte
  // entreprise ou non...) — un simple rechargement de infoVendeur() sur
  // évènement matché par id reste plus fiable qu'un patch champ par champ,
  // même principe que le rechargement de mesConversations() dans
  // Messagerie.jsx sur messageEvent.
  useEffect(() => {
    if (!vendeur) return;
    const idConcerne =
      (profilEvent && String(profilEvent.data.user_id) === String(vendeur.id)) ||
      (utilisateurEvent && String(utilisateurEvent.data.id) === String(vendeur.id));
    if (!idConcerne) return;
    ProduitsApi.infoVendeur(vendeur.id).then((res) => setVendeur(res.vendeur)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilEvent, utilisateurEvent]);

  const voirDetail = (p) => navigate(`/produits/detail?id=${p.id}`);

  // contact générique (pas lié à un produit précis) — demarrerConversation
  // accepte un destinataire_id seul, voir Messagerie/views.py. Un visiteur
  // non connecté est redirigé vers la connexion plutôt que de pouvoir
  // contacter le vendeur (voir aussi HomePage.jsx/DetailProduit.jsx)
  const contacterVendeur = () => {
    if (!isConnected) {
      navigate("/auth");
      return;
    }
    navigate(`/messages?avec=${vendeur.id}`);
  };

  const contacterProduitVendeur = (produit) => {
    if (!isConnected) {
      navigate("/auth");
      return;
    }
    ProduitsApi.contacterProduit(produit.id).catch(() => {});
    navigate(`/messages?avec=${produit.vendeurId}&produit=${produit.id}`);
  };

  const contacterViaWhatsapp = (produit) => {
    ProduitsApi.contacterProduit(produit.id).catch(() => {});
  };

  const ouvrirSignalement = () => {
    setSignalementForm({ type_probleme: "", motif: "" });
    setSignalementErreur(null);
    setSignalementEnvoye(false);
    setSignalementOuvert(true);
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
      await ProduitsApi.signalerVendeur(vendeur.id, signalementForm.type_probleme, signalementForm.motif.trim());
      setSignalementEnvoye(true);
    } catch (err) {
      setSignalementErreur(err.message);
    } finally {
      setSignalementEnCours(false);
    }
  };

  const produitsAffiches = produits.map((p) => versProduitAffiche(p, t("profile.notSpecified"), t("auth.haiti")));
  const estMonProfil = !!vendeur && !!utilisateur && String(vendeur.id) === String(utilisateur.id);

  return (
    <div className="pd-page">
      <NavBar />

      <div className="pd-container">
        <BoutonRetour />
        {chargement && <p className="pd-hint">{t("home.loadingProducts")}</p>}
        {!chargement && erreur && accesRestreint && (
          <div className="pd-alert pd-alert--error pd-alert--restreint">
            <p>{t(erreur)}</p>
            <Link to="/contacter-admin" className="rk-btn">{t("nav.contactAdmin")}</Link>
          </div>
        )}
        {!chargement && erreur && !accesRestreint && <p className="pd-alert pd-alert--error">{t(erreur)}</p>}

        {!chargement && !erreur && vendeur && (
          <>
            <div className="pd-seller" style={{ marginBottom: "28px" }}>
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
                  {vendeur.telephone && isConnected && (
                    <span><Phone size={13} />{vendeur.telephone}</span>
                  )}
                  <span><CalendarDays size={13} />{t("productDetail.memberSince", { date: new Date(vendeur.date_inscription).toLocaleDateString() })}</span>
                  <span><Package size={13} />{t("productDetail.sellerProductCount", { nombre: vendeur.nombre_produits })}</span>
                </div>

                {!estMonProfil && (
                  <div className="pd-actions" style={{ marginTop: "12px" }}>
                    <button className="pd-contact-btn" onClick={contacterVendeur}>
                      <MessageCircle size={16} />
                      {t("home.contact")}
                    </button>
                    {vendeur.telephone && (
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
                  </div>
                )}

                {!estMonProfil && !vendeur.desactive_par_signalements && (
                  <button type="button" className="pd-report-trigger" onClick={ouvrirSignalement}>
                    <Flag size={13} />
                    {t("productDetail.reportSeller")}
                  </button>
                )}
              </div>
            </div>

            <section className="pd-section">
              <h2 className="pd-section__title">{t("productDetail.allOffers")}</h2>
              {produitsAffiches.length === 0 ? (
                <p className="pd-hint">{t("productDetail.noOffers")}</p>
              ) : (
                <div className="pd-grid">
                  {produitsAffiches.map((p) => (
                    <ProductCard
                      key={p.id}
                      produit={p}
                      onDetails={voirDetail}
                      onContact={contacterProduitVendeur}
                      onWhatsapp={contacterViaWhatsapp}
                      utilisateurId={utilisateur?.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {signalementOuvert && (
        <div className="pd-modal-overlay" onClick={() => setSignalementOuvert(false)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__entete">
              <h3><Flag size={16} />{t("productDetail.reportSeller")}</h3>
              <button type="button" className="pd-modal__fermer" onClick={() => setSignalementOuvert(false)} aria-label={t("admin.dashboard.cancel")}>
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
              <p className="pd-modal__texte pd-alert pd-alert--succes">{t("productDetail.reportSent")}</p>
            ) : (
              <form onSubmit={soumettreSignalement}>
                <p className="pd-modal__texte">{t("productDetail.reportSellerIntro")}</p>
                <div className="rk-field">
                  <label className="rk-label">{t("productDetail.reportTypeLabel")}</label>
                  <select
                    className="rk-select"
                    value={signalementForm.type_probleme}
                    onChange={(e) => setSignalementForm((f) => ({ ...f, type_probleme: e.target.value }))}
                  >
                    <option value="">— {t("productDetail.reportTypeLabel")} —</option>
                    {TYPES_PROBLEME_VENDEUR.map((type) => (
                      <option key={type} value={type}>{t(`admin.dashboard.reportSellerType.${type}`)}</option>
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

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Info, Coins, CheckCircle2, ArrowRight, X, Image, Plus, Trash2, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { nomLocalise } from "../utils/nomLocalise.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import { useConfirmStore } from "../api/confirmStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import "../assets/CSS/ModifierProduit.css";

// référentiel catégorie/sous-catégories — même principe que AjouterProduit.jsx :
// sert à suggérer, pour la sous-catégorie choisie, un nom de produit et une
// unité de mesure cohérents plutôt que de simples champs texte libres.
const SOUS_CATEGORIES_JSON = categorieProduitsData["Sous-Categories"] || [];

const _ACCENTS = { à: "a", â: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ç: "c" };

function _normaliser(texte) {
  return (texte || "").toLowerCase().trim().replace(/[àâäéèêëîïôöùûüç]/g, (c) => _ACCENTS[c] || c);
}

function _trouverReferenceJSON(nomSousCategorie) {
  const cible = _normaliser(nomSousCategorie);
  return SOUS_CATEGORIES_JSON.find((sc) => _normaliser(sc["Sous-Categorie"]) === cible) || null;
}

export default function ModifierProduit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const produitId = searchParams.get("id");
  const { t, lang } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const demanderConfirmation = useConfirmStore((s) => s.demander);
  const produitEvent = useGlobalStore((s) => s.produitEvent);

  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [mesCategories, setMesCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);
  const [form, setForm] = useState(null);
  const [sousCategorieInitiale, setSousCategorieInitiale] = useState(null);
  // désactivé automatiquement après 5 signalements (voir
  // Produits/views/signalementsViews.py::signalerProduit) — seul un admin
  // peut lever ce blocage, le vendeur ne peut plus rendre le produit
  // disponible depuis ce formulaire (voir Produits/views/produitsViews.py::modifierProduit)
  const [desactiveParSignalements, setDesactiveParSignalements] = useState(false);
  const [photos, setPhotos] = useState([]);

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurProduit, setErreurProduit] = useState(null);
  const [succes, setSucces] = useState(null);

  const [envoiPhotoEnCours, setEnvoiPhotoEnCours] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState(null);
  const inputPhotosRef = useRef(null);

  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState(null);
  const [modalSuppressionOuvert, setModalSuppressionOuvert] = useState(false);

  useEffect(() => {
    if (!produitId) {
      setErreurChargement(t("product.editMissingId"));
      setChargement(false);
      return;
    }

    Promise.all([
      ProduitsApi.detailProduit(produitId),
      ProduitsApi.mesCategoriesVendeur(),
      ProduitsApi.listerSousCategories(),
    ])
      .then(([detailRes, mesRes, sousRes]) => {
        const p = detailRes.produit;
        if (utilisateur && p.vendeur_id !== utilisateur.id) {
          setErreurChargement(t("product.editNotOwner"));
          return;
        }
        setMesCategories(mesRes.categories || []);
        setSousCategories(sousRes.sous_categories || []);
        setSousCategorieInitiale(p.sous_categorie || null);
        setDesactiveParSignalements(!!p.desactive_par_signalements);
        // pas de champs de localisation dans ce formulaire (même principe que
        // AjouterProduit.jsx) : la localisation du produit suit automatiquement
        // celle du vendeur et se met à jour en cascade dès qu'il change de
        // localisation dans son profil (voir modifierProfil/modifierEntreprise,
        // Registration/views.py::_repercuter_localisation_sur_produits) —
        // l'éditer ici au niveau du produit romprait cette synchronisation.
        setForm({
          categorie_id:      p.categorie?.id ?? "",
          sous_categorie_id: p.sous_categorie?.id ?? "",
          nom:               p.nom || "",
          description:       p.description || "",
          prix:              p.prix ?? "",
          unitePrix:         p.unitePrix || "HTG",
          unite_De_Mesure:   p.unite_De_Mesure || "",
          est_disponible:    p.est_disponible,
        });
        setPhotos(p.photos || []);
      })
      .catch((err) => setErreurChargement(err.message))
      .finally(() => setChargement(false));
    // volontairement limité à produitId : un changement d'utilisateur ne doit
    // pas relancer le chargement (évite une double requête au premier rendu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  // réactivité temps réel (voir Produits/signals.py côté backend) : ce
  // formulaire n'avait aucun abonnement jusqu'ici — si le produit est
  // supprimé (par le vendeur depuis un autre onglet, ou par un admin) ou
  // désactivé par signalements pendant l'édition, l'écran restait
  // silencieusement périmé jusqu'à un rechargement manuel. Même filtre par id
  // que DetailProduit.jsx.
  useEffect(() => {
    if (!produitEvent || !produitId) return;
    const { type, data } = produitEvent;
    if (String(data.id) !== String(produitId)) return;
    if (type === "produit.deleted") {
      setErreurChargement(t("product.editDeletedWhileEditing"));
      return;
    }
    if ("desactive_par_signalements" in data) {
      setDesactiveParSignalements(!!data.desactive_par_signalements);
    }
  }, [produitEvent, produitId, t]);

  // sous-catégories rattachées aux catégories choisies par ce vendeur (même
  // périmètre que AjouterProduit.jsx) — la sous-catégorie déjà affectée au
  // produit reste toujours proposée, même si elle sort de ce périmètre (ex.
  // le vendeur a depuis retiré cette catégorie de ses catégories de vente)
  const sousCategoriesDisponibles = sousCategories.filter((sc) =>
    mesCategories.some((c) => c.id === sc.categorie_id) || sc.id === sousCategorieInitiale?.id
  );

  const sousCategorieChoisie = sousCategoriesDisponibles.find(
    (sc) => sc.id === Number(form?.sous_categorie_id)
  ) || null;

  // suggestions nom de produit / unité de mesure dérivées du référentiel JSON
  // pour la sous-catégorie choisie (voir _trouverReferenceJSON) — même
  // comportement que AjouterProduit.jsx
  const referenceJSON    = sousCategorieChoisie ? _trouverReferenceJSON(sousCategorieChoisie.nom) : null;
  const suggestionsNom   = referenceJSON?.Produit || [];
  const suggestionsUnite = referenceJSON?.Unite_mesure || [];

  const ajouterPhotos = async (e) => {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (fichiers.length === 0) return;

    setEnvoiPhotoEnCours(true);
    setErreurPhoto(null);
    try {
      const res = await ProduitsApi.ajouterPhotosProduit(produitId, fichiers);
      setPhotos((liste) => [...liste, ...(res.photos || [])]);
    } catch (err) {
      setErreurPhoto(err.message);
    } finally {
      setEnvoiPhotoEnCours(false);
    }
  };

  const retirerPhoto = async (photo) => {
    if (!(await demanderConfirmation(t("product.removePhotoConfirm"), { danger: true }))) return;
    setErreurPhoto(null);
    try {
      await ProduitsApi.supprimerPhotoProduit(photo.id);
      setPhotos((liste) => liste.filter((p) => p.id !== photo.id));
    } catch (err) {
      setErreurPhoto(err.message);
    }
  };

  // contrairement à AjouterProduit.jsx (photos pas encore envoyées, simple
  // tableau local), ces photos existent déjà côté serveur — le nouvel ordre
  // est donc aussi persisté immédiatement (voir ProduitsApi.reordonnerPhotosProduit,
  // Produits/views/photoProduits.py::reordonnerPhotosProduit), avec retour à
  // l'ordre précédent en cas d'échec réseau plutôt qu'un état local incohérent
  // avec le serveur.
  const deplacerPhoto = async (index, direction) => {
    const cible = index + direction;
    if (cible < 0 || cible >= photos.length) return;

    const ancienneListe = photos;
    const nouvelleListe = [...photos];
    [nouvelleListe[index], nouvelleListe[cible]] = [nouvelleListe[cible], nouvelleListe[index]];
    setPhotos(nouvelleListe);
    setErreurPhoto(null);
    try {
      await ProduitsApi.reordonnerPhotosProduit(produitId, nouvelleListe.map((p) => p.id));
    } catch (err) {
      setPhotos(ancienneListe);
      setErreurPhoto(err.message);
    }
  };

  const soumettreProduit = async (e) => {
    e.preventDefault();
    setSucces(null);

    if (!sousCategorieChoisie) {
      setErreurProduit(t("product.subCategoryRequired"));
      return;
    }
    if (!form.nom.trim()) {
      setErreurProduit(t("product.nameRequired"));
      return;
    }
    if (!(await demanderConfirmation(t("product.editConfirm")))) return;

    setEnvoiEnCours(true);
    setErreurProduit(null);
    try {
      await ProduitsApi.modifierProduit({
        id: produitId,
        ...form,
        categorie_id: sousCategorieChoisie.categorie_id,
        sous_categorie_id: sousCategorieChoisie.id,
        prix: form.prix === "" ? null : Number(form.prix),
      });
      setSucces(t("product.updateSuccess"));
      // laisse le temps de voir le message de succès avant de revenir à la
      // page d'où le vendeur est arrivé (liste "Mes produits", tableau de
      // bord, etc.) — même convention que Authentification.jsx après une
      // connexion/inscription réussie
      setTimeout(() => navigate(-1), 1000);
    } catch (err) {
      setErreurProduit(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const confirmerSuppression = async () => {
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await ProduitsApi.supprimerProduit(produitId);
      navigate("/produits/mesProduits");
    } catch (err) {
      setErreurSuppression(err.message);
      setSuppressionEnCours(false);
    }
  };

  return (
    <div className="mep-page">
      <NavBar />

      <div className="mep-container">
        <BoutonRetour />
        <div className="mep-header">
          <div className="mep-header__icon"><Package size={22} /></div>
          <div className="mep-header__texte">
            <h1 className="mep-header__title">{t("product.editProductTitle")}</h1>
            <p className="mep-header__subtitle">{t("product.editProductSubtitle")}</p>
          </div>
          {form && (
            <button
              type="button"
              className="mep-btn mep-header__delete"
              onClick={() => setModalSuppressionOuvert(true)}
            >
              <Trash2 size={16} />
              {t("product.deleteProduct")}
            </button>
          )}
        </div>

        {chargement && <p className="mep-hint">{t("profile.loading")}</p>}
        {!chargement && erreurChargement && (
          <p className="mep-alert mep-alert--error"><X size={16} />{erreurChargement}</p>
        )}

        {!chargement && !erreurChargement && form && (
          <div className="mep-card">
            <h3 className="mep-card__heading">
              <Package size={18} />
              {t("product.productDetails")}
            </h3>

            <form className="mep-form" onSubmit={soumettreProduit}>
              <div className="mep-form-section">
                <p className="mep-form-section__title"><Info size={15} />{t("product.sectionGeneral")}</p>

                <div className="mep-form-row">
                  <label className="mep-field">
                    {t("product.subCategory")} *
                    <select
                      className="mep-input"
                      value={form.sous_categorie_id}
                      onChange={(e) => setForm((f) => ({ ...f, sous_categorie_id: e.target.value }))}
                    >
                      <option value="">{t("product.selectSubCategory")}</option>
                      {sousCategoriesDisponibles.map((sc) => (
                        <option key={sc.id} value={sc.id}>{nomLocalise(sc, lang)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="mep-field">
                    {t("product.name")} *
                    {/* la liste du référentiel n'est qu'une PROPOSITION (voir
                        <datalist>) — le vendeur doit pouvoir saisir librement
                        un nom qui n'y figure pas, tant qu'il reste dans la
                        sous-catégorie choisie ; un <select> forçait
                        auparavant un choix strict parmi cette liste */}
                    <input
                      type="text"
                      className="mep-input"
                      list={suggestionsNom.length > 0 ? "suggestions-nom-produit" : undefined}
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    />
                    {suggestionsNom.length > 0 && (
                      <datalist id="suggestions-nom-produit">
                        {suggestionsNom.map((nom) => <option key={nom} value={nom} />)}
                      </datalist>
                    )}
                  </label>
                </div>

                <label className="mep-field mep-field--full">
                  {t("product.description")}
                  <textarea
                    className="mep-input mep-textarea"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
              </div>

              <div className="mep-form-section">
                <p className="mep-form-section__title"><Coins size={15} />{t("product.sectionPricing")}</p>

                <div className="mep-form-row">
                  <label className="mep-field">
                    {t("product.price")}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mep-input"
                      value={form.prix}
                      onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                    />
                  </label>

                  <label className="mep-field">
                    {t("product.currency")}
                    <select
                      className="mep-input"
                      value={form.unitePrix}
                      onChange={(e) => setForm((f) => ({ ...f, unitePrix: e.target.value }))}
                    >
                      <option value="HTG">{t("product.currencyHTG")}</option>
                      <option value="US">{t("product.currencyUS")}</option>
                    </select>
                  </label>

                  <label className="mep-field">
                    {t("product.unit")}
                    {suggestionsUnite.length > 0 ? (
                      <select
                        className="mep-input"
                        value={form.unite_De_Mesure}
                        onChange={(e) => setForm((f) => ({ ...f, unite_De_Mesure: e.target.value }))}
                      >
                        <option value="">{t("product.selectUnit")}</option>
                        {suggestionsUnite.map((unite) => <option key={unite} value={unite}>{unite}</option>)}
                        {!suggestionsUnite.includes(form.unite_De_Mesure) && form.unite_De_Mesure && (
                          <option value={form.unite_De_Mesure}>{form.unite_De_Mesure}</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={t("product.unitPlaceholder")}
                        className="mep-input"
                        value={form.unite_De_Mesure}
                        onChange={(e) => setForm((f) => ({ ...f, unite_De_Mesure: e.target.value }))}
                      />
                    )}
                  </label>
                </div>

                {desactiveParSignalements ? (
                  <p className="mep-alert mep-alert--error">{t("product.disabledByReports")}</p>
                ) : (
                  <label className="mep-checkbox">
                    <input
                      type="checkbox"
                      checked={form.est_disponible}
                      onChange={(e) => setForm((f) => ({ ...f, est_disponible: e.target.checked }))}
                    />
                    {t("product.availableNow")}
                  </label>
                )}
              </div>

              <div className="mep-form-section mep-form-section--last">
                <p className="mep-form-section__title"><Image size={15} />{t("product.sectionPhotos")}</p>

                <div className="mep-photo-grid">
                  {photos.map((photo, index) => (
                    <div className="mep-photo-thumb" key={photo.id}>
                      <img src={photo.url_photo} alt={form.nom} />
                      <button
                        type="button"
                        className="mep-photo-thumb__remove"
                        onClick={() => retirerPhoto(photo)}
                        aria-label={t("product.removePhoto")}
                      >
                        <X size={14} />
                      </button>
                      {photos.length > 1 && (
                        <div className="mep-photo-thumb__reorder">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => deplacerPhoto(index, -1)}
                            aria-label={t("product.movePhotoBefore")}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === photos.length - 1}
                            onClick={() => deplacerPhoto(index, 1)}
                            aria-label={t("product.movePhotoAfter")}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="mep-photo-add"
                    disabled={envoiPhotoEnCours}
                    onClick={() => inputPhotosRef.current?.click()}
                  >
                    <Plus size={20} />
                    {t("product.addPhotos")}
                  </button>
                </div>

                {erreurPhoto && <p className="mep-alert mep-alert--error"><X size={16} />{erreurPhoto}</p>}

                <input
                  ref={inputPhotosRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={ajouterPhotos}
                />
              </div>

              {erreurProduit && <p className="mep-alert mep-alert--error"><X size={16} />{erreurProduit}</p>}
              {succes && <p className="mep-alert mep-alert--success"><CheckCircle2 size={16} />{succes}</p>}

              <div className="mep-form-actions">
                <button type="submit" className="mep-btn mep-btn--primary" disabled={envoiEnCours}>
                  {envoiEnCours ? t("profile.loading") : t("product.saveChanges")}
                  {!envoiEnCours && <ArrowRight size={16} />}
                </button>
                <button type="button" className="mep-btn mep-btn--secondary" onClick={() => navigate("/produits/mesProduits")}>
                  {t("product.backToMyProducts")}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {modalSuppressionOuvert && (
        <div className="mep-modal-overlay" onClick={() => !suppressionEnCours && setModalSuppressionOuvert(false)}>
          <div className="mep-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mep-modal__icon"><AlertTriangle size={22} /></div>
            <h3 className="mep-modal__title">{t("product.deleteConfirmTitle")}</h3>
            <p className="mep-modal__text">
              {t("product.deleteConfirmText", { nom: form?.nom || "" })}
            </p>
            {erreurSuppression && (
              <p className="mep-alert mep-alert--error"><X size={16} />{erreurSuppression}</p>
            )}
            <div className="mep-modal__actions">
              <button
                type="button"
                className="mep-btn mep-btn--secondary"
                disabled={suppressionEnCours}
                onClick={() => setModalSuppressionOuvert(false)}
              >
                {t("product.cancel")}
              </button>
              <button
                type="button"
                className="mep-btn mep-btn--danger"
                disabled={suppressionEnCours}
                onClick={confirmerSuppression}
              >
                <Trash2 size={16} />
                {suppressionEnCours ? t("profile.loading") : t("product.deleteConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

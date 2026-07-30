import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Info, Coins, MapPin, CheckCircle2, ArrowRight, X, Image, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import departementsData from "../assets/Departements/haiti_departements.json";
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
  const { t } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);

  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [mesCategories, setMesCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);
  const [form, setForm] = useState(null);
  const [sousCategorieInitiale, setSousCategorieInitiale] = useState(null);
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
        setForm({
          categorie_id:      p.categorie?.id ?? "",
          sous_categorie_id: p.sous_categorie?.id ?? "",
          nom:               p.nom || "",
          description:       p.description || "",
          prix:              p.prix ?? "",
          unitePrix:         p.unitePrix || "HTG",
          unite_De_Mesure:   p.unite_De_Mesure || "",
          departement:       p.departement || "",
          commune:           p.commune || "",
          section_comunale:  p.section_comunale || "",
          adresse:           p.adresse || "",
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

  const communesDisponibles = form?.departement
    ? (departementsData.find((d) => d.departement === form.departement)?.communes || [])
    : [];
  const sectionsDisponibles = form?.commune
    ? (communesDisponibles.find((c) => c.commune === form.commune)?.sections_communales || [])
    : [];

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
    setErreurPhoto(null);
    try {
      await ProduitsApi.supprimerPhotoProduit(photo.id);
      setPhotos((liste) => liste.filter((p) => p.id !== photo.id));
    } catch (err) {
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
    if (!form.section_comunale) {
      setErreurProduit(t("product.sectionCommunaleRequired"));
      return;
    }

    setEnvoiEnCours(true);
    setErreurProduit(null);
    try {
      await ProduitsApi.modifierProduit({
        id: produitId,
        ...form,
        categorie_id: sousCategorieChoisie.categorie_id,
        sous_categorie_id: sousCategorieChoisie.id,
        prix: form.prix === "" ? null : Number(form.prix),
        region: form.section_comunale,
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
                        <option key={sc.id} value={sc.id}>{sc.nom}</option>
                      ))}
                    </select>
                  </label>

                  <label className="mep-field">
                    {t("product.name")} *
                    {suggestionsNom.length > 0 ? (
                      <select
                        className="mep-input"
                        value={form.nom}
                        onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      >
                        <option value="">{t("product.selectName")}</option>
                        {suggestionsNom.map((nom) => <option key={nom} value={nom}>{nom}</option>)}
                        {!suggestionsNom.includes(form.nom) && form.nom && (
                          <option value={form.nom}>{form.nom}</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="mep-input"
                        value={form.nom}
                        onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      />
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

                <label className="mep-checkbox">
                  <input
                    type="checkbox"
                    checked={form.est_disponible}
                    onChange={(e) => setForm((f) => ({ ...f, est_disponible: e.target.checked }))}
                  />
                  {t("product.availableNow")}
                </label>
              </div>

              <div className="mep-form-section">
                <p className="mep-form-section__title"><MapPin size={15} />{t("product.sectionLocation")}</p>

                <div className="mep-form-row">
                  <label className="mep-field">
                    {t("product.department")}
                    <select
                      className="mep-input"
                      value={form.departement}
                      onChange={(e) => {
                        const departement = e.target.value;
                        setForm((f) => ({ ...f, departement, commune: "", section_comunale: "" }));
                      }}
                    >
                      <option value="">{t("product.selectDepartment")}</option>
                      {departementsData.map((d) => (
                        <option key={d.departement} value={d.departement}>{d.departement}</option>
                      ))}
                    </select>
                  </label>

                  <label className="mep-field">
                    {t("product.commune")}
                    <select
                      className="mep-input"
                      value={form.commune}
                      disabled={!form.departement}
                      onChange={(e) => {
                        const commune = e.target.value;
                        setForm((f) => ({ ...f, commune, section_comunale: "" }));
                      }}
                    >
                      <option value="">{t("product.selectCommune")}</option>
                      {communesDisponibles.map((c) => (
                        <option key={c.commune} value={c.commune}>{c.commune}</option>
                      ))}
                    </select>
                  </label>

                  <label className="mep-field">
                    {t("product.sectionCommunale")} *
                    <select
                      className="mep-input"
                      value={form.section_comunale}
                      disabled={!form.commune || sectionsDisponibles.length === 0}
                      onChange={(e) => setForm((f) => ({ ...f, section_comunale: e.target.value }))}
                    >
                      <option value="">{t("product.selectSection")}</option>
                      {sectionsDisponibles.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mep-field mep-field--full">
                  {t("product.address")}
                  <input
                    type="text"
                    className="mep-input"
                    value={form.adresse}
                    onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                  />
                </label>
              </div>

              <div className="mep-form-section mep-form-section--last">
                <p className="mep-form-section__title"><Image size={15} />{t("product.sectionPhotos")}</p>

                <div className="mep-photo-grid">
                  {photos.map((photo) => (
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

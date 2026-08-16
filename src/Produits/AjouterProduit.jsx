import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, Tag, Check, Sprout, Info, Coins, CheckCircle2, ArrowRight, X, Image, Plus, ChevronLeft, ChevronRight,
} from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { ProduitsApi } from "../api/produits";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import "../assets/CSS/AjouterProduit.css";

const FORM_VIDE = {
  sous_categorie_id: "", nom: "", description: "", prix: "", unitePrix: "HTG", unite_De_Mesure: "",
  // coché par défaut : un produit publié doit être visible immédiatement,
  // sinon il reste invisible sur la page d'accueil (voir listerProduits,
  // Produits/views/produitsViews.py — seuls les produits "disponible" y
  // apparaissent) sans qu'aucun écran ne permette encore de basculer ça après coup
  est_disponible: true,
};

// référentiel catégorie/sous-catégories (voir AdminDashboard.jsx, qui s'en
// sert aussi pour créer les sous-catégories en base) — sert ici à suggérer,
// pour la sous-catégorie choisie par le vendeur, un nom de produit et une
// unité de mesure cohérents, plutôt qu'une liste plate toutes sous-catégories
// confondues. Le rapprochement se fait par NOM (pas d'id commun entre le
// JSON, simple référentiel statique, et les sous-catégories réelles créées
// par un admin en base) — voir _normaliser ci-dessous pour la comparaison.
const SOUS_CATEGORIES_JSON = categorieProduitsData["Sous-Categories"] || [];

// remplace les accents français/créoles usuels pour comparer "sans accents" —
// évite d'avoir à jongler avec les marques diacritiques combinantes Unicode
const _ACCENTS = { à: "a", â: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ç: "c" };

function _normaliser(texte) {
  return (texte || "").toLowerCase().trim().replace(/[àâäéèêëîïôöùûüç]/g, (c) => _ACCENTS[c] || c);
}

function _trouverReferenceJSON(nomSousCategorie) {
  const cible = _normaliser(nomSousCategorie);
  return SOUS_CATEGORIES_JSON.find((sc) => _normaliser(sc["Sous-Categorie"]) === cible) || null;
}

export default function AjouterProduit() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const categorieEvent = useGlobalStore((s) => s.categorieEvent);
  const sousCategorieEvent = useGlobalStore((s) => s.sousCategorieEvent);

  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [toutesCategories, setToutesCategories] = useState([]);
  const [mesCategories, setMesCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);

  // étape 1 (si aucune catégorie encore choisie) : sélection des catégories de vente
  const [selectionCategories, setSelectionCategories] = useState([]);
  const [choixEnCours, setChoixEnCours] = useState(false);
  const [erreurChoix, setErreurChoix] = useState(null);

  // étape 2 : formulaire du produit
  const [form, setForm] = useState(FORM_VIDE);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurProduit, setErreurProduit] = useState(null);

  // photos sélectionnées en attente d'envoi — le produit doit d'abord exister
  // en base (ajouterPhotosProduit référence un produit_id), donc l'upload se
  // fait juste après creerProduit, dans le même clic (voir soumettreProduit)
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef(photos);
  const inputPhotosRef = useRef(null);

  // libère au démontage les URL objet des aperçus encore en attente (celles
  // déjà retirées ou envoyées le sont explicitement par leurs propres actions,
  // voir ajouterPhotosSelectionnees / retirerPhoto / soumettreProduit)
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.apercu));
  }, []);

  const ajouterPhotosSelectionnees = (e) => {
    const fichiers = Array.from(e.target.files || []);
    if (fichiers.length === 0) return;
    setPhotos((liste) => [
      ...liste,
      ...fichiers.map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier) })),
    ]);
    // permet de resélectionner le(s) même(s) fichier(s) après un retrait
    e.target.value = "";
  };

  const retirerPhoto = (index) => {
    setPhotos((liste) => {
      URL.revokeObjectURL(liste[index].apercu);
      return liste.filter((_, i) => i !== index);
    });
  };

  // ordre purement local à ce stade (les photos ne sont pas encore envoyées
  // au serveur) : l'ordre du tableau `photos` détermine directement l'ordre
  // d'upload dans soumettreProduit (ProduitsApi.ajouterPhotosProduit envoie
  // les fichiers dans l'ordre du tableau reçu, voir Produits/views/
  // photoProduits.py::ajouterPhotosProduit, qui les numérote dans cet ordre)
  const deplacerPhoto = (index, direction) => {
    setPhotos((liste) => {
      const cible = index + direction;
      if (cible < 0 || cible >= liste.length) return liste;
      const copie = [...liste];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
  };

  useEffect(() => {
    Promise.all([
      ProduitsApi.listerCategories(),
      ProduitsApi.mesCategoriesVendeur(),
      ProduitsApi.listerSousCategories(),
    ])
      .then(([toutesRes, mesRes, sousRes]) => {
        setToutesCategories(toutesRes.categories || []);
        setMesCategories(mesRes.categories || []);
        setSousCategories(sousRes.sous_categories || []);
      })
      .catch((err) => setErreurChargement(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend)
  useEffect(() => {
    if (!sousCategorieEvent) return;
    setSousCategories((liste) => applyListEvent(liste, sousCategorieEvent));
  }, [sousCategorieEvent]);

  // réactivité temps réel (voir Produits/signals.py côté backend) : la liste
  // complète (étape 1, choix des catégories de vente) suit toute création/
  // modification/suppression — "mes catégories" (étape 2, déjà choisies par
  // ce vendeur) ne se voit jamais AJOUTER une catégorie via cet évènement
  // (le vendeur doit l'opter explicitement), seulement mise à jour/retirée
  useEffect(() => {
    if (!categorieEvent) return;
    setToutesCategories((liste) => applyListEvent(liste, categorieEvent));
    setMesCategories((liste) =>
      categorieEvent.type === "categorie.deleted"
        ? liste.filter((c) => c.id !== categorieEvent.data.id)
        : liste.map((c) => (c.id === categorieEvent.data.id ? { ...c, ...categorieEvent.data } : c))
    );
  }, [categorieEvent]);

  // sous-catégories rattachées aux catégories que ce vendeur a choisies à
  // l'étape 1 — un vendeur ne doit pas se voir proposer une sous-catégorie
  // hors du périmètre déjà validé (même logique que categorie_id, restreint
  // à categories_produits, côté backend)
  const sousCategoriesDisponibles = sousCategories.filter((sc) =>
    mesCategories.some((c) => c.id === sc.categorie_id)
  );

  const sousCategorieChoisie = sousCategoriesDisponibles.find(
    (sc) => sc.id === Number(form.sous_categorie_id)
  ) || null;

  // suggestions nom de produit / unité de mesure dérivées du référentiel
  // JSON pour la sous-catégorie choisie (voir _trouverReferenceJSON) — vides
  // tant qu'aucune sous-catégorie n'est sélectionnée
  const referenceJSON    = sousCategorieChoisie ? _trouverReferenceJSON(sousCategorieChoisie.nom) : null;
  const suggestionsNom   = referenceJSON?.Produit || [];
  const suggestionsUnite = referenceJSON?.Unite_mesure || [];

  const toggleSelectionCategorie = (id) => {
    setSelectionCategories((liste) =>
      liste.includes(id) ? liste.filter((c) => c !== id) : [...liste, id]
    );
  };

  const soumettreChoixCategories = async (e) => {
    e.preventDefault();
    if (selectionCategories.length === 0) {
      setErreurChoix(t("product.categoriesRequired"));
      return;
    }
    setChoixEnCours(true);
    setErreurChoix(null);
    try {
      const res = await ProduitsApi.choisirCategoriesVendeur(selectionCategories);
      setMesCategories(res.categories || []);
    } catch (err) {
      setErreurChoix(err.message);
    } finally {
      setChoixEnCours(false);
    }
  };

  const soumettreProduit = async (e) => {
    e.preventDefault();

    // garde-fou client — le vendeur DOIT choisir une sous-catégorie existante
    // (rattachée à une de ses catégories choisies) avant que le produit ne
    // soit envoyé ; categorie_id est dérivé de cette sous-catégorie ET
    // sous_categorie_id est envoyé tel quel (voir Produits/models/produitsModels.py
    // ::sous_categorie, utilisé pour le filtre par sous-catégorie du catalogue) —
    // le backend refuse aussi toute categorie_id hors de ses catégories
    // choisies (voir Produits/views/produitsViews.py::creerProduit)
    if (!sousCategorieChoisie) {
      setErreurProduit(t("product.subCategoryRequired"));
      return;
    }
    if (!form.nom.trim()) {
      setErreurProduit(t("product.nameRequired"));
      return;
    }

    setEnvoiEnCours(true);
    setErreurProduit(null);
    try {
      // pas de localisation par produit : le backend reprend automatiquement
      // celle du vendeur (profil individuel ou entreprise), voir
      // Produits/views/produitsViews.py::creerProduit
      const res = await ProduitsApi.creerProduit({
        ...form,
        categorie_id: sousCategorieChoisie.categorie_id,
        prix: form.prix === "" ? null : Number(form.prix),
      });

      // le produit existe déjà en base à ce stade — un échec d'upload des
      // photos ne doit pas être présenté comme un échec de la publication
      if (photos.length > 0) {
        try {
          await ProduitsApi.ajouterPhotosProduit(res.produit.id, photos.map((p) => p.fichier));
        } catch {
          // le produit reste publié ; le vendeur pourra réessayer l'ajout de
          // photos depuis "Mes produits" (modifierProduits.jsx)
        }
      }

      photos.forEach((p) => URL.revokeObjectURL(p.apercu));
      setPhotos([]);
      // publication terminée : direction "Mes produits" (le nouveau produit y
      // apparaît déjà via l'événement WebSocket produit.created, voir
      // mesProduits.jsx)
      navigate("/produits/mesProduits");
    } catch (err) {
      setErreurProduit(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const etape = mesCategories.length === 0 ? 1 : 2;

  return (
    <div className="ap-page">
      <NavBar />

      <div className="ap-container">
        <BoutonRetour />
        <div className="ap-header">
          <div className="ap-header__icon"><Sprout size={22} /></div>
          <div>
            <h1 className="ap-header__title">{t("product.addProductTitle")}</h1>
            <p className="ap-header__subtitle">{t("product.addProductSubtitle")}</p>
          </div>
        </div>

        {!chargement && !erreurChargement && (
          <ol className="ap-steps">
            <li className={`ap-steps__item ${etape === 1 ? "ap-steps__item--active" : "ap-steps__item--done"}`}>
              <span className="ap-steps__badge">{etape > 1 ? <Check size={14} /> : 1}</span>
              {t("product.stepCategories")}
            </li>
            <span className="ap-steps__line" />
            <li className={`ap-steps__item ${etape === 2 ? "ap-steps__item--active" : ""}`}>
              <span className="ap-steps__badge">2</span>
              {t("product.stepDetails")}
            </li>
          </ol>
        )}

        {chargement && <p className="ap-hint">{t("profile.loading")}</p>}
        {erreurChargement && <p className="ap-alert ap-alert--error"><X size={16} />{erreurChargement}</p>}

        {!chargement && !erreurChargement && mesCategories.length === 0 && (
          <div className="ap-card">
            <h3 className="ap-card__heading">{t("product.chooseCategoriesTitle")}</h3>
            <p className="ap-card__intro">{t("product.chooseCategoriesText")}</p>

            {toutesCategories.length === 0 ? (
              <p className="ap-hint">{t("product.noCategoriesAvailable")}</p>
            ) : (
              <form onSubmit={soumettreChoixCategories}>
                <ul className="ap-category-grid">
                  {toutesCategories.map((c) => {
                    const selectionnee = selectionCategories.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label className={`ap-category-chip ${selectionnee ? "ap-category-chip--selected" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectionnee}
                            onChange={() => toggleSelectionCategorie(c.id)}
                          />
                          <span className="ap-category-chip__icon"><Tag size={16} /></span>
                          <span className="ap-category-chip__label">{c.nom}</span>
                          {selectionnee && <CheckCircle2 size={18} className="ap-category-chip__check" />}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {erreurChoix && <p className="ap-alert ap-alert--error"><X size={16} />{erreurChoix}</p>}
                <button type="submit" className="ap-btn ap-btn--primary" disabled={choixEnCours}>
                  {t("product.confirmCategories")}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>
        )}

        {!chargement && !erreurChargement && mesCategories.length > 0 && (
          <div className="ap-card">
            <h3 className="ap-card__heading">
              <Package size={18} />
              {t("product.productDetails")}
            </h3>

            {sousCategoriesDisponibles.length === 0 ? (
              <p className="ap-hint">{t("product.noSubCategoriesAvailable")}</p>
            ) : (
              <form className="ap-form" onSubmit={soumettreProduit}>
                <div className="ap-form-section">
                  <p className="ap-form-section__title"><Info size={15} />{t("product.sectionGeneral")}</p>

                  <div className="ap-form-row">
                    <label className="ap-field">
                      {t("product.subCategory")} *
                      <select
                        className="ap-input"
                        value={form.sous_categorie_id}
                        onChange={(e) => setForm((f) => ({ ...f, sous_categorie_id: e.target.value }))}
                      >
                        <option value="">{t("product.selectSubCategory")}</option>
                        {sousCategoriesDisponibles.map((sc) => (
                          <option key={sc.id} value={sc.id}>{sc.nom}</option>
                        ))}
                      </select>
                    </label>

                    <label className="ap-field">
                      {t("product.name")} *
                      {suggestionsNom.length > 0 ? (
                        <select
                          className="ap-input"
                          value={form.nom}
                          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                        >
                          <option value="">{t("product.selectName")}</option>
                          {suggestionsNom.map((nom) => <option key={nom} value={nom}>{nom}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="ap-input"
                          value={form.nom}
                          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                        />
                      )}
                    </label>
                  </div>

                  <label className="ap-field ap-field--full">
                    {t("product.description")}
                    <textarea
                      className="ap-input ap-textarea"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="ap-form-section">
                  <p className="ap-form-section__title"><Coins size={15} />{t("product.sectionPricing")}</p>

                  <div className="ap-form-row">
                    <label className="ap-field">
                      {t("product.price")}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="ap-input"
                        value={form.prix}
                        onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                      />
                    </label>

                    <label className="ap-field">
                      {t("product.currency")}
                      <select
                        className="ap-input"
                        value={form.unitePrix}
                        onChange={(e) => setForm((f) => ({ ...f, unitePrix: e.target.value }))}
                      >
                        <option value="HTG">{t("product.currencyHTG")}</option>
                        <option value="US">{t("product.currencyUS")}</option>
                      </select>
                    </label>

                    <label className="ap-field">
                      {t("product.unit")}
                      {suggestionsUnite.length > 0 ? (
                        <select
                          className="ap-input"
                          value={form.unite_De_Mesure}
                          onChange={(e) => setForm((f) => ({ ...f, unite_De_Mesure: e.target.value }))}
                        >
                          <option value="">{t("product.selectUnit")}</option>
                          {suggestionsUnite.map((unite) => <option key={unite} value={unite}>{unite}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder={t("product.unitPlaceholder")}
                          className="ap-input"
                          value={form.unite_De_Mesure}
                          onChange={(e) => setForm((f) => ({ ...f, unite_De_Mesure: e.target.value }))}
                        />
                      )}
                    </label>
                  </div>

                  <label className="ap-checkbox">
                    <input
                      type="checkbox"
                      checked={form.est_disponible}
                      onChange={(e) => setForm((f) => ({ ...f, est_disponible: e.target.checked }))}
                    />
                    {t("product.availableNow")}
                  </label>
                </div>

                <div className="ap-form-section ap-form-section--last">
                  <p className="ap-form-section__title"><Image size={15} />{t("product.sectionPhotos")}</p>
                  <p className="ap-hint">{t("product.photosHint")}</p>

                  <div className="ap-photo-grid">
                    {photos.map((p, index) => (
                      <div className="ap-photo-thumb" key={p.apercu}>
                        <img src={p.apercu} alt={p.fichier.name} />
                        <button
                          type="button"
                          className="ap-photo-thumb__remove"
                          onClick={() => retirerPhoto(index)}
                          aria-label={t("product.removePhoto")}
                        >
                          <X size={14} />
                        </button>
                        {photos.length > 1 && (
                          <div className="ap-photo-thumb__reorder">
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
                      className="ap-photo-add"
                      onClick={() => inputPhotosRef.current?.click()}
                    >
                      <Plus size={20} />
                      {t("product.addPhotos")}
                    </button>
                  </div>

                  <input
                    ref={inputPhotosRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={ajouterPhotosSelectionnees}
                  />
                </div>

                {erreurProduit && <p className="ap-alert ap-alert--error"><X size={16} />{erreurProduit}</p>}

                <div className="ap-form-actions">
                  <button type="submit" className="ap-btn ap-btn--primary" disabled={envoiEnCours}>
                    {envoiEnCours ? t("profile.loading") : t("product.publish")}
                    {!envoiEnCours && <ArrowRight size={16} />}
                  </button>
                  <button type="button" className="ap-btn ap-btn--secondary" onClick={() => navigate("/")}>
                    {t("product.backToHome")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

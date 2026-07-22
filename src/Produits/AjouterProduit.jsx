import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Tag, Check } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/ProfilAcheteur.css";
import "../assets/CSS/AdminDashboard.css";
import "../assets/CSS/AjouterProduit.css";

const FORM_VIDE = {
  categorie_id: "", nom: "", description: "", prix: "", unite: "",
  departement: "", commune: "", section_comunale: "", adresse: "",
};

export default function AjouterProduit() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const categorieEvent = useGlobalStore((s) => s.categorieEvent);

  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [toutesCategories, setToutesCategories] = useState([]);
  const [mesCategories, setMesCategories] = useState([]);

  // étape 1 (si aucune catégorie encore choisie) : sélection des catégories de vente
  const [selectionCategories, setSelectionCategories] = useState([]);
  const [choixEnCours, setChoixEnCours] = useState(false);
  const [erreurChoix, setErreurChoix] = useState(null);

  // étape 2 : formulaire du produit
  const [form, setForm] = useState(FORM_VIDE);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurProduit, setErreurProduit] = useState(null);
  const [succes, setSucces] = useState(null);

  useEffect(() => {
    Promise.all([ProduitsApi.listerCategories(), ProduitsApi.mesCategoriesVendeur()])
      .then(([toutesRes, mesRes]) => {
        setToutesCategories(toutesRes.categories || []);
        setMesCategories(mesRes.categories || []);
      })
      .catch((err) => setErreurChargement(err.message))
      .finally(() => setChargement(false));
  }, []);

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
    setSucces(null);

    // garde-fou client — le vendeur DOIT choisir une catégorie existante
    // (parmi celles qu'il vend) avant que le produit ne soit envoyé ; le
    // backend refuse aussi toute categorie_id hors de ses catégories
    // choisies (voir Produits/views/produitsViews.py::creerProduit)
    if (!form.categorie_id) {
      setErreurProduit(t("product.categoryRequired"));
      return;
    }
    if (!form.nom.trim()) {
      setErreurProduit(t("product.nameRequired"));
      return;
    }

    setEnvoiEnCours(true);
    setErreurProduit(null);
    try {
      await ProduitsApi.creerProduit({
        ...form,
        categorie_id: Number(form.categorie_id),
        prix: form.prix === "" ? null : Number(form.prix),
      });
      setSucces(t("product.createSuccess"));
      setForm({ ...FORM_VIDE, categorie_id: form.categorie_id });
    } catch (err) {
      setErreurProduit(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="profil-page">
      <NavBar />

      <div className="admin-dashboard-container">
        <div className="profil-header">
          <div>
            <h1 className="profil-title">{t("product.addProductTitle")}</h1>
            <p className="profil-subtitle">{t("product.addProductSubtitle")}</p>
          </div>
        </div>

        {chargement && <p className="profil-field-value">{t("profile.loading")}</p>}
        {erreurChargement && <p className="admin-error">✗ {erreurChargement}</p>}

        {!chargement && !erreurChargement && mesCategories.length === 0 && (
          <div className="profil-card">
            <h3 className="profil-card__title profil-card__title--accent">
              {t("product.chooseCategoriesTitle")}
            </h3>
            <p className="profil-field-value">{t("product.chooseCategoriesText")}</p>

            {toutesCategories.length === 0 ? (
              <p className="profil-field-value">{t("product.noCategoriesAvailable")}</p>
            ) : (
              <form onSubmit={soumettreChoixCategories}>
                <ul className="admin-category-checklist">
                  {toutesCategories.map((c) => (
                    <li key={c.id}>
                      <label className="admin-category-checklist__item">
                        <input
                          type="checkbox"
                          checked={selectionCategories.includes(c.id)}
                          onChange={() => toggleSelectionCategorie(c.id)}
                        />
                        <Tag size={16} />
                        {c.nom}
                      </label>
                    </li>
                  ))}
                </ul>
                {erreurChoix && <p className="admin-error">✗ {erreurChoix}</p>}
                <button type="submit" className="profil-btn profil-btn--primary" disabled={choixEnCours}>
                  <Check size={16} />
                  {t("product.confirmCategories")}
                </button>
              </form>
            )}
          </div>
        )}

        {!chargement && !erreurChargement && mesCategories.length > 0 && (
          <div className="profil-card">
            <h3 className="profil-card__title profil-card__title--accent">
              <Package size={18} />
              {t("product.productDetails")}
            </h3>

            <form className="admin-product-form" onSubmit={soumettreProduit}>
              <div className="admin-product-form__row">
                <label className="admin-field-label">
                  {t("product.category")} *
                  <select
                    className="admin-input"
                    value={form.categorie_id}
                    onChange={(e) => setForm((f) => ({ ...f, categorie_id: e.target.value }))}
                  >
                    <option value="">{t("product.selectCategory")}</option>
                    {mesCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field-label">
                  {t("product.name")} *
                  <input
                    type="text"
                    className="admin-input"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  />
                </label>
              </div>

              <label className="admin-field-label admin-field-label--full">
                {t("product.description")}
                <textarea
                  className="admin-input admin-textarea"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>

              <div className="admin-product-form__row">
                <label className="admin-field-label">
                  {t("product.price")}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="admin-input"
                    value={form.prix}
                    onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  />
                </label>

                <label className="admin-field-label">
                  {t("product.unit")}
                  <input
                    type="text"
                    placeholder={t("product.unitPlaceholder")}
                    className="admin-input"
                    value={form.unite}
                    onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                  />
                </label>
              </div>

              <div className="admin-product-form__row">
                <label className="admin-field-label">
                  {t("product.department")}
                  <input
                    type="text"
                    className="admin-input"
                    value={form.departement}
                    onChange={(e) => setForm((f) => ({ ...f, departement: e.target.value }))}
                  />
                </label>

                <label className="admin-field-label">
                  {t("product.commune")}
                  <input
                    type="text"
                    className="admin-input"
                    value={form.commune}
                    onChange={(e) => setForm((f) => ({ ...f, commune: e.target.value }))}
                  />
                </label>
              </div>

              <label className="admin-field-label admin-field-label--full">
                {t("product.address")}
                <input
                  type="text"
                  className="admin-input"
                  value={form.adresse}
                  onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                />
              </label>

              {erreurProduit && <p className="admin-error">✗ {erreurProduit}</p>}
              {succes && <p className="admin-success">✓ {succes}</p>}

              <div className="admin-product-form__actions">
                <button type="submit" className="profil-btn profil-btn--primary" disabled={envoiEnCours}>
                  {t("product.publish")}
                </button>
                <button type="button" className="profil-btn profil-btn--secondary" onClick={() => navigate("/")}>
                  {t("product.backToHome")}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

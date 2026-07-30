import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sprout, Search, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/AfficherProduits.css";

// nombre de produits affichés au départ, et incrément du bouton "Afficher plus"
const TAILLE_PAGE = 10;

// Convertit un produit tel que renvoyé par l'API (voir _serialiseProduit,
// Produits/views/produitsViews.py) au format attendu par ProductCard.jsx +
// aux filtres de cette page (categorieId/sousCategorieId/departement/commune/
// sectionComunale bruts, en plus des champs déjà attendus par ProductCard)
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
    categorieId: p.categorie?.id,
    categorieNom: p.categorie?.nom,
    sousCategorieId: p.sous_categorie?.id,
    sousCategorieNom: p.sous_categorie?.nom,
    departement: p.departement || "",
    commune: p.commune || "",
    sectionComunale: p.section_comunale || "",
  };
}

// enlève les accents pour une recherche insensible aux accents (mêmes accents
// que ceux réellement rencontrés dans les données produit/vendeur du projet)
const _ACCENTS = { à: "a", â: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ç: "c" };
function _normaliser(texte) {
  return (texte || "").toLowerCase().trim().replace(/[àâäéèêëîïôöùûüç]/g, (c) => _ACCENTS[c] || c);
}

// lit une liste d'identifiants/valeurs séparés par virgule depuis l'URL
function _lireListeParam(searchParams, cle) {
  const valeur = searchParams.get(cle);
  return valeur ? valeur.split(",").filter(Boolean) : [];
}

// section de filtre repliable — style "menu Amazon" : titre cliquable +
// chevron, liste de cases à cocher avec le nombre de produits concernés
function SectionFiltre({ titre, options, valeursSelectionnees, onToggle }) {
  const [ouvert, setOuvert] = useState(true);

  if (options.length === 0) return null;

  return (
    <div className="ap2-filtre-section">
      <button
        type="button"
        className="ap2-filtre-section__titre"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        {titre}
        <ChevronDown size={16} className={`ap2-filtre-chevron ${ouvert ? "" : "ap2-filtre-chevron--ferme"}`} />
      </button>
      {ouvert && (
        <ul className="ap2-filtre-liste">
          {options.map((opt) => (
            <li key={opt.value}>
              <label className="ap2-filtre-option">
                <input
                  type="checkbox"
                  checked={valeursSelectionnees.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                />
                <span className="ap2-filtre-option__label">{opt.label}</span>
                <span className="ap2-filtre-option__count">{opt.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// section de filtre repliable pour l'intervalle de prix (min/max) — même
// habillage que SectionFiltre, mais deux champs numériques plutôt qu'une
// liste de cases à cocher
function SectionPrix({ titre, prixMin, prixMax, onChangeMin, onChangeMax, placeholderMin, placeholderMax }) {
  const [ouvert, setOuvert] = useState(true);

  return (
    <div className="ap2-filtre-section">
      <button
        type="button"
        className="ap2-filtre-section__titre"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        {titre}
        <ChevronDown size={16} className={`ap2-filtre-chevron ${ouvert ? "" : "ap2-filtre-chevron--ferme"}`} />
      </button>
      {ouvert && (
        <div className="ap2-filtre-prix">
          <input
            type="number"
            min="0"
            className="ap2-filtre-prix__input"
            placeholder={placeholderMin}
            value={prixMin}
            onChange={(e) => onChangeMin(e.target.value)}
          />
          <span className="ap2-filtre-prix__separateur">–</span>
          <input
            type="number"
            min="0"
            className="ap2-filtre-prix__input"
            placeholder={placeholderMax}
            value={prixMax}
            onChange={(e) => onChangeMax(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function AfficherProduits() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const isConnected = useAuthStore((s) => s.isConnected);
  const [searchParams, setSearchParams] = useSearchParams();

  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [messageContact, setMessageContact] = useState(null);
  const [recherche, setRecherche] = useState(searchParams.get("q") || "");
  const [categorieIds, setCategorieIds] = useState(() => _lireListeParam(searchParams, "categorie"));
  const [sousCategorieIds, setSousCategorieIds] = useState(() => _lireListeParam(searchParams, "sous_categorie"));
  const [departements, setDepartements] = useState(() => _lireListeParam(searchParams, "departement"));
  const [communes, setCommunes] = useState(() => _lireListeParam(searchParams, "commune"));
  const [sectionsComunales, setSectionsComunales] = useState(() => _lireListeParam(searchParams, "section_comunale"));
  const [prixMin, setPrixMin] = useState(searchParams.get("prix_min") || "");
  const [prixMax, setPrixMax] = useState(searchParams.get("prix_max") || "");
  // affiché par défaut sur toutes les tailles d'écran ; le bouton "Filtres"
  // permet de le masquer aussi bien en desktop (la sidebar disparaît, le
  // contenu principal reprend toute la largeur) qu'en mobile (panneau plein écran)
  const [filtresOuverts, setFiltresOuverts] = useState(true);
  const [nombreAffiche, setNombreAffiche] = useState(TAILLE_PAGE);

  // catalogue public : tous les produits disponibles, de tous les vendeurs
  // (voir Produits/views/produitsViews.py::listerProduits, filtre ?disponible=true)
  // — les facettes de filtre sont dérivées de ces produits eux-mêmes (voir
  // plus bas), pas d'un référentiel à part : seules les valeurs qui ont
  // vraiment des produits disponibles apparaissent, avec leur nombre, comme
  // sur le menu de filtrage d'Amazon
  useEffect(() => {
    ProduitsApi.listerProduits({ disponible: "true" })
      .then((res) => setProduits(res.produits || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend) : un
  // produit publié/rendu disponible par n'importe quel vendeur apparaît ici
  // sans rechargement de page ; un produit rendu indisponible ou supprimé en
  // disparaît de la même façon
  useEffect(() => {
    if (!produitEvent) return;
    const { type, data } = produitEvent;
    setProduits((liste) => {
      if (type === "produit.deleted" || data.est_disponible === false) {
        return liste.filter((p) => p.id !== data.id);
      }
      const existe = liste.some((p) => p.id === data.id);
      return existe
        ? liste.map((p) => (p.id === data.id ? { ...p, ...data } : p))
        : [...liste, data];
    });
  }, [produitEvent]);

  const produitsAffiches = useMemo(
    () => produits.map((p) => versProduitAffiche(p, t("profile.notSpecified"))),
    [produits, t]
  );

  const termeRecherche = _normaliser(recherche);

  // filtre par recherche texte seule (nom produit / nom vendeur) — sert de
  // base à toutes les facettes ci-dessous, pour que leurs compteurs
  // reflètent toujours la recherche en cours
  const produitsApresRecherche = produitsAffiches.filter((p) =>
    !termeRecherche ||
    _normaliser(p.nom).includes(termeRecherche) ||
    _normaliser(p.vendeurNom).includes(termeRecherche)
  );

  // un prédicat par dimension de filtre — utilisé à la fois pour calculer
  // les options de chaque facette (en excluant sa propre dimension, pour que
  // ses compteurs restent utiles une fois elle-même partiellement cochée) et
  // pour le filtrage final du catalogue (voir appliquerFiltres ci-dessous)
  const predicats = {
    categorie: (p) => categorieIds.length === 0 || categorieIds.includes(String(p.categorieId)),
    sousCategorie: (p) => sousCategorieIds.length === 0 || sousCategorieIds.includes(String(p.sousCategorieId)),
    departement: (p) => departements.length === 0 || departements.includes(p.departement),
    commune: (p) => communes.length === 0 || communes.includes(p.commune),
    sectionComunale: (p) => sectionsComunales.length === 0 || sectionsComunales.includes(p.sectionComunale),
    prix: (p) => {
      if (prixMin !== "" && (p.prix == null || p.prix < Number(prixMin))) return false;
      if (prixMax !== "" && (p.prix == null || p.prix > Number(prixMax))) return false;
      return true;
    },
  };

  const appliquerFiltres = (liste, exclure) =>
    Object.entries(predicats)
      .filter(([dimension]) => dimension !== exclure)
      .reduce((acc, [, predicat]) => acc.filter(predicat), liste);

  // options de facette : dérivées des produits déjà filtrés par recherche +
  // toutes les AUTRES facettes déjà cochées (drill-down — cocher un
  // département ne laisse apparaître, dans "Commune", que les communes de ce
  // département, même principe que la cascade département→commune→section
  // de AjouterProduit.jsx, appliqué ici au filtrage plutôt qu'à la création)
  function compterOptions(champ, exclure) {
    const compte = new Map();
    appliquerFiltres(produitsApresRecherche, exclure).forEach((p) => {
      const valeur = p[champ];
      if (!valeur) return;
      const cle = String(valeur);
      const label = champ === "categorieId" ? p.categorieNom : champ === "sousCategorieId" ? p.sousCategorieNom : valeur;
      const entree = compte.get(cle) || { value: cle, label, count: 0 };
      entree.count += 1;
      compte.set(cle, entree);
    });
    return Array.from(compte.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  const categorieOptions = useMemo(
    () => compterOptions("categorieId", "categorie"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produitsApresRecherche, sousCategorieIds, departements, communes, sectionsComunales, prixMin, prixMax]
  );
  const sousCategorieOptions = useMemo(
    () => compterOptions("sousCategorieId", "sousCategorie"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produitsApresRecherche, categorieIds, departements, communes, sectionsComunales, prixMin, prixMax]
  );
  const departementOptions = useMemo(
    () => compterOptions("departement", "departement"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produitsApresRecherche, categorieIds, sousCategorieIds, communes, sectionsComunales, prixMin, prixMax]
  );
  const communeOptions = useMemo(
    () => compterOptions("commune", "commune"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produitsApresRecherche, categorieIds, sousCategorieIds, departements, sectionsComunales, prixMin, prixMax]
  );
  const sectionComunaleOptions = useMemo(
    () => compterOptions("sectionComunale", "sectionComunale"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produitsApresRecherche, categorieIds, sousCategorieIds, departements, communes, prixMin, prixMax]
  );

  // résultat final : recherche + toutes les facettes (multi-sélection : OR à
  // l'intérieur d'une facette, AND entre facettes — même principe que le
  // menu de filtrage d'Amazon)
  const produitsFiltres = appliquerFiltres(produitsApresRecherche, null);
  const produitsPage = produitsFiltres.slice(0, nombreAffiche);

  const nombreFiltresActifs =
    categorieIds.length + sousCategorieIds.length + departements.length + communes.length +
    sectionsComunales.length + (prixMin !== "" ? 1 : 0) + (prixMax !== "" ? 1 : 0);

  // revient à la première page de résultats à chaque changement de
  // recherche ou de filtre — sinon "Afficher plus" resterait sur une valeur
  // élevée alors que le nouveau résultat filtré est plus court
  useEffect(() => {
    setNombreAffiche(TAILLE_PAGE);
  }, [termeRecherche, categorieIds, sousCategorieIds, departements, communes, sectionsComunales, prixMin, prixMax]);

  // synchronise l'état vers l'URL pour que le catalogue filtré reste
  // partageable/rechargeable
  const majParams = (surcharge) => {
    const q = surcharge.q !== undefined ? surcharge.q : recherche;
    const categorie = surcharge.categorie !== undefined ? surcharge.categorie : categorieIds;
    const sousCategorie = surcharge.sousCategorie !== undefined ? surcharge.sousCategorie : sousCategorieIds;
    const departement = surcharge.departement !== undefined ? surcharge.departement : departements;
    const commune = surcharge.commune !== undefined ? surcharge.commune : communes;
    const sectionComunale = surcharge.sectionComunale !== undefined ? surcharge.sectionComunale : sectionsComunales;
    const prixMinVal = surcharge.prixMin !== undefined ? surcharge.prixMin : prixMin;
    const prixMaxVal = surcharge.prixMax !== undefined ? surcharge.prixMax : prixMax;

    const params = {};
    if (q.trim()) params.q = q.trim();
    if (categorie.length > 0) params.categorie = categorie.join(",");
    if (sousCategorie.length > 0) params.sous_categorie = sousCategorie.join(",");
    if (departement.length > 0) params.departement = departement.join(",");
    if (commune.length > 0) params.commune = commune.join(",");
    if (sectionComunale.length > 0) params.section_comunale = sectionComunale.join(",");
    if (prixMinVal !== "") params.prix_min = prixMinVal;
    if (prixMaxVal !== "") params.prix_max = prixMaxVal;
    setSearchParams(params, { replace: true });
  };

  const modifierRecherche = (valeur) => {
    setRecherche(valeur);
    majParams({ q: valeur });
  };

  const toggleValeur = (liste, setListe, cle, valeur) => {
    const nouvelleListe = liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
    setListe(nouvelleListe);
    majParams({ [cle]: nouvelleListe });
  };

  const modifierPrixMin = (valeur) => {
    setPrixMin(valeur);
    majParams({ prixMin: valeur });
  };

  const modifierPrixMax = (valeur) => {
    setPrixMax(valeur);
    majParams({ prixMax: valeur });
  };

  const reinitialiserFiltres = () => {
    setCategorieIds([]);
    setSousCategorieIds([]);
    setDepartements([]);
    setCommunes([]);
    setSectionsComunales([]);
    setPrixMin("");
    setPrixMax("");
    majParams({ categorie: [], sousCategorie: [], departement: [], commune: [], sectionComunale: [], prixMin: "", prixMax: "" });
  };

  // voir HomePage.jsx::contacterProduit pour le détail du choix (messagerie
  // si connecté, sinon simple confirmation)
  const contacterProduit = (produit) => {
    ProduitsApi.contacterProduit(produit.id).catch(() => {});
    if (isConnected && produit.vendeurId) {
      navigate(`/messages?avec=${produit.vendeurId}&produit=${produit.id}`);
      return;
    }
    setMessageContact(t("home.contactRecorded"));
    setTimeout(() => setMessageContact(null), 3000);
  };

  const panneauFiltres = (
    <>
      <div className="ap2-sidebar__header">
        <h2 className="ap2-sidebar__titre">
          <SlidersHorizontal size={16} />
          {t("catalog.filters")}
        </h2>
        {nombreFiltresActifs > 0 && (
          <button type="button" className="ap2-sidebar__reset" onClick={reinitialiserFiltres}>
            {t("catalog.resetFilters")}
          </button>
        )}
      </div>

      <SectionPrix
        titre={t("catalog.filterPrice")}
        prixMin={prixMin}
        prixMax={prixMax}
        onChangeMin={modifierPrixMin}
        onChangeMax={modifierPrixMax}
        placeholderMin={t("catalog.priceMin")}
        placeholderMax={t("catalog.priceMax")}
      />
      <SectionFiltre
        titre={t("catalog.filterCategory")}
        options={categorieOptions}
        valeursSelectionnees={categorieIds}
        onToggle={(v) => toggleValeur(categorieIds, setCategorieIds, "categorie", v)}
      />
      <SectionFiltre
        titre={t("catalog.filterSubCategory")}
        options={sousCategorieOptions}
        valeursSelectionnees={sousCategorieIds}
        onToggle={(v) => toggleValeur(sousCategorieIds, setSousCategorieIds, "sousCategorie", v)}
      />
      <SectionFiltre
        titre={t("catalog.filterDepartment")}
        options={departementOptions}
        valeursSelectionnees={departements}
        onToggle={(v) => toggleValeur(departements, setDepartements, "departement", v)}
      />
      <SectionFiltre
        titre={t("catalog.filterCommune")}
        options={communeOptions}
        valeursSelectionnees={communes}
        onToggle={(v) => toggleValeur(communes, setCommunes, "commune", v)}
      />
      <SectionFiltre
        titre={t("catalog.filterSection")}
        options={sectionComunaleOptions}
        valeursSelectionnees={sectionsComunales}
        onToggle={(v) => toggleValeur(sectionsComunales, setSectionsComunales, "sectionComunale", v)}
      />
    </>
  );

  return (
    <div className="ap2-page">
      <NavBar />

      <div className="ap2-container">
        <div className="ap2-header">
          <div className="ap2-header__icon"><Sprout size={22} /></div>
          <div>
            <h1 className="ap2-header__title">{t("catalog.title")}</h1>
            <p className="ap2-header__subtitle">{t("catalog.subtitle")}</p>
          </div>
        </div>

        <div className="ap2-search">
          <Search size={16} className="ap2-search__icon" />
          <input
            type="text"
            className="ap2-search__input"
            placeholder={t("home.searchPlaceholder")}
            value={recherche}
            onChange={(e) => modifierRecherche(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="ap2-filtres-toggle"
          onClick={() => setFiltresOuverts((o) => !o)}
        >
          <SlidersHorizontal size={16} />
          {t("catalog.filters")}
          {nombreFiltresActifs > 0 && <span className="ap2-filtres-toggle__badge">{nombreFiltresActifs}</span>}
        </button>

        <div className="ap2-layout">
          {filtresOuverts && (
            <aside className="ap2-sidebar">
              <button
                type="button"
                className="ap2-sidebar__fermer"
                onClick={() => setFiltresOuverts(false)}
                aria-label={t("catalog.closeFilters")}
              >
                <X size={18} />
              </button>
              {panneauFiltres}
            </aside>
          )}

          <div className="ap2-main">
            {chargement && <p className="ap2-hint">{t("home.loadingProducts")}</p>}
            {!chargement && erreur && <p className="ap2-alert ap2-alert--error">{erreur}</p>}
            {!chargement && !erreur && produitsAffiches.length === 0 && (
              <p className="ap2-hint">{t("home.noProductsYet")}</p>
            )}
            {!chargement && !erreur && produitsAffiches.length > 0 && produitsFiltres.length === 0 && (
              <p className="ap2-hint">
                {termeRecherche ? t("catalog.noResults", { terme: recherche }) : t("catalog.noResultsFilters")}
              </p>
            )}

            {messageContact && <p className="ap2-alert ap2-alert--succes">{messageContact}</p>}

            {!chargement && !erreur && produitsPage.length > 0 && (
              <>
                <p className="ap2-compteur">
                  {t("catalog.showingCount", { affiche: produitsPage.length, total: produitsFiltres.length })}
                </p>
                <div className="ap2-grid">
                  {produitsPage.map((p) => (
                    <ProductCard
                      key={p.id}
                      produit={p}
                      onDetails={(pr) => navigate(`/produits/detail?id=${pr.id}`)}
                      onContact={contacterProduit}
                    />
                  ))}
                </div>
                {produitsFiltres.length > produitsPage.length && (
                  <div className="ap2-voir-plus">
                    <button
                      type="button"
                      className="ap2-voir-plus__btn"
                      onClick={() => setNombreAffiche((n) => n + TAILLE_PAGE)}
                    >
                      {t("catalog.showMore")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

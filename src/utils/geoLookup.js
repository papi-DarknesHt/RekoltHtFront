import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import departementsData from "../assets/Departements/haiti_departements.json";
import { normaliser } from "./normaliserTexte.js";

// Couches GeoJSON HDX (départements/communes/sections communales), chargées
// à la demande (voir chargerCouches) — ~1,3 Mo au total une fois simplifiées
// (voir scripts de génération), jamais inclus dans le bundle principal.
let couchesPromise = null;

function chargerCouches() {
  if (!couchesPromise) {
    couchesPromise = Promise.all([
      import("../assets/geo/hti_admin1.json"),
      import("../assets/geo/hti_admin2.json"),
      import("../assets/geo/hti_admin3.json"),
    ]).then(([adm1, adm2, adm3]) => ({
      adm1: adm1.default.features,
      adm2: adm2.default.features,
      adm3: adm3.default.features,
    }));
  }
  return couchesPromise;
}

function trouverPolygoneContenant(pt, features) {
  for (const feature of features) {
    try {
      if (booleanPointInPolygon(pt, feature)) return feature;
    } catch {
      // géométrie invalide isolée : on l'ignore plutôt que de faire échouer toute la recherche
    }
  }
  return null;
}

// fait correspondre un nom brut du GeoJSON (graphie HDX) à la graphie
// officielle utilisée dans haiti_departements.json (référentiel des <select>)
function correspondre(nom, options, extraireNom) {
  if (!nom) return null;
  const cible = normaliser(nom);
  return options.find((o) => normaliser(extraireNom(o)) === cible) || null;
}

// résout un point GPS en {departement, commune, section_communale} avec les
// graphies officielles du référentiel local. Chaque niveau peut être null
// indépendamment (point hors des polygones connus — mer, hors frontière —
// ou nom sans correspondance dans le référentiel) ; jamais de valeur null
// "au milieu" de la hiérarchie (ex. commune non-null avec departement null),
// voir fusionnerLocalisationDetectee qui s'appuie sur cette garantie.
export async function resoudreLocalisation(lat, lon) {
  const { adm1, adm2, adm3 } = await chargerCouches();
  const pt = point([lon, lat]);

  const featDep = trouverPolygoneContenant(pt, adm1);
  if (!featDep) return { departement: null, commune: null, section_communale: null };

  const dep = correspondre(featDep.properties.adm1_name1, departementsData, (d) => d.departement);
  if (!dep) return { departement: null, commune: null, section_communale: null };

  const communesDuDep = adm2.filter((f) => f.properties.adm1_pcode === featDep.properties.adm1_pcode);
  const featCom = trouverPolygoneContenant(pt, communesDuDep);
  if (!featCom) return { departement: dep.departement, commune: null, section_communale: null };

  const com = correspondre(featCom.properties.adm2_name1, dep.communes, (c) => c.commune);
  if (!com) return { departement: dep.departement, commune: null, section_communale: null };

  const sectionsDeCommune = adm3.filter((f) => f.properties.adm2_pcode === featCom.properties.adm2_pcode);
  const featSection = trouverPolygoneContenant(pt, sectionsDeCommune);
  const section = featSection
    ? com.sections_communales.find((s) => normaliser(s) === normaliser(featSection.properties.adm3_name1)) || null
    : null;

  return { departement: dep.departement, commune: com.commune, section_communale: section };
}

// niveau atteint par une résolution — ne dépend que de `loc` (jamais de
// l'état du formulaire), utilisable indépendamment de fusionnerLocalisationDetectee
// pour éviter de capturer un état obsolète dans un callback asynchrone
// (voir DevenirVendeur.jsx : onLocalisationDetectee arrive après un délai
// réseau, un `form` capturé à ce moment-là serait périmé).
export function niveauDetecteDepuisLoc(loc) {
  if (!loc || (!loc.departement && !loc.commune && !loc.section_communale)) return "aucun";
  return loc.section_communale ? "section" : loc.commune ? "commune" : "departement";
}

// fusionne un résultat de resoudreLocalisation avec l'état courant du
// formulaire, en respectant la hiérarchie département > commune > section :
// - un niveau détecté et différent de l'existant est appliqué, et tout ce
//   qui est en dessous est vidé (il ne peut plus être valide pour ce parent) ;
// - un niveau non détecté est vidé si son parent vient de changer, mais
//   préservé si le parent est resté identique (nouvel essai sur le même
//   point, ou détection partielle isolée) ;
// - si rien n'est détecté du tout, l'état existant n'est pas touché.
// `champs` permet d'adapter les noms de clés du formulaire appelant (ex.
// section_comunale dans AjouterProduit vs section_communale ailleurs).
// IMPORTANT : `prev` doit toujours venir d'un updater fonctionnel
// (setForm(prev => ...)), jamais d'un `form` capturé dans une closure —
// cette fonction est typiquement appelée depuis un callback asynchrone
// (résolution géographique après le clic), et un `form` de closure serait
// périmé au moment où le callback s'exécute réellement (voir bug corrigé
// dans DevenirVendeur.jsx : le coord posé par onChange se faisait écraser
// par ce merge basé sur un état obsolète).
export function fusionnerLocalisationDetectee(prev, loc, champs = {}) {
  const cleDep = champs.departement || "departement";
  const cleCom = champs.commune || "commune";
  const cleSection = champs.section || "section_communale";

  if (!loc || (!loc.departement && !loc.commune && !loc.section_communale)) {
    return { valeurs: prev, niveauDetecte: "aucun" };
  }

  const departementChange = !!loc.departement && loc.departement !== prev[cleDep];
  const departement = loc.departement || prev[cleDep];

  const communeChange = !!loc.commune && loc.commune !== prev[cleCom];
  const commune = loc.commune || (departementChange ? "" : prev[cleCom]);

  const section = loc.section_communale || (departementChange || communeChange ? "" : prev[cleSection]);

  return {
    valeurs: { ...prev, [cleDep]: departement, [cleCom]: commune, [cleSection]: section },
    niveauDetecte: niveauDetecteDepuisLoc(loc),
  };
}

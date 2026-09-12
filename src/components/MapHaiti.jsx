import { useEffect, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { ProduitsApi } from "../api/produits";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import logoSite from "../assets/Images/Asset5.svg";

// Taille de la carte
const MAP_SIZE = { width: "100%", height: "260px" };

// Centré sur Haïti (utilisé tant qu'on n'a pas la position réelle)
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Distance au-delà de laquelle un vendeur est considéré "loin"
const SEUIL_LOIN_KM = 10;

// Icône de marqueur — un petit repère "épingle" générique (même forme pour
// tous les vendeurs, coloré selon le code pré/loin déjà utilisé), PAS la
// photo du vendeur en gros cercle comme avant : avec beaucoup de vendeurs
// proches les uns des autres, ces cercles de 44px se chevauchaient et
// encombraient la carte (demande explicite). La photo/le logo reste visible
// au survol/clic (voir InfoWindow ci-dessous, inchangé) — seul le marqueur
// posé sur la carte change. Symbole vectoriel (google.maps.Symbol, pas un
// data URI image) : net à tout niveau de zoom, sans requête réseau.
const CHEMIN_EPINGLE = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

function iconeMarqueurVendeur(couleur) {
  return {
    path: CHEMIN_EPINGLE,
    fillColor: couleur,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 1.5,
    scale: 1.15,   // ~28px de haut, contre 44px pour l'ancien cercle-photo
    // la pointe de l'épingle (bas du chemin, pas son centre) doit toucher la
    // coordonnée GPS exacte — sinon le marqueur semble flotter à côté du point
    anchor: new window.google.maps.Point(12, 22),
  };
}

// Distance à vol d'oiseau entre deux points GPS (formule de Haversine), en km
function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function MapHaiti() {
  const { t } = useTranslation();
  // Charge l'API Google Maps avec la clé depuis .env
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  // Position réelle de l'utilisateur (fallback : centre d'Haïti)
  const [position, setPosition] = useState(CENTRE_HAITI);
  const [vendeurs, setVendeurs] = useState([]);
  const [vendeurSurvole, setVendeurSurvole] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition(CENTRE_HAITI),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // vendeurs ayant au moins un produit disponible et une position GPS connue
  // (voir Produits/views/produitsViews.py::listerVendeursCarte) — public,
  // aucune connexion requise
  const chargerVendeurs = () => {
    ProduitsApi.listerVendeursCarte()
      .then((res) => setVendeurs(res.vendeurs || []))
      .catch(() => {});
  };
  useEffect(chargerVendeurs, []);

  // rattrapage temps réel : un vendeur qui change ses coordonnées GPS depuis
  // "Modifier mon profil" (individuel : profilEvent, déjà global — entreprise :
  // entrepriseLocalisationEvent, voir Registration/signals.py::
  // broadcast_entreprise) ne se reflétait auparavant qu'après un rechargement
  // manuel de la page d'accueil, la carte gardait la position captée au tout
  // premier chargement. Un simple refetch (liste courte, page peu fréquentée)
  // reste plus simple/sûr qu'un patch en place — même principe que
  // Messagerie.jsx pour mesConversations().
  const profilEvent = useGlobalStore((s) => s.profilEvent);
  const entrepriseLocalisationEvent = useGlobalStore((s) => s.entrepriseLocalisationEvent);
  useEffect(() => {
    if (!profilEvent) return;
    chargerVendeurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilEvent]);
  useEffect(() => {
    if (!entrepriseLocalisationEvent) return;
    chargerVendeurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepriseLocalisationEvent]);
  // rattrapage après une coupure WebSocket (voir reconnectedAt, api/globalStore.js) —
  // un changement de coordonnées diffusé PENDANT la coupure serait sinon perdu
  const reconnectedAt = useGlobalStore((s) => s.reconnectedAt);
  useEffect(() => {
    if (!reconnectedAt) return;
    chargerVendeurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectedAt]);

  const vendeurAffiche = vendeurs.find((v) => v.vendeur_id === vendeurSurvole) || null;

  // icônes calculées une seule fois (pas à chaque rendu, voir ci-dessous
  // pourquoi ça compte) — seules 2 variantes possibles (proche/loin), pas la
  // peine d'en recréer une par vendeur ni de les reconstruire à chaque survol
  const iconesParStatut = useMemo(() => (
    isLoaded ? { proche: iconeMarqueurVendeur("#f5f0c0"), loin: iconeMarqueurVendeur("#e23") } : null
  ), [isLoaded]);

  // Affiche un placeholder pendant le chargement
  if (!isLoaded) {
    return (
      <div style={{
        background: "#f6f4f1",
        borderRadius: "14px",
        height: "260px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.7)",
        fontSize: "14px"
      }}>
        {t("map.loading")}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: "14px", overflow: "hidden", position: "relative" }}>
      <GoogleMap
        mapContainerStyle={MAP_SIZE}
        center={position}
        zoom={9}
        options={{
          disableDefaultUI: false,  // garde les contrôles +/-
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {/* Un marqueur (épingle) par vendeur (position exacte issue de son
            profil/entreprise) — crème = proche (≤10km), rouge = loin
            (>10km). Le survol/clic affiche sa photo/logo et ses infos dans
            l'InfoWindow ci-dessous (voir listerVendeursCarte,
            Produits/views/produitsViews.py) — inchangé, seul le marqueur
            posé sur la carte est désormais une petite épingle plutôt qu'un
            gros cercle-photo (voir iconeMarqueurVendeur ci-dessus). */}
        {vendeurs.map((v) => {
          const distance = distanceKm(position, { lat: v.latitude, lng: v.longitude });
          const loin = distance > SEUIL_LOIN_KM;
          return (
            <Marker
              key={v.vendeur_id}
              position={{ lat: v.latitude, lng: v.longitude }}
              title={v.nom}
              onMouseOver={() => setVendeurSurvole(v.vendeur_id)}
              onMouseOut={() => setVendeurSurvole((id) => (id === v.vendeur_id ? null : id))}
              onClick={() => setVendeurSurvole((id) => (id === v.vendeur_id ? null : v.vendeur_id))}
              icon={loin ? iconesParStatut.loin : iconesParStatut.proche}
            />
          );
        })}

        {vendeurAffiche && (
          <InfoWindow
            position={{ lat: vendeurAffiche.latitude, lng: vendeurAffiche.longitude }}
            onCloseClick={() => setVendeurSurvole(null)}
            // sans ça, Google Maps recentre légèrement la carte pour que la
            // bulle reste visible dès qu'elle s'ouvre — ce qui déplace le
            // marqueur sous un curseur resté immobile, déclenche mouseout
            // (ferme la bulle), la carte re-pan en arrière, mouseover
            // (rouvre la bulle)... boucle qui donnait l'effet de clignotement
            // au survol/clic (bug constaté, causé par l'ajout de l'InfoWindow)
            options={{ disableAutoPan: true }}
          >
            <div style={{ minWidth: "150px", fontFamily: "inherit", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <img
                src={vendeurAffiche.photo || logoSite}
                alt={vendeurAffiche.nom}
                style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  objectFit: vendeurAffiche.photo ? "cover" : "contain",
                  padding: vendeurAffiche.photo ? 0 : "4px",
                  background: "#f2f0eb", flexShrink: 0,
                }}
              />
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "13px" }}>{vendeurAffiche.nom}</p>
                {(vendeurAffiche.section_communale || vendeurAffiche.commune || vendeurAffiche.departement) && (
                  <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#555" }}>
                    {/* même format que la localisation d'un produit/profil
                        (voir utils/localisationProduit.js) : "Section
                        Communale, Commune, Département, Haïti" */}
                    {[vendeurAffiche.section_communale, vendeurAffiche.commune, vendeurAffiche.departement, t("auth.haiti")]
                      .filter(Boolean).join(", ")}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
                  {t("home.mapSellerProductCount", { nombre: vendeurAffiche.nombre_produits })}
                </p>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Badge nombre de vendeurs actifs */}
      <div style={{
        position: "absolute",
        bottom: "12px", right: "12px",
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        fontSize: "11px",
        padding: "4px 10px",
        borderRadius: "20px",
      }}>
        {t("home.mapActiveSellerCount", { nombre: vendeurs.length })}
      </div>
    </div>
  );
}

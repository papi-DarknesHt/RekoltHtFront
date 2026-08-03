import { useEffect, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { ProduitsApi } from "../api/produits";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import logoSite from "../assets/Images/Asset5.svg";

// Taille de la carte
const MAP_SIZE = { width: "100%", height: "260px" };

// Centré sur Haïti (utilisé tant qu'on n'a pas la position réelle)
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Distance au-delà de laquelle un vendeur est considéré "loin"
const SEUIL_LOIN_KM = 10;

// Icône de marqueur circulaire (photo de profil du vendeur, ou logo du site
// si le vendeur n'en a pas) avec un anneau coloré reprenant le code
// pré/loin déjà utilisé sur les marqueurs — construite comme un data URI SVG
// (pas un canvas) : la balise <image> référence l'URL directement, ce que le
// moteur de rendu SVG charge comme une <img> normale, sans jamais lire les
// pixels en JS. Ça évite tout souci de canvas "taint" par CORS que poserait
// un data URI généré via canvas.toDataURL() sur une photo hébergée ailleurs.
function construireIconeVendeur(photoUrl, couleurAnneau) {
  const taille = 44;
  const rayon = taille / 2;
  // échappe les caractères XML réservés (une URL réelle — Cloudinary,
  // Django media — peut contenir "&" dans sa query string, ce qui casserait
  // le XML du SVG sans cet échappement)
  const hrefEchappe = photoUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
    <defs><clipPath id="rond"><circle cx="${rayon}" cy="${rayon}" r="${rayon - 4}" /></clipPath></defs>
    <circle cx="${rayon}" cy="${rayon}" r="${rayon - 2}" fill="#fff" stroke="${couleurAnneau}" stroke-width="3.5" />
    <image href="${hrefEchappe}" x="4" y="4" width="${taille - 8}" height="${taille - 8}" clip-path="url(#rond)" preserveAspectRatio="xMidYMid slice" />
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(taille, taille),
    anchor: new window.google.maps.Point(rayon, rayon),
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
  useEffect(() => {
    ProduitsApi.listerVendeursCarte()
      .then((res) => setVendeurs(res.vendeurs || []))
      .catch(() => {});
  }, []);

  const vendeurAffiche = vendeurs.find((v) => v.vendeur_id === vendeurSurvole) || null;

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
        {/* Notre position */}
        <Marker
          position={position}
          title={t("map.here")}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          }}
        />

        {/* Un marqueur par vendeur (position exacte issue de son profil/entreprise) —
            photo de profil/logo d'entreprise si disponible, sinon le logo du
            site (voir listerVendeursCarte, Produits/views/produitsViews.py) ;
            anneau crème = pre (≤10km), rouge = loin (>10km), même code
            couleur que la légende affichée sous la carte (voir HomePage.jsx) */}
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
              icon={construireIconeVendeur(v.photo || logoSite, loin ? "#e23" : "#f5f0c0")}
            />
          );
        })}

        {vendeurAffiche && (
          <InfoWindow
            position={{ lat: vendeurAffiche.latitude, lng: vendeurAffiche.longitude }}
            onCloseClick={() => setVendeurSurvole(null)}
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
                {(vendeurAffiche.commune || vendeurAffiche.departement) && (
                  <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#555" }}>
                    {[vendeurAffiche.commune, vendeurAffiche.departement].filter(Boolean).join(", ")}
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

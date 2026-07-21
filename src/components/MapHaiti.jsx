import { useEffect, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

// Taille de la carte
const MAP_SIZE = { width: "100%", height: "260px" };

// Centré sur Haïti (utilisé tant qu'on n'a pas la position réelle)
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Distance au-delà de laquelle un produit est considéré "loin"
const SEUIL_LOIN_KM = 10;

// Produits avec leurs coordonnées GPS
const MARQUEURS = [
  { id: 1, nom: "Zaboka",  lat: 19.1467, lng: -71.8489 }, // Hinche
  { id: 2, nom: "Sitwon",  lat: 18.7896, lng: -72.1234 }, // Mayisad
  { id: 3, nom: "Kalalou", lat: 19.1467, lng: -71.8489 }, // Hinche
  { id: 4, nom: "Mango",   lat: 19.4500, lng: -72.6833 }, // Gonaïves
  { id: 5, nom: "Bannann", lat: 18.2342, lng: -72.5345 }, // Jacmel
];

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
  // Charge l'API Google Maps avec la clé depuis .env
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  // Position réelle de l'utilisateur (fallback : centre d'Haïti)
  const [position, setPosition] = useState(CENTRE_HAITI);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition(CENTRE_HAITI),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Marqueurs enrichis avec la distance réelle et le statut "loin"
  const marqueurs = useMemo(
    () =>
      MARQUEURS.map((m) => {
        const distance = distanceKm(position, m);
        return { ...m, distance, loin: distance > SEUIL_LOIN_KM };
      }),
    [position]
  );

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
        Chargement kat...
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
          title="Ou la"
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          }}
        />

        {/* Un marqueur par produit — crème = pre (≤10km), rouge = loin (>10km) */}
        {marqueurs.map((m) => (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={`${m.nom} — ${m.distance.toFixed(1)} km`}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor:   m.loin ? "#e23" : "#f5f0c0",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>

      {/* Badge nombre de produits actifs */}
      <div style={{
        position: "absolute",
        bottom: "12px", right: "12px",
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        fontSize: "11px",
        padding: "4px 10px",
        borderRadius: "20px",
      }}>
        {MARQUEURS.length} pwodikte aktif
      </div>
    </div>
  );
}
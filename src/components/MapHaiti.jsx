import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

// Taille de la carte
const MAP_SIZE = { width: "100%", height: "260px" };

// Centré sur Haïti
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Produits avec leurs coordonnées GPS
const MARQUEURS = [
  { id: 1, nom: "Zaboka",  lat: 19.1467, lng: -71.8489, loin: true  }, // Hinche
  { id: 2, nom: "Sitwon",  lat: 18.7896, lng: -72.1234, loin: false }, // Mayisad
  { id: 3, nom: "Kalalou", lat: 19.1467, lng: -71.8489, loin: false }, // Hinche
  { id: 4, nom: "Mango",   lat: 19.4500, lng: -72.6833, loin: true  }, // Gonaïves
  { id: 5, nom: "Bannann", lat: 18.2342, lng: -72.5345, loin: false }, // Jacmel
];

export default function MapHaiti() {
  // Charge l'API Google Maps avec la clé depuis .env
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  // Affiche un placeholder pendant le chargement
  if (!isLoaded) {
    return (
      <div style={{
        background: "#2d6b2d",
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
        center={CENTRE_HAITI}
        zoom={8}
        options={{
          disableDefaultUI: false,  // garde les contrôles +/-
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {/* Un marqueur par produit */}
        {MARQUEURS.map((m) => (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.nom}
            // rouge = loin, jaune = près
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
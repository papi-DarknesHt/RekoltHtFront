import { useEffect, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useTranslation } from "../assets/Translate/i18n.jsx";

const MAP_SIZE = { width: "100%", height: "260px" };
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Variante de MapHaiti.jsx dédiée à la sélection d'un point GPS précis :
// centre sur la position du navigateur (ou une adresse recherchée en repli),
// et pose le marqueur définitif uniquement au clic — équivalent web de
// l'appui long mobile.
export default function MapSelectionGPS({ value, onChange }) {
  const { t } = useTranslation();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  const [center, setCenter] = useState(CENTRE_HAITI);
  const [zoom, setZoom] = useState(9);
  const [localisation, setLocalisation] = useState(true);   // localisation navigateur en cours
  const [geoRefusee, setGeoRefusee] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [rechercheErreur, setRechercheErreur] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoRefusee(true);
      setLocalisation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setZoom(15);
        setLocalisation(false);
      },
      () => {
        setGeoRefusee(true);
        setLocalisation(false);
      },
      { timeout: 8000 }
    );
  }, []);

  const rechercherAdresse = () => {
    if (!adresse.trim() || !window.google) return;
    setRechercheEnCours(true);
    setRechercheErreur(null);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: adresse, region: "ht" }, (resultats, status) => {
      setRechercheEnCours(false);
      if (status === "OK" && resultats[0]) {
        const loc = resultats[0].geometry.location;
        setCenter({ lat: loc.lat(), lng: loc.lng() });
        setZoom(15);
      } else {
        setRechercheErreur(t("seller.gpsAddressNotFound"));
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="dv-map-loading">{t("seller.gpsLocating")}</div>
    );
  }

  return (
    <div className="dv-map-wrap">
      {geoRefusee && (
        <div className="dv-map-address-fallback">
          <input
            className="rk-input"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder={t("seller.gpsAddressPlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rechercherAdresse(); } }}
          />
          <button type="button" className="rk-btn dv-btn-secondary" onClick={rechercherAdresse} disabled={rechercheEnCours}>
            {rechercheEnCours ? t("seller.gpsSearching") : t("seller.gpsSearchButton")}
          </button>
          {rechercheErreur && <p className="rk-error">✗ {rechercheErreur}</p>}
        </div>
      )}

      <div style={{ borderRadius: "14px", overflow: "hidden", position: "relative" }}>
        <GoogleMap
          mapContainerStyle={MAP_SIZE}
          center={center}
          zoom={zoom}
          onClick={(e) => onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
          }}
        >
          {value && <Marker position={value} />}
        </GoogleMap>
      </div>

      <p className="dv-map-hint">
        {localisation
          ? t("seller.gpsLocating")
          : value
            ? t("seller.gpsSelectedCoord", { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })
            : t("seller.gpsHintClick")}
      </p>
    </div>
  );
}

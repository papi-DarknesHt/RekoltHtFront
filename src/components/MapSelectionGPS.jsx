import { useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { resoudreLocalisation } from "../utils/geoLookup.js";
import { adresseApproximative } from "../utils/nominatim.js";

const MAP_SIZE = { width: "100%", height: "260px" };
const CENTRE_HAITI = { lat: 18.9712, lng: -72.2852 };

// Variante de MapHaiti.jsx dédiée à la sélection d'un point GPS précis :
// centre sur la position du navigateur (ou une adresse recherchée en repli),
// et pose le marqueur définitif uniquement au clic — équivalent web de
// l'appui long mobile. Chaque point posé déclenche aussi une résolution
// département/commune/section (point-in-polygon, voir geoLookup.js) et une
// adresse approximative (Nominatim) transmises au parent via les callbacks
// optionnelles onLocalisationDetectee / onAdresseDetectee — le parent reste
// libre de pré-remplir ou non ses propres champs avec ces valeurs.
export default function MapSelectionGPS({ value, onChange, onLocalisationDetectee, onAdresseDetectee }) {
  const { t } = useTranslation();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  const [center, setCenter] = useState(CENTRE_HAITI);
  const [zoom, setZoom] = useState(9);
  const [localisation, setLocalisation] = useState(true);   // localisation navigateur en cours
  const [detectionEnCours, setDetectionEnCours] = useState(false);
  // secours si le clic sur la carte ne fonctionne pas (ex. rendu WebGL
  // indisponible côté navigateur — la carte se rabat alors sur une image
  // statique non cliquable) : saisie manuelle des coordonnées, repliée par défaut
  const [saisieManuelleOuverte, setSaisieManuelleOuverte] = useState(false);
  const [latManuelle, setLatManuelle] = useState("");
  const [lngManuelle, setLngManuelle] = useState("");
  const [erreurManuelle, setErreurManuelle] = useState(null);

  // ignore les réponses de détection devenues obsolètes (clic suivant parti
  // avant que la résolution du clic précédent ne soit revenue)
  const detectionIdRef = useRef(0);
  const abortRef = useRef(null);

  const placerPoint = (coord) => {
    onChange(coord);

    const idAppel = ++detectionIdRef.current;
    setDetectionEnCours(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    resoudreLocalisation(coord.lat, coord.lng)
      .then((res) => {
        if (idAppel !== detectionIdRef.current || !res) return;
        onLocalisationDetectee?.(res);
      })
      .catch(() => {});

    adresseApproximative(coord.lat, coord.lng, { signal: controller.signal })
      .then((texte) => {
        if (idAppel !== detectionIdRef.current || !texte) return;
        onAdresseDetectee?.(texte);
      })
      .catch(() => {})
      .finally(() => {
        if (idAppel === detectionIdRef.current) setDetectionEnCours(false);
      });
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocalisation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(coord);
        setZoom(15);
        setLocalisation(false);
        // ne place/détecte automatiquement que si aucun point n'est déjà
        // choisi (ex. prérempli depuis le compte) — sinon on ne fait que
        // recentrer la carte, sans écraser le choix existant
        if (!value) placerPoint(coord);
      },
      () => setLocalisation(false),
      { timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validerCoordonneesManuelles = () => {
    const lat = Number(latManuelle);
    const lng = Number(lngManuelle);
    setErreurManuelle(null);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || latManuelle.trim() === "" || lngManuelle.trim() === "") {
      setErreurManuelle(t("seller.gpsManualInvalid"));
      return;
    }
    const coord = { lat, lng };
    setCenter(coord);
    setZoom(15);
    placerPoint(coord);
  };

  if (!isLoaded) {
    return (
      <div className="dv-map-loading">{t("seller.gpsLocating")}</div>
    );
  }

  return (
    <div className="dv-map-wrap">
      <div style={{ borderRadius: "14px", overflow: "hidden", position: "relative" }}>
        <GoogleMap
          mapContainerStyle={MAP_SIZE}
          center={center}
          zoom={zoom}
          onClick={(e) => placerPoint({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
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
          : detectionEnCours
            ? t("seller.gpsDetecting")
            : value
              ? t("seller.gpsSelectedCoord", { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })
              : t("seller.gpsHintClick")}
      </p>

      {/* secours si ni le clic sur la carte ni la recherche d'adresse ne
          fonctionnent (voir commentaire plus haut) */}
      <button
        type="button"
        className="dv-map-manual-toggle"
        onClick={() => setSaisieManuelleOuverte((o) => !o)}
      >
        {saisieManuelleOuverte ? t("seller.gpsManualHide") : t("seller.gpsManualShow")}
      </button>

      {saisieManuelleOuverte && (
        <div className="dv-map-address-fallback">
          <input
            className="rk-input"
            type="number"
            step="any"
            value={latManuelle}
            onChange={(e) => setLatManuelle(e.target.value)}
            placeholder={t("seller.gpsManualLat")}
          />
          <input
            className="rk-input"
            type="number"
            step="any"
            value={lngManuelle}
            onChange={(e) => setLngManuelle(e.target.value)}
            placeholder={t("seller.gpsManualLng")}
          />
          <button type="button" className="rk-btn dv-btn-secondary" onClick={validerCoordonneesManuelles}>
            {t("seller.gpsManualApply")}
          </button>
        </div>
      )}
      {erreurManuelle && <p className="rk-error">✗ {erreurManuelle}</p>}
    </div>
  );
}

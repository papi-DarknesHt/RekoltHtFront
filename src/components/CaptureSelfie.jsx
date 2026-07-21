import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// Capture un selfie via la caméra du navigateur (getUserMedia) et renvoie un
// File JPEG au parent — avec repli sur <input type="file" capture="user">
// si la caméra est refusée/indisponible (courant sur certains navigateurs
// desktop ou en contexte non sécurisé).
export default function CaptureSelfie({ value, onChange }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [refuse, setRefuse] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Démarre la caméra tant qu'aucune photo n'est capturée ; s'arrête (cleanup)
  // dès qu'une valeur existe ou que le composant est démonté — évite de
  // dépendre du timing du ref vidéo dans un handler de clic (reprendre()).
  useEffect(() => {
    if (value) return;
    let annule = false;
    setRefuse(false);
    setPret(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia indisponible");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        });
        if (annule) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPret(true);
      } catch {
        if (!annule) setRefuse(true);
      }
    })();

    return () => {
      annule = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [value]);

  // aperçu de la photo déjà capturée (ou choisie via le repli fichier)
  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const capturer = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onChange(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  const handleFichierRepli = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) onChange(file);
  };

  if (value) {
    return (
      <div className="dv-selfie-wrap">
        <img src={previewUrl} alt="Selfie" className="dv-selfie-preview" />
        <button type="button" className="rk-btn dv-btn-secondary" onClick={() => onChange(null)}>
          {t("seller.selfieRetake")}
        </button>
      </div>
    );
  }

  if (refuse) {
    return (
      <div className="dv-selfie-wrap">
        <p className="dv-selfie-fallback-hint">{t("seller.selfieCameraDenied")}</p>
        <div className="dv-file-wrap">
          <label className="dv-file-label" htmlFor="dv-selfie-fallback-input">
            <span className="dv-file-icon">📷</span>
            {t("seller.fileChoose")}
          </label>
          <input
            id="dv-selfie-fallback-input"
            type="file"
            className="dv-file-input"
            accept="image/*"
            capture="user"
            onChange={handleFichierRepli}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dv-selfie-wrap">
      <div className="dv-selfie-camera">
        <video ref={videoRef} muted playsInline className="dv-selfie-video" />
        {!pret && <p className="dv-selfie-loading">{t("seller.selfieCameraLoading")}</p>}
      </div>
      <button type="button" className="rk-btn" onClick={capturer} disabled={!pret}>
        {t("seller.selfieTakePhoto")}
      </button>
    </div>
  );
}

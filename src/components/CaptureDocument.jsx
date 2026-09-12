import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { analyserImageStatique } from "../utils/analyseDocument.js";

const RATIO_CADRE = 1.586; // format carte ID-1 (ISO/IEC 7810), ex. CIN/permis
const TAILLE_MIN_RECADRAGE = 60; // largeur minimale (px, coordonnées affichées) du cadre de recadrage

const FEEDBACK_CLES = {
  dark:   "seller.documentFeedbackDark",
  blurry: "seller.documentFeedbackBlurry",
};

// Capture la photo d'une pièce d'identité.
//
// Approche volontairement simplifiée par rapport à une précédente version :
// plus de flux caméra en direct avec détection automatique du cadrage
// (getUserMedia + analyse image par image) — en pratique, une personne qui
// tient une pièce d'identité à la main ne peut jamais aligner un document
// parfaitement dans un cadre-guide fixe pour déclencher une capture
// "automatique dès que net et centré" de façon fiable (constaté en
// conditions réelles, voir conversation). À la place :
//   1. L'utilisateur prend une photo (appareil photo natif via
//      <input capture="environment">) ou en choisit une déjà existante.
//   2. Il RECADRE lui-même la zone du document sur cette photo (rectangle
//      déplaçable/redimensionnable, ratio carte ID-1 imposé) — un humain
//      recadre une pièce bien mieux qu'une heuristique de bords automatique.
//   3. Le recadrage validé est inspecté (luminosité/netteté, voir
//      analyserImageStatique) : tant que la lisibilité n'est pas jugée
//      suffisante, impossible de valider — l'utilisateur doit ajuster le
//      cadrage ou reprendre une autre photo. Seul un recadrage qui passe
//      cette inspection déclenche onChange (ce qui, dans DevenirVendeur.jsx,
//      active le bouton "Continuer" — aucune étape supplémentaire requise
//      côté formulaire).
export default function CaptureDocument({ value, onChange, label, ratioLibre = false, acceptPdf = false }) {
  const { t } = useTranslation();
  const imgRef = useRef(null);
  const zoneRef = useRef(null);
  const dragRef = useRef(null); // { type: 'deplacer'|'redimensionner', startX, startY, rectDepart }

  const [mode, setMode] = useState(null); // null (choix) | "recadrage"
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fichierBrut, setFichierBrut] = useState(null);
  const [imageBrutUrl, setImageBrutUrl] = useState(null);
  const [imageChargee, setImageChargee] = useState(false);
  const [rect, setRect] = useState(null); // {x, y, w, h} en coordonnées AFFICHÉES (px de l'<img>)
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [avertissement, setAvertissement] = useState(null);

  // aperçu de la photo déjà validée (value) — pour l'écran "Reprendre"
  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  // aperçu de la photo brute (avant recadrage)
  useEffect(() => {
    if (!fichierBrut) { setImageBrutUrl(null); return; }
    const url = URL.createObjectURL(fichierBrut);
    setImageBrutUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fichierBrut]);

  const reinitialiser = () => {
    setMode(null);
    setFichierBrut(null);
    setImageChargee(false);
    setRect(null);
    setAvertissement(null);
  };

  const handleFichierBrutChoisi = (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = ""; // permet de rechoisir le même fichier ensuite (ex: après "reprendre")
    if (!file) return;
    // un PDF n'a pas besoin (et n'est pas capable techniquement) d'être
    // recadré sur un <canvas> — accepté tel quel, comme un simple input file
    if (acceptPdf && file.type === "application/pdf") {
      onChange(file);
      return;
    }
    setAvertissement(null);
    setImageChargee(false);
    setRect(null);
    setFichierBrut(file);
    setMode("recadrage");
  };

  // place le cadre de recadrage initial une fois l'image affichée connue
  // (centré, la plus grande zone possible : au ratio carte ID-1 par défaut,
  // ou largeur/hauteur indépendantes si ratioLibre — ex. certificat de
  // patente, qui est une page complète et non une carte)
  const onImageChargee = () => {
    const img = imgRef.current;
    if (!img) return;
    const largeurAff = img.clientWidth, hauteurAff = img.clientHeight;
    let w, h;
    if (ratioLibre) {
      w = largeurAff * 0.9;
      h = hauteurAff * 0.9;
    } else {
      w = largeurAff * 0.9;
      h = w / RATIO_CADRE;
      if (h > hauteurAff * 0.9) { h = hauteurAff * 0.9; w = h * RATIO_CADRE; }
    }
    setRect({ x: (largeurAff - w) / 2, y: (hauteurAff - h) / 2, w, h });
    setImageChargee(true);
  };

  const clamperRect = (r, largeurAff, hauteurAff) => {
    let { x, y, w, h } = r;
    w = Math.min(w, largeurAff);
    h = Math.min(h, hauteurAff);
    x = Math.min(Math.max(0, x), largeurAff - w);
    y = Math.min(Math.max(0, y), hauteurAff - h);
    return { x, y, w, h };
  };

  const demarrerDeplacement = (e) => {
    e.preventDefault();
    if (!rect) return;
    dragRef.current = { type: "deplacer", startX: e.clientX, startY: e.clientY, rectDepart: rect };
    window.addEventListener("pointermove", surDeplacement);
    window.addEventListener("pointerup", finDeplacement);
  };

  const demarrerRedimensionnement = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rect) return;
    dragRef.current = { type: "redimensionner", startX: e.clientX, startY: e.clientY, rectDepart: rect };
    window.addEventListener("pointermove", surDeplacement);
    window.addEventListener("pointerup", finDeplacement);
  };

  const surDeplacement = (e) => {
    const drag = dragRef.current;
    const img = imgRef.current;
    if (!drag || !img) return;
    const largeurAff = img.clientWidth, hauteurAff = img.clientHeight;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;

    if (drag.type === "deplacer") {
      const { x, y, w, h } = drag.rectDepart;
      setRect(clamperRect({ x: x + dx, y: y + dy, w, h }, largeurAff, hauteurAff));
    } else if (ratioLibre) {
      // redimensionnement libre par la poignée bas-droite : largeur et
      // hauteur indépendantes (dx pilote w, dy pilote h)
      const { x, y, w, h } = drag.rectDepart;
      const largeurMax = largeurAff - x, hauteurMax = hauteurAff - y;
      const nw = Math.min(Math.max(TAILLE_MIN_RECADRAGE, w + dx), largeurMax);
      const nh = Math.min(Math.max(TAILLE_MIN_RECADRAGE, h + dy), hauteurMax);
      setRect({ x, y, w: nw, h: nh });
    } else {
      // redimensionnement par la poignée bas-droite, ratio carte ID-1 imposé
      // (dérivé uniquement de dx — dy suit automatiquement via RATIO_CADRE)
      const { x, y, w } = drag.rectDepart;
      const largeurMax = largeurAff - x, hauteurMax = hauteurAff - y;
      let nw = Math.min(Math.max(TAILLE_MIN_RECADRAGE, w + dx), largeurMax, hauteurMax * RATIO_CADRE);
      const nh = nw / RATIO_CADRE;
      setRect({ x, y, w: nw, h: nh });
    }
  };

  const finDeplacement = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", surDeplacement);
    window.removeEventListener("pointerup", finDeplacement);
  };

  // recadre l'image à sa résolution NATURELLE (pas la taille affichée à
  // l'écran) selon `rect`, inspecte le résultat (luminosité/netteté) et ne
  // valide (onChange) que si la lisibilité est jugée suffisante — sinon
  // laisse l'utilisateur ajuster le cadrage ou reprendre une autre photo.
  const validerRecadrage = async () => {
    const img = imgRef.current;
    if (!img || !rect) return;
    setAnalyseEnCours(true);
    setAvertissement(null);
    try {
      const echelle = img.naturalWidth / img.clientWidth;
      const sx = rect.x * echelle, sy = rect.y * echelle;
      const sw = rect.w * echelle, sh = rect.h * echelle;

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // inspection à une résolution réduite (rapide) — représentative de la
      // photo recadrée réelle, pas d'un aperçu séparé
      const canvasVerif = document.createElement("canvas");
      const echelleVerif = Math.min(1, 400 / sw);
      canvasVerif.width = Math.max(1, Math.round(sw * echelleVerif));
      canvasVerif.height = Math.max(1, Math.round(sh * echelleVerif));
      const ctxVerif = canvasVerif.getContext("2d");
      ctxVerif.drawImage(canvas, 0, 0, canvasVerif.width, canvasVerif.height);
      const { feedback } = analyserImageStatique(
        ctxVerif.getImageData(0, 0, canvasVerif.width, canvasVerif.height)
      );

      if (feedback !== "ok") {
        setAvertissement(FEEDBACK_CLES[feedback] || "seller.documentFeedbackBlurry");
        return;
      }

      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) onChange(new File([blob], "document.jpg", { type: "image/jpeg" }));
          resolve();
        }, "image/jpeg", 0.92);
      });
    } finally {
      setAnalyseEnCours(false);
    }
  };

  // photo déjà validée — "reprendre" ramène à l'écran de choix
  if (value) {
    const estPdf = value.type === "application/pdf";
    return (
      <div className="dv-selfie-wrap">
        {label && <p className="dv-section-label">{label}</p>}
        {estPdf ? (
          <p className="dv-document-hint">📄 {value.name}</p>
        ) : (
          <img src={previewUrl} alt={label || t("common.selfieAlt")} className="dv-selfie-preview" />
        )}
        <button type="button" className="rk-btn dv-btn-secondary" onClick={() => { onChange(null); reinitialiser(); }}>
          {t("seller.documentRetake")}
        </button>
      </div>
    );
  }

  // écran de choix — un seul bouton, "Choisir un fichier" (galerie OU
  // appareil photo, selon ce que propose le sélecteur natif du système/
  // navigateur). Bouton "Prendre une photo" dédié (capture="environment")
  // retiré à la demande explicite du propriétaire — combiné à un bug de
  // superposition (voir dv-file-input ci-dessous), avoir deux <input
  // type="file"> déclenchait le sélecteur au moindre clic n'importe où sur
  // la page plutôt que seulement sur leur bouton respectif.
  if (mode === null) {
    return (
      <div className="dv-selfie-wrap">
        {label && <p className="dv-section-label">{label}</p>}
        <p className="dv-document-hint">{t("seller.documentCaptureHint")}</p>
        <div className="dv-document-choix">
          {/* l'<input> est un ENFANT du <label> (pas un simple htmlFor) — sinon
              la règle CSS .dv-file-label-btn .dv-file-input (positionnement
              absolu limité aux dimensions du bouton) ne s'applique pas, et
              l'input retombe sur la règle .dv-file-input générique (pensée
              pour .dv-file-wrap) qui n'a alors aucun ancêtre positionné à
              proximité : il se positionne par rapport à toute la page et
              capte le moindre clic, où qu'il soit — bug corrigé ici. */}
          <label className="rk-btn dv-file-label-btn">
            📎 {t("seller.documentChooseFile")}
            <input
              type="file"
              className="dv-file-input"
              accept={acceptPdf ? "image/*,application/pdf" : "image/*"}
              onChange={handleFichierBrutChoisi}
            />
          </label>
        </div>
      </div>
    );
  }

  // mode === "recadrage" — ajuster la zone du document sur la photo choisie
  return (
    <div className="dv-selfie-wrap">
      {label && <p className="dv-section-label">{label}</p>}
      <p className="dv-document-hint">{t("seller.documentRecadrerHint")}</p>
      <div className="dv-document-recadrage" ref={zoneRef}>
        <img
          ref={imgRef}
          src={imageBrutUrl}
          alt=""
          className="dv-document-recadrage-img"
          onLoad={onImageChargee}
          draggable={false}
        />
        {imageChargee && rect && (
          <div
            className="dv-document-recadrage-rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            onPointerDown={demarrerDeplacement}
          >
            <div className="dv-document-recadrage-poignee" onPointerDown={demarrerRedimensionnement} />
          </div>
        )}
      </div>
      {analyseEnCours && <p className="dv-selfie-loading">{t("seller.documentFileAnalyzing")}</p>}
      {avertissement && <p className="rk-error"><XCircle size={20}/> {t(avertissement)}</p>}
      <button type="button" className="rk-btn" onClick={validerRecadrage} disabled={!imageChargee || analyseEnCours}>
        {t("seller.documentValiderRecadrage")}
      </button>
      <button type="button" className="dv-document-switch" onClick={reinitialiser}>
        {t("seller.documentChooseAnotherPhoto")}
      </button>
    </div>
  );
}

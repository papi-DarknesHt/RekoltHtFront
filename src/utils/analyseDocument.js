// Heuristiques pures (pas de dépendance DOM, testables en isolation) pour
// guider la capture caméra d'une pièce d'identité (voir CaptureDocument.jsx) :
// détecte si le cadrage courant est trop sombre, flou, ou mal centré dans le
// cadre-guide affiché à l'écran, sans dépendance de vision par ordinateur
// (pas d'OpenCV.js/TensorFlow.js dans le projet — tout est fait à la main sur
// un ImageData réduit, largement suffisant pour ce cas d'usage).

const SEUIL_SOMBRE = 60;       // luminance moyenne (0-255) en dessous de laquelle l'image est jugée trop sombre
const SEUIL_SUREXPOSE = 235;   // luminance moyenne au-dessus de laquelle l'image est jugée trop claire (reflet)
const SEUIL_NETTETE = 12;      // variance du gradient de Laplacien en dessous de laquelle l'image est jugée floue
const SEUIL_BORD = 40;         // magnitude de gradient de Sobel au-dessus de laquelle un pixel est considéré comme un "bord"
// proportion minimale de pixels-bord dans TOUTE la zone du cadre-guide pour la
// juger "remplie" par un document — calibré empiriquement (voir git history/
// conversation) : fond uni + bruit caméra ~0.001, peau/texture de main
// ~0.35, vraie pièce d'identité bien visible ~0.65. 0.32 laisse une marge
// confortable au-dessus du bruit/de la main tout en restant largement en
// dessous d'un document réel, même partiellement dans le cadre.
const DENSITE_CONTENU_MIN = 0.32;
// différence moyenne de luminance entre deux frames en dessous de laquelle
// l'image est jugée stable — volontairement généreux (une main qui tient une
// pièce d'identité tremble légèrement en permanence, voir analyserFrame) :
// on tolère le tremblement naturel, on ne demande pas une immobilité totale
const SEUIL_STABILITE = 14;

// Luminance ITU-R BT.601, cohérente avec la conversion utilisée par la
// plupart des heuristiques de traitement d'image simples.
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Convertit un ImageData (RGBA) en tableau de luminance (Float32Array, une
// valeur par pixel) — évite de relire les 4 canaux à chaque heuristique.
function versLuminance(imageData) {
  const { data, width, height } = imageData;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = luminance(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}

export function calculerLuminosite(imageData) {
  const lum = versLuminance(imageData);
  let somme = 0;
  for (let i = 0; i < lum.length; i++) somme += lum[i];
  return somme / lum.length;
}

// Variance du Laplacien approximé (4*centre - 4 voisins) — une image nette a
// des transitions marquées (variance élevée), une image floue les lisse
// (variance faible). Calcul limité à l'intérieur de l'image (marge de 1px).
export function calculerNettete(imageData) {
  const { width, height } = imageData;
  const lum = versLuminance(imageData);
  const gradients = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const g = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width];
      gradients.push(g);
    }
  }
  if (gradients.length === 0) return 0;
  const moyenne = gradients.reduce((a, b) => a + b, 0) / gradients.length;
  const variance = gradients.reduce((a, b) => a + (b - moyenne) ** 2, 0) / gradients.length;
  return variance;
}

// Densité de bords (gradient de Sobel) sur TOUTE la surface du cadre-guide —
// PAS seulement le long de ses 4 côtés (voir ancienne détecterBordsCadre,
// remplacée : exiger que les bords de la carte s'alignent précisément sur le
// contour du rectangle affiché à l'écran est irréaliste en pratique — une
// personne qui tient une pièce d'identité à la main ne peut jamais
// positionner ses 4 coins au pixel près sur un cadre fixe (tremblement,
// angle, carte legèrement plus grande/petite que le cadre) ; exiger cet
// alignement exact faisait que le cadre ne passait quasiment jamais au vert,
// même avec un document parfaitement lisible. On vérifie à la place qu'il y
// a assez de "contenu" (texte, photo, éléments imprimés à fort contraste)
// QUELQUE PART dans le cadre — vrai même si la carte déborde légèrement ou
// n'y est pas calée au pixel près, tant qu'elle est globalement visible.
export function detecterContenuCadre(imageData, rect) {
  const { width, height } = imageData;
  const lum = versLuminance(imageData);

  const sobel = (x, y) => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return 0;
    const gx =
      -lum[(y - 1) * width + (x - 1)] + lum[(y - 1) * width + (x + 1)] +
      -2 * lum[y * width + (x - 1)] + 2 * lum[y * width + (x + 1)] +
      -lum[(y + 1) * width + (x - 1)] + lum[(y + 1) * width + (x + 1)];
    const gy =
      -lum[(y - 1) * width + (x - 1)] - 2 * lum[(y - 1) * width + x] - lum[(y - 1) * width + (x + 1)] +
      lum[(y + 1) * width + (x - 1)] + 2 * lum[(y + 1) * width + x] + lum[(y + 1) * width + (x + 1)];
    return Math.sqrt(gx * gx + gy * gy);
  };

  const { x, y, w, h } = rect;
  const xMin = Math.max(1, Math.round(x)), xMax = Math.min(width - 1, Math.round(x + w));
  const yMin = Math.max(1, Math.round(y)), yMax = Math.min(height - 1, Math.round(y + h));
  let total = 0, bords = 0;
  for (let py = yMin; py < yMax; py++) {
    for (let px = xMin; px < xMax; px++) {
      total++;
      if (sobel(px, py) > SEUIL_BORD) bords++;
    }
  }
  const densite = total > 0 ? bords / total : 0;
  return { densite, suffisant: densite >= DENSITE_CONTENU_MIN };
}

// Différence moyenne de luminance entre deux frames successives — sous le
// seuil, on considère que la main/le document ne bouge plus.
export function calculerStabilite(lumPrecedente, lumCourante) {
  if (!lumPrecedente || lumPrecedente.length !== lumCourante.length) return Infinity;
  let somme = 0;
  for (let i = 0; i < lumCourante.length; i++) somme += Math.abs(lumCourante[i] - lumPrecedente[i]);
  return somme / lumCourante.length;
}

// Analyse une frame et retourne le feedback à afficher à l'utilisateur, avec
// priorité dark > blurry > off_center (on ne montre qu'un seul message à la
// fois — pas la peine de dire "trop sombre ET flou", régler l'un aide souvent
// l'autre). `lumPrecedente` est le Float32Array de luminance de la frame
// précédente (ou null pour la toute première), utilisé pour la stabilité.
export function analyserFrame(imageData, rect, lumPrecedente) {
  const lumCourante = versLuminance(imageData);
  const luminosite = calculerLuminosite(imageData);
  const nettete = calculerNettete(imageData);
  const { suffisant: bordsOk } = detecterContenuCadre(imageData, rect);
  const stabilite = calculerStabilite(lumPrecedente, lumCourante);
  const stable = stabilite < SEUIL_STABILITE;

  let feedback = "ok";
  if (luminosite < SEUIL_SOMBRE || luminosite > SEUIL_SUREXPOSE) {
    feedback = "dark";
  } else if (nettete < SEUIL_NETTETE) {
    feedback = "blurry";
  } else if (!bordsOk) {
    feedback = "off_center";
  } else if (!stable) {
    feedback = "off_center";
  }

  return { feedback, ok: feedback === "ok", lum: lumCourante };
}

// Variante pour un fichier importé (galerie/scanner) plutôt qu'un flux caméra
// en direct : ni bords-dans-le-cadre-guide (l'utilisateur a déjà cadré la
// photo lui-même en la prenant) ni stabilité (une seule image statique) ne
// s'appliquent — seules luminosité et netteté ont un sens ici. Sert à
// signaler à l'utilisateur, AVANT l'envoi au serveur, qu'un fichier flou ou
// trop sombre/clair risque fort de faire échouer l'OCR automatique — plutôt
// que de le découvrir seulement après soumission (voir CaptureDocument.jsx).
export function analyserImageStatique(imageData) {
  const luminosite = calculerLuminosite(imageData);
  const nettete = calculerNettete(imageData);

  let feedback = "ok";
  if (luminosite < SEUIL_SOMBRE || luminosite > SEUIL_SUREXPOSE) {
    feedback = "dark";
  } else if (nettete < SEUIL_NETTETE) {
    feedback = "blurry";
  }
  return { feedback, ok: feedback === "ok" };
}

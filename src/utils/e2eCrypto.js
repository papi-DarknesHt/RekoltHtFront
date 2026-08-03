// Primitives Web Crypto pour le chiffrement de bout en bout de la messagerie
// (voir Messagerie.jsx, ContacterAdmin.jsx, AdminDashboard.jsx, e2eStore.js).
// Le serveur ne voit jamais de clé privée ni de texte en clair — tout se
// passe ici, dans le navigateur, avec l'API SubtleCrypto native.
//
// Schéma : chaque utilisateur a une paire de clés ECDH (P-256), la clé
// publique est stockée côté serveur (CleChiffrementUtilisateur), la clé
// privée n'existe qu'enveloppée (chiffrée avec une clé dérivée d'un code PIN
// via PBKDF2). Une conversation privée 1:1 dérive un secret AES-GCM partagé
// via ECDH(ma clé privée, sa clé publique) = ECDH(sa clé privée, ma clé
// publique) — même valeur des deux côtés. Pour un destinataire non connu à
// l'avance (messagerie support, plusieurs admins possibles), voir
// chiffrerEnEnveloppe/dechiffrerEnveloppe plus bas : chiffrement hybride,
// une clé de message aléatoire chiffrée séparément pour chaque destinataire.

const COURBE = "P-256";
const ITERATIONS_PBKDF2_DEFAUT = 210000;

function versBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function depuisBase64(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// ── Paire de clés ECDH (identité de chiffrement de l'utilisateur) ────────────
export async function genererPaireCles() {
  const paire = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: COURBE },
    true,
    ["deriveKey", "deriveBits"]
  );
  const clePubliqueJwk = await crypto.subtle.exportKey("jwk", paire.publicKey);
  const clePriveeJwk = await crypto.subtle.exportKey("jwk", paire.privateKey);
  return { clePubliqueJwk, clePriveeJwk, clePriveeCryptoKey: paire.privateKey };
}

export function importerClePublique(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: COURBE }, true, []);
}

export function importerClePrivee(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: COURBE }, true, ["deriveKey", "deriveBits"]);
}

// ── Enveloppe de la clé privée avec un secret (code PIN) ──────────────────────
export function genererSel() {
  return versBase64(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriverCleEnveloppe(secret, selBase64, iterations) {
  const materiau = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: depuisBase64(selBase64), iterations, hash: "SHA-256" },
    materiau,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function chiffrerClePrivee(pin, clePriveeJwk, selBase64, iterations = ITERATIONS_PBKDF2_DEFAUT) {
  const cleEnveloppe = await deriverCleEnveloppe(pin, selBase64, iterations);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const donnees = new TextEncoder().encode(JSON.stringify(clePriveeJwk));
  const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cleEnveloppe, donnees);
  return { cle_privee_chiffree: versBase64(chiffre), iv_cle_privee: versBase64(iv) };
}

// Lève une erreur (OperationError) si le PIN est incorrect — AES-GCM
// authentifie le contenu, un mauvais secret ne produit jamais un résultat
// silencieusement faux.
export async function dechiffrerClePrivee(pin, cle_privee_chiffree, iv_cle_privee, selBase64, iterations = ITERATIONS_PBKDF2_DEFAUT) {
  const cleEnveloppe = await deriverCleEnveloppe(pin, selBase64, iterations);
  const dechiffre = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: depuisBase64(iv_cle_privee) },
    cleEnveloppe,
    depuisBase64(cle_privee_chiffree)
  );
  return JSON.parse(new TextDecoder().decode(dechiffre));
}

// ── Secret partagé par conversation 1:1 ────────────────────────────────────────
export async function deriverSecretPartage(clePriveeCryptoKey, clePubliqueAutreJwk) {
  const clePubliqueAutre = await importerClePublique(clePubliqueAutreJwk);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: clePubliqueAutre },
    clePriveeCryptoKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Chiffrement/déchiffrement d'un texte avec une clé AES-GCM déjà dérivée ────
export async function chiffrerTexte(cleAES, texte) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cleAES, new TextEncoder().encode(texte));
  return { contenu: versBase64(chiffre), iv: versBase64(iv) };
}

export async function dechiffrerTexte(cleAES, contenuBase64, ivBase64) {
  const dechiffre = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: depuisBase64(ivBase64) },
    cleAES,
    depuisBase64(contenuBase64)
  );
  return new TextDecoder().decode(dechiffre);
}

// ── Clé de message aléatoire (pour le chiffrement en enveloppe ci-dessous) ────
async function genererCleMessage() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exporterCleMessage(cleMessage) {
  return versBase64(await crypto.subtle.exportKey("raw", cleMessage));
}

async function importerCleMessage(cleBase64) {
  return crypto.subtle.importKey("raw", depuisBase64(cleBase64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

// ── Chiffrement en enveloppe multi-destinataires ──────────────────────────────
// Utilisé quand le destinataire final n'est pas connu à l'avance (messagerie
// support : n'importe quel admin peut répondre, voir MessageSupport dans
// Messagerie/models.py). Une clé de message aléatoire chiffre le texte une
// seule fois ; cette clé est elle-même chiffrée séparément pour chaque
// destinataire (dont soi-même, pour pouvoir relire son propre envoi) avec le
// secret ECDH dérivé de (ma clé privée, sa clé publique) — comme un email
// chiffré à plusieurs destinataires.
export async function chiffrerEnEnveloppe(clePriveeCryptoKey, texte, destinataires) {
  // destinataires: [{ utilisateur_id, cle_publique }]
  const cleMessage = await genererCleMessage();
  const { contenu, iv } = await chiffrerTexte(cleMessage, texte);
  const cleMessageBase64 = await exporterCleMessage(cleMessage);

  const cles = await Promise.all(destinataires.map(async (destinataire) => {
    const secretPartage = await deriverSecretPartage(clePriveeCryptoKey, destinataire.cle_publique);
    const enveloppe = await chiffrerTexte(secretPartage, cleMessageBase64);
    return { utilisateur_id: destinataire.utilisateur_id, cle_chiffree: enveloppe.contenu, iv: enveloppe.iv };
  }));

  return { contenu, iv, cles };
}

// clePubliqueExpediteur : clé publique de la personne qui a chiffré le
// message (nécessaire car ECDH(ma_privee, sa_publique) == ECDH(sa_privee,
// ma_publique) — je dois utiliser SA clé publique, pas celle d'un tiers).
export async function dechiffrerEnveloppe(clePriveeCryptoKey, clePubliqueExpediteur, contenu, iv, cleChiffree, ivCle) {
  const secretPartage = await deriverSecretPartage(clePriveeCryptoKey, clePubliqueExpediteur);
  const cleMessageBase64 = await dechiffrerTexte(secretPartage, cleChiffree, ivCle);
  const cleMessage = await importerCleMessage(cleMessageBase64);
  return dechiffrerTexte(cleMessage, contenu, iv);
}

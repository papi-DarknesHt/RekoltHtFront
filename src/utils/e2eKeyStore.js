// Cache local (IndexedDB) de la paire de clés déjà déverrouillée sur cet
// appareil — évite de redemander le code PIN à chaque ouverture (voir
// e2eStore.js::garantirCleE2E). Jamais envoyé au serveur : IndexedDB n'est
// jamais transmis au réseau, contrairement à un cookie.

const NOM_BASE = "rekoltht-e2e";
const NOM_STORE = "cles";
const VERSION = 1;

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(NOM_BASE, VERSION);
    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains(NOM_STORE)) {
        base.createObjectStore(NOM_STORE, { keyPath: "utilisateur_id" });
      }
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

export async function obtenirCleLocale(utilisateurId) {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const transaction = base.transaction(NOM_STORE, "readonly");
    const requete = transaction.objectStore(NOM_STORE).get(utilisateurId);
    requete.onsuccess = () => resolve(requete.result || null);
    requete.onerror = () => reject(requete.error);
  });
}

export async function enregistrerCleLocale(utilisateurId, { clePriveeJwk, clePubliqueJwk }) {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const transaction = base.transaction(NOM_STORE, "readwrite");
    transaction.objectStore(NOM_STORE).put({ utilisateur_id: utilisateurId, clePriveeJwk, clePubliqueJwk });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function effacerCleLocale(utilisateurId) {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const transaction = base.transaction(NOM_STORE, "readwrite");
    transaction.objectStore(NOM_STORE).delete(utilisateurId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

import { create } from "zustand";
import { AuthentificationApi } from "./auth.js";
import { E2eApi } from "./e2eApi.js";
import {
  genererPaireCles, importerClePrivee,
  genererSel, deriverCleEnveloppe, chiffrerClePrivee, dechiffrerClePrivee,
} from "../utils/e2eCrypto.js";
import { obtenirCleLocale, enregistrerCleLocale, effacerCleLocale } from "../utils/e2eKeyStore.js";

// Orchestration du chiffrement de bout en bout de la messagerie (privée +
// support) : garantit qu'une clé privée est disponible en mémoire avant
// d'envoyer/lire un message chiffré — de façon entièrement automatique et
// silencieuse, sans jamais rien demander à l'utilisateur (pas de code PIN,
// pas de mot de passe dédié : une application doit rester facile à
// utiliser).
//
// La clé privée est mise en cache localement (IndexedDB, voir
// e2eKeyStore.js) et une copie de secours CHIFFRÉE est sauvegardée côté
// serveur, protégée par une clé dérivée (voir utils/e2eCrypto.js::
// deriverCleEnveloppe) d'un secret que seul l'utilisateur peut fournir et
// que le serveur ne stocke jamais :
//   - compte classique : le mot de passe du compte ;
//   - compte connecté uniquement via Google (pas de mot de passe) : le
//     "sub" Google, renvoyé une seule fois par google_connection/
//     google_inscription (Registration/views.py) à la connexion.
// Dans les deux cas ce secret est déjà obtenu par le simple fait de se
// connecter (voir garantirCleE2E(secretDerivation), appelé juste après
// connexion()/googleConnexion()/inscription() dans AuthentificationStore.js)
// — la restauration sur un nouvel appareil se fait donc sans aucune saisie
// supplémentaire. Le serveur, lui, ne voit jamais ce secret en clair au
// repos ni la clé privée : uniquement un blob chiffré qu'il est incapable
// de déchiffrer lui-même.
export const useE2eStore = create((set, get) => ({
  pret: false,
  utilisateurId: null,
  clePriveeCryptoKey: null,
  clePubliqueJwk: null,

  // caches en mémoire pour la session — clé publique d'un interlocuteur
  // (messagerie privée) et liste des admins (messagerie support)
  clesPubliquesCache: {},

  // Génère une nouvelle paire de clés et la publie côté serveur. Si
  // secretDerivation est fourni (juste après une connexion), sauvegarde
  // aussi côté serveur une copie chiffrée de la clé privée, dérivée de ce
  // secret — permet de la restaurer automatiquement sur un autre appareil
  // plus tard (voir garantirCleE2E).
  async _publierNouvelleCle(utilisateur, secretDerivation) {
    const { clePubliqueJwk, clePriveeJwk, clePriveeCryptoKey } = await genererPaireCles();
    const donnees = { cle_publique: JSON.stringify(clePubliqueJwk) };

    if (secretDerivation) {
      const sel = genererSel();
      const cleEnveloppe = await deriverCleEnveloppe(secretDerivation, sel);
      const { contenu, iv } = await chiffrerClePrivee(clePriveeJwk, cleEnveloppe);
      Object.assign(donnees, { cle_privee_chiffree: contenu, iv_cle_privee: iv, sel_kdf: sel });
    }

    const dejaConfiguree = await E2eApi.obtenirMaCle().then(() => true).catch((e) => {
      if (e.status === 404) return false;
      throw e;
    });
    if (dejaConfiguree) {
      await E2eApi.modifierMaCle(donnees);
    } else {
      await E2eApi.creerMaCle(donnees);
    }

    await enregistrerCleLocale(utilisateur.id, { clePriveeJwk, clePubliqueJwk });
    set({ pret: true, utilisateurId: utilisateur.id, clePriveeCryptoKey, clePubliqueJwk, clesPubliquesCache: {} });
    return clePriveeCryptoKey;
  },

  // Point d'entrée principal : à appeler avant tout envoi/déchiffrement de
  // message — sans argument, résout depuis la mémoire ou depuis IndexedDB.
  // Entièrement silencieux, jamais de blocage.
  //
  // secretDerivation : à passer UNIQUEMENT juste après une connexion réussie
  // (mot de passe pour un compte classique, "sub" Google pour un compte
  // Google — voir AuthentificationStore.js), le temps qu'il est encore en
  // mémoire — permet de restaurer automatiquement la sauvegarde chiffrée du
  // serveur sur un appareil qui n'a pas encore de clé locale. Jamais
  // persisté, jamais renvoyé au-delà de cet appel.
  async garantirCleE2E(secretDerivation) {
    const utilisateur = AuthentificationApi.getUtilisateur();
    if (!utilisateur) throw new Error("Non connecté");

    if (get().pret && get().utilisateurId === utilisateur.id) {
      return get().clePriveeCryptoKey;
    }

    const local = await obtenirCleLocale(utilisateur.id);
    if (local) {
      const clePriveeCryptoKey = await importerClePrivee(local.clePriveeJwk);
      set({ pret: true, utilisateurId: utilisateur.id, clePriveeCryptoKey, clePubliqueJwk: local.clePubliqueJwk });
      return clePriveeCryptoKey;
    }

    // pas de clé locale (nouvel appareil ou données du navigateur vidées) :
    // tenter de restaurer la sauvegarde chiffrée du serveur avec le secret
    // qui vient d'être obtenu en se connectant
    if (secretDerivation) {
      try {
        const distant = await E2eApi.obtenirMaCle();
        if (distant.cle_privee_chiffree && distant.iv_cle_privee && distant.sel_kdf) {
          const cleEnveloppe = await deriverCleEnveloppe(secretDerivation, distant.sel_kdf, distant.iterations_kdf || undefined);
          const clePriveeJwk = await dechiffrerClePrivee(distant.cle_privee_chiffree, distant.iv_cle_privee, cleEnveloppe);
          const clePubliqueJwk = JSON.parse(distant.cle_publique);
          const clePriveeCryptoKey = await importerClePrivee(clePriveeJwk);
          await enregistrerCleLocale(utilisateur.id, { clePriveeJwk, clePubliqueJwk });
          set({ pret: true, utilisateurId: utilisateur.id, clePriveeCryptoKey, clePubliqueJwk, clesPubliquesCache: {} });
          return clePriveeCryptoKey;
        }
      } catch (e) {
        if (e.status !== 404) console.error("Restauration de la clé E2E échouée :", e);
        // silencieux : on retombe sur la génération d'une nouvelle paire ci-dessous
      }
    }

    // aucune sauvegarde exploitable (première fois, ou secret incorrect/
    // sauvegarde absente) : publier une nouvelle paire de clés
    return get()._publierNouvelleCle(utilisateur, secretDerivation);
  },

  // Ré-enveloppe la clé privée déjà active sous un nouveau mot de passe
  // (changement de mot de passe classique, voir AuthentificationStore.js::
  // modifierMotDePasse — sans objet pour un compte Google, dont le secret de
  // dérivation ne change pas) — ne fait rien si aucune clé E2E n'est encore
  // active pour cet utilisateur (rien à ré-envelopper).
  async reChiffrerPourNouveauMotDePasse(nouveauMotDePasse) {
    const { clePriveeCryptoKey, clePubliqueJwk } = get();
    if (!clePriveeCryptoKey || !clePubliqueJwk) return {};

    const clePriveeJwk = await crypto.subtle.exportKey("jwk", clePriveeCryptoKey);
    const sel = genererSel();
    const cleEnveloppe = await deriverCleEnveloppe(nouveauMotDePasse, sel);
    const { contenu, iv } = await chiffrerClePrivee(clePriveeJwk, cleEnveloppe);

    return {
      cle_publique:        JSON.stringify(clePubliqueJwk),
      cle_privee_chiffree: contenu,
      iv_cle_privee:       iv,
      sel_kdf:             sel,
    };
  },

  async effacerCacheLocal() {
    const utilisateur = AuthentificationApi.getUtilisateur();
    if (utilisateur) await effacerCleLocale(utilisateur.id);
    set({ pret: false, utilisateurId: null, clePriveeCryptoKey: null, clePubliqueJwk: null, clesPubliquesCache: {} });
  },

  // clé publique d'un interlocuteur (messagerie privée 1:1), mise en cache pour la session
  async obtenirClePubliqueDe(utilisateurId) {
    const cache = get().clesPubliquesCache;
    if (cache[utilisateurId]) return cache[utilisateurId];
    const { cle_publique } = await E2eApi.obtenirClePublique(utilisateurId);
    const jwk = JSON.parse(cle_publique);
    set({ clesPubliquesCache: { ...cache, [utilisateurId]: jwk } });
    return jwk;
  },

  // liste des admins ayant déjà configuré leur clé E2E (messagerie support) —
  // toujours revalidée (pas de cache long, la liste peut changer entre deux envois)
  async obtenirClesAdmins() {
    const { admins } = await E2eApi.obtenirClesAdmins();
    return admins.map((a) => ({ utilisateur_id: a.utilisateur_id, cle_publique: JSON.parse(a.cle_publique) }));
  },
}));

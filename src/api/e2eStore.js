import { create } from "zustand";
import { AuthentificationApi } from "./auth.js";
import { E2eApi } from "./e2eApi.js";
import { useConfirmStore } from "./confirmStore.js";
import {
  genererPaireCles, genererSel, chiffrerClePrivee, dechiffrerClePrivee, importerClePrivee,
} from "../utils/e2eCrypto.js";
import { obtenirCleLocale, enregistrerCleLocale, effacerCleLocale } from "../utils/e2eKeyStore.js";
import fr from "../assets/Translate/fr.json";
import en from "../assets/Translate/en.json";
import ht from "../assets/Translate/ht.json";

// hors composant React, pas d'accès au contexte de i18n.jsx — même
// contournement que apiErrors.js::traduireErreurApi (relit localStorage.lang
// et pioche directement dans les dictionnaires JSON)
const DICTIONNAIRES = { fr, en, ht };
function _t(cle) {
  const lang = localStorage.getItem("lang") || "ht";
  return DICTIONNAIRES[lang]?.e2e?.[cle] || cle;
}

// Orchestration du chiffrement de bout en bout de la messagerie (privée +
// support) : garantit qu'une clé privée déverrouillée est disponible en
// mémoire avant d'envoyer/lire un message chiffré, en ne demandant le code
// PIN à l'utilisateur QUE si cet appareil n'a pas déjà la clé en cache
// (IndexedDB, voir e2eKeyStore.js). Le composant ModalPinE2E.jsx consomme
// `requetePin` pour afficher la modale (même principe promesse que
// confirmStore.js) — cette couche ne connaît rien du rendu.
//
// Contrat avec ModalPinE2E.jsx :
//  - mode "creer"        -> appelle repondrePin(pin) une fois PIN == confirmation
//  - mode "deverrouiller" -> appelle repondrePin(pin) pour tenter un déverrouillage ;
//                            si l'utilisateur clique "PIN oublié" et choisit un
//                            nouveau PIN, appelle confirmerRegeneration(nouveauPin)
//  - dans les deux cas, annulerPin() sur fermeture/annulation
export const useE2eStore = create((set, get) => ({
  pret: false,
  utilisateurId: null,
  clePriveeCryptoKey: null,
  clePubliqueJwk: null,

  // caches en mémoire pour la session — clé publique d'un interlocuteur
  // (messagerie privée) et liste des admins (messagerie support)
  clesPubliquesCache: {},

  // { mode: 'creer' | 'deverrouiller', erreur } | null — voir ModalPinE2E.jsx
  requetePin: null,
  _resolvePin: null,
  _rejectPin: null,

  repondrePin(pin) {
    get()._resolvePin?.({ pin });
    set({ requetePin: null, _resolvePin: null, _rejectPin: null });
  },

  confirmerRegeneration(nouveauPin) {
    get()._resolvePin?.({ regenerer: true, pin: nouveauPin });
    set({ requetePin: null, _resolvePin: null, _rejectPin: null });
  },

  annulerPin() {
    get()._rejectPin?.(new Error("annule"));
    set({ requetePin: null, _resolvePin: null, _rejectPin: null });
  },

  _demanderPin(mode, erreur = null) {
    return new Promise((resolve, reject) => {
      set({ requetePin: { mode, erreur }, _resolvePin: resolve, _rejectPin: reject });
    });
  },

  // Régénère complètement la paire de clés (première configuration, PIN
  // oublié, ou action volontaire depuis les paramètres de sécurité) — publie
  // une nouvelle clé publique, ce qui rend tous les anciens messages
  // chiffrés définitivement illisibles (aucune migration rétroactive,
  // décision assumée — voir le plan de cette fonctionnalité).
  async _publierNouvelleCle(utilisateur, pin) {
    const { clePubliqueJwk, clePriveeJwk, clePriveeCryptoKey } = await genererPaireCles();
    const sel = genererSel();
    const { cle_privee_chiffree, iv_cle_privee } = await chiffrerClePrivee(pin, clePriveeJwk, sel);

    const donnees = {
      cle_publique: JSON.stringify(clePubliqueJwk),
      cle_privee_chiffree,
      iv_cle_privee,
      sel_kdf: sel,
    };
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

  // Régénération volontaire depuis les paramètres de sécurité (ModifierProfil.jsx)
  // — pas besoin de l'ancien PIN puisqu'on remplace toute la paire de clés ;
  // même confirmation destructive que le cas "PIN oublié" (voir garantirCleE2E).
  async regenererCleVolontairement() {
    const utilisateur = AuthentificationApi.getUtilisateur();
    if (!utilisateur) throw new Error("Non connecté");
    const confirme = await useConfirmStore.getState().demander(_t("confirmRegeneration"), { danger: true });
    if (!confirme) return null;
    const { pin } = await get()._demanderPin("creer");
    return get()._publierNouvelleCle(utilisateur, pin);
  },

  // Point d'entrée principal : à appeler avant tout envoi/déchiffrement de
  // message. Résout silencieusement si la clé est déjà prête pour cet
  // appareil, sinon ouvre la modale PIN (création ou déverrouillage selon
  // qu'un enregistrement existe déjà côté serveur).
  async garantirCleE2E() {
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

    let cleServeur = null;
    try {
      cleServeur = await E2eApi.obtenirMaCle();
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    if (!cleServeur) {
      // première configuration — création d'un code PIN
      const { pin } = await get()._demanderPin("creer");
      return get()._publierNouvelleCle(utilisateur, pin);
    }

    // déverrouillage — boucle jusqu'à un PIN correct ou une régénération demandée
    let erreur = null;
    for (;;) {
      const reponse = await get()._demanderPin("deverrouiller", erreur);

      if (reponse.regenerer) {
        const confirme = await useConfirmStore.getState().demander(
          _t("confirmRegeneration"),
          { danger: true }
        );
        if (!confirme) { erreur = null; continue; }
        return get()._publierNouvelleCle(utilisateur, reponse.pin);
      }

      try {
        const clePriveeJwk = await dechiffrerClePrivee(
          reponse.pin, cleServeur.cle_privee_chiffree, cleServeur.iv_cle_privee, cleServeur.sel_kdf, cleServeur.iterations_kdf
        );
        const clePubliqueJwk = JSON.parse(cleServeur.cle_publique);
        const clePriveeCryptoKey = await importerClePrivee(clePriveeJwk);
        await enregistrerCleLocale(utilisateur.id, { clePriveeJwk, clePubliqueJwk });
        set({ pret: true, utilisateurId: utilisateur.id, clePriveeCryptoKey, clePubliqueJwk });
        return clePriveeCryptoKey;
      } catch {
        erreur = "PIN_INCORRECT";
      }
    }
  },

  // Ré-enveloppement volontaire (changement de PIN depuis les paramètres de
  // sécurité, ModifierProfil.jsx) — la clé publique ne change pas.
  async changerPin(ancienPin, nouveauPin) {
    const utilisateur = AuthentificationApi.getUtilisateur();
    const cleServeur = await E2eApi.obtenirMaCle();
    const clePriveeJwk = await dechiffrerClePrivee(
      ancienPin, cleServeur.cle_privee_chiffree, cleServeur.iv_cle_privee, cleServeur.sel_kdf, cleServeur.iterations_kdf
    );
    const sel = genererSel();
    const { cle_privee_chiffree, iv_cle_privee } = await chiffrerClePrivee(nouveauPin, clePriveeJwk, sel);
    await E2eApi.modifierMaCle({
      cle_publique: cleServeur.cle_publique,
      cle_privee_chiffree, iv_cle_privee, sel_kdf: sel,
    });
    const clePubliqueJwk = JSON.parse(cleServeur.cle_publique);
    await enregistrerCleLocale(utilisateur.id, { clePriveeJwk, clePubliqueJwk });
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

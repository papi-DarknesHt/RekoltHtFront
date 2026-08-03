import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, ShieldCheck, X, Flag } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import { useGlobalStore } from "../api/globalStore.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { MessagerieApi } from "../api/messagerie";
import { ProduitsApi } from "../api/produits";
import { useE2eStore } from "../api/e2eStore.js";
import { deriverSecretPartage, chiffrerTexte, dechiffrerTexte } from "../utils/e2eCrypto.js";
import "../assets/CSS/Messagerie.css";
import "../assets/CSS/DetailProduit.css";

const TYPES_PROBLEME_MESSAGE = ["contenu_inapproprie", "harcelement", "spam", "arnaque_fraude", "autre"];

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initiale(nom) {
  return (nom || "?").charAt(0).toUpperCase();
}

// texte à afficher pour un message du fil actif — voir texteDechiffre dans
// Messagerie() : undefined = déchiffrement pas encore tenté, null = échec
function texteBulle(message, texteDechiffre, t) {
  if (!message.chiffre) return message.contenu;
  const valeur = texteDechiffre[message.id];
  if (valeur === undefined) return t("messagerie.dechiffrementEnCours");
  if (valeur === null) return t("messagerie.contenuIllisible");
  return valeur;
}

// même principe pour l'aperçu du dernier message dans la sidebar
function texteApercuConversation(conversation, apercuDechiffre, t) {
  const dm = conversation.dernier_message;
  if (!dm) return "";
  if (!dm.chiffre) return dm.contenu || t("messagerie.sharedProduct");
  const valeur = apercuDechiffre[conversation.id];
  if (valeur === undefined) return t("messagerie.dechiffrementEnCours");
  if (valeur === null) return t("messagerie.contenuIllisible");
  return valeur || t("messagerie.sharedProduct");
}

export default function Messagerie() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const profil = useProfilStore((s) => s.profil);
  const isVendeur = profil?.role === "vendeur";
  const messageEvent = useGlobalStore((s) => s.messageEvent);
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [conversationActiveId, setConversationActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chargementConversations, setChargementConversations] = useState(true);
  const [chargementMessages, setChargementMessages] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // produit à joindre au prochain envoi, affiché comme aperçu "en réponse à"
  // au-dessus du champ de saisie — jamais envoyé tant que l'utilisateur n'a
  // pas lui-même appuyé sur envoyer (voir envoyerMessage plus bas)
  const [produitAPartager, setProduitAPartager] = useState(null);
  const finDesMessagesRef = useRef(null);
  const setNonLus = useMessagerieBadgeStore((s) => s.setNonLus);

  // chiffrement de bout en bout (voir api/e2eStore.js et utils/e2eCrypto.js)
  // — clePriveeCryptoKey déclenche un nouveau rendu dès que la clé devient
  // disponible (déverrouillage via la modale PIN, voir ModalPinE2E.jsx),
  // faisant automatiquement rejouer les effets de déchiffrement ci-dessous
  const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
  const clePriveeCryptoKey = useE2eStore((s) => s.clePriveeCryptoKey);
  const obtenirClePubliqueDe = useE2eStore((s) => s.obtenirClePubliqueDe);
  // texte en clair déjà déchiffré, par id de message ou de conversation —
  // undefined = pas encore tenté, null = échec (voir texteBulle/texteApercu)
  const [texteDechiffre, setTexteDechiffre] = useState({});
  const [apercuDechiffre, setApercuDechiffre] = useState({});

  // signalement d'un message reçu (voir Messagerie/views.py::signalerMessage)
  // — même principe que le signalement produit/vendeur : modal avec type de
  // problème + motif, transmis directement aux admins
  const [signalementCible, setSignalementCible] = useState(null); // message ciblé, ou null si fermé
  const [signalementForm, setSignalementForm] = useState({ type_probleme: "", motif: "" });
  const [signalementEnCours, setSignalementEnCours] = useState(false);
  const [signalementErreur, setSignalementErreur] = useState(null);
  const [signalementEnvoye, setSignalementEnvoye] = useState(false);

  // chargement initial des conversations — si on arrive depuis le bouton
  // "Contacter" d'une fiche produit (voir ProductCard.jsx -> navigate
  // `/messages?avec=<vendeur_id>&produit=<produit_id>`), on démarre/récupère
  // d'abord cette conversation précise avant de charger la liste complète ;
  // le produit lui-même n'est récupéré que pour l'aperçu (voir plus bas),
  // jamais envoyé automatiquement
  useEffect(() => {
    const avecId = searchParams.get("avec");
    const produitId = searchParams.get("produit");

    const chargerListe = () =>
      MessagerieApi.mesConversations().then((res) => setConversations(res.conversations || []));

    const tout = avecId
      ? MessagerieApi.demarrerConversation(Number(avecId))
          .then((res) => {
            setConversationActiveId(res.conversation.id);
            return chargerListe();
          })
      : chargerListe();

    if (produitId) {
      ProduitsApi.detailProduit(Number(produitId))
        .then((res) => setProduitAPartager({
          id: res.produit.id,
          nom: res.produit.nom,
          prix: res.produit.prix,
          unitePrix: res.produit.unitePrix,
          photo: res.produit.photos?.[0]?.url_photo || null,
        }))
        .catch(() => {});
    }

    tout
      .catch((err) => setErreur(err.message))
      .finally(() => setChargementConversations(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // déverrouille (ou configure) la clé de chiffrement de bout en bout dès
  // l'ouverture de la page — la modale PIN (ModalPinE2E.jsx) ne s'affiche que
  // si cet appareil n'a pas déjà la clé en cache (voir e2eStore.js)
  useEffect(() => {
    garantirCleE2E().catch((err) => {
      if (err.message !== "annule") setErreur(err.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversationActive = conversations.find((c) => c.id === conversationActiveId) || null;

  // déchiffre les messages du fil actif dès que la clé est prête — reste
  // silencieux (bulle "message illisible", voir texteBulle) si le
  // déchiffrement échoue, par ex. après une régénération de clé
  useEffect(() => {
    if (!clePriveeCryptoKey || !conversationActive) return;
    const messagesChiffres = messages.filter((m) => m.chiffre);
    if (messagesChiffres.length === 0) return;
    let annule = false;
    (async () => {
      let secret;
      try {
        const clePubliqueAutre = await obtenirClePubliqueDe(conversationActive.autre_utilisateur.id);
        secret = await deriverSecretPartage(clePriveeCryptoKey, clePubliqueAutre);
      } catch {
        return;
      }
      const resultats = {};
      for (const m of messagesChiffres) {
        try {
          resultats[m.id] = await dechiffrerTexte(secret, m.contenu, m.iv);
        } catch {
          resultats[m.id] = null;
        }
      }
      if (!annule) setTexteDechiffre((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messages, clePriveeCryptoKey, conversationActive, obtenirClePubliqueDe]);

  // déchiffre l'aperçu du dernier message de chaque conversation (sidebar)
  useEffect(() => {
    if (!clePriveeCryptoKey) return;
    const aDechiffrer = conversations.filter((c) => c.dernier_message?.chiffre);
    if (aDechiffrer.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const c of aDechiffrer) {
        try {
          const clePubliqueAutre = await obtenirClePubliqueDe(c.autre_utilisateur.id);
          const secret = await deriverSecretPartage(clePriveeCryptoKey, clePubliqueAutre);
          resultats[c.id] = await dechiffrerTexte(secret, c.dernier_message.contenu, c.dernier_message.iv);
        } catch {
          resultats[c.id] = null;
        }
      }
      if (!annule) setApercuDechiffre((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [conversations, clePriveeCryptoKey, obtenirClePubliqueDe]);

  // charge les messages de la conversation sélectionnée
  useEffect(() => {
    if (!conversationActiveId) return;
    setChargementMessages(true);
    MessagerieApi.messagesConversation(conversationActiveId)
      .then((res) => setMessages(res.messages || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargementMessages(false));
  }, [conversationActiveId]);

  // défilement automatique vers le dernier message
  useEffect(() => {
    finDesMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // réactivité temps réel (voir Messagerie/signals.py côté backend, groupe
  // WebSocket personnel "user_<id>" — pas "global")
  useEffect(() => {
    if (!messageEvent) return;
    const msg = messageEvent.data;

    // un message supprimé (par un admin, voir supprimerMessageAdmin côté
    // backend) ne concerne que le fil actif — pas de mise à jour de l'aperçu
    // dans la liste des conversations, geler ce détail mineur plutôt que
    // recharger toute la liste pour un cas rare
    if (messageEvent.type === "message.deleted") {
      if (msg.conversation_id === conversationActiveId) {
        setMessages((liste) => liste.filter((m) => m.id !== msg.id));
      }
      return;
    }

    if (msg.conversation_id === conversationActiveId) {
      setMessages((liste) => (liste.some((m) => m.id === msg.id) ? liste : [...liste, msg]));
    }

    setConversations((liste) => {
      const existe = liste.some((c) => c.id === msg.conversation_id);
      if (!existe) {
        // conversation inconnue localement (quelqu'un nous contacte pour la
        // première fois) — recharge la liste complète une fois
        MessagerieApi.mesConversations().then((res) => setConversations(res.conversations || []));
        return liste;
      }
      return liste
        .map((c) => (c.id === msg.conversation_id
          ? {
              ...c,
              dernier_message: msg,
              date_maj: msg.date_envoi,
              non_lus: msg.conversation_id === conversationActiveId || msg.expediteur_id === utilisateur?.id
                ? c.non_lus
                : c.non_lus + 1,
            }
          : c))
        .sort((a, b) => new Date(b.date_maj) - new Date(a.date_maj));
    });
  }, [messageEvent, conversationActiveId, utilisateur?.id]);

  // synchronise la pastille de la sonnette (voir NavBar.jsx) sur l'état local
  // de cette page — plus fiable qu'un nouvel appel API : reflète
  // immédiatement le "marquer comme lu" optimiste de ouvrirConversation()
  useEffect(() => {
    setNonLus(conversations.reduce((somme, c) => somme + (c.non_lus || 0), 0));
  }, [conversations, setNonLus]);

  const ouvrirConversation = (conversation) => {
    setConversationActiveId(conversation.id);
    if (conversation.non_lus > 0) {
      setConversations((liste) => liste.map((c) => (c.id === conversation.id ? { ...c, non_lus: 0 } : c)));
    }
  };

  const envoyerMessage = async (e) => {
    e.preventDefault();
    const texte = brouillon.trim();
    if ((!texte && !produitAPartager) || !conversationActiveId || !conversationActive) return;
    setEnvoiEnCours(true);
    setBrouillon("");
    const produitId = produitAPartager?.id;
    setProduitAPartager(null);
    try {
      let contenuEnvoi = texte;
      let ivEnvoi;
      if (texte) {
        const clePrivee = await garantirCleE2E();
        const clePubliqueAutre = await obtenirClePubliqueDe(conversationActive.autre_utilisateur.id);
        const secret = await deriverSecretPartage(clePrivee, clePubliqueAutre);
        const resultat = await chiffrerTexte(secret, texte);
        contenuEnvoi = resultat.contenu;
        ivEnvoi = resultat.iv;
      }
      const res = await MessagerieApi.envoyerMessage(conversationActiveId, contenuEnvoi, produitId, ivEnvoi);
      setMessages((liste) => (liste.some((m) => m.id === res.message.id) ? liste : [...liste, res.message]));
      // évite un aller-retour de déchiffrement inutile pour mon propre envoi
      if (texte) setTexteDechiffre((prev) => ({ ...prev, [res.message.id]: texte }));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const ouvrirSignalementMessage = (message) => {
    setSignalementCible(message);
    setSignalementForm({ type_probleme: "", motif: "" });
    setSignalementErreur(null);
    setSignalementEnvoye(false);
  };

  const soumettreSignalementMessage = async (e) => {
    e.preventDefault();
    if (!signalementForm.type_probleme) {
      setSignalementErreur(t("productDetail.reportTypeRequired"));
      return;
    }
    if (!signalementForm.motif.trim()) {
      setSignalementErreur(t("productDetail.reportReasonRequired"));
      return;
    }
    setSignalementEnCours(true);
    setSignalementErreur(null);
    try {
      // copie en clair déjà déchiffrée côté client (voir texteBulle) — sans
      // objet pour un message legacy non chiffré (backend retombe alors sur
      // message.contenu directement, voir _serialiseSignalementMessage)
      const contenuDechiffre = signalementCible.chiffre
        ? (texteDechiffre[signalementCible.id] || undefined)
        : undefined;
      await MessagerieApi.signalerMessage(
        signalementCible.id, signalementForm.type_probleme, signalementForm.motif.trim(), contenuDechiffre
      );
      setSignalementEnvoye(true);
    } catch (err) {
      setSignalementErreur(err.message);
    } finally {
      setSignalementEnCours(false);
    }
  };

  return (
    <div className="msg-page">
      <NavBar />

      <div className="msg-layout">
        <aside className="msg-sidebar">
          <div className="msg-sidebar__header">
            <BoutonRetour />
            <h1 className="msg-sidebar__title">{t("messagerie.title")}</h1>
            {conversationActive && (
              <p className="msg-sidebar__subtitle">
                {t("messagerie.activeWith", { nom: conversationActive.autre_utilisateur.nom_affiche })}
              </p>
            )}
            {isVendeur && (
              <button
                type="button"
                className="msg-contact-admin-btn"
                onClick={() => navigate("/contacter-admin")}
              >
                <ShieldCheck size={15} />
                {t("nav.contactAdmin")}
              </button>
            )}
          </div>

          {erreur && <p className="msg-alert">{erreur}</p>}
          {chargementConversations && <p className="msg-hint">{t("profile.loading")}</p>}
          {!chargementConversations && conversations.length === 0 && (
            <p className="msg-hint">{t("messagerie.noConversations")}</p>
          )}

          <ul className="msg-conv-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  className={`msg-conv-item ${c.id === conversationActiveId ? "msg-conv-item--active" : ""}`}
                  onClick={() => ouvrirConversation(c)}
                >
                  <span className="msg-conv-item__avatar">{initiale(c.autre_utilisateur.nom_affiche)}</span>
                  <span className="msg-conv-item__body">
                    <span className="msg-conv-item__nom">{c.autre_utilisateur.nom_affiche}</span>
                    <span className="msg-conv-item__apercu">
                      {texteApercuConversation(c, apercuDechiffre, t)}
                    </span>
                  </span>
                  <span className="msg-conv-item__meta">
                    {c.dernier_message && <span>{formatHeure(c.dernier_message.date_envoi)}</span>}
                    {c.non_lus > 0 && <span className="msg-conv-item__badge">{c.non_lus}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="msg-chat">
          {!conversationActive ? (
            <div className="msg-chat__vide">
              <p className="msg-hint">{t("messagerie.selectConversation")}</p>
            </div>
          ) : (
            <>
              <div className="msg-chat__header">
                <span className="msg-chat__avatar">{initiale(conversationActive.autre_utilisateur.nom_affiche)}</span>
                <p className="msg-chat__nom">{conversationActive.autre_utilisateur.nom_affiche}</p>
              </div>

              <div className="msg-chat__messages">
                {chargementMessages && <p className="msg-hint">{t("profile.loading")}</p>}
                {!chargementMessages && messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg-bulle ${m.expediteur_id === utilisateur?.id ? "msg-bulle--moi" : "msg-bulle--autre"}`}
                  >
                    {m.expediteur_id !== utilisateur?.id && (
                      <button
                        type="button"
                        className="msg-bulle__signaler"
                        onClick={() => ouvrirSignalementMessage(m)}
                        aria-label={t("messagerie.reportMessage")}
                        title={t("messagerie.reportMessage")}
                      >
                        <Flag size={11} />
                      </button>
                    )}
                    {m.produit && (
                      <div className="msg-produit-partage">
                        <div className="msg-produit-partage__img">
                          {m.produit.photo ? <img src={m.produit.photo} alt={m.produit.nom} /> : <span>🌾</span>}
                        </div>
                        <div className="msg-produit-partage__info">
                          <span className={`msg-produit-partage__badge ${m.produit.est_disponible ? "" : "msg-produit-partage__badge--indispo"}`}>
                            {m.produit.est_disponible ? t("myProducts.available") : t("myProducts.unavailable")}
                          </span>
                          <p className="msg-produit-partage__nom">{m.produit.nom}</p>
                          {m.produit.prix != null && (
                            <p className="msg-produit-partage__prix">
                              {m.produit.prix} {m.produit.unitePrix}
                              {m.produit.unite_De_Mesure ? ` / ${m.produit.unite_De_Mesure}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {m.contenu && <p className="msg-bulle__texte">{texteBulle(m, texteDechiffre, t)}</p>}
                    <span className="msg-bulle__heure">{formatHeure(m.date_envoi)}</span>
                  </div>
                ))}
                <div ref={finDesMessagesRef} />
              </div>

              {produitAPartager && (
                <div className="msg-reply-preview">
                  <div className="msg-reply-preview__barre" />
                  <div className="msg-reply-preview__img">
                    {produitAPartager.photo ? <img src={produitAPartager.photo} alt={produitAPartager.nom} /> : <span>🌾</span>}
                  </div>
                  <div className="msg-reply-preview__info">
                    <span className="msg-reply-preview__label">{t("messagerie.replyingAboutProduct")}</span>
                    <p className="msg-reply-preview__nom">{produitAPartager.nom}</p>
                  </div>
                  <button
                    type="button"
                    className="msg-reply-preview__fermer"
                    onClick={() => setProduitAPartager(null)}
                    aria-label={t("messagerie.cancelReply")}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <form className="msg-chat__saisie" onSubmit={envoyerMessage}>
                <input
                  type="text"
                  className="msg-chat__input"
                  placeholder={t("messagerie.writeMessage")}
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                />
                <button type="submit" className="msg-chat__envoyer" disabled={envoiEnCours || (!brouillon.trim() && !produitAPartager)}>
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {signalementCible && (
        <div className="pd-modal-overlay" onClick={() => setSignalementCible(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal__entete">
              <h3><Flag size={16} />{t("messagerie.reportMessage")}</h3>
              <button type="button" className="pd-modal__fermer" onClick={() => setSignalementCible(null)} aria-label={t("admin.dashboard.cancel")}>
                <X size={18} />
              </button>
            </div>

            {signalementEnvoye ? (
              <p className="pd-modal__texte">{t("productDetail.reportSent")}</p>
            ) : (
              <form onSubmit={soumettreSignalementMessage}>
                <p className="pd-modal__texte">{t("messagerie.reportMessageIntro")}</p>
                <div className="rk-field">
                  <label className="rk-label">{t("productDetail.reportTypeLabel")}</label>
                  <select
                    className="rk-select"
                    value={signalementForm.type_probleme}
                    onChange={(e) => setSignalementForm((f) => ({ ...f, type_probleme: e.target.value }))}
                  >
                    <option value="">— {t("productDetail.reportTypeLabel")} —</option>
                    {TYPES_PROBLEME_MESSAGE.map((type) => (
                      <option key={type} value={type}>{t(`admin.dashboard.reportMessageType.${type}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("productDetail.reportReasonLabel")}</label>
                  <textarea
                    className="rk-input pd-modal__textarea"
                    value={signalementForm.motif}
                    onChange={(e) => setSignalementForm((f) => ({ ...f, motif: e.target.value }))}
                    placeholder={t("productDetail.reportReasonPlaceholder")}
                  />
                </div>
                {signalementErreur && <p className="rk-error">✗ {signalementErreur}</p>}
                <button type="submit" className="rk-btn" disabled={signalementEnCours}>
                  {signalementEnCours ? t("seller.saving") : t("productDetail.reportSubmit")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

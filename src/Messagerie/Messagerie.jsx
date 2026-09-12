import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, ShieldCheck, X, Flag, Trash2, Reply, CheckSquare, ArrowLeft } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import { useGlobalStore } from "../api/globalStore.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { useConfirmStore } from "../api/confirmStore.js";
import { MessagerieApi } from "../api/messagerie";
import { ProduitsApi } from "../api/produits";
import { symboleDevise } from "../utils/symboleDevise.js";
import "../assets/CSS/Messagerie.css";
import "../assets/CSS/DetailProduit.css";

const TYPES_PROBLEME_MESSAGE = ["contenu_inapproprie", "harcelement", "spam", "arnaque_fraude", "autre"];

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initiale(nom) {
  return (nom || "?").charAt(0).toUpperCase();
}

// aperçu court d'un message cité (bouton "Répondre" — voir menu contextuel
// et la citation affichée en haut d'une bulle, plus bas). Le contenu arrive
// déjà en clair depuis le backend (chiffré au repos côté serveur, voir
// MESSAGES_MASTER_KEY/Messagerie/services/messages_chiffrement_service.py) —
// plus aucun déchiffrement ni clé côté client, demande explicite du
// propriétaire : accès immédiat aux messages sur n'importe quel appareil/
// navigateur dès la connexion, sans mot de passe ni clé à saisir.
function apercuCitation(message) {
  if (message.produit && !message.contenu) return `📦 ${message.produit.nom}`;
  return message.contenu;
}

// même principe pour l'aperçu du dernier message dans la sidebar
function texteApercuConversation(conversation, t) {
  const dm = conversation.dernier_message;
  if (!dm) return "";
  return dm.contenu || t("messagerie.sharedProduct");
}

export default function Messagerie() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const profil = useProfilStore((s) => s.profil);
  const isVendeur = profil?.role === "vendeur";
  const messageEvent = useGlobalStore((s) => s.messageEvent);
  const reconnectedAt = useGlobalStore((s) => s.reconnectedAt);
  const [searchParams] = useSearchParams();
  const demanderConfirmation = useConfirmStore((s) => s.demander);

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
  // message auquel répondre, affiché comme aperçu "en réponse à" au-dessus
  // du champ de saisie (voir répondreAMessage/menu contextuel plus bas) —
  // mutuellement exclusif avec produitAPartager, un seul aperçu à la fois
  const [messageEnReponse, setMessageEnReponse] = useState(null);
  // menu contextuel (clic droit sur une bulle) : { x, y, message } ou null
  const [menuContextuel, setMenuContextuel] = useState(null);
  // sélection multiple (voir "Sélectionner" du menu contextuel) — permet de
  // supprimer plusieurs messages "pour moi" en une seule fois
  const [modeSelection, setModeSelection] = useState(false);
  const [messagesSelectionnes, setMessagesSelectionnes] = useState(() => new Set());
  const finDesMessagesRef = useRef(null);
  const setNonLus = useMessagerieBadgeStore((s) => s.setNonLus);

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
    // dépend de searchParams (pas [] à l'ancienne) : un futur lien qui
    // navigue vers /messages?avec=... en restant sur la même route (donc
    // sans remontage du composant) doit rouvrir la bonne conversation, pas
    // rester bloqué sur l'état du tout premier montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const conversationActive = conversations.find((c) => c.id === conversationActiveId) || null;

  // charge les messages de la conversation sélectionnée — réinitialise aussi
  // le menu contextuel/mode sélection au passage : jamais laissés "orphelins"
  // d'une conversation à l'autre
  useEffect(() => {
    setMenuContextuel(null);
    setModeSelection(false);
    setMessagesSelectionnes(new Set());
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

    // "supprimé pour moi" (voir supprimerMessagePourMoi/supprimerConversationPourMoi,
    // Messagerie/views.py) : diffusé UNIQUEMENT à moi-même (mes autres onglets/
    // sessions ouverts) — l'autre participant n'est jamais notifié, il continue
    // de tout voir normalement.
    if (messageEvent.type === "message.supprime_pour_moi") {
      if (msg.conversation_id === conversationActiveId) {
        setMessages((liste) => liste.filter((m) => m.id !== msg.id));
      }
      return;
    }
    if (messageEvent.type === "conversation.supprime_pour_moi") {
      setConversations((liste) => liste.filter((c) => c.id !== msg.id));
      if (msg.id === conversationActiveId) {
        setConversationActiveId(null);
        setMessages([]);
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

  // rattrapage après une coupure du WebSocket (veille de l'appareil, wifi qui
  // saute, cold-start du serveur...) — voir reconnectedAt, api/globalStore.js.
  // Pendant la coupure, tout message reçu de l'autre participant n'a JAMAIS
  // été diffusé (le backend ne rejoue rien après coup) : sans ce correctif il
  // fallait recharger la page à la main pour le voir apparaître (bug signalé
  // explicitement — "même si on n'est pas en ligne, on doit voir nos anciens
  // messages"). Ignoré au tout premier montage (reconnectedAt reste à 0 tant
  // qu'aucune VRAIE reconnexion n'a eu lieu, voir setConnected).
  useEffect(() => {
    if (!reconnectedAt) return;
    MessagerieApi.mesConversations().then((res) => setConversations(res.conversations || [])).catch(() => {});
    if (conversationActiveId) {
      MessagerieApi.messagesConversation(conversationActiveId)
        .then((res) => setMessages(res.messages || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectedAt]);

  // ferme le menu contextuel au clic ailleurs, à Échap, ou dès qu'on change
  // de conversation/scroll — jamais laissé ouvert "orphelin"
  useEffect(() => {
    if (!menuContextuel) return;
    const fermer = () => setMenuContextuel(null);
    const surEchap = (e) => { if (e.key === "Escape") fermer(); };
    document.addEventListener("click", fermer);
    document.addEventListener("scroll", fermer, true);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("click", fermer);
      document.removeEventListener("scroll", fermer, true);
      document.removeEventListener("keydown", surEchap);
    };
  }, [menuContextuel]);

  const ouvrirConversation = (conversation) => {
    setConversationActiveId(conversation.id);
    if (conversation.non_lus > 0) {
      setConversations((liste) => liste.map((c) => (c.id === conversation.id ? { ...c, non_lus: 0 } : c)));
    }
  };

  const ouvrirMenuContextuel = (e, message) => {
    if (modeSelection) return;
    e.preventDefault();
    setMenuContextuel({ x: e.clientX, y: e.clientY, message });
  };

  const repondreAMessage = (message) => {
    setMessageEnReponse(message);
    setProduitAPartager(null);
    setMenuContextuel(null);
  };

  const demarrerSelection = (message) => {
    setModeSelection(true);
    setMessagesSelectionnes(new Set([message.id]));
    setMenuContextuel(null);
  };

  const basculerSelectionMessage = (message) => {
    setMessagesSelectionnes((set) => {
      const suivant = new Set(set);
      if (suivant.has(message.id)) suivant.delete(message.id); else suivant.add(message.id);
      return suivant;
    });
  };

  const annulerSelection = () => {
    setModeSelection(false);
    setMessagesSelectionnes(new Set());
  };

  // suppression groupée "pour moi seulement" — même sémantique que
  // supprimerMessage, appliquée à toute la sélection en une seule confirmation
  const supprimerMessagesSelectionnes = async () => {
    if (messagesSelectionnes.size === 0) return;
    if (!(await demanderConfirmation(t("messagerie.deleteSelectedConfirm"), { danger: true }))) return;
    const ids = [...messagesSelectionnes];
    try {
      await Promise.all(ids.map((id) => MessagerieApi.supprimerMessagePourMoi(id)));
      setMessages((liste) => liste.filter((m) => !messagesSelectionnes.has(m.id)));
      annulerSelection();
    } catch (err) {
      setErreur(err.message);
    }
  };

  // suppression "pour moi seulement" — l'autre participant continue de voir
  // ce message normalement (voir Messagerie/views.py::supprimerMessagePourMoi)
  const supprimerMessage = async (message) => {
    if (!(await demanderConfirmation(t("messagerie.deleteMessageConfirm"), { danger: true }))) return;
    try {
      await MessagerieApi.supprimerMessagePourMoi(message.id);
      setMessages((liste) => liste.filter((m) => m.id !== message.id));
    } catch (err) {
      setErreur(err.message);
    }
  };

  // suppression "pour moi seulement" de toute la discussion — l'autre
  // participant continue de la voir avec tous ses messages (voir
  // Messagerie/views.py::supprimerConversationPourMoi) ; réapparaît
  // automatiquement si l'un des deux y écrit à nouveau
  const supprimerConversation = async (conversation) => {
    if (!(await demanderConfirmation(t("messagerie.deleteConversationConfirm"), { danger: true }))) return;
    try {
      await MessagerieApi.supprimerConversationPourMoi(conversation.id);
      setConversations((liste) => liste.filter((c) => c.id !== conversation.id));
      if (conversation.id === conversationActiveId) {
        setConversationActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      setErreur(err.message);
    }
  };

  const envoyerMessage = async (e) => {
    e.preventDefault();
    const texte = brouillon.trim();
    if ((!texte && !produitAPartager) || !conversationActiveId || !conversationActive) return;
    setEnvoiEnCours(true);
    setErreur(null);
    const produitId = produitAPartager?.id;
    const repondAId = messageEnReponse?.id;
    try {
      // chiffré au repos côté SERVEUR (voir Messagerie/services/
      // messages_chiffrement_service.py) — le texte part en clair vers le
      // serveur ici (HTTPS), aucun chiffrement côté client nécessaire
      const res = await MessagerieApi.envoyerMessage(conversationActiveId, texte, produitId, repondAId);
      setMessages((liste) => (liste.some((m) => m.id === res.message.id) ? liste : [...liste, res.message]));
      // le brouillon n'est vidé qu'une fois l'envoi confirmé — sinon un échec
      // réseau ferait perdre le texte déjà tapé, constaté en conditions réelles
      setBrouillon("");
      setProduitAPartager(null);
      setMessageEnReponse(null);
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
      await MessagerieApi.signalerMessage(
        signalementCible.id, signalementForm.type_probleme, signalementForm.motif.trim()
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

      {/* sur mobile (voir Messagerie.css), la sidebar ET le panneau de
          discussion sont côte à côte en CSS mais l'un des deux masqué selon
          conversationActiveId — sans balise <form>/état dédié, ce sont les
          seuls éléments qui déterminent lequel des deux occuper tout l'écran */}
      <div className={`msg-layout ${conversationActiveId ? "msg-layout--conversation-active" : ""}`}>
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
                      {texteApercuConversation(c, t)}
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
                {/* uniquement visible sur mobile, voir Messagerie.css — sur
                    desktop la sidebar reste affichée en permanence à côté */}
                <button
                  type="button"
                  className="msg-chat__retour"
                  onClick={() => setConversationActiveId(null)}
                  aria-label={t("messagerie.backToList")}
                  title={t("messagerie.backToList")}
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="msg-chat__avatar">{initiale(conversationActive.autre_utilisateur.nom_affiche)}</span>
                <p className="msg-chat__nom">{conversationActive.autre_utilisateur.nom_affiche}</p>
                <button
                  type="button"
                  className="msg-chat__supprimer"
                  onClick={() => supprimerConversation(conversationActive)}
                  aria-label={t("messagerie.deleteConversation")}
                  title={t("messagerie.deleteConversation")}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {modeSelection && (
                <div className="msg-selection-bar">
                  <span>{t("messagerie.selectedCount", { n: messagesSelectionnes.size })}</span>
                  <div className="msg-selection-bar__actions">
                    <button type="button" className="msg-selection-bar__annuler" onClick={annulerSelection}>
                      {t("messagerie.cancelSelection")}
                    </button>
                    <button
                      type="button"
                      className="msg-selection-bar__supprimer"
                      onClick={supprimerMessagesSelectionnes}
                      disabled={messagesSelectionnes.size === 0}
                    >
                      <Trash2 size={14} />
                      {t("messagerie.deleteSelected")}
                    </button>
                  </div>
                </div>
              )}

              <div className="msg-chat__messages">
                {chargementMessages && <p className="msg-hint">{t("profile.loading")}</p>}
                {!chargementMessages && messages.map((m) => {
                  const original = m.repond_a_id ? messages.find((x) => x.id === m.repond_a_id) : null;
                  const selectionnee = messagesSelectionnes.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`msg-bulle ${m.expediteur_id === utilisateur?.id ? "msg-bulle--moi" : "msg-bulle--autre"} ${modeSelection ? "msg-bulle--mode-selection" : ""} ${selectionnee ? "msg-bulle--selectionnee" : ""}`}
                      onContextMenu={(e) => ouvrirMenuContextuel(e, m)}
                      onClick={() => modeSelection && basculerSelectionMessage(m)}
                    >
                      {modeSelection && (
                        <span className="msg-bulle__case" aria-hidden="true">
                          {selectionnee && <CheckSquare size={14} />}
                        </span>
                      )}
                      <div className="msg-bulle__contenu">
                        {m.repond_a_id && (
                          <div className="msg-bulle__citation">
                            {/* miniature du produit/photo cité — le texte seul
                                ("📦 nom du produit") ne suffisait pas à montrer
                                CE dont on parle, corrigé définitivement en
                                affichant aussi la photo quand l'original en a
                                une (voir apercuCitation plus haut, et le même
                                traitement pour produitAPartager ci-dessous) */}
                            {original?.produit?.photo && (
                              <img
                                className="msg-bulle__citation-img"
                                src={original.produit.photo}
                                alt={original.produit.nom}
                              />
                            )}
                            <div className="msg-bulle__citation-texte-bloc">
                              <span className="msg-bulle__citation-nom">
                                {original
                                  ? (original.expediteur_id === utilisateur?.id
                                    ? t("messagerie.you")
                                    : conversationActive?.autre_utilisateur?.nom_affiche)
                                  : ""}
                              </span>
                              <span className="msg-bulle__citation-texte">
                                {original ? apercuCitation(original) : t("messagerie.messageUnavailable")}
                              </span>
                            </div>
                          </div>
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
                                  {m.produit.prix} {symboleDevise(m.produit.unitePrix)}
                                  {m.produit.unite_De_Mesure ? ` / ${m.produit.unite_De_Mesure}` : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {m.contenu && <p className="msg-bulle__texte">{m.contenu}</p>}
                        <span className="msg-bulle__heure">{formatHeure(m.date_envoi)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={finDesMessagesRef} />
              </div>

              {menuContextuel && (
                <div
                  className="msg-context-menu"
                  style={{ top: menuContextuel.y, left: menuContextuel.x }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" onClick={() => repondreAMessage(menuContextuel.message)}>
                    <Reply size={14} /> {t("messagerie.reply")}
                  </button>
                  {menuContextuel.message.expediteur_id !== utilisateur?.id && (
                    <button type="button" onClick={() => { ouvrirSignalementMessage(menuContextuel.message); setMenuContextuel(null); }}>
                      <Flag size={14} /> {t("messagerie.reportMessage")}
                    </button>
                  )}
                  <button type="button" onClick={() => demarrerSelection(menuContextuel.message)}>
                    <CheckSquare size={14} /> {t("messagerie.select")}
                  </button>
                  <button
                    type="button"
                    className="msg-context-menu__danger"
                    onClick={() => { const m = menuContextuel.message; setMenuContextuel(null); supprimerMessage(m); }}
                  >
                    <Trash2 size={14} /> {t("messagerie.deleteMessage")}
                  </button>
                </div>
              )}

              {messageEnReponse && (
                <div className="msg-reply-preview">
                  <div className="msg-reply-preview__barre" />
                  {messageEnReponse.produit?.photo ? (
                    <div className="msg-reply-preview__img">
                      <img src={messageEnReponse.produit.photo} alt={messageEnReponse.produit.nom} />
                    </div>
                  ) : (
                    <div className="msg-reply-preview__img msg-reply-preview__img--icone">
                      <Reply size={16} />
                    </div>
                  )}
                  <div className="msg-reply-preview__info">
                    <span className="msg-reply-preview__label">
                      {t("messagerie.replyingToMessage", {
                        nom: messageEnReponse.expediteur_id === utilisateur?.id
                          ? t("messagerie.you")
                          : conversationActive?.autre_utilisateur?.nom_affiche,
                      })}
                    </span>
                    <p className="msg-reply-preview__nom">{apercuCitation(messageEnReponse)}</p>
                  </div>
                  <button
                    type="button"
                    className="msg-reply-preview__fermer"
                    onClick={() => setMessageEnReponse(null)}
                    aria-label={t("messagerie.cancelReplyMessage")}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

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
              <p className="pd-modal__texte pd-alert pd-alert--succes">{t("productDetail.reportSent")}</p>
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
                {signalementErreur && <p className="rk-error"><XCircle size={20}/> {signalementErreur}</p>}
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

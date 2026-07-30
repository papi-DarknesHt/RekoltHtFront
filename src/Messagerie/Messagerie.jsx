import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, ShieldCheck } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import { useGlobalStore } from "../api/globalStore.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { MessagerieApi } from "../api/messagerie";
import "../assets/CSS/Messagerie.css";

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initiale(nom) {
  return (nom || "?").charAt(0).toUpperCase();
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
  const finDesMessagesRef = useRef(null);
  const setNonLus = useMessagerieBadgeStore((s) => s.setNonLus);

  // chargement initial des conversations — si on arrive depuis le bouton
  // "Contacter" d'une fiche produit (voir ProductCard.jsx -> navigate
  // `/messages?avec=<vendeur_id>&produit=<produit_id>`), on démarre/récupère
  // d'abord cette conversation précise avant de charger la liste complète
  useEffect(() => {
    const avecId = searchParams.get("avec");
    const produitId = searchParams.get("produit");

    const chargerListe = () =>
      MessagerieApi.mesConversations().then((res) => setConversations(res.conversations || []));

    const tout = avecId
      ? MessagerieApi.demarrerConversation(Number(avecId), produitId ? Number(produitId) : undefined)
          .then((res) => {
            setConversationActiveId(res.conversation.id);
            return chargerListe();
          })
      : chargerListe();

    tout
      .catch((err) => setErreur(err.message))
      .finally(() => setChargementConversations(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const conversationActive = conversations.find((c) => c.id === conversationActiveId) || null;

  const ouvrirConversation = (conversation) => {
    setConversationActiveId(conversation.id);
    if (conversation.non_lus > 0) {
      setConversations((liste) => liste.map((c) => (c.id === conversation.id ? { ...c, non_lus: 0 } : c)));
    }
  };

  const envoyerMessage = (e) => {
    e.preventDefault();
    const texte = brouillon.trim();
    if (!texte || !conversationActiveId) return;
    setEnvoiEnCours(true);
    setBrouillon("");
    MessagerieApi.envoyerMessage(conversationActiveId, texte)
      .then((res) => {
        setMessages((liste) => (liste.some((m) => m.id === res.message.id) ? liste : [...liste, res.message]));
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setEnvoiEnCours(false));
  };

  return (
    <div className="msg-page">
      <NavBar />

      <div className="msg-layout">
        <aside className="msg-sidebar">
          <div className="msg-sidebar__header">
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
                      {c.dernier_message ? (c.dernier_message.contenu || t("messagerie.sharedProduct")) : ""}
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
                    {m.contenu && <p className="msg-bulle__texte">{m.contenu}</p>}
                    <span className="msg-bulle__heure">{formatHeure(m.date_envoi)}</span>
                  </div>
                ))}
                <div ref={finDesMessagesRef} />
              </div>

              <form className="msg-chat__saisie" onSubmit={envoyerMessage}>
                <input
                  type="text"
                  className="msg-chat__input"
                  placeholder={t("messagerie.writeMessage")}
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                />
                <button type="submit" className="msg-chat__envoyer" disabled={envoiEnCours || !brouillon.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

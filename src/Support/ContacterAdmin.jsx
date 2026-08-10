import { useEffect, useState } from "react";
import { Send, ShieldCheck, Clock } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useGlobalStore } from "../api/globalStore.js";
import { MessagerieApi } from "../api/messagerie";
import { useE2eStore } from "../api/e2eStore.js";
import { dechiffrerEnveloppe } from "../utils/e2eCrypto.js";
import "../assets/CSS/ContacterAdmin.css";

function formaterDate(iso) {
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// texte à afficher pour contenu/reponse d'un message support — voir
// `dechiffres` dans ContacterAdmin() : undefined = pas encore tenté,
// null = échec (voir e2eCrypto.js::dechiffrerEnveloppe)
function texteChamp(valeur, t) {
  if (valeur === undefined) return t("messagerie.dechiffrementEnCours");
  if (valeur === null) return t("messagerie.contenuIllisible");
  return valeur;
}

export default function ContacterAdmin() {
  const { t } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);

  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // Deux formats coexistent pour contenu/reponse (voir Messagerie/views.py::
  // _serialiseMessageAdmin) : 'coffre_serveur' (nouveau, par défaut) — le
  // serveur a déjà déchiffré, le texte en clair est directement dans
  // m.contenu/m.reponse ; 'e2e_client' (legacy, messages envoyés avant
  // l'introduction du coffre support) — ciphertext, déchiffré ici même,
  // uniquement possible si j'ai toujours la bonne clé E2E.
  const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
  const clePriveeCryptoKey = useE2eStore((s) => s.clePriveeCryptoKey);
  const clePubliqueJwk = useE2eStore((s) => s.clePubliqueJwk);
  const obtenirClePubliqueDe = useE2eStore((s) => s.obtenirClePubliqueDe);
  // id -> { contenu?, reponse? } déjà déchiffrés (messages legacy uniquement)
  // — undefined/null, voir texteChamp
  const [dechiffres, setDechiffres] = useState({});

  useEffect(() => {
    // uniquement nécessaire pour déchiffrer d'éventuels messages LEGACY
    // encore au format E2E client — échec silencieux, ne doit jamais
    // bloquer cette page pour une raison qui ne la concerne plus vraiment
    garantirCleE2E().catch(() => {});
    MessagerieApi.mesMessagesAdmin()
      .then((res) => setMessages(res.messages_admin || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // déchiffre contenu (chiffré pour moi-même, l'auteur) et reponse (chiffrée
  // par l'admin qui a répondu — il faut sa clé publique, pas la mienne) —
  // uniquement pour les messages encore au format legacy 'e2e_client'
  useEffect(() => {
    if (messages.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const m of messages) {
        const entree = {};
        if (m.chiffre && m.format_chiffrement === "e2e_client") {
          if (!clePriveeCryptoKey || !clePubliqueJwk) {
            // pas encore prête — retentera au prochain passage de cet effet
          } else if (m.cle_contenu_moi) {
            try {
              entree.contenu = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueJwk, m.contenu, m.iv_contenu, m.cle_contenu_moi, m.iv_cle_contenu_moi
              );
            } catch { entree.contenu = null; }
          } else {
            entree.contenu = null;
          }
        }
        if (m.reponse && m.reponse_format_chiffrement === "e2e_client") {
          if (!clePriveeCryptoKey) {
            // pas encore prête
          } else if (m.cle_reponse_moi) {
            try {
              const clePubliqueAdmin = await obtenirClePubliqueDe(m.admin_repondant_id);
              entree.reponse = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueAdmin, m.reponse, m.iv_reponse, m.cle_reponse_moi, m.iv_cle_reponse_moi
              );
            } catch { entree.reponse = null; }
          } else {
            entree.reponse = null;
          }
        }
        if (Object.keys(entree).length > 0) resultats[m.id] = entree;
      }
      if (!annule && Object.keys(resultats).length > 0) setDechiffres((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messages, clePriveeCryptoKey, clePubliqueJwk, obtenirClePubliqueDe]);

  // réactivité temps réel (voir Messagerie/views.py::repondreMessageAdmin) —
  // diffusé au groupe personnel "user_<id>" de ce vendeur dès qu'un admin répond
  useEffect(() => {
    if (!messageAdminEvent || messageAdminEvent.type !== "message_admin.repondu") return;
    const data = messageAdminEvent.data;
    if (data.vendeur_id !== utilisateur?.id) return;
    setMessages((liste) => liste.map((m) => (m.id === data.id ? data : m)));
  }, [messageAdminEvent, utilisateur?.id]);

  const envoyerMessage = async (e) => {
    e.preventDefault();
    const contenu = brouillon.trim();
    if (!contenu) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      // chiffré côté serveur ("coffre support") — aucun chiffrement client
      // requis, voir Messagerie/services/support_chiffrement_service.py
      const res = await MessagerieApi.contacterAdmin(contenu);
      setMessages((liste) => [res.message_admin, ...liste]);
      setBrouillon("");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="ca-page">
      <NavBar />

      <div className="ca-container">
        <BoutonRetour />
        <div className="ca-header">
          <div className="ca-header__icon"><ShieldCheck size={22} /></div>
          <div>
            <h1 className="ca-header__title">{t("supportAdmin.title")}</h1>
            <p className="ca-header__subtitle">{t("supportAdmin.subtitle")}</p>
          </div>
        </div>

        <form className="ca-form" onSubmit={envoyerMessage}>
          <textarea
            className="ca-textarea"
            placeholder={t("supportAdmin.placeholder")}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
          />
          <button type="submit" className="ca-btn ca-btn--primary" disabled={envoiEnCours || !brouillon.trim()}>
            <Send size={16} />
            {envoiEnCours ? t("profile.loading") : t("supportAdmin.send")}
          </button>
          {erreur && <p className="ca-alert">{erreur}</p>}
        </form>

        <h2 className="ca-historique-titre">{t("supportAdmin.historyTitle")}</h2>

        {chargement && <p className="ca-hint">{t("profile.loading")}</p>}
        {!chargement && messages.length === 0 && (
          <p className="ca-hint">{t("supportAdmin.noMessages")}</p>
        )}

        {!chargement && messages.length > 0 && (
          <ul className="ca-liste">
            {messages.map((m) => (
              <li className="ca-item" key={m.id}>
                <div className="ca-item__bulle ca-item__bulle--envoye">
                  <p className="ca-item__texte">
                    {m.format_chiffrement === "e2e_client" ? texteChamp(dechiffres[m.id]?.contenu, t) : m.contenu}
                  </p>
                  <span className="ca-item__date">{formaterDate(m.date_envoi)}</span>
                </div>

                {m.reponse ? (
                  <div className="ca-item__bulle ca-item__bulle--reponse">
                    <p className="ca-item__auteur">
                      <ShieldCheck size={14} />
                      {m.admin_repondant_nom}
                    </p>
                    <p className="ca-item__texte">
                      {m.reponse_format_chiffrement === "e2e_client" ? texteChamp(dechiffres[m.id]?.reponse, t) : m.reponse}
                    </p>
                    <span className="ca-item__date">{formaterDate(m.date_reponse)}</span>
                  </div>
                ) : (
                  <p className="ca-item__attente">
                    <Clock size={14} />
                    {t("supportAdmin.awaitingReply")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Footer />
    </div>
  );
}

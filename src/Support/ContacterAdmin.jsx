import { useEffect, useState } from "react";
import { Send, ShieldCheck, Clock } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useGlobalStore } from "../api/globalStore.js";
import { MessagerieApi } from "../api/messagerie";
import "../assets/CSS/ContacterAdmin.css";

function formaterDate(iso) {
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

  useEffect(() => {
    MessagerieApi.mesMessagesAdmin()
      .then((res) => setMessages(res.messages_admin || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Messagerie/views.py::repondreMessageAdmin) —
  // diffusé au groupe personnel "user_<id>" de ce vendeur dès qu'un admin répond
  useEffect(() => {
    if (!messageAdminEvent || messageAdminEvent.type !== "message_admin.repondu") return;
    const data = messageAdminEvent.data;
    if (data.vendeur_id !== utilisateur?.id) return;
    setMessages((liste) => liste.map((m) => (m.id === data.id ? data : m)));
  }, [messageAdminEvent, utilisateur?.id]);

  const envoyerMessage = (e) => {
    e.preventDefault();
    const contenu = brouillon.trim();
    if (!contenu) return;
    setEnvoiEnCours(true);
    setErreur(null);
    MessagerieApi.contacterAdmin(contenu)
      .then((res) => {
        setMessages((liste) => [res.message_admin, ...liste]);
        setBrouillon("");
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setEnvoiEnCours(false));
  };

  return (
    <div className="ca-page">
      <NavBar />

      <div className="ca-container">
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
                  <p className="ca-item__texte">{m.contenu}</p>
                  <span className="ca-item__date">{formaterDate(m.date_envoi)}</span>
                </div>

                {m.reponse ? (
                  <div className="ca-item__bulle ca-item__bulle--reponse">
                    <p className="ca-item__auteur">
                      <ShieldCheck size={14} />
                      {m.admin_repondant_nom}
                    </p>
                    <p className="ca-item__texte">{m.reponse}</p>
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

import { useState } from "react";
import { Mail, Send, MessageSquare, Clock } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import "../assets/CSS/ContacterNous.css";

const FORM_VIDE = { nom: "", email: "", sujet: "", message: "" };

// page publique — n'importe quel visiteur (connecté ou non) peut envoyer un
// message à l'équipe RekoltHt, transmis par email (voir Registration/views.py
// ::contacterNous). Distincte de Support/ContacterAdmin.jsx, réservée aux
// vendeurs déjà connectés pour contacter spécifiquement les administrateurs.
export default function ContacterNous() {
  const { t } = useTranslation();
  const [form, setForm] = useState(FORM_VIDE);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await AuthentificationApi.contacterNous(form);
      setEnvoye(true);
      setForm(FORM_VIDE);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="cn-page">
      <NavBar />

      <div className="cn-container">
        <BoutonRetour />

        <div className="cn-header">
          <div className="cn-header__icon"><Mail size={22} /></div>
          <div>
            <h1 className="cn-header__title">{t("contactPage.title")}</h1>
            <p className="cn-header__subtitle">{t("contactPage.subtitle")}</p>
          </div>
        </div>

        <div className="cn-infos">
          <span className="cn-info-item"><MessageSquare size={15} />{t("contactPage.responseInfo")}</span>
          <span className="cn-info-item"><Clock size={15} />{t("contactPage.hoursInfo")}</span>
        </div>

        {envoye ? (
          <p className="cn-alert cn-alert--succes">{t("contactPage.success")}</p>
        ) : (
          <form className="cn-form" onSubmit={soumettre}>
            <div className="cn-row">
              <div className="cn-field">
                <label className="cn-label">{t("contactPage.nameLabel")}</label>
                <input
                  type="text"
                  className="cn-input"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  required
                />
              </div>
              <div className="cn-field">
                <label className="cn-label">{t("contactPage.emailLabel")}</label>
                <input
                  type="email"
                  className="cn-input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="cn-field">
              <label className="cn-label">{t("contactPage.subjectLabel")}</label>
              <input
                type="text"
                className="cn-input"
                value={form.sujet}
                onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))}
                placeholder={t("contactPage.subjectPlaceholder")}
              />
            </div>

            <div className="cn-field">
              <label className="cn-label">{t("contactPage.messageLabel")}</label>
              <textarea
                className="cn-textarea"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={t("contactPage.messagePlaceholder")}
                required
              />
            </div>

            {erreur && <p className="cn-alert cn-alert--error">✗ {erreur}</p>}

            <button type="submit" className="cn-btn" disabled={envoiEnCours}>
              <Send size={16} />
              {envoiEnCours ? t("profile.loading") : t("contactPage.send")}
            </button>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}

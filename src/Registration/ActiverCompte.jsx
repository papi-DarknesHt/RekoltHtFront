import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import "../assets/CSS/Authentification.css";
import logo from "../assets/Images/Asset5.svg";
import { useAuthStore } from "./AuthentificationStore";
import { AuthentificationApi } from "../api/auth";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import {XCircle, Check} from 'lucide-react'

export default function ActiverCompte() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useTranslation();
  const confirmerInscription = useAuthStore((s) => s.confirmerInscription);

  // "pret" (bouton à cliquer) | "en_cours" | "succes" | "erreur" — volontairement
  // PAS déclenché automatiquement au montage (voir plus bas) : un scanner de
  // sécurité d'email (Gmail/Outlook, "Safe Links"...) ou un simple aperçu de
  // lien visite souvent l'URL avant même que l'utilisateur ne clique dessus.
  // Le token étant à usage unique (supprimé côté serveur dès la première
  // confirmation réussie, voir confirmerInscription, Registration/views.py),
  // un tel pré-chargement consommait le lien silencieusement — le VRAI clic
  // de l'utilisateur tombait alors systématiquement sur "lien invalide", même
  // si le compte avait en réalité déjà été créé par le scanner. Exiger un
  // clic explicite élimine ce risque : un robot ne clique pas sur un bouton.
  const [statut, setStatut] = useState(token ? "pret" : "erreur");
  const [erreur, setErreur] = useState(token ? null : t("auth.activationLinkMissing"));
  const [emailRenvoi, setEmailRenvoi] = useState("");
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [renvoiEnvoye, setRenvoiEnvoye] = useState(false);

  const handleActiver = () => {
    setStatut("en_cours");
    confirmerInscription(token)
      .then(() => {
        setStatut("succes");
        setTimeout(() => navigate("/"), 1500);
      })
      .catch((err) => {
        setStatut("erreur");
        setErreur(err.message);
      });
  };

  const handleRenvoyer = async (e) => {
    e.preventDefault();
    if (!emailRenvoi.trim()) return;
    setRenvoiEnCours(true);
    setRenvoiEnvoye(false);
    try {
      await AuthentificationApi.renvoyerActivation(emailRenvoi.trim());
      setRenvoiEnvoye(true);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setRenvoiEnCours(false);
    }
  };

  return (
    <div className="rk-root">
      <div className="rk-right" style={{ margin: "0 auto", float: "none" }}>
        <div className="rk-card">
          <img src={logo} alt="" style={{ height: 40, marginBottom: 16 }} />

          {statut === "pret" && (
            <>
              <p className="rk-card-sub">{t("auth.activationReadyPrompt")}</p>
              <button type="button" className="rk-btn" onClick={handleActiver}>
                {t("auth.activateAccountButton")}
              </button>
            </>
          )}

          {statut === "en_cours" && (
            <p className="rk-card-sub">{t("auth.activationInProgress")}</p>
          )}

          {statut === "succes" && (
            <div className="rk-success"><Check size={20}/> {t("auth.activationSuccess")}</div>
          )}

          {statut === "erreur" && (
            <>
              <p className="rk-error"><XCircle size={20}/> {erreur}</p>
              <form onSubmit={handleRenvoyer}>
                <div className="rk-field">
                  <label className="rk-label">{t("auth.email")}</label>
                  <input
                    className="rk-input" type="email" value={emailRenvoi}
                    onChange={(e) => setEmailRenvoi(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")} required
                  />
                </div>
                {renvoiEnvoye && <div className="rk-success"><Check size={20}/> {t("auth.activationEmailResent")}</div>}
                <button type="submit" className="rk-btn" disabled={renvoiEnCours}>
                  {renvoiEnCours ? t("auth.loading") : t("auth.resendActivationEmail")}
                </button>
              </form>
              <p style={{ marginTop: 16 }}>
                <Link to="/auth">{t("auth.backToLogin")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

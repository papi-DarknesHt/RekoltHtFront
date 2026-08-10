import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import "../assets/CSS/Authentification.css";
import logo from "../assets/Images/Asset5.svg";
import { useAuthStore } from "./AuthentificationStore";
import { AuthentificationApi } from "../api/auth";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// page publique (PAS dans RoutePrivee — l'utilisateur n'est pas encore
// connecté) ouverte depuis le lien reçu par email (voir sinscrire,
// Registration/views.py) — valide le token en query string et crée enfin le
// compte (voir confirmerInscription, même backend)
export default function ActiverCompte() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useTranslation();
  const confirmerInscription = useAuthStore((s) => s.confirmerInscription);

  const [statut, setStatut] = useState("en_cours"); // en_cours | succes | erreur
  const [erreur, setErreur] = useState(null);
  const [emailRenvoi, setEmailRenvoi] = useState("");
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [renvoiEnvoye, setRenvoiEnvoye] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatut("erreur");
      setErreur(t("auth.activationLinkMissing"));
      return;
    }
    confirmerInscription(token)
      .then(() => {
        setStatut("succes");
        setTimeout(() => navigate("/"), 1500);
      })
      .catch((err) => {
        setStatut("erreur");
        setErreur(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

          {statut === "en_cours" && (
            <p className="rk-card-sub">{t("auth.activationInProgress")}</p>
          )}

          {statut === "succes" && (
            <div className="rk-success">✓ {t("auth.activationSuccess")}</div>
          )}

          {statut === "erreur" && (
            <>
              <p className="rk-error">✗ {erreur}</p>
              <form onSubmit={handleRenvoyer}>
                <div className="rk-field">
                  <label className="rk-label">{t("auth.email")}</label>
                  <input
                    className="rk-input" type="email" value={emailRenvoi}
                    onChange={(e) => setEmailRenvoi(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")} required
                  />
                </div>
                {renvoiEnvoye && <div className="rk-success">✓ {t("auth.activationEmailResent")}</div>}
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

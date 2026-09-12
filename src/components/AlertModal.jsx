import { useNavigate } from "react-router-dom";
import { AlertOctagon } from "lucide-react";
import { useAlertStore } from "../api/alertStore.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/AlertModal.css";

// popup d'information global (voir api/alertStore.js) — monté une seule fois
// dans App.jsx, au-dessus de tout le reste. Contrairement à ConfirmModal, ne
// bloque rien : juste un message + un bouton OK, avec une action secondaire
// optionnelle (ex: "Contacter l'administration" → /contact).
export default function AlertModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requete = useAlertStore((s) => s.requete);
  const fermer = useAlertStore((s) => s.fermer);

  if (!requete) return null;

  const { titre, message, actionLabel, actionHref, danger } = requete;

  return (
    <div className="alert-modal-overlay" onClick={fermer}>
      <div className={`alert-modal ${danger ? "alert-modal--danger" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal__icon"><AlertOctagon size={22} /></div>
        {titre && <h3 className="alert-modal__titre">{titre}</h3>}
        <p className="alert-modal__text">{message}</p>
        <div className="alert-modal__actions">
          {actionHref && actionLabel && (
            <button
              type="button"
              className="alert-modal__btn alert-modal__btn--secondary"
              onClick={() => { fermer(); navigate(actionHref); }}
            >
              {actionLabel}
            </button>
          )}
          <button type="button" className="alert-modal__btn alert-modal__btn--primary" onClick={fermer}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

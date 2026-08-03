import { AlertTriangle } from "lucide-react";
import { useConfirmStore } from "../api/confirmStore.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/ConfirmModal.css";

// popup de confirmation global — voir api/confirmStore.js pour l'appel
// (useConfirmStore((s) => s.demander)) ; monté une seule fois dans App.jsx
export default function ConfirmModal() {
  const { t } = useTranslation();
  const requete = useConfirmStore((s) => s.requete);
  const repondre = useConfirmStore((s) => s.repondre);

  if (!requete) return null;

  return (
    <div className="confirm-modal-overlay" onClick={() => repondre(false)}>
      <div className={`confirm-modal ${requete.danger ? "confirm-modal--danger" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__icon"><AlertTriangle size={22} /></div>
        <p className="confirm-modal__text">{requete.message}</p>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--secondary"
            onClick={() => repondre(false)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn ${requete.danger ? "confirm-modal__btn--danger" : "confirm-modal__btn--primary"}`}
            onClick={() => repondre(true)}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { useRaisonStore } from "../api/raisonStore.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/ConfirmModal.css";
import "../assets/CSS/RaisonModal.css";

// popup demandant une justification texte avant toute décision de modération
// sur un signalement (voir api/raisonStore.js) ; monté une seule fois dans
// App.jsx, à côté de <ConfirmModal /> — la séquence complète est toujours
// raison d'abord, confirmation ensuite (voir AdminDashboard.jsx)
export default function RaisonModal() {
  const { t } = useTranslation();
  const requete = useRaisonStore((s) => s.requete);
  const repondre = useRaisonStore((s) => s.repondre);
  const [texte, setTexte] = useState("");

  if (!requete) return null;

  const valide = texte.trim().length > 0;

  const fermer = (raison) => {
    setTexte("");
    repondre(raison);
  };

  return (
    <div className="confirm-modal-overlay" onClick={() => fermer(null)}>
      <div className={`confirm-modal raison-modal ${requete.danger ? "confirm-modal--danger" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__icon"><MessageSquareText size={22} /></div>
        <p className="confirm-modal__text">{requete.message}</p>
        <textarea
          className="raison-modal__textarea"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={t("admin.dashboard.reasonPlaceholder")}
          rows={4}
          autoFocus
        />
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--secondary"
            onClick={() => fermer(null)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn ${requete.danger ? "confirm-modal__btn--danger" : "confirm-modal__btn--primary"}`}
            disabled={!valide}
            onClick={() => fermer(texte.trim())}
          >
            {t("common.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

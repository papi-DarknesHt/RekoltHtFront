import { useState } from "react";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// Bulle de conseils flottante (pas un vrai agent conversationnel — aucun
// backend de chat n'existe dans ce projet) : le message affiché change selon
// l'étape du wizard DevenirVendeur.jsx, ou selon le statut une fois la
// demande soumise.
const CLES_TIP_ETAPE = {
    1: "seller.chatbotTipStep1",
    2: "seller.chatbotTipStep2",
    3: "seller.chatbotTipStep3",
    4: "seller.chatbotTipStep4",
    5: "seller.chatbotTipStep5",
};

const CLES_TIP_STATUT = {
    en_attente: "seller.chatbotTipStatusPending",
    en_attente_manuelle: "seller.chatbotTipStatusManual",
    verifie: "seller.chatbotTipStatusVerified",
    echoue: "seller.chatbotTipStatusFailed",
};

export default function ChatbotVendeur({ etape, statut }) {
    const { t } = useTranslation();
    const [ouvert, setOuvert] = useState(false);

    const cle = statut ? CLES_TIP_STATUT[statut] : CLES_TIP_ETAPE[etape];
    if (!cle) return null;

    return (
        <div className="cv-wrap">
            {ouvert && (
                <div className="cv-panel">
                    <div className="cv-panel-header">
                        <span>{t("seller.chatbotTitle")}</span>
                        <button type="button" className="cv-close" onClick={() => setOuvert(false)} aria-label="Fermer">
                            ×
                        </button>
                    </div>
                    <p className="cv-panel-text">{t(cle)}</p>
                </div>
            )}
            <button
                type="button"
                className="cv-toggle"
                onClick={() => setOuvert(o => !o)}
                aria-label={t("seller.chatbotToggleLabel")}
            >
                💬
            </button>
        </div>
    );
}

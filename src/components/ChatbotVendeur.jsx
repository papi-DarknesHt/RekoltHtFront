import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import "../assets/CSS/ChatbotVendeur.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useChatbotStore } from "./chatbotStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { MessagerieApi } from "../api/messagerie";
import { useE2eStore } from "../api/e2eStore.js";
import { chiffrerEnEnveloppe } from "../utils/e2eCrypto.js";
import { SECTIONS_AIDE, SECTIONS_A_PROPOS, SECTIONS_CONDITIONS } from "../assets/Translate/faqSections.js";
import { trouverReponseFaq } from "../utils/faqMatcher.js";

// Assistant flottant, monté une seule fois globalement (voir App.jsx) pour
// être disponible sur toutes les pages. Deux rôles :
// 1. Conseil contextuel pendant le wizard DevenirVendeur.jsx (comportement
//    d'origine, voir chatbotStore.js) — affiché comme premier message du bot
//    à l'ouverture, si un contexte est actif.
// 2. Petit agent de FAQ : la question tapée par l'utilisateur est recoupée
//    avec le contenu des pages Aide, Qui sommes-nous et Politique
//    d'utilisation (aide.sections.*/about.*/terms.*, voir faqSections.js
//    et utils/faqMatcher.js — recoupement de mots-clés, pas un vrai NLP). Si
//    aucune réponse ne ressort, propose de transmettre la question à un admin
//    (voir Messagerie/views.py::contacterAdmin, ouvert à tout compte
//    acheteur/vendeur connecté, pas seulement vendeur).
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

let prochainId = 1;

export default function ChatbotVendeur() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [ouvert, setOuvert] = useState(false);
    const [messages, setMessages] = useState([]);
    const [saisie, setSaisie] = useState("");
    const [questionEnAttente, setQuestionEnAttente] = useState(null);
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const zoneMessagesRef = useRef(null);

    const etape = useChatbotStore((s) => s.etape);
    const statut = useChatbotStore((s) => s.statut);
    const isConnected = useAuthStore((s) => s.isConnected);
    const utilisateur = useAuthStore((s) => s.utilisateur);
    const profil = useProfilStore((s) => s.profil);
    const isAdmin = profil?.role === "admin";

    // chiffrement de bout en bout de l'escalade vers le support (voir
    // Support/ContacterAdmin.jsx pour le même principe détaillé)
    const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
    const clePubliqueJwk = useE2eStore((s) => s.clePubliqueJwk);
    const obtenirClesAdmins = useE2eStore((s) => s.obtenirClesAdmins);

    const cleTipContexte = statut ? CLES_TIP_STATUT[statut] : CLES_TIP_ETAPE[etape];

    // liste plate des questions/réponses de la FAQ dans la langue courante —
    // reconstruite si la langue change (t change de référence, voir i18n.jsx).
    // Combine les trois sources : Aide (déjà en questions/réponses), Qui
    // sommes-nous et Politique d'utilisation (prose, une question dédiée au
    // chatbot a été écrite pour chaque section — voir faqSections.js)
    const faq = useMemo(() => {
        const liste = [];
        for (const section of SECTIONS_AIDE) {
            for (let n = 1; n <= section.nombreItems; n++) {
                liste.push({
                    question: t(`aide.sections.${section.cle}.q${n}`),
                    reponse: t(`aide.sections.${section.cle}.a${n}`),
                });
            }
        }
        for (const item of [...SECTIONS_A_PROPOS, ...SECTIONS_CONDITIONS]) {
            liste.push({ question: t(item.questionCle), reponse: t(item.reponseCle) });
        }
        return liste;
    }, [t]);

    const ajouterMessage = (type, texte) => {
        setMessages((liste) => [...liste, { id: prochainId++, type, texte }]);
    };

    // message d'accueil à la première ouverture — le conseil contextuel du
    // wizard KYC s'il est actif, sinon une invitation générique à poser une question
    const ouvrir = () => {
        setOuvert(true);
        if (messages.length === 0) {
            ajouterMessage("bot", t(cleTipContexte || "seller.chatbotTipDefault"));
        }
    };

    useEffect(() => {
        if (zoneMessagesRef.current) {
            zoneMessagesRef.current.scrollTop = zoneMessagesRef.current.scrollHeight;
        }
    }, [messages, questionEnAttente]);

    const soumettreQuestion = (e) => {
        e.preventDefault();
        const question = saisie.trim();
        if (!question) return;
        setSaisie("");
        ajouterMessage("moi", question);
        setQuestionEnAttente(null);

        const trouvee = trouverReponseFaq(question, faq);
        if (trouvee) {
            ajouterMessage("bot", trouvee.reponse);
            return;
        }

        if (isAdmin) {
            // un admin n'a pas d'autre admin "générique" à contacter depuis ce
            // widget — pas de proposition d'escalade dans ce cas
            ajouterMessage("bot", t("chatbot.noAnswerAdmin"));
            return;
        }

        ajouterMessage("bot", t("chatbot.noAnswer"));
        setQuestionEnAttente(question);
    };

    // n'est appelé que lorsque isConnected est vrai (voir le rendu des
    // boutons ci-dessous) — un visiteur non connecté voit à la place des
    // liens directs vers la connexion ou la page Contact
    const accepterEscalade = async () => {
        const question = questionEnAttente;
        setQuestionEnAttente(null);
        setEnvoiEnCours(true);
        try {
            const clePrivee = await garantirCleE2E();
            const admins = await obtenirClesAdmins();
            const destinataires = [...admins, { utilisateur_id: utilisateur.id, cle_publique: clePubliqueJwk }];
            const { contenu, iv, cles } = await chiffrerEnEnveloppe(clePrivee, question, destinataires);
            await MessagerieApi.contacterAdmin(contenu, iv, cles);
            ajouterMessage("bot", t("chatbot.escalateSent"));
        } catch (err) {
            ajouterMessage("bot", err.message);
        } finally {
            setEnvoiEnCours(false);
        }
    };

    const refuserEscalade = () => {
        setQuestionEnAttente(null);
        ajouterMessage("bot", t("chatbot.escalateDeclined"));
    };

    return (
        <div className="cv-wrap">
            {ouvert && (
                <div className="cv-panel cv-panel--chat">
                    <div className="cv-panel-header">
                        <span>{t("seller.chatbotTitle")}</span>
                        <button type="button" className="cv-close" onClick={() => setOuvert(false)} aria-label={t("common.close")}>
                            ×
                        </button>
                    </div>

                    <div className="cv-messages" ref={zoneMessagesRef}>
                        {messages.map((m) => (
                            <p key={m.id} className={`cv-message cv-message--${m.type}`}>{m.texte}</p>
                        ))}
                        {envoiEnCours && <p className="cv-message cv-message--bot cv-message--attente">{t("profile.loading")}</p>}
                    </div>

                    {questionEnAttente && !envoiEnCours && (
                        <div className="cv-escalade-actions">
                            {isConnected ? (
                                <button type="button" className="cv-btn cv-btn--primary" onClick={accepterEscalade}>
                                    {t("chatbot.escalateYes")}
                                </button>
                            ) : (
                                <>
                                    <button type="button" className="cv-btn cv-btn--primary" onClick={() => navigate("/auth")}>
                                        {t("chatbot.escalateGoToLogin")}
                                    </button>
                                    <button type="button" className="cv-btn" onClick={() => navigate("/contact")}>
                                        {t("chatbot.escalateGoToContact")}
                                    </button>
                                </>
                            )}
                            <button type="button" className="cv-btn" onClick={refuserEscalade}>
                                {t("chatbot.escalateNo")}
                            </button>
                        </div>
                    )}

                    <form className="cv-input-row" onSubmit={soumettreQuestion}>
                        <input
                            type="text"
                            className="cv-input"
                            value={saisie}
                            onChange={(e) => setSaisie(e.target.value)}
                            placeholder={t("chatbot.inputPlaceholder")}
                        />
                        <button type="submit" className="cv-send" aria-label={t("chatbot.send")} disabled={!saisie.trim()}>
                            <Send size={15} />
                        </button>
                    </form>
                </div>
            )}
            <button
                type="button"
                className="cv-toggle"
                onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
                aria-label={t("seller.chatbotToggleLabel")}
            >
                💬
            </button>
        </div>
    );
}

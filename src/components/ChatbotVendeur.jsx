import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import "../assets/CSS/ChatbotVendeur.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useChatbotStore } from "./chatbotStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { MessagerieApi } from "../api/messagerie";
import { SECTIONS_AIDE, SECTIONS_A_PROPOS, SECTIONS_CONDITIONS } from "../assets/Translate/faqSections.js";

// Assistant flottant, monté une seule fois globalement (voir App.jsx) pour
// être disponible sur toutes les pages. Deux rôles :
// 1. Conseil contextuel pendant le wizard DevenirVendeur.jsx (comportement
//    d'origine, voir chatbotStore.js) — affiché comme premier message du bot
//    à l'ouverture, si un contexte est actif.
// 2. Assistant conversationnel : chaque question tapée est envoyée à un vrai
//    modèle de langage (Claude, voir Messagerie/services/chatbot_ia_service.py
//    et Messagerie/views.py::chatbotRepondre) accompagnée de tout le contenu
//    du Centre d'aide/À propos/Conditions (aide.sections.*/about.*/terms.*,
//    voir faqSections.js — même source que les pages publiques, jamais
//    dupliquée) : l'IA s'appuie STRICTEMENT sur cette documentation, tolère
//    les fautes de frappe/formulations vagues, pose une question de
//    clarification plutôt que de deviner sur un mot-clé trop large (ex.
//    "vendeur" tout seul), et signale elle-même quand une question sort de ce
//    périmètre (`hors_sujet`, voir soumettreQuestion) — remplace l'ancien
//    recoupement de mots-clés (utils/faqMatcher.js, retiré, jugé pas assez
//    intelligent — demande explicite). Si vraiment hors sujet, ou si
//    l'assistant IA est indisponible (panne, clé non configurée...), propose
//    de transmettre la question à un admin (voir Messagerie/views.py::
//    contacterAdmin, ouvert à tout compte acheteur/vendeur connecté, pas
//    seulement vendeur).
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

// nombre max de tours (messages moi+bot confondus) transmis comme historique
// de conversation à l'IA pour la continuité — au-delà, coupé (l'IA n'a de
// toute façon besoin que des derniers échanges pour suivre le fil)
const MAX_TOURS_HISTORIQUE = 12;

let prochainId = 1;

export default function ChatbotVendeur() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [ouvert, setOuvert] = useState(false);
    const [messages, setMessages] = useState([]);
    const [saisie, setSaisie] = useState("");
    const [questionEnAttente, setQuestionEnAttente] = useState(null);
    // requête en cours vers l'assistant IA (distinct de envoiEnCours, qui ne
    // concerne que l'envoi d'un message à un admin, voir accepterEscalade)
    const [attenteReponseIA, setAttenteReponseIA] = useState(false);
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const zoneMessagesRef = useRef(null);

    const etape = useChatbotStore((s) => s.etape);
    const statut = useChatbotStore((s) => s.statut);
    const isConnected = useAuthStore((s) => s.isConnected);
    const profil = useProfilStore((s) => s.profil);
    const isAdmin = profil?.role === "admin";

    const cleTipContexte = statut ? CLES_TIP_STATUT[statut] : CLES_TIP_ETAPE[etape];

    // liste plate des questions/réponses de la documentation dans la langue
    // courante — reconstruite si la langue change (t change de référence,
    // voir i18n.jsx). Combine les trois sources : Aide (déjà en
    // questions/réponses), Qui sommes-nous et Politique d'utilisation (prose,
    // une question dédiée au chatbot a été écrite pour chaque section — voir
    // faqSections.js)
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

    // documentation assemblée en un seul bloc de texte, envoyée à chaque
    // question comme contexte pour l'IA (voir MessagerieApi.demanderReponseChatbotIA)
    const contexte = useMemo(
        () => faq.map((item) => `Q: ${item.question}\nR: ${item.reponse}`).join("\n\n"),
        [faq],
    );

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
    }, [messages, questionEnAttente, attenteReponseIA]);

    // dégrade vers le flux d'escalade existant (proposer de contacter un
    // admin) — appelé aussi bien quand l'IA elle-même signale hors_sujet que
    // quand l'appel à l'IA échoue complètement (panne, clé non configurée...)
    const proposerEscalade = (question) => {
        if (isAdmin) {
            // un admin n'a pas d'autre admin "générique" à contacter depuis ce
            // widget — pas de proposition d'escalade dans ce cas
            ajouterMessage("bot", t("chatbot.noAnswerAdmin"));
            return;
        }
        setQuestionEnAttente(question);
    };

    const soumettreQuestion = async (e) => {
        e.preventDefault();
        const question = saisie.trim();
        if (!question || attenteReponseIA) return;
        setSaisie("");
        ajouterMessage("moi", question);
        setQuestionEnAttente(null);

        // historique AVANT l'ajout du message ci-dessus (closure sur l'état au
        // moment de l'appel) — donne à l'IA le fil de la conversation sans le
        // dupliquer avec la question posée séparément (voir chatbot_ia_service.py)
        const historique = messages
            .filter((m) => m.type === "moi" || m.type === "bot")
            .slice(-MAX_TOURS_HISTORIQUE)
            .map((m) => ({ role: m.type === "moi" ? "user" : "assistant", contenu: m.texte }));

        setAttenteReponseIA(true);
        try {
            const resultat = await MessagerieApi.demanderReponseChatbotIA(question, contexte, historique);
            ajouterMessage("bot", resultat.reponse);
            if (resultat.hors_sujet) {
                proposerEscalade(question);
            }
        } catch {
            // assistant IA indisponible (panne réseau, clé non configurée côté
            // serveur, quota API...) — même dégradation que "hors sujet" : on ne
            // laisse jamais l'utilisateur sans réponse ni recours
            ajouterMessage("bot", isAdmin ? t("chatbot.noAnswerAdmin") : t("chatbot.noAnswer"));
            proposerEscalade(question);
        } finally {
            setAttenteReponseIA(false);
        }
    };

    // n'est appelé que lorsque isConnected est vrai (voir le rendu des
    // boutons ci-dessous) — un visiteur non connecté voit à la place des
    // liens directs vers la connexion ou la page Contact
    const accepterEscalade = async () => {
        const question = questionEnAttente;
        setQuestionEnAttente(null);
        setEnvoiEnCours(true);
        try {
            // chiffré côté serveur ("coffre support") — aucun chiffrement
            // client requis, voir Messagerie/services/support_chiffrement_service.py
            await MessagerieApi.contacterAdmin(question);
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
                        {attenteReponseIA && <p className="cv-message cv-message--bot cv-message--attente">{t("chatbot.thinking")}</p>}
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
                            disabled={attenteReponseIA}
                        />
                        <button type="submit" className="cv-send" aria-label={t("chatbot.send")} disabled={!saisie.trim() || attenteReponseIA}>
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

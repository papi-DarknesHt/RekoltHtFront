import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/ConfirmModal.css";

// bannière bloquante globale — affichée dès que l'utilisateur connecté a
// utilisateur.doit_changer_mot_de_passe (voir reinitialiserMotDePasseAdmin,
// Registration/views.py : un super admin/"Tous les droits" a demandé la
// réinitialisation de son mot de passe). Le mot de passe ACTUEL reste valide
// (voir modifierMotDePasse, qui le vérifie toujours) — cette bannière ne fait
// qu'empêcher d'utiliser le reste de la plateforme tant qu'un nouveau mot de
// passe n'a pas été choisi. Montée une seule fois dans App.jsx, comme ConfirmModal.
export default function ForcerChangementMotDePasse() {
    const { t } = useTranslation();
    const isConnecte = useAuthStore((s) => s.isConnected);
    const utilisateur = useAuthStore((s) => s.utilisateur);
    const modifierMotDePasse = useAuthStore((s) => s.modifierMotDePasse);
    const deconnexion = useAuthStore((s) => s.deconnexion);

    const [ancien, setAncien] = useState("");
    const [nouveau, setNouveau] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [erreur, setErreur] = useState(null);
    const [enCours, setEnCours] = useState(false);

    if (!isConnecte || !utilisateur?.doit_changer_mot_de_passe) return null;

    const soumettre = async (e) => {
        e.preventDefault();
        setErreur(null);
        if (nouveau !== confirmation) {
            setErreur(t("auth.passwordMismatch"));
            return;
        }
        setEnCours(true);
        try {
            await modifierMotDePasse({ ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau });
            // modifierMotDePasse (store) ne renvoie que { message } et ne met pas
            // à jour utilisateur — sans ça, cette bannière resterait affichée
            // jusqu'au prochain rechargement de page malgré le succès
            const utilisateurMaJ = { ...utilisateur, doit_changer_mot_de_passe: false };
            localStorage.setItem("utilisateur", JSON.stringify(utilisateurMaJ));
            useAuthStore.setState({ utilisateur: utilisateurMaJ });
        } catch (err) {
            setErreur(err.message);
        } finally {
            setEnCours(false);
        }
    };

    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal" style={{ maxWidth: "400px" }}>
                <div className="confirm-modal__icon"><KeyRound size={22} /></div>
                <p className="confirm-modal__text">{t("auth.forcedPasswordChangeMessage")}</p>
                <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                    <div className="rk-field">
                        <label className="rk-label">{t("profile.currentPassword")}</label>
                        <input type="password" className="rk-input" value={ancien} onChange={(e) => setAncien(e.target.value)} required />
                    </div>
                    <div className="rk-field">
                        <label className="rk-label">{t("profile.newPassword")}</label>
                        <input type="password" className="rk-input" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required minLength={8} />
                    </div>
                    <div className="rk-field">
                        <label className="rk-label">{t("profile.confirmNewPassword")}</label>
                        <input type="password" className="rk-input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} />
                    </div>
                    {erreur && <p className="rk-error">✗ {erreur}</p>}
                    <div className="confirm-modal__actions">
                        <button type="button" className="confirm-modal__btn confirm-modal__btn--secondary" onClick={deconnexion}>
                            {t("nav.logout")}
                        </button>
                        <button type="submit" className="confirm-modal__btn confirm-modal__btn--primary" disabled={enCours}>
                            {enCours ? t("profile.saving") : t("profile.changePassword")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import "../assets/CSS/NotificationsPermission.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { useNotifPushStore } from "../api/notifPushStore.js";
import logo from "../assets/Images/Asset5.svg";

// Modale (même schéma que ConfirmModal.jsx : overlay plein écran, carte
// centrée, au-dessus de TOUT — y compris le header, voir NotificationsPermission.css)
// qui propose d'activer les notifications du NAVIGATEUR (API Notification
// native — distincte de la sonnette in-app de NavBar.jsx, qui elle continue
// de fonctionner sans rien demander) : permet d'être alerté d'un nouveau
// message même l'onglet RekoltHt en arrière-plan/minimisé. Montée une seule
// fois globalement (voir App.jsx, même schéma que ChatbotVendeur/ConfirmModal).
//
// Demande explicite : si l'utilisateur refuse/ignore cette PREMIÈRE
// proposition, NE JAMAIS s'en souvenir durablement (aucune écriture
// localStorage) — seul un état React en mémoire (ecarte ci-dessous) évite de
// la ré-afficher une deuxième fois PENDANT la même session d'onglet ; un
// simple rechargement de page ou une nouvelle visite la reproposera tant que
// le navigateur n'a pas lui-même mémorisé un choix définitif ("Activer" ->
// Notification.permission passe à "granted"/"denied", mémorisé par le
// NAVIGATEUR, pas par nous). Une fois accordée, l'utilisateur garde la main
// pour activer/désactiver À TOUT MOMENT depuis le commutateur du menu
// notifications (voir NavBar.jsx et api/notifPushStore.js — CE réglage-là,
// contrairement à "Plus tard" ci-dessous, est bien persisté : c'est un choix
// actif, pas une mise de côté temporaire).
export default function NotificationsPermission() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isConnected = useAuthStore((s) => s.isConnected);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const profil = useProfilStore((s) => s.profil);
  const isAdmin = profil?.role === "admin";
  const messageEvent = useGlobalStore((s) => s.messageEvent);
  const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);
  const notifsActivees = useNotifPushStore((s) => s.activees);
  const definirNotifsActivees = useNotifPushStore((s) => s.definir);

  const supporte = typeof window !== "undefined" && "Notification" in window;

  // valeur calculée au montage (pas d'effet nécessaire : voir "visible"
  // ci-dessous, entièrement dérivé au rendu) — devient true dès que
  // l'utilisateur clique "Activer" (quel que soit le résultat, accordé ou
  // refusé : dans les deux cas le NAVIGATEUR mémorise désormais son propre
  // choix, on n'a plus besoin de reproposer CETTE modale précisément — le
  // commutateur de NavBar.jsx reste lui accessible en permanence)
  const [dejaChoisi, setDejaChoisi] = useState(() => supporte && Notification.permission !== "default");
  // "Plus tard" cliqué pendant CETTE session d'onglet — jamais persisté sur
  // disque (voir commentaire de tête de fichier), remis à zéro à chaque
  // rechargement de page puisque c'est un simple état React en mémoire
  const [ecarte, setEcarte] = useState(false);

  const visible = supporte && isConnected && !dejaChoisi && !ecarte;

  const activer = async () => {
    let resultat = "denied";
    try {
      resultat = await Notification.requestPermission();
    } catch {
      // API refusée/indisponible (contexte non sécurisé, navigateur trop
      // ancien...) — on ferme quand même la modale, rien de plus à faire
    }
    if (resultat === "granted") definirNotifsActivees(true);
    setDejaChoisi(true);
  };

  const plusTard = () => {
    setEcarte(true);
  };

  // pousse une vraie notification navigateur pour un nouveau message reçu —
  // seulement si la permission est accordée ET que l'utilisateur ne l'a pas
  // désactivée depuis le commutateur (voir notifPushStore.js), et si l'onglet
  // n'est PAS au premier plan (sinon la sonnette de NavBar.jsx suffit).
  // Jamais pour un message qu'on vient d'envoyer soi-même : messageEvent est
  // diffusé aux DEUX participants (voir Messagerie/signals.py::
  // broadcast_message), donc l'expéditeur le reçoit aussi.
  useEffect(() => {
    if (!supporte || !notifsActivees || Notification.permission !== "granted" || !document.hidden) return;
    if (!messageEvent || messageEvent.type !== "message.created") return;
    if (messageEvent.data?.expediteur_id === utilisateur?.id) return;
    const n = new Notification(t("notifPush.newMessageTitle"), { body: t("notifPush.newMessageBody"), icon: logo });
    n.onclick = () => { window.focus(); navigate("/messages"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageEvent]);

  // même principe pour une nouvelle demande de support vendeur -> admins
  // (voir Messagerie/signals.py::broadcast_message_admin_cree) — admin uniquement
  useEffect(() => {
    if (!supporte || !notifsActivees || Notification.permission !== "granted" || !document.hidden) return;
    if (!isAdmin || !messageAdminEvent || messageAdminEvent.type !== "message_admin.created") return;
    const n = new Notification(t("notifPush.newSupportRequestTitle"), { body: t("notifPush.newSupportRequestBody"), icon: logo });
    n.onclick = () => { window.focus(); navigate("/admin/dashboard"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageAdminEvent]);

  if (!visible) return null;

  return (
    <div className="notif-perm-overlay" onClick={plusTard}>
      <div className="notif-perm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notif-perm-modal__icon"><Bell size={22} /></div>
        <p className="notif-perm-modal__title">{t("notifPush.promptTitle")}</p>
        <p className="notif-perm-modal__body">{t("notifPush.promptBody")}</p>
        <div className="notif-perm-modal__actions">
          <button type="button" className="notif-perm-modal__btn notif-perm-modal__btn--secondary" onClick={plusTard}>
            {t("notifPush.later")}
          </button>
          <button type="button" className="notif-perm-modal__btn notif-perm-modal__btn--primary" onClick={activer}>
            {t("notifPush.enable")}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams, useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import {
  Users, Building2, ShieldCheck, Package, Ban, CheckCircle2,
  LayoutDashboard, Tag, Pencil, Trash2, Plus, X, MessageCircle, Send, Flag,
  Menu, ArrowLeft, LogOut, Sun, Moon, Bell, User, ChevronDown,
  KeyRound, Download, UserCog, HardDrive, Upload, RotateCcw, Cloud, PlayCircle,
} from "lucide-react";
import StarRating from "../components/StarRating.jsx";
import { DonutChart, HistogramChart, LineChart } from "../components/AdminCharts.jsx";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useThemeStore } from "../api/themeStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import { ProduitsApi } from "../api/produits";
import { MessagerieApi } from "../api/messagerie";
import { SauvegardeApi } from "../api/sauvegarde.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { useConfirmStore } from "../api/confirmStore.js";
import { useE2eStore } from "../api/e2eStore.js";
import { chiffrerEnEnveloppe, dechiffrerEnveloppe } from "../utils/e2eCrypto.js";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import logoSite from "../assets/Images/Asset5.svg";
import "../assets/CSS/AdminDashboard.css";

// noms de sous-catégories suggérés (référentiel standard, voir
// categorieProduits.json) — simple aide à la saisie, l'admin reste libre de
// taper un autre nom via le <datalist> ci-dessous
const SUGGESTIONS_SOUS_CATEGORIES = (categorieProduitsData["Sous-Categories"] || [])
  .map((sc) => sc["Sous-Categorie"]);

  // liste des droits disponible qui peut etre assigner
const DROITS_ASSIGNABLES = [
  "gestion_utilisateurs", "gestion_signalements",
  "gestion_categories", "gestion_support", "gestion_sauvegardes",
  "gestion_mots_de_passe",
];

const NOM_PRENOM_INVALIDE = /\d/;
function telephoneInvalide(valeur) {
  const chiffres = (valeur || "").replace(/\D/g, "");
  return !(chiffres.length === 8 || (chiffres.length === 11 && chiffres.startsWith("509")));
}

// hiérarchie entre comptes admin 

function peutAgirSurAdmin(mesDroits, droitsCible) {
  if (!mesDroits || !droitsCible) return false;
  if (droitsCible.est_super_super_admin) return false;
  if (mesDroits.est_super_super_admin) return true;
  if (droitsCible.super_admin) return false;
  return !!mesDroits.super_admin;
}

// hiérarchie spécifique à la réinitialisation de mot de passe (voir
// peut_reinitialiser_mdp, Registration/models.py) : plus permissive que
// peutAgirSurAdmin pour un admin à droits limités qui possède
// gestion_mots_de_passe — il peut agir sur un AUTRE admin à droits limités,
// sauf si celui-ci possède lui aussi ce droit précis
function peutReinitialiserMdp(mesDroits, droitsCible) {
  if (!mesDroits || !droitsCible) return false;
  if (droitsCible.est_super_super_admin) return false;
  if (mesDroits.est_super_super_admin) return true;
  if (droitsCible.super_admin) return false;
  if (mesDroits.super_admin) return true;
  return !!mesDroits.gestion_mots_de_passe && !droitsCible.gestion_mots_de_passe;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const deconnexion = useAuthStore((s) => s.deconnexion);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isAdmin = profil?.role === "admin";
  // droits granulaires du compte connecté (voir DroitsAdmin côté backend,
  // inclus dans /Registration/profil/ — voir _serialiseProfil) — n'importe
  // quel onglet/action non couvert par ces droits est masqué ci-dessous ;
  // le serveur reste la vraie limite (verifier_droit_admin), ceci n'est que
  // de l'UX pour ne pas montrer des boutons qui échoueraient en 403
  const droits = profil?.droits_admin || null;
  const estSuperAdmin = !!droits?.super_admin;
  const aLeDroit = (nom) => estSuperAdmin || !!droits?.[nom];
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const categorieEvent = useGlobalStore((s) => s.categorieEvent);
  const sousCategorieEvent = useGlobalStore((s) => s.sousCategorieEvent);
  const utilisateurEvent = useGlobalStore((s) => s.utilisateurEvent);
  const profilEvent = useGlobalStore((s) => s.profilEvent);
  const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);
  const signalementEvent = useGlobalStore((s) => s.signalementEvent);
  const signalementVendeurEvent = useGlobalStore((s) => s.signalementVendeurEvent);
  const signalementMessageEvent = useGlobalStore((s) => s.signalementMessageEvent);
  const signalementAvisEvent = useGlobalStore((s) => s.signalementAvisEvent);
  const setMessagesSupportEnAttenteBadge = useMessagerieBadgeStore((s) => s.setMessagesSupportEnAttente);
  const demanderConfirmation = useConfirmStore((s) => s.demander);

  // chiffrement de bout en bout en enveloppe des messages support (voir
  // Support/ContacterAdmin.jsx pour le même principe détaillé côté vendeur)
  const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
  const clePriveeCryptoKey = useE2eStore((s) => s.clePriveeCryptoKey);
  const obtenirClePubliqueDe = useE2eStore((s) => s.obtenirClePubliqueDe);
  const obtenirClesAdmins = useE2eStore((s) => s.obtenirClesAdmins);
  // id -> texte en clair déjà déchiffré (undefined = pas tenté, null = échec)
  const [contenusSupportDechiffres, setContenusSupportDechiffres] = useState({});

  // permet un lien direct vers un onglet précis (ex: la pastille de la
  // sonnette "demandes vendeur" de NavBar.jsx renvoie vers ?tab=support)
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

  // shell admin (sidebar + topbar, voir AdminDashboard.css) — sidebarOuvert ne
  // sert qu'en dessous du breakpoint mobile (sidebar en hors-champ par défaut)
  const [sidebarOuvert, setSidebarOuvert] = useState(false);
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);
  const menuCompteRef = useRef(null);

  useEffect(() => {
    const fermerSiExterieur = (e) => {
      if (menuCompteRef.current && !menuCompteRef.current.contains(e.target)) {
        setMenuCompteOuvert(false);
      }
    };
    document.addEventListener("mousedown", fermerSiExterieur);
    return () => document.removeEventListener("mousedown", fermerSiExterieur);
  }, []);

  const handleDeconnexion = async () => {
    await deconnexion();
    navigate("/");
  };

  const [stats, setStats] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bloquageEnCours, setBloquageEnCours] = useState(null);
  const [suppressionUtilisateurEnCoursId, setSuppressionUtilisateurEnCoursId] = useState(null);

  // messages vendeur -> admins en attente de réponse (voir Messagerie/models.py
  // ::MessageSupport) — file partagée entre tous les admins, premier à
  // répondre "prend" le message (voir soumettreReponseSupport plus bas)
  const [messagesSupport, setMessagesSupport] = useState([]);
  const [chargementSupport, setChargementSupport] = useState(true);
  const [erreurSupport, setErreurSupport] = useState(null);
  const [reponsesBrouillon, setReponsesBrouillon] = useState({});
  const [reponseEnCoursId, setReponseEnCoursId] = useState(null);

  // signalements de produits en attente (voir Produits/models/signalementModel.py)
  // — file partagée entre admins, même principe "premier arrivé premier
  // servi" que messagesSupport ci-dessus (voir traiterUnSignalement)
  const [signalements, setSignalements] = useState([]);
  const [chargementSignalements, setChargementSignalements] = useState(true);
  const [erreurSignalements, setErreurSignalements] = useState(null);
  const [traitementEnCoursId, setTraitementEnCoursId] = useState(null);
  const [reactivationEnCoursId, setReactivationEnCoursId] = useState(null);
  const [erreurReactivation, setErreurReactivation] = useState(null);
  const [desactivationProduitEnCoursId, setDesactivationProduitEnCoursId] = useState(null);

  // signalements de vendeurs en attente (voir Produits/models/signalementVendeurModel.py)
  // — même principe de file partagée que signalements ci-dessus
  const [signalementsVendeurs, setSignalementsVendeurs] = useState([]);
  const [chargementSignalementsVendeurs, setChargementSignalementsVendeurs] = useState(true);
  const [erreurSignalementsVendeurs, setErreurSignalementsVendeurs] = useState(null);
  const [traitementVendeurEnCoursId, setTraitementVendeurEnCoursId] = useState(null);
  const [reactivationVendeurEnCoursId, setReactivationVendeurEnCoursId] = useState(null);
  const [erreurReactivationVendeur, setErreurReactivationVendeur] = useState(null);
  const [blocageVendeurDepuisRapportEnCoursId, setBlocageVendeurDepuisRapportEnCoursId] = useState(null);

  // signalements de messages en attente (voir Messagerie/models.py::SignalementMessage)
  // — même principe de file partagée que signalements/signalementsVendeurs ci-dessus
  const [signalementsMessages, setSignalementsMessages] = useState([]);
  const [chargementSignalementsMessages, setChargementSignalementsMessages] = useState(true);
  const [erreurSignalementsMessages, setErreurSignalementsMessages] = useState(null);
  const [traitementMessageEnCoursId, setTraitementMessageEnCoursId] = useState(null);
  const [blocageUtilisateurMessageEnCoursId, setBlocageUtilisateurMessageEnCoursId] = useState(null);

  // signalements d'avis en attente (voir Produits/models/signalementAvisModel.py)
  // — même principe de file partagée que les autres signalements ci-dessus
  const [signalementsAvis, setSignalementsAvis] = useState([]);
  const [chargementSignalementsAvis, setChargementSignalementsAvis] = useState(true);
  const [erreurSignalementsAvis, setErreurSignalementsAvis] = useState(null);
  const [traitementAvisEnCoursId, setTraitementAvisEnCoursId] = useState(null);
  const [suppressionAvisSignaleEnCoursId, setSuppressionAvisSignaleEnCoursId] = useState(null);

  // ── Gestion des ADMs (réservée au super admin, voir DroitsAdmin) ─────────
  const [admins, setAdmins] = useState([]);
  const [chargementAdmins, setChargementAdmins] = useState(true);
  const [erreurAdmins, setErreurAdmins] = useState(null);

  const [formulaireAdminOuvert, setFormulaireAdminOuvert] = useState(false);
  const [formAdmin, setFormAdmin] = useState(() => ({ nom: "", prenom: "", email: "", telephone: "", mot_de_passe: "", ...Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, false])) }));
  const [adminEnCours, setAdminEnCours] = useState(false);
  const [erreurFormAdmin, setErreurFormAdmin] = useState(null);

  // droits en cours de modification pour UN admin de la liste à la fois
  // (id de l'admin, ou null si aucune édition en cours)
  const [droitsEnEditionId, setDroitsEnEditionId] = useState(null);
  const [formDroitsEdition, setFormDroitsEdition] = useState({});
  const [droitsEnCoursId, setDroitsEnCoursId] = useState(null);

  const [blocageAdminEnCoursId, setBlocageAdminEnCoursId] = useState(null);
  const [revocationEnCoursId, setRevocationEnCoursId] = useState(null);

  // infos (nom/prénom/email/téléphone) en cours de modification pour UN
  // admin de la liste à la fois — même principe que droitsEnEditionId
  const [infosEnEditionId, setInfosEnEditionId] = useState(null);
  const [formInfosEdition, setFormInfosEdition] = useState({ nom: "", prenom: "", email: "", telephone: "" });
  const [infosEnCoursId, setInfosEnCoursId] = useState(null);
  const [erreurFormInfos, setErreurFormInfos] = useState(null);

  const [resetMdpEnCoursId, setResetMdpEnCoursId] = useState(null);

  // reCAPTCHA du formulaire de création d'un compte ADM — même widget que
  // Registration/Authentification.jsx, vérifié cette fois côté serveur aussi
  // (voir Registration/views.py::_verifier_recaptcha)
  const recaptchaAdminRef = useRef(null);
  const [recaptchaAdminToken, setRecaptchaAdminToken] = useState(null);
  const [recaptchaAdminErreur, setRecaptchaAdminErreur] = useState(false);

  // rapport PDF du journal d'audit
  const [rapportDateDebut, setRapportDateDebut] = useState("");
  const [rapportDateFin, setRapportDateFin] = useState("");
  const [rapportAdminId, setRapportAdminId] = useState("");
  const [rapportEnCours, setRapportEnCours] = useState(false);
  const [erreurRapport, setErreurRapport] = useState(null);

  // ── Sauvegardes (droit gestion_sauvegardes ; restauration réservée au
  // super admin, voir Sauvegarde/views.py côté backend) ────────────────────
  const [configSauvegarde, setConfigSauvegarde] = useState(null);
  const [chargementConfigSauvegarde, setChargementConfigSauvegarde] = useState(true);
  const [erreurSauvegarde, setErreurSauvegarde] = useState(null);
  const [configSauvegardeEnCours, setConfigSauvegardeEnCours] = useState(false);

  const [historiqueSauvegardes, setHistoriqueSauvegardes] = useState([]);
  const [chargementHistoriqueSauvegardes, setChargementHistoriqueSauvegardes] = useState(true);

  const [declenchementEnCours, setDeclenchementEnCours] = useState(false);
  const [telechargementSauvegardeEnCoursId, setTelechargementSauvegardeEnCoursId] = useState(null);

  const [googleEnCours, setGoogleEnCours] = useState(false);
  const [messageGoogle, setMessageGoogle] = useState(() => searchParams.get("google"));

  // restauration : fichier choisi -> analyse (aperçu) -> confirmation
  const [fichierRestauration, setFichierRestauration] = useState(null);
  const [analyseRestauration, setAnalyseRestauration] = useState(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [erreurRestauration, setErreurRestauration] = useState(null);
  const [resultatRestauration, setResultatRestauration] = useState(null);

  // formulaire catégorie — même objet sert à la création (categorieEnEdition
  // === null) et à la modification (categorieEnEdition === id de la catégorie)
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);
  const [formCategorie, setFormCategorie] = useState({ nom: "", description: "" });
  const [categorieEnCours, setCategorieEnCours] = useState(false);
  const [categorieErreur, setCategorieErreur] = useState(null);

  // formulaire sous-catégorie — même principe que le formulaire catégorie ci-dessus
  const [sousCategorieEnEdition, setSousCategorieEnEdition] = useState(null);
  const [formSousCategorie, setFormSousCategorie] = useState({ nom: "", categorie_id: "" });
  const [sousCategorieEnCours, setSousCategorieEnCours] = useState(false);
  const [sousCategorieErreur, setSousCategorieErreur] = useState(null);

  // au montage : rafraîchit le profil pour avoir un role à jour (ex: session
  // ouverte avant une promotion admin) avant de décider d'afficher la page
  useEffect(() => {
    afficherProfil().catch(() => {});
  }, [afficherProfil]);

  const chargerDonnees = () => {
    setLoading(true);
    setError(null);
    // listerUtilisateursAdmin est exclu de ce Promise.all partagé : elle
    // nécessite désormais le droit gestion_utilisateurs (voir DroitsAdmin
    // côté backend), et un admin qui ne l'a pas ne doit pas voir TOUT son
    // tableau de bord se vider à cause d'un 403 sur cette seule requête —
    // voir le chargement séparé ci-dessous
    Promise.all([
      AuthentificationApi.obtenirDashboardAdmin(),
      ProduitsApi.listerProduits(),
      ProduitsApi.listerCategories(),
      ProduitsApi.listerSousCategories(),
    ])
      .then(([statsRes, produitsRes, categoriesRes, sousCategoriesRes]) => {
        setStats(statsRes);
        setProduits(produitsRes.produits || []);
        setCategories(categoriesRes.categories || []);
        setSousCategories(sousCategoriesRes.sous_categories || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) chargerDonnees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const [erreurUtilisateurs, setErreurUtilisateurs] = useState(null);
  useEffect(() => {
    if (!aLeDroit("gestion_utilisateurs")) return;
    AuthentificationApi.listerUtilisateursAdmin()
      .then((res) => setUtilisateurs(res.utilisateurs || []))
      .catch((err) => setErreurUtilisateurs(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droits]);

  useEffect(() => {
    if (!isAdmin) return;
    garantirCleE2E().catch((err) => setErreurSupport(err.message));
    setChargementSupport(true);
    MessagerieApi.listerMessagesAdminEnAttente()
      .then((res) => setMessagesSupport(res.messages_admin || []))
      .catch((err) => setErreurSupport(err.message))
      .finally(() => setChargementSupport(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // déchiffre le contenu des messages support en attente — chiffré par le
  // vendeur/acheteur d'origine, il faut donc SA clé publique (pas la mienne)
  useEffect(() => {
    if (!clePriveeCryptoKey || messagesSupport.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const m of messagesSupport) {
        if (!m.chiffre) continue;
        if (!m.cle_contenu_moi) { resultats[m.id] = null; continue; }
        try {
          const clePubliqueAuteur = await obtenirClePubliqueDe(m.vendeur_id);
          resultats[m.id] = await dechiffrerEnveloppe(
            clePriveeCryptoKey, clePubliqueAuteur, m.contenu, m.iv_contenu, m.cle_contenu_moi, m.iv_cle_contenu_moi
          );
        } catch {
          resultats[m.id] = null;
        }
      }
      if (!annule && Object.keys(resultats).length > 0) setContenusSupportDechiffres((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messagesSupport, clePriveeCryptoKey, obtenirClePubliqueDe]);

  useEffect(() => {
    if (!isAdmin) return;
    setChargementSignalements(true);
    ProduitsApi.listerSignalementsAdmin()
      .then((res) => setSignalements(res.signalements || []))
      .catch((err) => setErreurSignalements(err.message))
      .finally(() => setChargementSignalements(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setChargementSignalementsVendeurs(true);
    ProduitsApi.listerSignalementsVendeursAdmin()
      .then((res) => setSignalementsVendeurs(res.signalements || []))
      .catch((err) => setErreurSignalementsVendeurs(err.message))
      .finally(() => setChargementSignalementsVendeurs(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setChargementSignalementsMessages(true);
    MessagerieApi.listerSignalementsMessagesAdmin()
      .then((res) => setSignalementsMessages(res.signalements || []))
      .catch((err) => setErreurSignalementsMessages(err.message))
      .finally(() => setChargementSignalementsMessages(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setChargementSignalementsAvis(true);
    ProduitsApi.listerSignalementsAvisAdmin()
      .then((res) => setSignalementsAvis(res.signalements || []))
      .catch((err) => setErreurSignalementsAvis(err.message))
      .finally(() => setChargementSignalementsAvis(false));
  }, [isAdmin]);

  // liste des comptes admin — super admin (vue complète) OU admin à droits
  // limités possédant gestion_mots_de_passe (vue réduite, voir onglets plus
  // bas et le rendu de l'onglet "admins" plus loin) ; inutile de la charger
  // pour un admin qui ne verra de toute façon jamais cet onglet
  useEffect(() => {
    if (!estSuperAdmin && !aLeDroit("gestion_mots_de_passe")) return;
    setChargementAdmins(true);
    AuthentificationApi.listerAdmins()
      .then((res) => setAdmins(res.admins || []))
      .catch((err) => setErreurAdmins(err.message))
      .finally(() => setChargementAdmins(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droits]);

  // configuration + historique des sauvegardes — réservés au droit
  // gestion_sauvegardes, inutile de les charger sinon (voir onglets plus bas)
  useEffect(() => {
    if (!aLeDroit("gestion_sauvegardes")) return;
    setChargementConfigSauvegarde(true);
    SauvegardeApi.obtenirConfiguration()
      .then((res) => setConfigSauvegarde(res.configuration))
      .catch((err) => setErreurSauvegarde(err.message))
      .finally(() => setChargementConfigSauvegarde(false));

    setChargementHistoriqueSauvegardes(true);
    SauvegardeApi.listerHistorique()
      .then((res) => setHistoriqueSauvegardes(res.historique || []))
      .catch((err) => setErreurSauvegarde(err.message))
      .finally(() => setChargementHistoriqueSauvegardes(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droits]);

  // réactivité temps réel (voir Messagerie/signals.py + Messagerie/views.py
  // ::repondreMessageAdmin côté backend, groupe WebSocket "admins") : un
  // nouveau message apparaît chez tous les admins connectés ; dès qu'un admin
  // (celui-ci ou un autre) y répond, il disparaît de cette file partagée
  useEffect(() => {
    if (!messageAdminEvent) return;
    const { type, data } = messageAdminEvent;
    if (type === "message_admin.created") {
      setMessagesSupport((liste) => (liste.some((m) => m.id === data.id) ? liste : [...liste, data]));
    } else if (type === "message_admin.repondu") {
      setMessagesSupport((liste) => liste.filter((m) => m.id !== data.id));
    }
  }, [messageAdminEvent]);

  // réactivité temps réel (voir Produits/views/signalementsViews.py côté
  // backend, groupe WebSocket "admins") — même logique que messageAdminEvent
  useEffect(() => {
    if (!signalementEvent) return;
    const { type, data } = signalementEvent;
    if (type === "signalement.created") {
      setSignalements((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement.traite") {
      setSignalements((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementEvent]);

  // même logique que signalementEvent ci-dessus, pour les signalements de vendeurs
  useEffect(() => {
    if (!signalementVendeurEvent) return;
    const { type, data } = signalementVendeurEvent;
    if (type === "signalement_vendeur.created") {
      setSignalementsVendeurs((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_vendeur.traite") {
      setSignalementsVendeurs((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementVendeurEvent]);

  // même logique que signalementEvent ci-dessus, pour les signalements de messages
  useEffect(() => {
    if (!signalementMessageEvent) return;
    const { type, data } = signalementMessageEvent;
    if (type === "signalement_message.created") {
      setSignalementsMessages((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_message.traite") {
      setSignalementsMessages((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementMessageEvent]);

  // même logique que signalementEvent ci-dessus, pour les signalements d'avis
  useEffect(() => {
    if (!signalementAvisEvent) return;
    const { type, data } = signalementAvisEvent;
    if (type === "signalement_avis.created") {
      setSignalementsAvis((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_avis.traite") {
      setSignalementsAvis((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementAvisEvent]);

  // synchronise la pastille "demandes vendeur" de NavBar.jsx sur l'état local
  // de cette page — plus fiable qu'un nouvel appel API : reflète
  // immédiatement le retrait optimiste de soumettreReponseSupport()
  useEffect(() => {
    if (isAdmin) setMessagesSupportEnAttenteBadge(messagesSupport.length);
  }, [messagesSupport.length, isAdmin, setMessagesSupportEnAttenteBadge]);

  // réactivité temps réel (voir Produits/signals.py côté backend) : un produit
  // créé/modifié/supprimé par CE vendeur ou par n'importe quel autre vendeur
  // met à jour la liste et les tuiles de statistiques sans rechargement de page
  useEffect(() => {
    if (!produitEvent) return;
    setProduits((liste) => applyListEvent(liste, produitEvent));
    setStats((s) => {
      if (!s) return s;
      const delta = produitEvent.type === "produit.created" ? 1
        : produitEvent.type === "produit.deleted" ? -1 : 0;
      if (delta === 0) return s;
      return { ...s, produits: { ...s.produits, total: s.produits.total + delta } };
    });
  }, [produitEvent]);

  useEffect(() => {
    if (!categorieEvent) return;
    setCategories((liste) => applyListEvent(liste, categorieEvent));
    setStats((s) => {
      if (!s) return s;
      const delta = categorieEvent.type === "categorie.created" ? 1
        : categorieEvent.type === "categorie.deleted" ? -1 : 0;
      if (delta === 0) return s;
      return { ...s, produits: { ...s.produits, categories: s.produits.categories + delta } };
    });
  }, [categorieEvent]);

  useEffect(() => {
    if (!sousCategorieEvent) return;
    setSousCategories((liste) => applyListEvent(liste, sousCategorieEvent));
  }, [sousCategorieEvent]);

  // réactivité temps réel (voir Registration/signals.py côté backend) : un
  // compte créé/modifié/supprimé par n'importe qui met à jour la liste et la
  // tuile "Utilisateurs" sans rechargement de page — même logique que
  // produitEvent/categorieEvent ci-dessus. Le payload inclut désormais role
  // (voir broadcast_utilisateur), donc pas besoin de le préserver à part.
  useEffect(() => {
    if (!utilisateurEvent) return;
    setUtilisateurs((liste) => applyListEvent(liste, utilisateurEvent));
    setStats((s) => {
      if (!s) return s;
      const delta = utilisateurEvent.type === "utilisateur.created" ? 1
        : utilisateurEvent.type === "utilisateur.deleted" ? -1 : 0;
      if (delta === 0) return s;
      return { ...s, utilisateurs: { ...s.utilisateurs, total: s.utilisateurs.total + delta } };
    });
  }, [utilisateurEvent]);

  // le rôle change sur Profil (convertir_en_vendeur/KYC), pas sur Utilisateur
  // — ça déclenche broadcast_profil ("profil.updated"), pas broadcast_utilisateur
  // (voir Registration/signals.py) : sans cet effet, un acheteur promu vendeur
  // (ex: vérification KYC validée) gardait son ancien badge de rôle jusqu'au
  // prochain rechargement. profilEvent utilise "user_id" (pas "id"), donc pas
  // de applyListEvent ici — patch manuel du seul champ role.
  useEffect(() => {
    if (!profilEvent || profilEvent.type !== "profil.updated") return;
    const { user_id, role } = profilEvent.data;
    if (role === undefined) return;
    setUtilisateurs((liste) => liste.map((u) => (u.id === user_id ? { ...u, role } : u)));
  }, [profilEvent]);

  const toggleBloquer = async (utilisateur) => {
    const msg = t("admin.dashboard.confirmBlockUser").replace("{nom}", `${utilisateur.prenom} ${utilisateur.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBloquageEnCours(utilisateur.id);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(utilisateur.id);
      const nouvelEtat = !utilisateur.est_bloquer;
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === utilisateur.id ? { ...u, est_bloquer: nouvelEtat } : u))
      );
      // la tuile "Comptes bloqués" vient d'un instantané séparé (obtenirDashboardAdmin) —
      // sans ce correctif elle ne bougeait qu'après un rechargement complet de la page
      setStats((s) => s && {
        ...s,
        utilisateurs: {
          ...s.utilisateurs,
          bloques: s.utilisateurs.bloques + (nouvelEtat ? 1 : -1),
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBloquageEnCours(null);
    }
  };

  // suppression définitive (voir Registration/views.py::supprimerUtilisateurAdmin —
  // CASCADE sur profil, entreprises possédées, produits publiés, messages...) ;
  // contrairement au blocage, il n'y a aucun retour en arrière possible, d'où le
  // texte de confirmation renforcé (admin.dashboard.confirmDeleteUser)
  const supprimerUnUtilisateur = async (utilisateur) => {
    const msg = t("admin.dashboard.confirmDeleteUser").replace("{nom}", `${utilisateur.prenom} ${utilisateur.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionUtilisateurEnCoursId(utilisateur.id);
    setError(null);
    try {
      await AuthentificationApi.supprimerUtilisateurAdmin(utilisateur.id);
      setUtilisateurs((liste) => liste.filter((u) => u.id !== utilisateur.id));
      // "total" est déjà décrémenté par l'effet utilisateurEvent ci-dessus
      // (broadcast_utilisateur_supprime, voir Registration/signals.py) —
      // seuls vendeurs/bloques ne sont pas couverts par ce broadcast
      setStats((s) => s && {
        ...s,
        utilisateurs: {
          ...s.utilisateurs,
          vendeurs: s.utilisateurs.vendeurs - (utilisateur.role === "vendeur" ? 1 : 0),
          bloques:  s.utilisateurs.bloques - (utilisateur.est_bloquer ? 1 : 0),
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSuppressionUtilisateurEnCoursId(null);
    }
  };

  const soumettreReponseSupport = async (messageSupport) => {
    const texte = (reponsesBrouillon[messageSupport.id] || "").trim();
    if (!texte) return;
    setReponseEnCoursId(messageSupport.id);
    setErreurSupport(null);
    try {
      // chiffrement en enveloppe de la réponse — vendeur/acheteur d'origine +
      // tous les admins actuels (dont moi-même), voir e2eCrypto.js::chiffrerEnEnveloppe.
      // Si l'auteur d'origine n'a pas (ou plus) de clé publique configurée,
      // on répond en clair plutôt que de bloquer la réponse — une messagerie
      // doit rester utilisable même quand l'autre partie n'a pas encore de
      // chiffrement configuré (même principe que Messagerie.jsx::envoyerMessage).
      let reponseEnvoi = texte;
      let ivEnvoi;
      let clesEnvoi;
      try {
        const clePrivee = await garantirCleE2E();
        const admins = await obtenirClesAdmins();
        const clePubliqueAuteur = await obtenirClePubliqueDe(messageSupport.vendeur_id);
        const destinataires = [...admins, { utilisateur_id: messageSupport.vendeur_id, cle_publique: clePubliqueAuteur }];
        const resultat = await chiffrerEnEnveloppe(clePrivee, texte, destinataires);
        reponseEnvoi = resultat.contenu;
        ivEnvoi = resultat.iv;
        clesEnvoi = resultat.cles;
      } catch {
        reponseEnvoi = texte;
        ivEnvoi = undefined;
        clesEnvoi = undefined;
      }
      await MessagerieApi.repondreMessageAdmin(messageSupport.id, reponseEnvoi, ivEnvoi, clesEnvoi);
      // succès : le retire de sa propre file (le WS "message_admin.repondu"
      // se charge de le retirer des AUTRES admins connectés)
      setMessagesSupport((liste) => liste.filter((m) => m.id !== messageSupport.id));
      setReponsesBrouillon((b) => {
        const copie = { ...b };
        delete copie[messageSupport.id];
        return copie;
      });
    } catch (err) {
      // 409 : un autre admin a répondu entre-temps — ce message n'est plus
      // actionnable, on le retire aussi de cette vue plutôt que de laisser
      // un bouton "Répondre" qui échouerait à nouveau
      setErreurSupport(err.message);
      setMessagesSupport((liste) => liste.filter((m) => m.id !== messageSupport.id));
    } finally {
      setReponseEnCoursId(null);
    }
  };

  const traiterUnSignalement = async (signalement) => {
    setTraitementEnCoursId(signalement.id);
    setErreurSignalements(null);
    try {
      await ProduitsApi.traiterSignalement(signalement.id);
      // succès : le retire de sa propre file (le WS "signalement.traite" se
      // charge de le retirer des AUTRES admins connectés)
      setSignalements((liste) => liste.filter((s) => s.id !== signalement.id));
    } catch (err) {
      // 409 : un autre admin a déjà traité ce signalement — plus actionnable
      setErreurSignalements(err.message);
      setSignalements((liste) => liste.filter((s) => s.id !== signalement.id));
    } finally {
      setTraitementEnCoursId(null);
    }
  };

  // désactive manuellement le produit signalé (distinct de la désactivation
  // automatique au 5e signalement, voir signalerProduit, Produits/views/
  // signalementsViews.py) — reactiverUnProduit ci-dessous sert aussi à la lever
  const desactiverUnProduitDepuisSignalement = async (signalement) => {
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDisableProduct"), { danger: true }))) return;
    setDesactivationProduitEnCoursId(signalement.id);
    setErreurSignalements(null);
    try {
      const res = await ProduitsApi.desactiverProduitAdmin(signalement.produit_id);
      setProduits((liste) => liste.map((p) => (p.id === signalement.produit_id ? res.produit : p)));
    } catch (err) {
      setErreurSignalements(err.message);
    } finally {
      setDesactivationProduitEnCoursId(null);
    }
  };

  const traiterUnSignalementVendeur = async (signalement) => {
    setTraitementVendeurEnCoursId(signalement.id);
    setErreurSignalementsVendeurs(null);
    try {
      await ProduitsApi.traiterSignalementVendeur(signalement.id);
      // succès : le retire de sa propre file (le WS "signalement_vendeur.traite"
      // se charge de le retirer des AUTRES admins connectés)
      setSignalementsVendeurs((liste) => liste.filter((s) => s.id !== signalement.id));
    } catch (err) {
      // 409 : un autre admin a déjà traité ce signalement — plus actionnable
      setErreurSignalementsVendeurs(err.message);
      setSignalementsVendeurs((liste) => liste.filter((s) => s.id !== signalement.id));
    } finally {
      setTraitementVendeurEnCoursId(null);
    }
  };

  // bloque le compte du vendeur signalé — action à sens unique (pas de bascule
  // débloquer ici, voir onglet "Utilisateurs" pour ça)
  const bloquerVendeurDepuisSignalementVendeur = async (signalement) => {
    const msg = t("admin.dashboard.confirmBlockSeller").replace("{nom}", signalement.vendeur_nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBlocageVendeurDepuisRapportEnCoursId(signalement.id);
    setErreurSignalementsVendeurs(null);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(signalement.vendeur_id);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === signalement.vendeur_id ? { ...u, est_bloquer: !u.est_bloquer } : u))
      );
    } catch (err) {
      setErreurSignalementsVendeurs(err.message);
    } finally {
      setBlocageVendeurDepuisRapportEnCoursId(null);
    }
  };

  // lève la suspension automatique d'un vendeur après plus de 5 signalements
  // pour le même motif (voir Produits/views/signalementsViews.py::signalerVendeur)
  // — seul un admin peut le faire ; rend aussi disponibles tous ses produits
  // non bannis individuellement (voir reactiverVendeurAdmin, Registration/views.py).
  // cleEnCours : identifiant utilisé pour le spinner du bouton qui a déclenché
  // l'action — soit l'id du signalement (file "Signalements vendeurs"), soit
  // directement l'id du compte (liste "Utilisateurs")
  const reactiverUnVendeur = async (vendeurId, cleEnCours) => {
    setReactivationVendeurEnCoursId(cleEnCours);
    setErreurReactivationVendeur(null);
    try {
      await AuthentificationApi.reactiverVendeurAdmin(vendeurId);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === vendeurId ? { ...u, desactive_par_signalements: false } : u))
      );
    } catch (err) {
      setErreurReactivationVendeur(err.message);
    } finally {
      setReactivationVendeurEnCoursId(null);
    }
  };

  const traiterUnSignalementMessage = async (signalement) => {
    setTraitementMessageEnCoursId(signalement.id);
    setErreurSignalementsMessages(null);
    try {
      await MessagerieApi.traiterSignalementMessage(signalement.id);
      // succès : le retire de sa propre file (le WS "signalement_message.traite"
      // se charge de le retirer des AUTRES admins connectés)
      setSignalementsMessages((liste) => liste.filter((s) => s.id !== signalement.id));
    } catch (err) {
      // 409 : un autre admin a déjà traité ce signalement — plus actionnable
      setErreurSignalementsMessages(err.message);
      setSignalementsMessages((liste) => liste.filter((s) => s.id !== signalement.id));
    } finally {
      setTraitementMessageEnCoursId(null);
    }
  };

  // bloque le compte de l'expéditeur du message signalé — action à sens
  // unique (pas de bascule débloquer ici, voir onglet "Utilisateurs" pour ça)
  const bloquerUtilisateurDepuisSignalementMessage = async (signalement) => {
    const msg = t("admin.dashboard.confirmBlockUser").replace("{nom}", signalement.message_expediteur_nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBlocageUtilisateurMessageEnCoursId(signalement.id);
    setErreurSignalementsMessages(null);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(signalement.message_expediteur_id);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === signalement.message_expediteur_id ? { ...u, est_bloquer: !u.est_bloquer } : u))
      );
    } catch (err) {
      setErreurSignalementsMessages(err.message);
    } finally {
      setBlocageUtilisateurMessageEnCoursId(null);
    }
  };

  const traiterUnSignalementAvis = async (signalement) => {
    setTraitementAvisEnCoursId(signalement.id);
    setErreurSignalementsAvis(null);
    try {
      await ProduitsApi.traiterSignalementAvis(signalement.id);
      // succès : le retire de sa propre file (le WS "signalement_avis.traite"
      // se charge de le retirer des AUTRES admins connectés)
      setSignalementsAvis((liste) => liste.filter((s) => s.id !== signalement.id));
    } catch (err) {
      // 409 : un autre admin a déjà traité ce signalement — plus actionnable
      setErreurSignalementsAvis(err.message);
      setSignalementsAvis((liste) => liste.filter((s) => s.id !== signalement.id));
    } finally {
      setTraitementAvisEnCoursId(null);
    }
  };

  // supprime définitivement l'avis signalé — CASCADE retire aussi tout autre
  // signalement en attente sur ce même avis (voir supprimerAvis,
  // Produits/views/avisViews.py, qui autorise un admin à supprimer l'avis de
  // n'importe qui) ; action irréversible, d'où la confirmation renforcée
  const supprimerUnAvisSignale = async (signalement) => {
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDeleteReview"), { danger: true }))) return;
    setSuppressionAvisSignaleEnCoursId(signalement.id);
    setErreurSignalementsAvis(null);
    try {
      await ProduitsApi.supprimerAvis(signalement.avis_id);
      setSignalementsAvis((liste) => liste.filter((s) => s.avis_id !== signalement.avis_id));
    } catch (err) {
      setErreurSignalementsAvis(err.message);
    } finally {
      setSuppressionAvisSignaleEnCoursId(null);
    }
  };

  // lève la désactivation automatique d'un produit après 5 signalements (voir
  // Produits/views/signalementsViews.py::signalerProduit) — seul un admin
  // peut la lever, le vendeur en est empêché (modifierProduit/
  // toggleDisponibiliteProduit). Le WS "produit.updated" patchera aussi la
  // liste, mais on met à jour localement pour un retour immédiat.
  const reactiverUnProduit = async (produit) => {
    setReactivationEnCoursId(produit.id);
    setErreurReactivation(null);
    try {
      const res = await ProduitsApi.reactiverProduitAdmin(produit.id);
      setProduits((liste) => liste.map((p) => (p.id === produit.id ? res.produit : p)));
    } catch (err) {
      setErreurReactivation(err.message);
    } finally {
      setReactivationEnCoursId(null);
    }
  };

  const ouvrirFormulaireEdition = (categorie) => {
    setCategorieEnEdition(categorie.id);
    setFormCategorie({ nom: categorie.nom, description: categorie.description || "" });
    setCategorieErreur(null);
  };

  const annulerFormulaireCategorie = () => {
    setCategorieEnEdition(null);
    setFormCategorie({ nom: "", description: "" });
    setCategorieErreur(null);
  };

  const soumettreFormulaireCategorie = async (e) => {
    e.preventDefault();
    if (!formCategorie.nom.trim()) {
      setCategorieErreur(t("admin.dashboard.categoryNameRequired"));
      return;
    }
    if (categorieEnEdition) {
      const msg = t("admin.dashboard.confirmEditCategory").replace("{nom}", formCategorie.nom);
      if (!(await demanderConfirmation(msg))) return;
    }

    setCategorieEnCours(true);
    setCategorieErreur(null);
    try {
      if (categorieEnEdition) {
        const res = await ProduitsApi.modifierCategorie({ id: categorieEnEdition, ...formCategorie });
        setCategories((liste) => liste.map((c) => (c.id === categorieEnEdition ? res.categorie : c)));
      } else {
        const res = await ProduitsApi.creerCategorie(formCategorie);
        // applyListEvent (pas un simple [...liste, res.categorie]) : le
        // broadcast WebSocket "categorie.created" (voir categorieEvent
        // ci-dessus) peut arriver avant la réponse HTTP de cette requête —
        // le signal se déclenche pendant Categories.objects.create(), donc
        // potentiellement avant même que la réponse ait fini de sérialiser
        // et de faire l'aller-retour réseau — auquel cas un simple append
        // ajoutait la catégorie une seconde fois, constaté en conditions
        // réelles.
        setCategories((liste) => applyListEvent(liste, { type: "categorie.created", data: res.categorie }));
      }
      annulerFormulaireCategorie();
    } catch (err) {
      setCategorieErreur(err.message);
    } finally {
      setCategorieEnCours(false);
    }
  };

  const supprimerCategorie = async (categorie) => {
    const msg = t("admin.dashboard.confirmDeleteCategory").replace("{nom}", categorie.nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    try {
      await ProduitsApi.supprimerCategorie(categorie.id);
      setCategories((liste) => liste.filter((c) => c.id !== categorie.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const ouvrirFormulaireEditionSousCategorie = (sousCategorie) => {
    setSousCategorieEnEdition(sousCategorie.id);
    setFormSousCategorie({ nom: sousCategorie.nom, categorie_id: sousCategorie.categorie_id });
    setSousCategorieErreur(null);
  };

  const annulerFormulaireSousCategorie = () => {
    setSousCategorieEnEdition(null);
    setFormSousCategorie({ nom: "", categorie_id: "" });
    setSousCategorieErreur(null);
  };

  const soumettreFormulaireSousCategorie = async (e) => {
    e.preventDefault();
    if (!formSousCategorie.nom.trim()) {
      setSousCategorieErreur(t("admin.dashboard.subCategoryNameRequired"));
      return;
    }
    if (!formSousCategorie.categorie_id) {
      setSousCategorieErreur(t("admin.dashboard.subCategoryParentRequired"));
      return;
    }
    if (sousCategorieEnEdition) {
      const msg = t("admin.dashboard.confirmEditSubCategory").replace("{nom}", formSousCategorie.nom);
      if (!(await demanderConfirmation(msg))) return;
    }

    setSousCategorieEnCours(true);
    setSousCategorieErreur(null);
    try {
      const payload = { nom: formSousCategorie.nom, categorie_id: Number(formSousCategorie.categorie_id) };
      if (sousCategorieEnEdition) {
        const res = await ProduitsApi.modifierSousCategorie({ id: sousCategorieEnEdition, ...payload });
        setSousCategories((liste) => liste.map((sc) => (sc.id === sousCategorieEnEdition ? res.sous_categorie : sc)));
      } else {
        const res = await ProduitsApi.creerSousCategorie(payload);
        // applyListEvent : même raison que pour les catégories ci-dessus (le
        // broadcast WebSocket "sous_categorie.created" peut devancer la
        // réponse HTTP de cette requête).
        setSousCategories((liste) => applyListEvent(liste, { type: "sous_categorie.created", data: res.sous_categorie }));
      }
      annulerFormulaireSousCategorie();
    } catch (err) {
      setSousCategorieErreur(err.message);
    } finally {
      setSousCategorieEnCours(false);
    }
  };

  const supprimerSousCategorie = async (sousCategorie) => {
    const msg = t("admin.dashboard.confirmDeleteSubCategory").replace("{nom}", sousCategorie.nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    try {
      await ProduitsApi.supprimerSousCategorie(sousCategorie.id);
      setSousCategories((liste) => liste.filter((sc) => sc.id !== sousCategorie.id));
    } catch (err) {
      setError(err.message);
    }
  };

  // accès réservé aux admins — profil non encore chargé -> on attend avant de trancher
  if (profil && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const tuiles = stats && [
    { icon: Users,       label: t("admin.dashboard.users"),        value: stats.utilisateurs.total,             couleur: "vert" },
    { icon: ShieldCheck, label: t("admin.dashboard.sellers"),       value: stats.utilisateurs.vendeurs,          couleur: "or" },
    { icon: Ban,         label: t("admin.dashboard.blocked"),       value: stats.utilisateurs.bloques,           couleur: "rouge" },
    { icon: Building2,   label: t("admin.dashboard.companies"),     value: stats.entreprises.total,              couleur: "ardoise" },
    { icon: CheckCircle2,label: t("admin.dashboard.verifiedRequests"), value: stats.verifications.verifiees,     couleur: "terracotta" },
    { icon: Package,     label: t("admin.dashboard.products"),      value: stats.produits.total,                 couleur: "foret" },
  ];

  // données des 3 graphiques du tableau de bord — construites uniquement à
  // partir de stats (voir Registration/views.py::dashboardAdmin), aucun
  // appel réseau supplémentaire. Ordre des couleurs catégorielles fixe,
  // jamais permuté (voir Charts.css / dataviz skill)
  const donneesComptesParType = stats && [
    { label: t("admin.dashboard.roleBuyers"),  value: stats.utilisateurs.acheteurs },
    { label: t("admin.dashboard.sellers"),     value: stats.utilisateurs.vendeurs },
    { label: t("admin.dashboard.roleAdmins"),  value: stats.utilisateurs.admins },
  ].filter((d) => d.value > 0);
  const COULEURS_COMPTES = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)"];

  const donneesProduitsParSousCategorie = stats?.produits.par_sous_categorie?.map((c) => ({
    label: c.nom, value: c.nombre_produits,
  })) || [];

  const donneesProduitsConsultes = stats?.produits.plus_consultes?.map((p) => ({
    label: p.nom, value: p.nombre_vues,
  })) || [];

  const totalAlertes = messagesSupport.length + signalements.length + signalementsVendeurs.length
    + signalementsMessages.length + signalementsAvis.length;

  // ── Gestion des ADMs — handlers (réservés au super admin) ────────────────
  const ouvrirCreationAdmin = () => {
    setFormAdmin({ nom: "", prenom: "", email: "", telephone: "", mot_de_passe: "", ...Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, false])) });
    setErreurFormAdmin(null);
    setRecaptchaAdminToken(null);
    setRecaptchaAdminErreur(false);
    setFormulaireAdminOuvert(true);
  };

  const soumettreCreationAdmin = async (e) => {
    e.preventDefault();
    setErreurFormAdmin(null);

    if (NOM_PRENOM_INVALIDE.test(formAdmin.nom) || NOM_PRENOM_INVALIDE.test(formAdmin.prenom)) {
      setErreurFormAdmin(t("admin.dashboard.adms.nameNoDigits"));
      return;
    }
    if (telephoneInvalide(formAdmin.telephone)) {
      setErreurFormAdmin(t("admin.dashboard.adms.phoneInvalid"));
      return;
    }
    if (!recaptchaAdminToken) {
      setRecaptchaAdminErreur(true);
      setErreurFormAdmin(t("auth.recaptchaError"));
      return;
    }

    setAdminEnCours(true);
    try {
      const res = await AuthentificationApi.creerAdmin({ ...formAdmin, recaptcha: recaptchaAdminToken });
      setAdmins((liste) => [...liste, res.admin]);
      setFormulaireAdminOuvert(false);
    } catch (err) {
      setErreurFormAdmin(err.message);
    } finally {
      recaptchaAdminRef.current?.reset();
      setRecaptchaAdminToken(null);
      setAdminEnCours(false);
    }
  };

  const ouvrirEditionDroits = (admin) => {
    setDroitsEnEditionId(admin.id);
    // super_admin n'est jamais modifiable via ce formulaire (voir
    // _appliquer_droits, Registration/views.py) — un seul compte super admin
    // doit exister sur la plateforme, non attribuable via l'API
    setFormDroitsEdition(
      Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, admin.droits?.[d] || false]))
    );
  };

  const soumettreEditionDroits = async (adminId) => {
    setDroitsEnCoursId(adminId);
    setErreurAdmins(null);
    try {
      const res = await AuthentificationApi.modifierDroitsAdmin({ id: adminId, ...formDroitsEdition });
      setAdmins((liste) => liste.map((a) => (a.id === adminId ? res.admin : a)));
      setDroitsEnEditionId(null);
    } catch (err) {
      setErreurAdmins(err.message);
    } finally {
      setDroitsEnCoursId(null);
    }
  };

  // réutilise l'endpoint générique de blocage — la règle d'escalade (cibler
  // un compte admin nécessite super_admin) est déjà appliquée côté serveur
  // (voir toggleBloquerUtilisateur, Registration/views.py)
  const toggleBloquerAdmin = async (admin) => {
    setBlocageAdminEnCoursId(admin.id);
    setErreurAdmins(null);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(admin.id);
      setAdmins((liste) => liste.map((a) => (a.id === admin.id ? { ...a, est_bloquer: !a.est_bloquer } : a)));
    } catch (err) {
      setErreurAdmins(err.message);
    } finally {
      setBlocageAdminEnCoursId(null);
    }
  };

  const revoquerUnAdmin = async (admin) => {
    const msg = t("admin.dashboard.adms.confirmRevoke").replace("{nom}", `${admin.prenom} ${admin.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setRevocationEnCoursId(admin.id);
    setErreurAdmins(null);
    try {
      await AuthentificationApi.revoquerAdmin(admin.id);
      setAdmins((liste) => liste.filter((a) => a.id !== admin.id));
    } catch (err) {
      setErreurAdmins(err.message);
    } finally {
      setRevocationEnCoursId(null);
    }
  };

  // modifie les infos (nom/prénom/email/téléphone) d'un AUTRE admin — pour
  // ses PROPRES infos, un admin utilise sa page de profil habituelle
  // (voir le lien "ownAccount" plus bas, qui pointe vers /profil)
  const ouvrirEditionInfos = (admin) => {
    setInfosEnEditionId(admin.id);
    setFormInfosEdition({ nom: admin.nom, prenom: admin.prenom, email: admin.email, telephone: admin.telephone });
    setErreurFormInfos(null);
  };

  const soumettreEditionInfos = async (adminId) => {
    setErreurFormInfos(null);
    if (NOM_PRENOM_INVALIDE.test(formInfosEdition.nom) || NOM_PRENOM_INVALIDE.test(formInfosEdition.prenom)) {
      setErreurFormInfos(t("admin.dashboard.adms.nameNoDigits"));
      return;
    }
    if (telephoneInvalide(formInfosEdition.telephone)) {
      setErreurFormInfos(t("admin.dashboard.adms.phoneInvalid"));
      return;
    }
    setInfosEnCoursId(adminId);
    try {
      const res = await AuthentificationApi.modifierInfosAdmin({ id: adminId, ...formInfosEdition });
      setAdmins((liste) => liste.map((a) => (a.id === adminId ? res.admin : a)));
      setInfosEnEditionId(null);
    } catch (err) {
      setErreurFormInfos(err.message);
    } finally {
      setInfosEnCoursId(null);
    }
  };

  // ne change PAS le mot de passe actuel — force seulement un changement à
  // la prochaine connexion de l'admin visé (voir doit_changer_mot_de_passe,
  // Registration/models.py)
  const reinitialiserMdpAdmin = async (admin) => {
    const msg = t("admin.dashboard.adms.confirmResetPassword").replace("{nom}", `${admin.prenom} ${admin.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setResetMdpEnCoursId(admin.id);
    setErreurAdmins(null);
    try {
      await AuthentificationApi.reinitialiserMotDePasseAdmin(admin.id);
    } catch (err) {
      setErreurAdmins(err.message);
    } finally {
      setResetMdpEnCoursId(null);
    }
  };

  // borne max des sélecteurs de date du rapport d'audit — on ne peut pas
  // choisir une période dans le futur, qu'on n'a pas encore vécue
  const dateAujourdhui = new Date().toISOString().slice(0, 10);

  const appliquerRaccourciPeriode = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    const fmt = (d) => d.toISOString().slice(0, 10);
    setRapportDateDebut(fmt(debut));
    setRapportDateFin(fmt(fin));
  };

  const telechargerRapportAudit = async () => {
    if (!rapportDateDebut || !rapportDateFin) {
      setErreurRapport(t("admin.dashboard.adms.rapportDatesRequired"));
      return;
    }
    setErreurRapport(null);
    setRapportEnCours(true);
    try {
      const blob = await AuthentificationApi.genererRapportAudit(rapportDateDebut, rapportDateFin, rapportAdminId || undefined);
      const heure = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
      const nomFichier = `Report-Audit-${rapportDateDebut}-${rapportDateFin}-${heure}.pdf`;
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreurRapport(err.message);
    } finally {
      setRapportEnCours(false);
    }
  };

  const soumettreConfigSauvegarde = async (patch) => {
    setConfigSauvegardeEnCours(true);
    setErreurSauvegarde(null);
    try {
      const res = await SauvegardeApi.modifierConfiguration(patch);
      setConfigSauvegarde(res.configuration);
    } catch (err) {
      setErreurSauvegarde(err.message);
    } finally {
      setConfigSauvegardeEnCours(false);
    }
  };

  const declencherSauvegardeMaintenant = async () => {
    setDeclenchementEnCours(true);
    setErreurSauvegarde(null);
    try {
      const res = await SauvegardeApi.declencherSauvegarde();
      setHistoriqueSauvegardes((liste) => [res.historique, ...liste]);
    } catch (err) {
      setErreurSauvegarde(err.message);
    } finally {
      setDeclenchementEnCours(false);
    }
  };

  const telechargerSauvegarde = async (h) => {
    setTelechargementSauvegardeEnCoursId(h.id);
    setErreurSauvegarde(null);
    try {
      const blob = await SauvegardeApi.telechargerSauvegarde(h.id);
      const nomFichier = `Sauvegarde-RekoltHt-${new Date(h.date_execution).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.rhtbackup`;
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreurSauvegarde(err.message);
    } finally {
      setTelechargementSauvegardeEnCoursId(null);
    }
  };

  const connecterGoogleDrive = async () => {
    setGoogleEnCours(true);
    setErreurSauvegarde(null);
    try {
      const res = await SauvegardeApi.obtenirUrlAutorisationGoogle();
      window.open(res.url_autorisation, "_blank", "noopener,noreferrer");
    } catch (err) {
      setErreurSauvegarde(err.message);
    } finally {
      setGoogleEnCours(false);
    }
  };

  const deconnecterGoogleDrive = async () => {
    setGoogleEnCours(true);
    setErreurSauvegarde(null);
    try {
      await SauvegardeApi.deconnecterGoogleDrive();
      setConfigSauvegarde((c) => c && { ...c, google_drive_connecte: false });
    } catch (err) {
      setErreurSauvegarde(err.message);
    } finally {
      setGoogleEnCours(false);
    }
  };

  const choisirFichierRestauration = (fichier) => {
    setFichierRestauration(fichier || null);
    setAnalyseRestauration(null);
    setResultatRestauration(null);
    setErreurRestauration(null);
  };

  const analyserFichierRestauration = async () => {
    if (!fichierRestauration) return;
    setAnalyseEnCours(true);
    setErreurRestauration(null);
    try {
      const res = await SauvegardeApi.analyserRestauration(fichierRestauration);
      setAnalyseRestauration(res.resume);
    } catch (err) {
      setErreurRestauration(err.message);
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const confirmerRestaurationFichier = async () => {
    if (!fichierRestauration) return;
    const msg = t("admin.dashboard.sauvegarde.confirmRestore");
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setRestaurationEnCours(true);
    setErreurRestauration(null);
    try {
      const res = await SauvegardeApi.confirmerRestauration(fichierRestauration);
      setResultatRestauration(res.resultat);
      setAnalyseRestauration(null);
      setFichierRestauration(null);
      SauvegardeApi.listerHistorique().then((r) => setHistoriqueSauvegardes(r.historique || [])).catch(() => {});
    } catch (err) {
      setErreurRestauration(err.message);
    } finally {
      setRestaurationEnCours(false);
    }
  };

  // onglets masqués selon les droits du compte connecté (voir aLeDroit
  // plus haut) — UX seulement, le serveur reste la vraie limite. "overview"
  // et "produits" restent toujours visibles (stats agrégées en lecture
  // seule + fiches produit publiques ; seules les actions de modération à
  // l'intérieur de ces onglets sont elles-mêmes gated, voir plus bas)
  const onglets = [
    { id: "overview",   label: t("admin.dashboard.tabOverview"),   icon: LayoutDashboard },
    { id: "produits",   label: t("admin.dashboard.tabProducts"),   icon: Package },
    ...(aLeDroit("gestion_utilisateurs") ? [
      { id: "utilisateurs", label: t("admin.dashboard.tabUsers"), icon: Users },
    ] : []),
    ...(aLeDroit("gestion_categories") ? [
      { id: "categories", label: t("admin.dashboard.tabCategories"), icon: Tag },
      { id: "sous-categories", label: t("admin.dashboard.tabSubCategories"), icon: Tag },
    ] : []),
    ...(aLeDroit("gestion_sauvegardes") ? [
      { id: "sauvegarde", label: t("admin.dashboard.sauvegarde.tabTitle"), icon: HardDrive },
    ] : []),
    ...(aLeDroit("gestion_support") ? [
      { id: "support", label: t("admin.dashboard.tabSupport"), icon: MessageCircle, badge: messagesSupport.length },
    ] : []),
    ...(estSuperAdmin || aLeDroit("gestion_mots_de_passe") ? [{ id: "admins", label: t("admin.dashboard.adms.tabTitle"), icon: UserCog }] : []),
    ...(aLeDroit("gestion_signalements") ? [
      { id: "signalements", label: t("admin.dashboard.tabReports"), icon: Flag, badge: signalements.length + signalementsVendeurs.length + signalementsMessages.length + signalementsAvis.length },
    ] : []),
  ];

  const ongletActif = onglets.find((o) => o.id === activeTab);
  const nomAffiche = utilisateur ? `${utilisateur.prenom || ""} ${utilisateur.nom || ""}`.trim() : "";

  const choisirOnglet = (id) => {
    setActiveTab(id);
    setSidebarOuvert(false);
  };

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${sidebarOuvert ? "admin-sidebar--ouverte" : ""}`}>
        <div className="admin-sidebar__brand">
          <img src={logoSite} alt="" className="admin-sidebar__logo" />
          <div>
            <p className="admin-sidebar__brand-name">RekoltHt</p>
            <p className="admin-sidebar__brand-tag">{t("admin.sidebar.tag")}</p>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          <p className="admin-sidebar__nav-label">{t("admin.sidebar.navigation")}</p>
          {onglets.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              className={`admin-sidebar__link ${activeTab === id ? "admin-sidebar__link--active" : ""}`}
              onClick={() => choisirOnglet(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {!!badge && <span className="admin-sidebar__badge">{badge}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <button type="button" className="admin-sidebar__back" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            {t("admin.sidebar.backToSite")}
          </button>
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {profil?.photo_profil ? (
                <img src={profil.photo_profil} alt="" />
              ) : (
                <User size={16} />
              )}
            </div>
            <div className="admin-sidebar__user-info">
              <p className="admin-sidebar__user-name">{nomAffiche || t("admin.sidebar.role")}</p>
              <p className="admin-sidebar__user-role">{t("admin.sidebar.role")}</p>
            </div>
            <button
              type="button"
              className="admin-sidebar__logout"
              onClick={handleDeconnexion}
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOuvert && <div className="admin-sidebar__overlay" onClick={() => setSidebarOuvert(false)} />}

      <div className="admin-content">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu-btn"
            onClick={() => setSidebarOuvert(true)}
            aria-label={t("admin.sidebar.openMenu")}
          >
            <Menu size={20} />
          </button>

          <nav className="admin-topbar__breadcrumb" aria-label="Breadcrumb">
            <span>{t("admin.dashboard.title")}</span>
            <span className="admin-topbar__breadcrumb-sep">/</span>
            <span className="admin-topbar__breadcrumb-current">{ongletActif?.label}</span>
          </nav>

          <div className="admin-topbar__actions">
            <button
              type="button"
              className="admin-topbar__icon-btn"
              onClick={toggleTheme}
              aria-label={t("nav.toggleTheme")}
              title={t("nav.toggleTheme")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              className="admin-topbar__icon-btn"
              onClick={() => choisirOnglet("signalements")}
              aria-label={t("admin.dashboard.tabReports")}
              title={t("admin.dashboard.tabReports")}
            >
              <Bell size={18} />
              {totalAlertes > 0 && <span className="admin-topbar__badge">{totalAlertes > 9 ? "9+" : totalAlertes}</span>}
            </button>

            <div className="admin-topbar__account" ref={menuCompteRef}>
              <button
                type="button"
                className="admin-topbar__account-btn"
                onClick={() => setMenuCompteOuvert((o) => !o)}
              >
                <div className="admin-topbar__avatar">
                  {profil?.photo_profil ? (
                    <img src={profil.photo_profil} alt="" />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <span className="admin-topbar__account-name">{nomAffiche}</span>
                <ChevronDown size={14} className={menuCompteOuvert ? "admin-topbar__chevron--ouvert" : ""} />
              </button>
              {menuCompteOuvert && (
                <div className="admin-topbar__dropdown">
                  <button type="button" onClick={() => { navigate("/profil"); setMenuCompteOuvert(false); }}>
                    <User size={14} />
                    {t("nav.myProfile")}
                  </button>
                  <div className="admin-topbar__dropdown-divider" />
                  <button type="button" className="admin-topbar__dropdown-item--danger" onClick={handleDeconnexion}>
                    <LogOut size={14} />
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-main">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
            <p className="admin-page-subtitle">{t("admin.dashboard.subtitle")}</p>
          </div>
          {activeTab === "overview" && aLeDroit("gestion_utilisateurs") && (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--primary"
              onClick={() => choisirOnglet("utilisateurs")}
            >
              <Users size={16} />
              {t("admin.dashboard.manageUsersButton")}
            </button>
          )}
        </div>

        {loading && <p className="admin-field-value">{t("profile.loading")}</p>}
        {error && <p className="admin-error">✗ {error}</p>}

        {!loading && !error && activeTab === "overview" && (
          <>
            {stats && (
              <section className="admin-stats-grid">
                {tuiles.map(({ icon: Icon, label, value, couleur }) => (
                  <div className="admin-stat-card" key={label}>
                    <div className={`admin-stat-card__icon admin-stat-card__icon--${couleur}`}><Icon size={20} /></div>
                    <div>
                      <p className="admin-stat-card__value">{value}</p>
                      <p className="admin-stat-card__label">{label}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {stats && (
              <section className="admin-charts-grid">
                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("admin.dashboard.chartAccountsByType")}</h3>
                  <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartAccountsByTypeSubtitle")}</p>
                  {donneesComptesParType.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("admin.dashboard.noChartData")}</p>
                  ) : (
                    <DonutChart
                      data={donneesComptesParType}
                      colors={COULEURS_COMPTES}
                      centerLabel={t("admin.dashboard.chartAccountsCenterLabel")}
                    />
                  )}
                </div>

                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("admin.dashboard.chartProductsBySubcategory")}</h3>
                  <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartProductsBySubcategorySubtitle")}</p>
                  {donneesProduitsParSousCategorie.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("admin.dashboard.noChartData")}</p>
                  ) : (
                    <LineChart data={donneesProduitsParSousCategorie} color="var(--chart-series-1)" />
                  )}
                </div>

                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("admin.dashboard.chartMostViewed")}</h3>
                  <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartMostViewedSubtitle")}</p>
                  {donneesProduitsConsultes.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("admin.dashboard.noChartData")}</p>
                  ) : (
                    <HistogramChart data={donneesProduitsConsultes} color="var(--chart-series-2)" />
                  )}
                </div>
              </section>
            )}

          </>
        )}

        {!loading && !error && activeTab === "utilisateurs" && aLeDroit("gestion_utilisateurs") && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.usersListTitle")}
              </h3>

              {erreurReactivationVendeur && <p className="admin-error">✗ {erreurReactivationVendeur}</p>}
              {erreurUtilisateurs && <p className="admin-error">✗ {erreurUtilisateurs}</p>}

              <ul className="admin-item-list">
                {utilisateurs.map((u) => (
                  <li className="admin-item" key={u.id}>
                    <div className="admin-item__avatar">
                      {(u.prenom?.[0] || "").toUpperCase()}{(u.nom?.[0] || "").toUpperCase()}
                    </div>
                    <div className="admin-item__info">
                      <p className="admin-item__name">{u.prenom} {u.nom}</p>
                      <p className="admin-item__contact">{u.email} — {u.telephone}</p>
                    </div>
                    <span className="admin-tag">{u.role}</span>
                    {u.est_bloquer && (
                      <span className="admin-tag admin-badge--blocked">{t("admin.dashboard.blockedBadge")}</span>
                    )}
                    {u.desactive_par_signalements && (
                      <span className="admin-tag admin-badge--blocked">{t("admin.dashboard.suspendedBadge")}</span>
                    )}
                    {u.desactive_par_signalements && (
                      <button
                        className="admin-action-btn admin-action-btn--secondary"
                        disabled={reactivationVendeurEnCoursId === u.id}
                        onClick={() => reactiverUnVendeur(u.id, u.id)}
                      >
                        <CheckCircle2 size={14} />
                        {t("admin.dashboard.reactivateSeller")}
                      </button>
                    )}
                    {/* un admin ne peut pas bloquer/supprimer son propre compte (voir
                        toggleBloquerUtilisateur/supprimerUtilisateurAdmin, Registration/views.py,
                        qui refusent déjà ces actions côté serveur) — masqués ici pour éviter un
                        bouton qui échouerait systématiquement */}
                    {u.id !== utilisateur?.id && (
                      <>
                        <button
                          className={`admin-action-btn ${u.est_bloquer ? "admin-action-btn--secondary" : "admin-btn--danger"}`}
                          disabled={bloquageEnCours === u.id}
                          onClick={() => toggleBloquer(u)}
                        >
                          {u.est_bloquer ? t("admin.dashboard.unblock") : t("admin.dashboard.block")}
                        </button>
                        <button
                          className="admin-action-btn admin-btn--danger"
                          disabled={suppressionUtilisateurEnCoursId === u.id}
                          onClick={() => supprimerUnUtilisateur(u)}
                        >
                          <Trash2 size={14} />
                          {t("admin.dashboard.deleteUser")}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
        )}

        {!loading && !error && activeTab === "produits" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.productsListTitle")}
            </h3>

            {erreurReactivation && <p className="admin-error">✗ {erreurReactivation}</p>}

            {produits.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noProducts")}</p>
            ) : (
              <ul className="admin-item-list">
                {produits.map((p) => (
                  <li className="admin-item" key={p.id}>
                    {p.photos?.[0]?.url_photo ? (
                      <img src={p.photos[0].url_photo} alt={p.nom} className="admin-item__avatar" style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="admin-item__avatar"><Package size={18} /></div>
                    )}
                    <div className="admin-item__info">
                      <p className="admin-item__name">{p.nom}</p>
                      <p className="admin-item__contact">
                        {p.categorie?.nom} — {p.prix ? `${p.prix} ${p.unitePrix}` : t("profile.notSpecified")} {p.unite_De_Mesure}
                      </p>
                    </div>
                    <span className={`admin-tag ${p.est_disponible ? "" : "admin-badge--blocked"}`}>
                      {p.est_disponible ? t("admin.dashboard.available") : t("admin.dashboard.unavailable")}
                    </span>
                    {p.desactive_par_signalements && aLeDroit("gestion_signalements") && (
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--secondary"
                        disabled={reactivationEnCoursId === p.id}
                        onClick={() => reactiverUnProduit(p)}
                      >
                        <ShieldCheck size={16} />
                        {t("admin.dashboard.reactivateProduct")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && !error && activeTab === "categories" && (
          <>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card__title admin-card__title--accent">
                  {categorieEnEdition ? t("admin.dashboard.editCategory") : t("admin.dashboard.newCategory")}
                </h3>
                {categorieEnEdition && (
                  <button className="admin-icon-btn" onClick={annulerFormulaireCategorie} aria-label={t("admin.dashboard.cancel")}>
                    <X size={18} />
                  </button>
                )}
              </div>

              <form className="admin-category-form" onSubmit={soumettreFormulaireCategorie}>
                <input
                  type="text"
                  placeholder={t("admin.dashboard.categoryNamePlaceholder")}
                  value={formCategorie.nom}
                  onChange={(e) => setFormCategorie((f) => ({ ...f, nom: e.target.value }))}
                  className="admin-input"
                />
                <input
                  type="text"
                  placeholder={t("admin.dashboard.categoryDescriptionPlaceholder")}
                  value={formCategorie.description}
                  onChange={(e) => setFormCategorie((f) => ({ ...f, description: e.target.value }))}
                  className="admin-input"
                />
                {categorieErreur && <p className="admin-error">✗ {categorieErreur}</p>}
                <button type="submit" className="admin-action-btn admin-action-btn--primary" disabled={categorieEnCours}>
                  <Plus size={16} />
                  {categorieEnEdition ? t("admin.dashboard.saveCategory") : t("admin.dashboard.addCategory")}
                </button>
              </form>
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.categoriesListTitle")}
              </h3>

              {categories.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noCategories")}</p>
              ) : (
                <ul className="admin-item-list">
                  {categories.map((c) => (
                    <li className="admin-item" key={c.id}>
                      <div className="admin-item__avatar"><Tag size={18} /></div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{c.nom}</p>
                        <p className="admin-item__contact">{c.description || t("profile.notSpecified")}</p>
                      </div>
                      <button className="admin-icon-btn" onClick={() => ouvrirFormulaireEdition(c)} aria-label={t("admin.dashboard.editCategory")}>
                        <Pencil size={16} />
                      </button>
                      <button className="admin-icon-btn admin-icon-btn--danger" onClick={() => supprimerCategorie(c)} aria-label={t("admin.dashboard.deleteCategory")}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {!loading && !error && activeTab === "sous-categories" && (
          <>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card__title admin-card__title--accent">
                  {sousCategorieEnEdition ? t("admin.dashboard.editSubCategory") : t("admin.dashboard.newSubCategory")}
                </h3>
                {sousCategorieEnEdition && (
                  <button className="admin-icon-btn" onClick={annulerFormulaireSousCategorie} aria-label={t("admin.dashboard.cancel")}>
                    <X size={18} />
                  </button>
                )}
              </div>

              <form className="admin-category-form" onSubmit={soumettreFormulaireSousCategorie}>
                <select
                  className="admin-input"
                  value={formSousCategorie.categorie_id}
                  onChange={(e) => setFormSousCategorie((f) => ({ ...f, categorie_id: e.target.value }))}
                >
                  <option value="">{t("admin.dashboard.subCategoryParentPlaceholder")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
                <input
                  type="text"
                  list="suggestions-sous-categories"
                  placeholder={t("admin.dashboard.subCategoryNamePlaceholder")}
                  value={formSousCategorie.nom}
                  onChange={(e) => setFormSousCategorie((f) => ({ ...f, nom: e.target.value }))}
                  className="admin-input"
                />
                <datalist id="suggestions-sous-categories">
                  {SUGGESTIONS_SOUS_CATEGORIES.map((nom) => <option key={nom} value={nom} />)}
                </datalist>
                {sousCategorieErreur && <p className="admin-error">✗ {sousCategorieErreur}</p>}
                <button type="submit" className="admin-action-btn admin-action-btn--primary" disabled={sousCategorieEnCours}>
                  <Plus size={16} />
                  {sousCategorieEnEdition ? t("admin.dashboard.saveSubCategory") : t("admin.dashboard.addSubCategory")}
                </button>
              </form>
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.subCategoriesListTitle")}
              </h3>

              {sousCategories.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noSubCategories")}</p>
              ) : (
                <ul className="admin-item-list">
                  {sousCategories.map((sc) => (
                    <li className="admin-item" key={sc.id}>
                      <div className="admin-item__avatar"><Tag size={18} /></div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{sc.nom}</p>
                        <p className="admin-item__contact">
                          {categories.find((c) => c.id === sc.categorie_id)?.nom || t("profile.notSpecified")}
                        </p>
                      </div>
                      <button className="admin-icon-btn" onClick={() => ouvrirFormulaireEditionSousCategorie(sc)} aria-label={t("admin.dashboard.editSubCategory")}>
                        <Pencil size={16} />
                      </button>
                      <button className="admin-icon-btn admin-icon-btn--danger" onClick={() => supprimerSousCategorie(sc)} aria-label={t("admin.dashboard.deleteSubCategory")}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {activeTab === "support" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.supportListTitle")}
            </h3>

            {erreurSupport && <p className="admin-error">✗ {erreurSupport}</p>}
            {chargementSupport && <p className="admin-field-value">{t("profile.loading")}</p>}

            {!chargementSupport && messagesSupport.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noSupportMessages")}</p>
            ) : (
              <ul className="admin-item-list admin-support-list">
                {messagesSupport.map((m) => (
                  <li className="admin-support-item" key={m.id}>
                    <div className="admin-support-item__entete">
                      <div className="admin-item__avatar">
                        <MessageCircle size={18} />
                      </div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{m.vendeur_nom}</p>
                        <p className="admin-item__contact">{new Date(m.date_envoi).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="admin-support-item__contenu">
                      {!m.chiffre ? m.contenu
                        : contenusSupportDechiffres[m.id] === undefined ? t("messagerie.dechiffrementEnCours")
                        : contenusSupportDechiffres[m.id] === null ? t("messagerie.contenuIllisible")
                        : contenusSupportDechiffres[m.id]}
                    </p>
                    <div className="admin-support-item__reponse">
                      <textarea
                        className="admin-input admin-support-item__textarea"
                        placeholder={t("admin.dashboard.replyPlaceholder")}
                        value={reponsesBrouillon[m.id] || ""}
                        onChange={(e) => setReponsesBrouillon((b) => ({ ...b, [m.id]: e.target.value }))}
                      />
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={reponseEnCoursId === m.id || !(reponsesBrouillon[m.id] || "").trim()}
                        onClick={() => soumettreReponseSupport(m)}
                      >
                        <Send size={16} />
                        {t("admin.dashboard.reply")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "signalements" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.reportsListTitle")}
            </h3>

            {erreurSignalements && <p className="admin-error">✗ {erreurSignalements}</p>}
            {chargementSignalements && <p className="admin-field-value">{t("profile.loading")}</p>}

            {!chargementSignalements && signalements.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noReports")}</p>
            ) : (
              <ul className="admin-item-list admin-support-list">
                {signalements.map((s) => (
                  <li className="admin-support-item" key={s.id}>
                    {s.a_declenche_desactivation_auto && (
                      <p className="admin-auto-banner">{t("admin.dashboard.autoDisabledNotice")}</p>
                    )}
                    <div className="admin-support-item__entete">
                      <div className="admin-item__avatar">
                        <Flag size={18} />
                      </div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{s.produit_nom}</p>
                        <p className="admin-item__contact">
                          <Link to={`/vendeur/detail?id=${s.vendeur_id}`}>{s.vendeur_nom}</Link>
                          {" — "}{t(`admin.dashboard.reportType.${s.type_probleme}`)}
                        </p>
                      </div>
                      <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                    </div>
                    <p className="admin-support-item__contenu">{s.motif}</p>
                    <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                      {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                    </p>
                    <div className="admin-support-item__reponse">
                      <button
                        className="admin-action-btn admin-btn--danger"
                        disabled={desactivationProduitEnCoursId === s.id}
                        onClick={() => desactiverUnProduitDepuisSignalement(s)}
                      >
                        <Ban size={16} />
                        {t("admin.dashboard.disableProduct")}
                      </button>
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={traitementEnCoursId === s.id}
                        onClick={() => traiterUnSignalement(s)}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.markReportHandled")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "signalements" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.reportsSellersListTitle")}
            </h3>

            {erreurSignalementsVendeurs && <p className="admin-error">✗ {erreurSignalementsVendeurs}</p>}
            {erreurReactivationVendeur && <p className="admin-error">✗ {erreurReactivationVendeur}</p>}
            {chargementSignalementsVendeurs && <p className="admin-field-value">{t("profile.loading")}</p>}

            {!chargementSignalementsVendeurs && signalementsVendeurs.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noReportsSellers")}</p>
            ) : (
              <ul className="admin-item-list admin-support-list">
                {signalementsVendeurs.map((s) => (
                  <li className="admin-support-item" key={s.id}>
                    {s.a_declenche_suspension_auto && (
                      <p className="admin-auto-banner">{t("admin.dashboard.autoSuspendedNotice")}</p>
                    )}
                    <div className="admin-support-item__entete">
                      <div className="admin-item__avatar">
                        <Flag size={18} />
                      </div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">
                          <Link to={`/vendeur/detail?id=${s.vendeur_id}`}>{s.vendeur_nom}</Link>
                        </p>
                        <p className="admin-item__contact">
                          {t(`admin.dashboard.reportSellerType.${s.type_probleme}`)}
                        </p>
                      </div>
                      <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                    </div>
                    <p className="admin-support-item__contenu">{s.motif}</p>
                    <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                      {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                    </p>
                    <div className="admin-support-item__reponse">
                      <button
                        className="admin-action-btn admin-btn--danger"
                        disabled={blocageVendeurDepuisRapportEnCoursId === s.id}
                        onClick={() => bloquerVendeurDepuisSignalementVendeur(s)}
                      >
                        <Ban size={16} />
                        {t("admin.dashboard.blockSeller")}
                      </button>
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={traitementVendeurEnCoursId === s.id}
                        onClick={() => traiterUnSignalementVendeur(s)}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.markReportHandled")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "signalements" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.reportsMessagesListTitle")}
            </h3>

            {erreurSignalementsMessages && <p className="admin-error">✗ {erreurSignalementsMessages}</p>}
            {chargementSignalementsMessages && <p className="admin-field-value">{t("profile.loading")}</p>}

            {!chargementSignalementsMessages && signalementsMessages.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noReportsMessages")}</p>
            ) : (
              <ul className="admin-item-list admin-support-list">
                {signalementsMessages.map((s) => (
                  <li className="admin-support-item" key={s.id}>
                    <div className="admin-support-item__entete">
                      <div className="admin-item__avatar">
                        <Flag size={18} />
                      </div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{s.message_expediteur_nom}</p>
                        <p className="admin-item__contact">
                          {t(`admin.dashboard.reportMessageType.${s.type_probleme}`)}
                        </p>
                      </div>
                      <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                    </div>
                    <p className="admin-support-item__contenu">« {s.message_contenu || t("messagerie.sharedProduct")} »</p>
                    <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                      {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")} — {s.motif}
                    </p>
                    <div className="admin-support-item__reponse">
                      <button
                        className="admin-action-btn admin-btn--danger"
                        disabled={blocageUtilisateurMessageEnCoursId === s.id}
                        onClick={() => bloquerUtilisateurDepuisSignalementMessage(s)}
                      >
                        <Ban size={16} />
                        {t("admin.dashboard.blockUser")}
                      </button>
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={traitementMessageEnCoursId === s.id}
                        onClick={() => traiterUnSignalementMessage(s)}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.markReportHandled")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "signalements" && (
          <div className="admin-card">
            <h3 className="admin-card__title admin-card__title--accent">
              {t("admin.dashboard.reportsAvisListTitle")}
            </h3>

            {erreurSignalementsAvis && <p className="admin-error">✗ {erreurSignalementsAvis}</p>}
            {chargementSignalementsAvis && <p className="admin-field-value">{t("profile.loading")}</p>}

            {!chargementSignalementsAvis && signalementsAvis.length === 0 ? (
              <p className="admin-field-value">{t("admin.dashboard.noReportsAvis")}</p>
            ) : (
              <ul className="admin-item-list admin-support-list">
                {signalementsAvis.map((s) => (
                  <li className="admin-support-item" key={s.id}>
                    <div className="admin-support-item__entete">
                      <div className="admin-item__avatar">
                        <Flag size={18} />
                      </div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">{s.auteur_avis_nom || t("profile.notSpecified")}</p>
                        <p className="admin-item__contact">
                          {s.produit_nom} — {t(`admin.dashboard.reportAvisType.${s.type_probleme}`)}
                        </p>
                      </div>
                      <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                    </div>
                    <p className="admin-support-item__contenu">
                      <StarRating note={s.avis_note} taille={13} /> {s.avis_commentaire}
                    </p>
                    <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                      {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")} — {s.motif}
                    </p>
                    {s.auteur_avis_avertissements != null && (
                      <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                        {t("admin.dashboard.warningsCount", { n: s.auteur_avis_avertissements })}
                      </p>
                    )}
                    <div className="admin-support-item__reponse">
                      <button
                        className="admin-action-btn admin-btn--danger"
                        disabled={suppressionAvisSignaleEnCoursId === s.id}
                        onClick={() => supprimerUnAvisSignale(s)}
                      >
                        <Trash2 size={16} />
                        {t("admin.dashboard.deleteReview")}
                      </button>
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={traitementAvisEnCoursId === s.id}
                        onClick={() => traiterUnSignalementAvis(s)}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.markReportHandled")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "admins" && (estSuperAdmin || aLeDroit("gestion_mots_de_passe")) && (
          <>
            <div className="admin-card">
              <div className="admin-card__header-row">
                <h3 className="admin-card__title admin-card__title--accent">
                  {t("admin.dashboard.adms.listTitle")}
                </h3>
                {estSuperAdmin && (
                  <button type="button" className="admin-action-btn admin-action-btn--primary" onClick={ouvrirCreationAdmin}>
                    <Plus size={16} />
                    {t("admin.dashboard.adms.createButton")}
                  </button>
                )}
              </div>

              {erreurAdmins && <p className="admin-error">✗ {erreurAdmins}</p>}
              {chargementAdmins && <p className="admin-field-value">{t("profile.loading")}</p>}

              {!chargementAdmins && admins.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.adms.noAdmins")}</p>
              ) : (
                <ul className="admin-item-list">
                  {admins.map((a) => {
                    const estMoi = a.id === utilisateur?.id;
                    const estIntouchable = !!a.droits?.est_super_super_admin;
                    // un admin à droits limités qui n'a QUE gestion_mots_de_passe
                    // (pas estSuperAdmin) ne voit que la ligne + le bouton reset —
                    // pas les autres actions, réservées à "Tous les droits"
                    const peutGererCeCompte = !estMoi && !estIntouchable && estSuperAdmin && peutAgirSurAdmin(droits, a.droits);
                    const peutReinitCeMdp = !estMoi && !estIntouchable && peutReinitialiserMdp(droits, a.droits);
                    return (
                      <li className="admin-item" key={a.id}>
                        <div className="admin-item__avatar"><UserCog size={18} /></div>
                        <div className="admin-item__info">
                          <p className="admin-item__name">{a.prenom} {a.nom}</p>
                          <p className="admin-item__contact">{a.email} — {a.telephone}</p>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                            {estIntouchable ? (
                              <span className="admin-tag">{t("admin.dashboard.adms.superSuperAdmin")}</span>
                            ) : a.droits?.super_admin ? (
                              <span className="admin-tag">{t("admin.dashboard.adms.superAdmin")}</span>
                            ) : (
                              DROITS_ASSIGNABLES.filter((d) => a.droits?.[d]).map((d) => (
                                <span className="admin-tag" key={d}>{t(`admin.dashboard.adms.droits.${d}`)}</span>
                              ))
                            )}
                            {a.est_bloquer && <span className="admin-tag admin-badge--blocked">{t("admin.dashboard.suspendedBadge")}</span>}
                            {a.doit_changer_mot_de_passe && <span className="admin-tag">{t("admin.dashboard.adms.pendingPasswordChange")}</span>}
                          </div>

                          {infosEnEditionId === a.id && (
                            <form
                              className="rk-checkbox-group"
                              style={{ alignItems: "flex-start", marginTop: "10px" }}
                              onSubmit={(e) => { e.preventDefault(); soumettreEditionInfos(a.id); }}
                            >
                              <input className="rk-input" placeholder={t("admin.dashboard.adms.lastName")} value={formInfosEdition.nom} onChange={(e) => setFormInfosEdition((f) => ({ ...f, nom: e.target.value }))} />
                              <input className="rk-input" placeholder={t("admin.dashboard.adms.firstName")} value={formInfosEdition.prenom} onChange={(e) => setFormInfosEdition((f) => ({ ...f, prenom: e.target.value }))} />
                              <input type="email" className="rk-input" placeholder={t("admin.dashboard.adms.emailLabel")} value={formInfosEdition.email} onChange={(e) => setFormInfosEdition((f) => ({ ...f, email: e.target.value }))} />
                              <input type="tel" className="rk-input" placeholder={t("admin.dashboard.adms.phoneLabel")} value={formInfosEdition.telephone} onChange={(e) => setFormInfosEdition((f) => ({ ...f, telephone: e.target.value }))} />
                              {erreurFormInfos && <p className="rk-error">✗ {erreurFormInfos}</p>}
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button type="submit" className="admin-action-btn admin-action-btn--primary" disabled={infosEnCoursId === a.id}>
                                  {t("admin.dashboard.save")}
                                </button>
                                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => setInfosEnEditionId(null)}>
                                  {t("admin.dashboard.cancel")}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>

                        {estMoi ? (
                          <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => navigate("/profil")}>
                            {t("admin.dashboard.adms.editOwnInfo")}
                          </button>
                        ) : estIntouchable ? (
                          <span className="admin-tag">{t("admin.dashboard.adms.untouchable")}</span>
                        ) : (
                          <>
                            {peutGererCeCompte && infosEnEditionId !== a.id && (
                              <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => ouvrirEditionInfos(a)}>
                                <Pencil size={14} />
                                {t("admin.dashboard.adms.editInfo")}
                              </button>
                            )}

                            {peutGererCeCompte && (
                              droitsEnEditionId === a.id ? (
                                <div className="rk-checkbox-group" style={{ alignItems: "flex-start" }}>
                                  {DROITS_ASSIGNABLES.map((d) => (
                                    <label key={d} className="rk-checkbox-row">
                                      <input
                                        type="checkbox"
                                        checked={!!formDroitsEdition[d]}
                                        onChange={(e) => setFormDroitsEdition((f) => ({ ...f, [d]: e.target.checked }))}
                                      />
                                      {t(`admin.dashboard.adms.droits.${d}`)}
                                    </label>
                                  ))}
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                      type="button" className="admin-action-btn admin-action-btn--primary"
                                      disabled={droitsEnCoursId === a.id} onClick={() => soumettreEditionDroits(a.id)}
                                    >
                                      {t("admin.dashboard.save")}
                                    </button>
                                    <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => setDroitsEnEditionId(null)}>
                                      {t("admin.dashboard.cancel")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => ouvrirEditionDroits(a)}>
                                  <KeyRound size={14} />
                                  {t("admin.dashboard.adms.editRights")}
                                </button>
                              )
                            )}

                            {peutReinitCeMdp && (
                              <button
                                type="button" className="admin-action-btn admin-action-btn--secondary"
                                disabled={resetMdpEnCoursId === a.id} onClick={() => reinitialiserMdpAdmin(a)}
                              >
                                <KeyRound size={14} />
                                {t("admin.dashboard.adms.resetPassword")}
                              </button>
                            )}

                            {peutGererCeCompte && (
                              <>
                                <button
                                  type="button"
                                  className={`admin-action-btn ${a.est_bloquer ? "admin-action-btn--secondary" : "admin-btn--danger"}`}
                                  disabled={blocageAdminEnCoursId === a.id}
                                  onClick={() => toggleBloquerAdmin(a)}
                                >
                                  {a.est_bloquer ? t("admin.dashboard.unblock") : t("admin.dashboard.block")}
                                </button>
                                <button
                                  type="button" className="admin-action-btn admin-btn--danger"
                                  disabled={revocationEnCoursId === a.id} onClick={() => revoquerUnAdmin(a)}
                                >
                                  <Ban size={14} />
                                  {t("admin.dashboard.adms.revoke")}
                                </button>
                              </>
                            )}

                            {!peutGererCeCompte && !peutReinitCeMdp && (
                              <span className="admin-tag">{t("admin.dashboard.adms.protectedAccount")}</span>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {estSuperAdmin && formulaireAdminOuvert && (
              <div className="admin-modal-overlay" onClick={() => setFormulaireAdminOuvert(false)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal__entete">
                    <h3>{t("admin.dashboard.adms.createTitle")}</h3>
                    <button type="button" className="admin-modal__fermer" onClick={() => setFormulaireAdminOuvert(false)} aria-label={t("admin.dashboard.cancel")}>
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={soumettreCreationAdmin}>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.lastName")}</label>
                      <input className="rk-input" value={formAdmin.nom} onChange={(e) => setFormAdmin((f) => ({ ...f, nom: e.target.value }))} required />
                    </div>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.firstName")}</label>
                      <input className="rk-input" value={formAdmin.prenom} onChange={(e) => setFormAdmin((f) => ({ ...f, prenom: e.target.value }))} required />
                    </div>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.emailLabel")}</label>
                      <input type="email" className="rk-input" value={formAdmin.email} onChange={(e) => setFormAdmin((f) => ({ ...f, email: e.target.value }))} required />
                    </div>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.phoneLabel")}</label>
                      <input type="tel" className="rk-input" value={formAdmin.telephone} onChange={(e) => setFormAdmin((f) => ({ ...f, telephone: e.target.value }))} required />
                      <p className="admin-field-value" style={{ fontSize: "0.78em", marginTop: "4px" }}>{t("admin.dashboard.adms.phoneHint")}</p>
                    </div>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.passwordLabel")}</label>
                      <input type="password" className="rk-input" value={formAdmin.mot_de_passe} onChange={(e) => setFormAdmin((f) => ({ ...f, mot_de_passe: e.target.value }))} required />
                    </div>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.adms.rightsLabel")}</label>
                      <div className="rk-checkbox-group">
                        {DROITS_ASSIGNABLES.map((d) => (
                          <label key={d} className="rk-checkbox-row">
                            <input type="checkbox" checked={!!formAdmin[d]} onChange={(e) => setFormAdmin((f) => ({ ...f, [d]: e.target.checked }))} />
                            {t(`admin.dashboard.adms.droits.${d}`)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ margin: "1rem 0 0.5rem" }}>
                      <ReCAPTCHA
                        ref={recaptchaAdminRef}
                        sitekey={import.meta.env.VITE_RECAPTCHA_KEY}
                        onChange={(token) => { setRecaptchaAdminToken(token); setRecaptchaAdminErreur(false); }}
                        onExpired={() => { setRecaptchaAdminToken(null); setRecaptchaAdminErreur(true); }}
                      />
                      {recaptchaAdminErreur && <p className="rk-error">✗ {t("auth.recaptchaError")}</p>}
                    </div>

                    {erreurFormAdmin && <p className="rk-error">✗ {erreurFormAdmin}</p>}
                    <button type="submit" className="rk-btn" disabled={adminEnCours}>
                      {adminEnCours ? t("seller.saving") : t("admin.dashboard.adms.createButton")}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {estSuperAdmin && (
              <div className="admin-card">
                <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.adms.auditReportTitle")}</h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriode(1)}>
                    {t("admin.dashboard.adms.today")}
                  </button>
                  <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriode(7)}>
                    {t("admin.dashboard.adms.last7Days")}
                  </button>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <div className="rk-field">
                    <label className="rk-label">{t("admin.dashboard.adms.dateFrom")}</label>
                    <input type="date" className="rk-input" max={dateAujourdhui} value={rapportDateDebut} onChange={(e) => setRapportDateDebut(e.target.value)} />
                  </div>
                  <div className="rk-field">
                    <label className="rk-label">{t("admin.dashboard.adms.dateTo")}</label>
                    <input type="date" className="rk-input" max={dateAujourdhui} value={rapportDateFin} onChange={(e) => setRapportDateFin(e.target.value)} />
                  </div>
                  <div className="rk-field">
                    <label className="rk-label">{t("admin.dashboard.adms.filterAdmin")}</label>
                    <select className="rk-select" value={rapportAdminId} onChange={(e) => setRapportAdminId(e.target.value)}>
                      <option value="">{t("admin.dashboard.adms.allAdmins")}</option>
                      {admins.map((a) => (
                        <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {erreurRapport && <p className="rk-error">✗ {erreurRapport}</p>}
                <button type="button" className="admin-action-btn admin-action-btn--primary" disabled={rapportEnCours} onClick={telechargerRapportAudit}>
                  <Download size={16} />
                  {rapportEnCours ? t("profile.loading") : t("admin.dashboard.adms.downloadReport")}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "sauvegarde" && aLeDroit("gestion_sauvegardes") && (
          <>
            {erreurSauvegarde && <p className="admin-error">✗ {erreurSauvegarde}</p>}
            {messageGoogle && (
              <p className={messageGoogle === "connecte" ? "admin-field-value" : "admin-error"}>
                {messageGoogle === "connecte" && `✓ ${t("admin.dashboard.sauvegarde.googleConnected")}`}
                {messageGoogle === "refuse" && `✗ ${t("admin.dashboard.sauvegarde.googleDenied")}`}
                {messageGoogle === "erreur" && `✗ ${t("admin.dashboard.sauvegarde.googleError")}`}
                {" "}
                <button type="button" className="admin-icon-btn" onClick={() => setMessageGoogle(null)} aria-label={t("common.close")}>
                  <X size={14} />
                </button>
              </p>
            )}

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.configTitle")}</h3>

              {chargementConfigSauvegarde && <p className="admin-field-value">{t("profile.loading")}</p>}

              {!chargementConfigSauvegarde && configSauvegarde && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <label className="rk-checkbox-row">
                    <input
                      type="checkbox"
                      checked={configSauvegarde.active}
                      onChange={(e) => setConfigSauvegarde((c) => ({ ...c, active: e.target.checked }))}
                    />
                    {t("admin.dashboard.sauvegarde.active")}
                  </label>

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.sauvegarde.frequency")}</label>
                      <select
                        className="rk-select"
                        value={configSauvegarde.frequence}
                        onChange={(e) => setConfigSauvegarde((c) => ({ ...c, frequence: e.target.value }))}
                      >
                        <option value="quotidienne">{t("admin.dashboard.sauvegarde.freqDaily")}</option>
                        <option value="hebdomadaire">{t("admin.dashboard.sauvegarde.freqWeekly")}</option>
                        <option value="mensuelle">{t("admin.dashboard.sauvegarde.freqMonthly")}</option>
                      </select>
                    </div>

                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.sauvegarde.triggerTime")}</label>
                      <input
                        type="time"
                        className="rk-input"
                        value={configSauvegarde.heure_declenchement}
                        onChange={(e) => setConfigSauvegarde((c) => ({ ...c, heure_declenchement: e.target.value }))}
                      />
                    </div>

                    {configSauvegarde.frequence === "hebdomadaire" && (
                      <div className="rk-field">
                        <label className="rk-label">{t("admin.dashboard.sauvegarde.weekday")}</label>
                        <select
                          className="rk-select"
                          value={configSauvegarde.jour_semaine}
                          onChange={(e) => setConfigSauvegarde((c) => ({ ...c, jour_semaine: Number(e.target.value) }))}
                        >
                          {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((jour, i) => (
                            <option key={jour} value={i}>{t(`admin.dashboard.sauvegarde.day.${jour}`)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {configSauvegarde.frequence === "mensuelle" && (
                      <div className="rk-field">
                        <label className="rk-label">{t("admin.dashboard.sauvegarde.monthDay")}</label>
                        <input
                          type="number" min={1} max={28} className="rk-input"
                          value={configSauvegarde.jour_mois}
                          onChange={(e) => setConfigSauvegarde((c) => ({ ...c, jour_mois: Number(e.target.value) }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="rk-field">
                    <label className="rk-label">{t("admin.dashboard.sauvegarde.type")}</label>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <label className="rk-checkbox-row">
                        <input
                          type="radio" name="type_sauvegarde" value="complete"
                          checked={configSauvegarde.type_sauvegarde === "complete"}
                          onChange={() => setConfigSauvegarde((c) => ({ ...c, type_sauvegarde: "complete" }))}
                        />
                        {t("admin.dashboard.sauvegarde.typeFull")}
                      </label>
                      <label className="rk-checkbox-row">
                        <input
                          type="radio" name="type_sauvegarde" value="incrementale"
                          checked={configSauvegarde.type_sauvegarde === "incrementale"}
                          onChange={() => setConfigSauvegarde((c) => ({ ...c, type_sauvegarde: "incrementale" }))}
                        />
                        {t("admin.dashboard.sauvegarde.typeIncremental")}
                      </label>
                    </div>
                  </div>

                  <div className="rk-field">
                    <label className="rk-label">{t("admin.dashboard.sauvegarde.destination")}</label>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                      <label className="rk-checkbox-row">
                        <input
                          type="radio" name="destination" value="locale"
                          checked={configSauvegarde.destination === "locale"}
                          onChange={() => setConfigSauvegarde((c) => ({ ...c, destination: "locale" }))}
                        />
                        {t("admin.dashboard.sauvegarde.destLocal")}
                      </label>
                      <label className="rk-checkbox-row">
                        <input
                          type="radio" name="destination" value="google_drive"
                          checked={configSauvegarde.destination === "google_drive"}
                          onChange={() => setConfigSauvegarde((c) => ({ ...c, destination: "google_drive" }))}
                        />
                        {t("admin.dashboard.sauvegarde.destGoogleDrive")}
                      </label>

                      {configSauvegarde.destination === "google_drive" && (
                        configSauvegarde.google_drive_connecte ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="admin-tag"><Cloud size={12} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />{t("admin.dashboard.sauvegarde.googleConnected")}</span>
                            <button type="button" className="admin-action-btn admin-action-btn--secondary" disabled={googleEnCours} onClick={deconnecterGoogleDrive}>
                              {t("admin.dashboard.sauvegarde.disconnectGoogle")}
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="admin-action-btn admin-action-btn--secondary" disabled={googleEnCours} onClick={connecterGoogleDrive}>
                            <Cloud size={14} />
                            {t("admin.dashboard.sauvegarde.connectGoogle")}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <button
                    type="button" className="admin-action-btn admin-action-btn--primary"
                    style={{ alignSelf: "flex-start" }}
                    disabled={configSauvegardeEnCours}
                    onClick={() => soumettreConfigSauvegarde(configSauvegarde)}
                  >
                    {configSauvegardeEnCours ? t("profile.loading") : t("admin.dashboard.save")}
                  </button>
                </div>
              )}
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.manualTitle")}</h3>
              <p className="admin-field-value">{t("admin.dashboard.sauvegarde.manualSubtitle")}</p>
              <button
                type="button" className="admin-action-btn admin-action-btn--primary"
                disabled={declenchementEnCours} onClick={declencherSauvegardeMaintenant}
              >
                <PlayCircle size={16} />
                {declenchementEnCours ? t("profile.loading") : t("admin.dashboard.sauvegarde.runNow")}
              </button>
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.historyTitle")}</h3>

              {chargementHistoriqueSauvegardes && <p className="admin-field-value">{t("profile.loading")}</p>}
              {!chargementHistoriqueSauvegardes && historiqueSauvegardes.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.sauvegarde.noHistory")}</p>
              ) : (
                <ul className="admin-item-list">
                  {historiqueSauvegardes.map((h) => (
                    <li className="admin-item" key={h.id}>
                      <div className="admin-item__avatar"><HardDrive size={18} /></div>
                      <div className="admin-item__info">
                        <p className="admin-item__name">
                          {new Date(h.date_execution).toLocaleString()}
                          {h.est_sauvegarde_securite && <span className="admin-tag" style={{ marginLeft: 8 }}>{t("admin.dashboard.sauvegarde.securityBackup")}</span>}
                        </p>
                        <p className="admin-item__contact">
                          {t(`admin.dashboard.sauvegarde.type${h.type_sauvegarde === "complete" ? "Full" : "Incremental"}`)}
                          {" — "}
                          {h.destination === "google_drive" ? t("admin.dashboard.sauvegarde.destGoogleDrive") : t("admin.dashboard.sauvegarde.destLocal")}
                          {" — "}
                          {h.declenche_par_nom || t("admin.dashboard.sauvegarde.automatic")}
                        </p>
                      </div>
                      <span className={`admin-tag ${h.statut === "echec" ? "admin-badge--blocked" : ""}`}>
                        {h.statut === "succes" ? t("admin.dashboard.sauvegarde.success") : t("admin.dashboard.sauvegarde.failure")}
                      </span>
                      {h.telechargeable && (
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          disabled={telechargementSauvegardeEnCoursId === h.id}
                          onClick={() => telechargerSauvegarde(h)}
                        >
                          <Download size={14} />
                          {t("admin.dashboard.sauvegarde.download")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {estSuperAdmin && (
              <div className="admin-card">
                <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.restoreTitle")}</h3>
                <p className="admin-field-value">{t("admin.dashboard.sauvegarde.restoreSubtitle")}</p>

                <input
                  type="file" accept=".rhtbackup"
                  onChange={(e) => choisirFichierRestauration(e.target.files?.[0])}
                  style={{ margin: "12px 0" }}
                />

                {erreurRestauration && <p className="admin-error">✗ {erreurRestauration}</p>}

                {fichierRestauration && !analyseRestauration && !resultatRestauration && (
                  <button type="button" className="admin-action-btn admin-action-btn--secondary" disabled={analyseEnCours} onClick={analyserFichierRestauration}>
                    <Upload size={14} />
                    {analyseEnCours ? t("profile.loading") : t("admin.dashboard.sauvegarde.analyze")}
                  </button>
                )}

                {analyseRestauration && (
                  <div className="admin-support-item__contenu" style={{ marginTop: "12px" }}>
                    <p><strong>{t("admin.dashboard.sauvegarde.summaryDate")}</strong> {new Date(analyseRestauration.manifest.date_generation).toLocaleString()}</p>
                    <p><strong>{t("admin.dashboard.sauvegarde.summaryType")}</strong> {analyseRestauration.manifest.type_sauvegarde === "complete" ? t("admin.dashboard.sauvegarde.typeFull") : t("admin.dashboard.sauvegarde.typeIncremental")}</p>
                    <p><strong>{t("admin.dashboard.sauvegarde.summaryRecords")}</strong> {analyseRestauration.nombre_enregistrements}</p>
                    <p><strong>{t("admin.dashboard.sauvegarde.summaryMedia")}</strong> {analyseRestauration.media_inclus ? `${t("admin.dashboard.sauvegarde.yes")} (${analyseRestauration.nombre_fichiers_media})` : t("admin.dashboard.sauvegarde.no")}</p>
                    <button
                      type="button" className="admin-action-btn admin-btn--danger"
                      style={{ marginTop: "10px" }}
                      disabled={restaurationEnCours}
                      onClick={confirmerRestaurationFichier}
                    >
                      <RotateCcw size={14} />
                      {restaurationEnCours ? t("profile.loading") : t("admin.dashboard.sauvegarde.confirmButton")}
                    </button>
                  </div>
                )}

                {resultatRestauration && (
                  <p className="admin-field-value" style={{ marginTop: "12px" }}>
                    ✓ {t("admin.dashboard.sauvegarde.restoreDone", { n: resultatRestauration.nombre_enregistrements_restaures })}
                  </p>
                )}
              </div>
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Users, Building2, ShieldCheck, Package, Ban, CheckCircle2,
  LayoutDashboard, Tag, Pencil, Trash2, Plus, X, MessageCircle, Send, Flag,
  Menu, ArrowLeft, LogOut, Sun, Moon, Bell, User, ChevronDown,
  KeyRound, Download, UserCog, HardDrive, Upload, RotateCcw, Cloud, PlayCircle, History, FileText,
  Eye, XCircle, Check,
} from "lucide-react";
import StarRating from "../components/StarRating.jsx";
import Language from "../components/language.jsx";
import { DonutChart, HistogramChart, LineChart, FrequencyChart } from "../components/AdminCharts.jsx";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useThemeStore } from "../api/themeStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { nomLocalise } from "../utils/nomLocalise.js";
import { symboleDevise } from "../utils/symboleDevise.js";
import { AuthentificationApi } from "../api/auth";
import { ProduitsApi } from "../api/produits";
import { MessagerieApi } from "../api/messagerie";
import { SauvegardeApi } from "../api/sauvegarde.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { useConfirmStore } from "../api/confirmStore.js";
import { useRaisonStore } from "../api/raisonStore.js";
import { useE2eStore } from "../api/e2eStore.js";
import { dechiffrerEnveloppe } from "../utils/e2eCrypto.js";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import logoSite from "../assets/Images/Asset5.svg";
import "../assets/CSS/AdminDashboard.css";

// noms de sous-catégories suggérés
const SUGGESTIONS_SOUS_CATEGORIES = (categorieProduitsData["Sous-Categories"] || [])
  .map((sc) => sc["Sous-Categorie"]);

// liste des droits disponible qui peut etre assigner
const DROITS_ASSIGNABLES = [
  "gestion_utilisateurs", "gestion_signalements",
  "gestion_categories", "gestion_support", "gestion_sauvegardes",
  "gestion_mots_de_passe",
];

const NOM_PRENOM_INVALIDE = /\d/;
// date locale (fuseau du NAVIGATEUR, en pratique Haïti pour nos admins) au
// format AAAA-MM-JJ — PAS Date.toISOString().slice(0, 10), qui convertit en
// UTC : passé 20h (UTC-4) l'utilisateur a déjà basculé sur le jour suivant en
// UTC, donc "Aujourd'hui"/"7 derniers jours"/"30 derniers jours" sélectionnait
// le mauvais jour et le backend (qui compare désormais en heure d'Haïti,
// voir TIME_ZONE) rejetait la date de fin comme "dans le futur". 
function formatDateLocale(d) {
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

// regroupe une liste d'historique par jour local (ex. "8/8/2026"), en
// conservant l'ordre déjà trié par le backend (le plus récent en premier)
function regrouperParDate(liste, champDate) {
  const groupes = new Map();
  for (const item of liste) {
    const cle = new Date(item[champDate]).toLocaleDateString();
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(item);
  }
  return Array.from(groupes.entries());
}

// regroupe une liste de signalements par cible 
function regrouperParCible(liste, champCible) {
  const obtenirCle = typeof champCible === "function" ? champCible : (item) => item[champCible];
  const groupes = new Map();
  for (const item of liste) {
    const cle = obtenirCle(item);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(item);
  }
  return Array.from(groupes.values());
}

// fabrique un toggle de sélection (Set d'ids) lié à un setState précis
function creerToggleSelection(setSelection) {
  return (id) => {
    setSelection((s) => {
      const suivant = new Set(s);
      if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
      return suivant;
    });
  };
}

function creerToggleSelectionGroupe(setSelection) {
  return (idsDuGroupe) => {
    setSelection((s) => {
      const suivant = new Set(s);
      const toutesDejaCochees = idsDuGroupe.every((id) => suivant.has(id));
      idsDuGroupe.forEach((id) => (toutesDejaCochees ? suivant.delete(id) : suivant.add(id)));
      return suivant;
    });
  };
}

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

// hiérarchie spécifique à la réinitialisation de mot de passe 
function peutReinitialiserMdp(mesDroits, droitsCible) {
  if (!mesDroits || !droitsCible) return false;
  if (droitsCible.est_super_super_admin) return false;
  if (mesDroits.est_super_super_admin) return true;
  if (droitsCible.super_admin) return false;
  if (mesDroits.super_admin) return true;
  return !!mesDroits.gestion_mots_de_passe && !droitsCible.gestion_mots_de_passe;
}

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const deconnexion = useAuthStore((s) => s.deconnexion);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isAdmin = profil?.role === "admin";
  // droits granulaires du compte connecté 
  const droits = profil?.droits_admin || null;
  const estSuperAdmin = !!droits?.super_admin;
  // le propriétaire est seul habilité à accorder/retirer
  // "Tous les droits" à un autre admin 
  const estProprietaire = !!droits?.est_super_super_admin;
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
  const demandeAdministrativeEvent = useGlobalStore((s) => s.demandeAdministrativeEvent);
  const verificationManuelleEvent = useGlobalStore((s) => s.verificationManuelleEvent);
  const sauvegardeEvent = useGlobalStore((s) => s.sauvegardeEvent);
  const setMessagesSupportEnAttenteBadge = useMessagerieBadgeStore((s) => s.setMessagesSupportEnAttente);
  const demanderConfirmation = useConfirmStore((s) => s.demander);
  const demanderRaison = useRaisonStore((s) => s.demanderRaison);

  // chiffrement de bout en bout en enveloppe des messages support (voir
  // Support/ContacterAdmin.jsx )
  const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
  const clePriveeCryptoKey = useE2eStore((s) => s.clePriveeCryptoKey);
  const obtenirClePubliqueDe = useE2eStore((s) => s.obtenirClePubliqueDe);

  // id -> texte en clair déjà déchiffré (undefined = pas tenté, null = échec)
  const [contenusSupportDechiffres, setContenusSupportDechiffres] = useState({});

  // historique (messagesSupportRepondus)
  const [historiqueSupportDechiffre, setHistoriqueSupportDechiffre] = useState({});

  // permet un lien direct vers un onglet précis
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

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

  // "Gestion des comptes" (section repliable, fermée par défaut) + filtres 
  const [comptesOuvert, setComptesOuvert] = useState(false);
  const [filtreComptesDateDebut, setFiltreComptesDateDebut] = useState("");
  const [filtreComptesDateFin, setFiltreComptesDateFin] = useState("");
  const [filtreComptesStatut, setFiltreComptesStatut] = useState("");
  const [filtreComptesNom, setFiltreComptesNom] = useState("");
  const [filtreComptesPrenom, setFiltreComptesPrenom] = useState("");
  const reinitialiserFiltresComptes = () => {
    setFiltreComptesDateDebut("");
    setFiltreComptesDateFin("");
    setFiltreComptesStatut("");
    setFiltreComptesNom("");
    setFiltreComptesPrenom("");
  };
  const filtresComptesActifs = !!(filtreComptesDateDebut || filtreComptesDateFin || filtreComptesStatut || filtreComptesNom || filtreComptesPrenom);
  const utilisateursFiltres = useMemo(() => {
    return utilisateurs.filter((u) => {

      const dateInscription = (u.date_inscription || "").slice(0, 10);
      if (filtreComptesDateDebut && dateInscription < filtreComptesDateDebut) return false;
      if (filtreComptesDateFin && dateInscription > filtreComptesDateFin) return false;
      if (filtreComptesStatut && u.role !== filtreComptesStatut) return false;
      if (filtreComptesNom && !(u.nom || "").toLowerCase().includes(filtreComptesNom.trim().toLowerCase())) return false;
      if (filtreComptesPrenom && !(u.prenom || "").toLowerCase().includes(filtreComptesPrenom.trim().toLowerCase())) return false;
      return true;
    });
  }, [utilisateurs, filtreComptesDateDebut, filtreComptesDateFin, filtreComptesStatut, filtreComptesNom, filtreComptesPrenom]);

  const [produitsOuvert, setProduitsOuvert] = useState(false);
  const [filtreProduitsDisponibilite, setFiltreProduitsDisponibilite] = useState("");
  const [filtreProduitsNom, setFiltreProduitsNom] = useState("");
  const reinitialiserFiltresProduits = () => {
    setFiltreProduitsDisponibilite("");
    setFiltreProduitsNom("");
  };
  const filtresProduitsActifs = !!(filtreProduitsDisponibilite || filtreProduitsNom);
  const produitsFiltres = useMemo(() => {
    return produits.filter((p) => {
      if (filtreProduitsDisponibilite === "disponible" && !p.est_disponible) return false;
      if (filtreProduitsDisponibilite === "indisponible" && p.est_disponible) return false;
      if (filtreProduitsNom && !(p.nom || "").toLowerCase().includes(filtreProduitsNom.trim().toLowerCase())) return false;
      return true;
    });
  }, [produits, filtreProduitsDisponibilite, filtreProduitsNom]);

  const dateAujourdhuiVuesAdmin = formatDateLocale(new Date());
  const [statsVuesAdminDateDebut, setStatsVuesAdminDateDebut] = useState(() => {
    const debut = new Date();
    debut.setDate(debut.getDate() - 6);
    return formatDateLocale(debut);
  });
  const [statsVuesAdminDateFin, setStatsVuesAdminDateFin] = useState(dateAujourdhuiVuesAdmin);
  const [statsVuesAdmin, setStatsVuesAdmin] = useState(null);
  const [chargementStatsVuesAdmin, setChargementStatsVuesAdmin] = useState(true);
  const [erreurStatsVuesAdmin, setErreurStatsVuesAdmin] = useState(null);

  const appliquerRaccourciPeriodeVuesAdmin = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    setStatsVuesAdminDateDebut(formatDateLocale(debut));
    setStatsVuesAdminDateFin(formatDateLocale(fin));
  };

  // messages vendeur -> admins en attente de réponse 
  const [messagesSupport, setMessagesSupport] = useState([]);
  const [chargementSupport, setChargementSupport] = useState(true);
  const [erreurSupport, setErreurSupport] = useState(null);
  const [reponsesBrouillon, setReponsesBrouillon] = useState({});
  const [reponseEnCoursId, setReponseEnCoursId] = useState(null);

  // historique des messages déjà répondus 
  const [messagesSupportRepondus, setMessagesSupportRepondus] = useState([]);
  const [chargementSupportRepondus, setChargementSupportRepondus] = useState(true);

  // demandes de vérification KYC en revue manuelle 
  const [demandesRevueManuelle, setDemandesRevueManuelle] = useState([]);
  const [chargementRevueManuelle, setChargementRevueManuelle] = useState(true);
  const [erreurRevueManuelle, setErreurRevueManuelle] = useState(null);
  const [decisionRevueManuelleEnCoursId, setDecisionRevueManuelleEnCoursId] = useState(null);
  const [demandeRevueManuelleOuverte, setDemandeRevueManuelleOuverte] = useState(null);
  const [motifRevueManuelle, setMotifRevueManuelle] = useState("");

  // signalements de produits en attente 
  const [signalements, setSignalements] = useState([]);
  const [chargementSignalements, setChargementSignalements] = useState(true);
  const [erreurSignalements, setErreurSignalements] = useState(null);
  const [traitementEnCoursId, setTraitementEnCoursId] = useState(null);
  const [reactivationEnCoursId, setReactivationEnCoursId] = useState(null);
  const [erreurReactivation, setErreurReactivation] = useState(null);
  const [desactivationProduitEnCoursId, setDesactivationProduitEnCoursId] = useState(null);

  const [gestionProduitEnCoursId, setGestionProduitEnCoursId] = useState(null);
  const [erreurGestionProduits, setErreurGestionProduits] = useState(null);
  const [signalementsTraites, setSignalementsTraites] = useState([]);
  const [chargementSignalementsTraites, setChargementSignalementsTraites] = useState(true);

  // signalements de vendeurs en attente 
  const [signalementsVendeurs, setSignalementsVendeurs] = useState([]);
  const [chargementSignalementsVendeurs, setChargementSignalementsVendeurs] = useState(true);
  const [erreurSignalementsVendeurs, setErreurSignalementsVendeurs] = useState(null);
  const [traitementVendeurEnCoursId, setTraitementVendeurEnCoursId] = useState(null);
  const [reactivationVendeurEnCoursId, setReactivationVendeurEnCoursId] = useState(null);
  const [erreurReactivationVendeur, setErreurReactivationVendeur] = useState(null);
  const [blocageVendeurDepuisRapportEnCoursId, setBlocageVendeurDepuisRapportEnCoursId] = useState(null);
  const [signalementsVendeursTraites, setSignalementsVendeursTraites] = useState([]);
  const [chargementSignalementsVendeursTraites, setChargementSignalementsVendeursTraites] = useState(true);

  // signalements de messages en attente 
  const [signalementsMessages, setSignalementsMessages] = useState([]);
  const [chargementSignalementsMessages, setChargementSignalementsMessages] = useState(true);
  const [erreurSignalementsMessages, setErreurSignalementsMessages] = useState(null);
  const [traitementMessageEnCoursId, setTraitementMessageEnCoursId] = useState(null);
  const [blocageUtilisateurMessageEnCoursId, setBlocageUtilisateurMessageEnCoursId] = useState(null);
  const [signalementsMessagesTraites, setSignalementsMessagesTraites] = useState([]);
  const [chargementSignalementsMessagesTraites, setChargementSignalementsMessagesTraites] = useState(true);

  // signalements d'avis en attente 
  const [signalementsAvis, setSignalementsAvis] = useState([]);
  const [chargementSignalementsAvis, setChargementSignalementsAvis] = useState(true);
  const [erreurSignalementsAvis, setErreurSignalementsAvis] = useState(null);
  const [traitementAvisEnCoursId, setTraitementAvisEnCoursId] = useState(null);
  const [suppressionAvisSignaleEnCoursId, setSuppressionAvisSignaleEnCoursId] = useState(null);
  const [signalementsAvisTraites, setSignalementsAvisTraites] = useState([]);
  const [chargementSignalementsAvisTraites, setChargementSignalementsAvisTraites] = useState(true);

  // sélection multiple + suppression pour les 5 historiques admin 
  const [selectionHistoriqueSupport, setSelectionHistoriqueSupport] = useState(new Set());
  const [suppressionHistoriqueSupportEnCours, setSuppressionHistoriqueSupportEnCours] = useState(false);
  const [selectionHistoriqueSignalements, setSelectionHistoriqueSignalements] = useState(new Set());
  const [suppressionHistoriqueSignalementsEnCours, setSuppressionHistoriqueSignalementsEnCours] = useState(false);
  const [selectionHistoriqueSignalementsVendeurs, setSelectionHistoriqueSignalementsVendeurs] = useState(new Set());
  const [suppressionHistoriqueSignalementsVendeursEnCours, setSuppressionHistoriqueSignalementsVendeursEnCours] = useState(false);
  const [selectionHistoriqueSignalementsMessages, setSelectionHistoriqueSignalementsMessages] = useState(new Set());
  const [suppressionHistoriqueSignalementsMessagesEnCours, setSuppressionHistoriqueSignalementsMessagesEnCours] = useState(false);
  const [selectionHistoriqueSignalementsAvis, setSelectionHistoriqueSignalementsAvis] = useState(new Set());
  const [suppressionHistoriqueSignalementsAvisEnCours, setSuppressionHistoriqueSignalementsAvisEnCours] = useState(false);

  // affichage des 5 historiques dans un modal dédié 
  const [modalHistoriqueSupportOuvert, setModalHistoriqueSupportOuvert] = useState(false);
  const [modalHistoriqueSignalementsOuvert, setModalHistoriqueSignalementsOuvert] = useState(false);

  // ── Gestion des ADMs (réservée au super admin, voir DroitsAdmin) ─────────
  const [admins, setAdmins] = useState([]);
  const [chargementAdmins, setChargementAdmins] = useState(true);
  const [erreurAdmins, setErreurAdmins] = useState(null);

  const [formulaireAdminOuvert, setFormulaireAdminOuvert] = useState(false);
  const [formAdmin, setFormAdmin] = useState(() => ({ nom: "", prenom: "", email: "", telephone: "", mot_de_passe: "", ...Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, false])) }));
  const [adminEnCours, setAdminEnCours] = useState(false);
  const [erreurFormAdmin, setErreurFormAdmin] = useState(null);

  // droits en cours de modification pour UN admin de la liste à la fois
  const [droitsEnEditionId, setDroitsEnEditionId] = useState(null);
  const [formDroitsEdition, setFormDroitsEdition] = useState({});
  const [droitsEnCoursId, setDroitsEnCoursId] = useState(null);

  const [blocageAdminEnCoursId, setBlocageAdminEnCoursId] = useState(null);
  const [revocationEnCoursId, setRevocationEnCoursId] = useState(null);

  // infos (nom/prénom/email/téléphone) en cours de modification pour UN
  // admin de la liste à la fois 
  const [infosEnEditionId, setInfosEnEditionId] = useState(null);
  const [formInfosEdition, setFormInfosEdition] = useState({ nom: "", prenom: "", email: "", telephone: "" });
  const [infosEnCoursId, setInfosEnCoursId] = useState(null);
  const [erreurFormInfos, setErreurFormInfos] = useState(null);

  const [resetMdpEnCoursId, setResetMdpEnCoursId] = useState(null);

  // rapport PDF du journal d'audit
  const [rapportDateDebut, setRapportDateDebut] = useState("");
  const [rapportDateFin, setRapportDateFin] = useState("");
  const [rapportAdminId, setRapportAdminId] = useState("");
  const [rapportEnCours, setRapportEnCours] = useState(false);
  const [erreurRapport, setErreurRapport] = useState(null);

  const [rapportSupportDateDebut, setRapportSupportDateDebut] = useState("");
  const [rapportSupportDateFin, setRapportSupportDateFin] = useState("");
  const [rapportSupportAdminId, setRapportSupportAdminId] = useState("");
  const [rapportSupportEnCours, setRapportSupportEnCours] = useState(false);
  const [erreurRapportSupport, setErreurRapportSupport] = useState(null);

  // rapport PDF d'audit des signalements 
  const [rapportSignalementsDateDebut, setRapportSignalementsDateDebut] = useState("");
  const [rapportSignalementsDateFin, setRapportSignalementsDateFin] = useState("");
  const [rapportSignalementsAdminId, setRapportSignalementsAdminId] = useState("");
  const [rapportSignalementsEnCours, setRapportSignalementsEnCours] = useState(false);
  const [erreurRapportSignalements, setErreurRapportSignalements] = useState(null);

  // ── Sauvegardes  ───
  const [configSauvegarde, setConfigSauvegarde] = useState(null);
  const [chargementConfigSauvegarde, setChargementConfigSauvegarde] = useState(true);
  const [erreurSauvegarde, setErreurSauvegarde] = useState(null);
  const [configSauvegardeEnCours, setConfigSauvegardeEnCours] = useState(false);

  const [historiqueSauvegardes, setHistoriqueSauvegardes] = useState([]);
  const [chargementHistoriqueSauvegardes, setChargementHistoriqueSauvegardes] = useState(true);

  const [declenchementEnCours, setDeclenchementEnCours] = useState(false);
  const [telechargementSauvegardeEnCoursId, setTelechargementSauvegardeEnCoursId] = useState(null);

  // progression d'un envoi Google Drive en cours 
  const [progressionSauvegarde, setProgressionSauvegarde] = useState(null);

  const [modalHistoriqueSauvegardeOuvert, setModalHistoriqueSauvegardeOuvert] = useState(false);

  const [googleEnCours, setGoogleEnCours] = useState(false);
  const [messageGoogle, setMessageGoogle] = useState(() => searchParams.get("google"));

  // restauration : fichier choisi -> analyse (aperçu) -> confirmation
  const [fichierRestauration, setFichierRestauration] = useState(null);
  const [analyseRestauration, setAnalyseRestauration] = useState(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [erreurRestauration, setErreurRestauration] = useState(null);
  const [resultatRestauration, setResultatRestauration] = useState(null);

  // formulaire catégorie 
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);
  const [formCategorie, setFormCategorie] = useState({ nom: "", nom_ht: "", nom_en: "", description: "" });
  const [categorieEnCours, setCategorieEnCours] = useState(false);
  const [categorieErreur, setCategorieErreur] = useState(null);

  // formulaire sous-catégorie 
  const [sousCategorieEnEdition, setSousCategorieEnEdition] = useState(null);
  const [formSousCategorie, setFormSousCategorie] = useState({ nom: "", nom_ht: "", nom_en: "", categorie_id: "" });
  const [sousCategorieEnCours, setSousCategorieEnCours] = useState(false);
  const [sousCategorieErreur, setSousCategorieErreur] = useState(null);

  useEffect(() => {
    afficherProfil().catch(() => { });
  }, [afficherProfil]);

  const chargerDonnees = () => {
    setLoading(true);
    setError(null);
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
  }, [isAdmin]);

  const chargerStatsVuesAdmin = () => {
    if (!isAdmin || !statsVuesAdminDateDebut || !statsVuesAdminDateFin) return;
    setChargementStatsVuesAdmin(true);
    setErreurStatsVuesAdmin(null);
    AuthentificationApi.statistiquesVuesAdmin(statsVuesAdminDateDebut, statsVuesAdminDateFin)
      .then((res) => setStatsVuesAdmin(res))
      .catch((err) => setErreurStatsVuesAdmin(err.message))
      .finally(() => setChargementStatsVuesAdmin(false));
  };
  useEffect(chargerStatsVuesAdmin, [isAdmin, statsVuesAdminDateDebut, statsVuesAdminDateFin]);

  const donneesCategoriesVuesAdmin = (statsVuesAdmin?.categories_plus_consultees || []).map((c) => ({
    label: c.label || t("dashboard.uncategorized"),
    value: c.value,
  }));

  const [erreurUtilisateurs, setErreurUtilisateurs] = useState(null);
  const chargerUtilisateursAdmin = () => {
    if (!aLeDroit("gestion_utilisateurs")) return;
    AuthentificationApi.listerUtilisateursAdmin()
      .then((res) => setUtilisateurs(res.utilisateurs || []))
      .catch((err) => setErreurUtilisateurs(err.message));
  };
  useEffect(chargerUtilisateursAdmin, [droits]);

  // demandes administratives (objet + description, agréer/rejeter) 
  const [demandesAdministratives, setDemandesAdministratives] = useState([]);
  const [erreurDemandesAdministratives, setErreurDemandesAdministratives] = useState(null);
  const [decisionDemandeEnCoursId, setDecisionDemandeEnCoursId] = useState(null);
  const chargerDemandesAdministrativesAdmin = () => {
    if (!aLeDroit("gestion_utilisateurs")) return;
    AuthentificationApi.listerDemandesAdministrativesAdmin()
      .then((res) => setDemandesAdministratives(res.demandes || []))
      .catch((err) => setErreurDemandesAdministratives(err.message));
  };
  useEffect(chargerDemandesAdministrativesAdmin, [droits]);

  // réactivité temps réel 
  useEffect(() => {
    if (!demandeAdministrativeEvent || !aLeDroit("gestion_utilisateurs")) return;
    const { type, data } = demandeAdministrativeEvent;
    if (type === "demande_administrative.created") {
      setDemandesAdministratives((liste) => (
        liste.some((d) => d.id === data.id) ? liste : [data, ...liste]
      ));
      return;
    }
    // "demande_administrative.traitee" : retire de la file 
    setDemandesAdministratives((liste) => liste.filter((d) => d.id !== data.id));
  }, [demandeAdministrativeEvent]);

  const approuverDemande = async (demande) => {
    if (!(await demanderConfirmation(t("admin.dashboard.confirmApproveRequest")))) return;
    setDecisionDemandeEnCoursId(demande.id);
    setErreurDemandesAdministratives(null);
    try {
      await AuthentificationApi.approuverDemandeAdministrative(demande.id, "");
      setDemandesAdministratives((liste) => liste.filter((d) => d.id !== demande.id));
      setUtilisateurs((liste) => liste.map((u) => (u.id === demande.utilisateur_id ? { ...u, est_bloquer: false } : u)));
    } catch (err) {
      setErreurDemandesAdministratives(err.message);
    } finally {
      setDecisionDemandeEnCoursId(null);
    }
  };

  const rejeterDemande = async (demande) => {
    const motif = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (motif === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmRejectRequest"), { danger: true }))) return;
    setDecisionDemandeEnCoursId(demande.id);
    setErreurDemandesAdministratives(null);
    try {
      await AuthentificationApi.rejeterDemandeAdministrative(demande.id, motif);
      setDemandesAdministratives((liste) => liste.filter((d) => d.id !== demande.id));
    } catch (err) {
      setErreurDemandesAdministratives(err.message);
    } finally {
      setDecisionDemandeEnCoursId(null);
    }
  };

  const chargerMessagesSupportEnAttente = () => {
    if (!isAdmin) return;
    setChargementSupport(true);
    MessagerieApi.listerMessagesAdminEnAttente()
      .then((res) => setMessagesSupport(res.messages_admin || []))
      .catch((err) => setErreurSupport(err.message))
      .finally(() => setChargementSupport(false));
  };
  useEffect(() => {
    if (!isAdmin) return;
    // uniquement nécessaire pour déchiffrer les messages LEGACY encore au
    // format E2E client 
    garantirCleE2E().catch(() => { });
    chargerMessagesSupportEnAttente();
  }, [isAdmin]);

  // Contenu des messages support en attente 
  useEffect(() => {
    if (messagesSupport.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const m of messagesSupport) {
        if (!m.chiffre) continue;
        if (m.format_chiffrement === "coffre_serveur") {
          resultats[m.id] = m.contenu;
          continue;
        }
        if (!clePriveeCryptoKey) continue;
        if (!m.cle_contenu_moi) { resultats[m.id] = null; continue; }
        try {
          const clePubliqueAuteur = await obtenirClePubliqueDe(m.vendeur_id);
          const texte = await dechiffrerEnveloppe(
            clePriveeCryptoKey, clePubliqueAuteur, m.contenu, m.iv_contenu, m.cle_contenu_moi, m.iv_cle_contenu_moi
          );
          resultats[m.id] = texte;
          MessagerieApi.migrerMessageVersCoffre({ id: m.id, contenu_dechiffre: texte }).catch(() => { });
        } catch {
          resultats[m.id] = null;
        }
      }
      if (!annule && Object.keys(resultats).length > 0) setContenusSupportDechiffres((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messagesSupport, clePriveeCryptoKey, obtenirClePubliqueDe]);

  const chargerMessagesSupportRepondus = () => {
    if (!isAdmin) return;
    setChargementSupportRepondus(true);
    MessagerieApi.listerMessagesAdminRepondus()
      .then((res) => setMessagesSupportRepondus(res.messages_admin || []))
      .catch(() => { })
      .finally(() => setChargementSupportRepondus(false));
  };
  useEffect(chargerMessagesSupportRepondus, [isAdmin]);

  // déchiffre contenu/reponse de l'historique — uniquement pour les messages
  // encore au format legacy 'e2e_client' 
  useEffect(() => {
    if (messagesSupportRepondus.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const m of messagesSupportRepondus) {
        const entree = {};
        if (m.chiffre && m.format_chiffrement === "e2e_client") {
          if (clePriveeCryptoKey && m.cle_contenu_moi) {
            try {
              const clePubliqueAuteur = await obtenirClePubliqueDe(m.vendeur_id);
              entree.contenu = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueAuteur, m.contenu, m.iv_contenu, m.cle_contenu_moi, m.iv_cle_contenu_moi
              );
              MessagerieApi.migrerMessageVersCoffre({ id: m.id, contenu_dechiffre: entree.contenu }).catch(() => { });
            } catch { entree.contenu = null; }
          } else if (clePriveeCryptoKey) {
            entree.contenu = null;
          }
        }
        if (m.reponse && m.reponse_format_chiffrement === "e2e_client") {
          if (clePriveeCryptoKey && m.cle_reponse_moi) {
            try {
              const clePubliqueAdmin = await obtenirClePubliqueDe(m.admin_repondant_id);
              entree.reponse = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueAdmin, m.reponse, m.iv_reponse, m.cle_reponse_moi, m.iv_cle_reponse_moi
              );
              MessagerieApi.migrerMessageVersCoffre({ id: m.id, reponse_dechiffree: entree.reponse }).catch(() => { });
            } catch { entree.reponse = null; }
          } else if (clePriveeCryptoKey) {
            entree.reponse = null;
          }
        }
        if (Object.keys(entree).length > 0) resultats[m.id] = entree;
      }
      if (!annule && Object.keys(resultats).length > 0) setHistoriqueSupportDechiffre((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messagesSupportRepondus, clePriveeCryptoKey, obtenirClePubliqueDe]);

  // demandes KYC en revue manuelle 
  const chargerDemandesRevueManuelle = () => {
    if (!estSuperAdmin) return;
    setChargementRevueManuelle(true);
    AuthentificationApi.listerDemandesRevueManuelleAdmin()
      .then((res) => setDemandesRevueManuelle(res.demandes || []))
      .catch((err) => setErreurRevueManuelle(err.message))
      .finally(() => setChargementRevueManuelle(false));
  };
  useEffect(chargerDemandesRevueManuelle, [estSuperAdmin]);

  // progression d'un envoi Google Drive en cours 
  useEffect(() => {
    if (!sauvegardeEvent) return;
    const { type, data } = sauvegardeEvent;
    if (type === "sauvegarde.progression") {
      setProgressionSauvegarde({ pourcentage: data.pourcentage, minutesRestantes: data.minutes_restantes });
    } else if (type === "sauvegarde.terminee") {
      setProgressionSauvegarde(null);
      SauvegardeApi.listerHistorique().then((r) => setHistoriqueSauvegardes(r.historique || [])).catch(() => { });
    }
  }, [sauvegardeEvent]);

  useEffect(() => {
    if (!verificationManuelleEvent) return;
    const { type, data } = verificationManuelleEvent;
    if (type === "verification.revue_manuelle.created") {
      setDemandesRevueManuelle((liste) => (liste.some((d) => d.id === data.id) ? liste : [...liste, data]));
    } else if (type === "verification.revue_manuelle.traitee") {
      setDemandesRevueManuelle((liste) => liste.filter((d) => d.id !== data.id));
    }
  }, [verificationManuelleEvent]);

  // approuve/rejette une demande KYC en revue manuelle 
  const traiterDemandeRevueManuelle = async (demande, decision) => {
    const confirmKey = decision === "approuver" ? "admin.dashboard.verif.confirmApprove" : "admin.dashboard.verif.confirmReject";
    if (!(await demanderConfirmation(t(confirmKey), { danger: decision === "rejeter" }))) return;
    setDecisionRevueManuelleEnCoursId(demande.id);
    setErreurRevueManuelle(null);
    try {
      await AuthentificationApi.traiterDemandeRevueManuelleAdmin(demande.id, decision, motifRevueManuelle);
      // succès : le retire de sa propre file (le WS "verification.revue_manuelle.traitee"
      // se charge de le retirer des AUTRES admins connectés)
      setDemandesRevueManuelle((liste) => liste.filter((d) => d.id !== demande.id));
      setDemandeRevueManuelleOuverte(null);
      setMotifRevueManuelle("");
    } catch (err) {
      setErreurRevueManuelle(err.message);
    } finally {
      setDecisionRevueManuelleEnCoursId(null);
    }
  };

  const chargerSignalements = () => {
    if (!isAdmin) return;
    setChargementSignalements(true);
    ProduitsApi.listerSignalementsAdmin()
      .then((res) => setSignalements(res.signalements || []))
      .catch((err) => setErreurSignalements(err.message))
      .finally(() => setChargementSignalements(false));
  };
  useEffect(chargerSignalements, [isAdmin]);

  const chargerSignalementsTraites = () => {
    if (!isAdmin) return;
    setChargementSignalementsTraites(true);
    ProduitsApi.listerSignalementsTraites()
      .then((res) => setSignalementsTraites(res.signalements || []))
      .catch(() => { })
      .finally(() => setChargementSignalementsTraites(false));
  };
  useEffect(chargerSignalementsTraites, [isAdmin]);

  const chargerSignalementsVendeurs = () => {
    if (!isAdmin) return;
    setChargementSignalementsVendeurs(true);
    ProduitsApi.listerSignalementsVendeursAdmin()
      .then((res) => setSignalementsVendeurs(res.signalements || []))
      .catch((err) => setErreurSignalementsVendeurs(err.message))
      .finally(() => setChargementSignalementsVendeurs(false));
  };
  useEffect(chargerSignalementsVendeurs, [isAdmin]);

  const chargerSignalementsVendeursTraites = () => {
    if (!isAdmin) return;
    setChargementSignalementsVendeursTraites(true);
    ProduitsApi.listerSignalementsVendeursTraites()
      .then((res) => setSignalementsVendeursTraites(res.signalements || []))
      .catch(() => { })
      .finally(() => setChargementSignalementsVendeursTraites(false));
  };
  useEffect(chargerSignalementsVendeursTraites, [isAdmin]);

  const chargerSignalementsMessages = () => {
    if (!isAdmin) return;
    setChargementSignalementsMessages(true);
    MessagerieApi.listerSignalementsMessagesAdmin()
      .then((res) => setSignalementsMessages(res.signalements || []))
      .catch((err) => setErreurSignalementsMessages(err.message))
      .finally(() => setChargementSignalementsMessages(false));
  };
  useEffect(chargerSignalementsMessages, [isAdmin]);

  const chargerSignalementsMessagesTraites = () => {
    if (!isAdmin) return;
    setChargementSignalementsMessagesTraites(true);
    MessagerieApi.listerSignalementsMessagesTraites()
      .then((res) => setSignalementsMessagesTraites(res.signalements || []))
      .catch(() => { })
      .finally(() => setChargementSignalementsMessagesTraites(false));
  };
  useEffect(chargerSignalementsMessagesTraites, [isAdmin]);

  const chargerSignalementsAvis = () => {
    if (!isAdmin) return;
    setChargementSignalementsAvis(true);
    ProduitsApi.listerSignalementsAvisAdmin()
      .then((res) => setSignalementsAvis(res.signalements || []))
      .catch((err) => setErreurSignalementsAvis(err.message))
      .finally(() => setChargementSignalementsAvis(false));
  };
  useEffect(chargerSignalementsAvis, [isAdmin]);

  const chargerSignalementsAvisTraites = () => {
    if (!isAdmin) return;
    setChargementSignalementsAvisTraites(true);
    ProduitsApi.listerSignalementsAvisTraites()
      .then((res) => setSignalementsAvisTraites(res.signalements || []))
      .catch(() => { })
      .finally(() => setChargementSignalementsAvisTraites(false));
  };
  useEffect(chargerSignalementsAvisTraites, [isAdmin]);

  // liste des comptes admin — super admin (vue complète) OU admin à droits
  // limités possédant gestion_mots_de_passe. 
  const chargerAdmins = () => {
    if (!estSuperAdmin && !aLeDroit("gestion_mots_de_passe")) return;
    setChargementAdmins(true);
    AuthentificationApi.listerAdmins()
      .then((res) => setAdmins(res.admins || []))
      .catch((err) => setErreurAdmins(err.message))
      .finally(() => setChargementAdmins(false));
  };
  useEffect(chargerAdmins, [droits]);

  // configuration + historique des sauvegardes — réservés au droit
  // gestion_sauvegardes.
  const chargerConfigEtHistoriqueSauvegardes = () => {
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
  };
  useEffect(chargerConfigEtHistoriqueSauvegardes, [droits]);

  // rattrapage après une coupure WebSocket. 
  const reconnectedAt = useGlobalStore((s) => s.reconnectedAt);
  useEffect(() => {
    if (!reconnectedAt) return;
    if (isAdmin) chargerDonnees();
    chargerStatsVuesAdmin();
    chargerUtilisateursAdmin();
    chargerDemandesAdministrativesAdmin();
    chargerMessagesSupportEnAttente();
    chargerMessagesSupportRepondus();
    chargerDemandesRevueManuelle();
    chargerSignalements();
    chargerSignalementsTraites();
    chargerSignalementsVendeurs();
    chargerSignalementsVendeursTraites();
    chargerSignalementsMessages();
    chargerSignalementsMessagesTraites();
    chargerSignalementsAvis();
    chargerSignalementsAvisTraites();
    chargerAdmins();
    chargerConfigEtHistoriqueSauvegardes();
  }, [reconnectedAt]);

  useEffect(() => {
    if (!messageAdminEvent) return;
    const { type, data } = messageAdminEvent;
    if (type === "message_admin.created") {
      setMessagesSupport((liste) => (liste.some((m) => m.id === data.id) ? liste : [...liste, data]));
    } else if (type === "message_admin.repondu") {
      setMessagesSupport((liste) => liste.filter((m) => m.id !== data.id));
    }
  }, [messageAdminEvent]);

  useEffect(() => {
    if (!signalementEvent) return;
    const { type, data } = signalementEvent;
    if (type === "signalement.created") {
      setSignalements((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement.traite") {
      setSignalements((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementEvent]);

  useEffect(() => {
    if (!signalementVendeurEvent) return;
    const { type, data } = signalementVendeurEvent;
    if (type === "signalement_vendeur.created") {
      setSignalementsVendeurs((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_vendeur.traite") {
      setSignalementsVendeurs((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementVendeurEvent]);

  useEffect(() => {
    if (!signalementMessageEvent) return;
    const { type, data } = signalementMessageEvent;
    if (type === "signalement_message.created") {
      setSignalementsMessages((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_message.traite") {
      setSignalementsMessages((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementMessageEvent]);

  useEffect(() => {
    if (!signalementAvisEvent) return;
    const { type, data } = signalementAvisEvent;
    if (type === "signalement_avis.created") {
      setSignalementsAvis((liste) => (liste.some((s) => s.id === data.id) ? liste : [...liste, data]));
    } else if (type === "signalement_avis.traite") {
      setSignalementsAvis((liste) => liste.filter((s) => s.id !== data.id));
    }
  }, [signalementAvisEvent]);

  useEffect(() => {
    if (isAdmin) setMessagesSupportEnAttenteBadge(messagesSupport.length);
  }, [messagesSupport.length, isAdmin, setMessagesSupportEnAttenteBadge]);

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

  useEffect(() => {
    if (!utilisateurEvent) return;
    const estAdmin = utilisateurEvent.data?.role === "admin";
    if (utilisateurEvent.type === "utilisateur.deleted" || estAdmin) {
      setAdmins((liste) => applyListEvent(liste, utilisateurEvent));
    }
  }, [utilisateurEvent]);

  useEffect(() => {
    if (!profilEvent || profilEvent.type !== "profil.updated") return;
    const { user_id, role } = profilEvent.data;
    if (role === undefined) return;
    setUtilisateurs((liste) => liste.map((u) => (u.id === user_id ? { ...u, role } : u)));
  }, [profilEvent]);

  useEffect(() => {
    setStats((s) => {
      if (!s) return s;
      return {
        ...s,
        utilisateurs: {
          ...s.utilisateurs,
          vendeurs: utilisateurs.filter((u) => u.role === "vendeur").length,
          acheteurs: utilisateurs.filter((u) => u.role === "acheteur").length,
          bloques: utilisateurs.filter((u) => u.est_bloquer).length,
          admins: admins.length,
        },
      };
    });
  }, [utilisateurs, admins]);

  const entrepriseEvent = useGlobalStore((s) => s.entrepriseEvent);
  useEffect(() => {
    if (!entrepriseEvent || entrepriseEvent.type !== "entreprise.created") return;
    setStats((s) => (s ? { ...s, entreprises: { ...s.entreprises, total: s.entreprises.total + 1 } } : s));
  }, [entrepriseEvent]);

  const toggleBloquer = async (utilisateur) => {

    let raison = null;
    if (!utilisateur.est_bloquer) {
      raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
      if (raison === null) return;
    }
    const msg = t("admin.dashboard.confirmBlockUser").replace("{nom}", `${utilisateur.prenom} ${utilisateur.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBloquageEnCours(utilisateur.id);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(utilisateur.id, raison);
      const nouvelEtat = !utilisateur.est_bloquer;
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === utilisateur.id ? { ...u, est_bloquer: nouvelEtat } : u))
      );

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

  const soumettreReponseSupport = async (messageSupport) => {
    const texte = (reponsesBrouillon[messageSupport.id] || "").trim();
    if (!texte) return;
    setReponseEnCoursId(messageSupport.id);
    setErreurSupport(null);
    try {

      const res = await MessagerieApi.repondreMessageAdmin(messageSupport.id, texte);

      setMessagesSupport((liste) => liste.filter((m) => m.id !== messageSupport.id));
      setMessagesSupportRepondus((liste) => [res.message_admin, ...liste]);
      setReponsesBrouillon((b) => {
        const copie = { ...b };
        delete copie[messageSupport.id];
        return copie;
      });
    } catch (err) {

      setErreurSupport(err.message);
      setMessagesSupport((liste) => liste.filter((m) => m.id !== messageSupport.id));
    } finally {
      setReponseEnCoursId(null);
    }
  };

  const traiterUnSignalement = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmMarkRead")))) return;
    const ids = groupe.map((s) => s.id);
    setTraitementEnCoursId(groupe[0].id);
    setErreurSignalements(null);
    try {
      const res = await ProduitsApi.traiterSignalement(ids, raison);

      setSignalements((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsTraites((liste) => [...res.signalements, ...liste]);
    } catch (err) {
      setErreurSignalements(err.message);
      setSignalements((liste) => liste.filter((s) => !ids.includes(s.id)));
    } finally {
      setTraitementEnCoursId(null);
    }
  };

  const desactiverUnProduitDepuisSignalement = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDisableProduct"), { danger: true }))) return;
    const ids = groupe.map((s) => s.id);
    const produitId = groupe[0].produit_id;
    setDesactivationProduitEnCoursId(groupe[0].id);
    setErreurSignalements(null);
    try {
      const res = await ProduitsApi.desactiverProduitAdmin(produitId, raison);
      setProduits((liste) => liste.map((p) => (p.id === produitId ? res.produit : p)));
      const resTraiter = await ProduitsApi.traiterSignalement(ids, raison);
      setSignalements((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsTraites((liste) => [...resTraiter.signalements, ...liste]);
    } catch (err) {
      setErreurSignalements(err.message);
    } finally {
      setDesactivationProduitEnCoursId(null);
    }
  };

  const traiterUnSignalementVendeur = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmMarkRead")))) return;
    const ids = groupe.map((s) => s.id);
    setTraitementVendeurEnCoursId(groupe[0].id);
    setErreurSignalementsVendeurs(null);
    try {
      const res = await ProduitsApi.traiterSignalementVendeur(ids, raison);

      setSignalementsVendeurs((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsVendeursTraites((liste) => [...res.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsVendeurs(err.message);
      setSignalementsVendeurs((liste) => liste.filter((s) => !ids.includes(s.id)));
    } finally {
      setTraitementVendeurEnCoursId(null);
    }
  };

  const bloquerVendeurDepuisSignalementVendeur = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    const msg = t("admin.dashboard.confirmBlockSeller").replace("{nom}", groupe[0].vendeur_nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    const ids = groupe.map((s) => s.id);
    const vendeurId = groupe[0].vendeur_id;
    setBlocageVendeurDepuisRapportEnCoursId(groupe[0].id);
    setErreurSignalementsVendeurs(null);
    try {
      await AuthentificationApi.bloquerDepuisSignalementAdmin(vendeurId, raison);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === vendeurId ? { ...u, est_bloquer: true } : u))
      );
      const resTraiter = await ProduitsApi.traiterSignalementVendeur(ids, raison);
      setSignalementsVendeurs((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsVendeursTraites((liste) => [...resTraiter.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsVendeurs(err.message);
    } finally {
      setBlocageVendeurDepuisRapportEnCoursId(null);
    }
  };

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

  const traiterUnSignalementMessage = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmMarkRead")))) return;
    const ids = groupe.map((s) => s.id);
    setTraitementMessageEnCoursId(groupe[0].id);
    setErreurSignalementsMessages(null);
    try {
      const res = await MessagerieApi.traiterSignalementMessage(ids, raison);

      setSignalementsMessages((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsMessagesTraites((liste) => [...res.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsMessages(err.message);
      setSignalementsMessages((liste) => liste.filter((s) => !ids.includes(s.id)));
    } finally {
      setTraitementMessageEnCoursId(null);
    }
  };

  // bloque le compte de l'expéditeur du message signalé 
  const bloquerUtilisateurDepuisSignalementMessage = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    const msg = t("admin.dashboard.confirmBlockUser").replace("{nom}", groupe[0].message_expediteur_nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    const ids = groupe.map((s) => s.id);
    const expediteurId = groupe[0].message_expediteur_id;
    setBlocageUtilisateurMessageEnCoursId(groupe[0].id);
    setErreurSignalementsMessages(null);
    try {
      await AuthentificationApi.bloquerDepuisSignalementAdmin(expediteurId, raison);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === expediteurId ? { ...u, est_bloquer: true } : u))
      );
      const resTraiter = await MessagerieApi.traiterSignalementMessage(ids, raison);
      setSignalementsMessages((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsMessagesTraites((liste) => [...resTraiter.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsMessages(err.message);
    } finally {
      setBlocageUtilisateurMessageEnCoursId(null);
    }
  };

  const traiterUnSignalementAvis = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmMarkRead")))) return;
    const ids = groupe.map((s) => s.id);
    setTraitementAvisEnCoursId(groupe[0].id);
    setErreurSignalementsAvis(null);
    try {
      const res = await ProduitsApi.traiterSignalementAvis(ids, raison);

      setSignalementsAvis((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsAvisTraites((liste) => [...res.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsAvis(err.message);
      setSignalementsAvis((liste) => liste.filter((s) => !ids.includes(s.id)));
    } finally {
      setTraitementAvisEnCoursId(null);
    }
  };

  // supprime définitivement l'avis signalé 
  const supprimerUnAvisSignale = async (groupe) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDeleteReview"), { danger: true }))) return;
    const ids = groupe.map((s) => s.id);
    const avisId = groupe[0].avis_id;
    setSuppressionAvisSignaleEnCoursId(groupe[0].id);
    setErreurSignalementsAvis(null);
    try {
      await ProduitsApi.supprimerAvis(avisId, raison);
      const resTraiter = await ProduitsApi.traiterSignalementAvis(ids, raison);
      setSignalementsAvis((liste) => liste.filter((s) => !ids.includes(s.id)));
      setSignalementsAvisTraites((liste) => [...resTraiter.signalements, ...liste]);
    } catch (err) {
      setErreurSignalementsAvis(err.message);
    } finally {
      setSuppressionAvisSignaleEnCoursId(null);
    }
  };

  // ── Historiques admin : sélection multiple + suppression ─────

  const toggleSelectionHistoriqueSupport = creerToggleSelection(setSelectionHistoriqueSupport);
  const toggleSelectionGroupeHistoriqueSupport = creerToggleSelectionGroupe(setSelectionHistoriqueSupport);
  const supprimerHistoriqueSupportSelectionne = async () => {
    if (selectionHistoriqueSupport.size === 0) return;
    const msg = t("admin.dashboard.confirmDeleteSupportHistory").replace("{n}", selectionHistoriqueSupport.size);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionHistoriqueSupportEnCours(true);
    setErreurSupport(null);
    try {
      const ids = Array.from(selectionHistoriqueSupport);
      await MessagerieApi.supprimerHistoriqueMessagesSupport(ids);
      setMessagesSupportRepondus((liste) => liste.filter((m) => !selectionHistoriqueSupport.has(m.id)));
      setSelectionHistoriqueSupport(new Set());
    } catch (err) {
      setErreurSupport(err.message);
    } finally {
      setSuppressionHistoriqueSupportEnCours(false);
    }
  };
  const historiqueSupportParDate = useMemo(() => regrouperParDate(messagesSupportRepondus, "date_reponse"), [messagesSupportRepondus]);

  const toggleSelectionHistoriqueSignalements = creerToggleSelection(setSelectionHistoriqueSignalements);
  const toggleSelectionGroupeHistoriqueSignalements = creerToggleSelectionGroupe(setSelectionHistoriqueSignalements);
  const supprimerHistoriqueSignalementsSelectionne = async () => {
    if (selectionHistoriqueSignalements.size === 0) return;
    const msg = t("admin.dashboard.confirmDeleteReportHistory").replace("{n}", selectionHistoriqueSignalements.size);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionHistoriqueSignalementsEnCours(true);
    setErreurSignalements(null);
    try {
      const ids = Array.from(selectionHistoriqueSignalements);
      await ProduitsApi.supprimerHistoriqueSignalements(ids);
      setSignalementsTraites((liste) => liste.filter((s) => !selectionHistoriqueSignalements.has(s.id)));
      setSelectionHistoriqueSignalements(new Set());
    } catch (err) {
      setErreurSignalements(err.message);
    } finally {
      setSuppressionHistoriqueSignalementsEnCours(false);
    }
  };

  const signalementsGroupes = useMemo(() => regrouperParCible(signalements, "produit_id"), [signalements]);
  const historiqueSignalementsParCible = useMemo(() => regrouperParCible(signalementsTraites, "produit_id"), [signalementsTraites]);

  const toggleSelectionHistoriqueSignalementsVendeurs = creerToggleSelection(setSelectionHistoriqueSignalementsVendeurs);
  const toggleSelectionGroupeHistoriqueSignalementsVendeurs = creerToggleSelectionGroupe(setSelectionHistoriqueSignalementsVendeurs);
  const supprimerHistoriqueSignalementsVendeursSelectionne = async () => {
    if (selectionHistoriqueSignalementsVendeurs.size === 0) return;
    const msg = t("admin.dashboard.confirmDeleteReportHistory").replace("{n}", selectionHistoriqueSignalementsVendeurs.size);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionHistoriqueSignalementsVendeursEnCours(true);
    setErreurSignalementsVendeurs(null);
    try {
      const ids = Array.from(selectionHistoriqueSignalementsVendeurs);
      await ProduitsApi.supprimerHistoriqueSignalementsVendeurs(ids);
      setSignalementsVendeursTraites((liste) => liste.filter((s) => !selectionHistoriqueSignalementsVendeurs.has(s.id)));
      setSelectionHistoriqueSignalementsVendeurs(new Set());
    } catch (err) {
      setErreurSignalementsVendeurs(err.message);
    } finally {
      setSuppressionHistoriqueSignalementsVendeursEnCours(false);
    }
  };
  const signalementsVendeursGroupes = useMemo(() => regrouperParCible(signalementsVendeurs, "vendeur_id"), [signalementsVendeurs]);
  const historiqueSignalementsVendeursParCible = useMemo(() => regrouperParCible(signalementsVendeursTraites, "vendeur_id"), [signalementsVendeursTraites]);

  const toggleSelectionHistoriqueSignalementsMessages = creerToggleSelection(setSelectionHistoriqueSignalementsMessages);
  const toggleSelectionGroupeHistoriqueSignalementsMessages = creerToggleSelectionGroupe(setSelectionHistoriqueSignalementsMessages);
  const supprimerHistoriqueSignalementsMessagesSelectionne = async () => {
    if (selectionHistoriqueSignalementsMessages.size === 0) return;
    const msg = t("admin.dashboard.confirmDeleteReportHistory").replace("{n}", selectionHistoriqueSignalementsMessages.size);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionHistoriqueSignalementsMessagesEnCours(true);
    setErreurSignalementsMessages(null);
    try {
      const ids = Array.from(selectionHistoriqueSignalementsMessages);
      await MessagerieApi.supprimerHistoriqueSignalementsMessages(ids);
      setSignalementsMessagesTraites((liste) => liste.filter((s) => !selectionHistoriqueSignalementsMessages.has(s.id)));
      setSelectionHistoriqueSignalementsMessages(new Set());
    } catch (err) {
      setErreurSignalementsMessages(err.message);
    } finally {
      setSuppressionHistoriqueSignalementsMessagesEnCours(false);
    }
  };
  const signalementsMessagesGroupes = useMemo(() => regrouperParCible(signalementsMessages, "message_id"), [signalementsMessages]);
  const historiqueSignalementsMessagesParCible = useMemo(() => regrouperParCible(signalementsMessagesTraites, "message_id"), [signalementsMessagesTraites]);

  const toggleSelectionHistoriqueSignalementsAvis = creerToggleSelection(setSelectionHistoriqueSignalementsAvis);
  const toggleSelectionGroupeHistoriqueSignalementsAvis = creerToggleSelectionGroupe(setSelectionHistoriqueSignalementsAvis);
  const supprimerHistoriqueSignalementsAvisSelectionne = async () => {
    if (selectionHistoriqueSignalementsAvis.size === 0) return;
    const msg = t("admin.dashboard.confirmDeleteReportHistory").replace("{n}", selectionHistoriqueSignalementsAvis.size);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setSuppressionHistoriqueSignalementsAvisEnCours(true);
    setErreurSignalementsAvis(null);
    try {
      const ids = Array.from(selectionHistoriqueSignalementsAvis);
      await ProduitsApi.supprimerHistoriqueSignalementsAvis(ids);
      setSignalementsAvisTraites((liste) => liste.filter((s) => !selectionHistoriqueSignalementsAvis.has(s.id)));
      setSelectionHistoriqueSignalementsAvis(new Set());
    } catch (err) {
      setErreurSignalementsAvis(err.message);
    } finally {
      setSuppressionHistoriqueSignalementsAvisEnCours(false);
    }
  };
  const signalementsAvisGroupes = useMemo(() => regrouperParCible(signalementsAvis, "avis_id"), [signalementsAvis]);
  const historiqueSignalementsAvisParCible = useMemo(
    () => regrouperParCible(signalementsAvisTraites, (s) => s.avis_id ?? `snap:${s.produit_nom}:${s.auteur_avis_nom}:${s.avis_commentaire}`),
    [signalementsAvisTraites]
  );

  // lève la désactivation automatique d'un produit après 5 signalements
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

  // désactive n'importe quel produit disponible directement 
  const desactiverUnProduitDepuisLaListe = async (produit) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDisableProduct"), { danger: true }))) return;
    setGestionProduitEnCoursId(produit.id);
    setErreurGestionProduits(null);
    try {
      const res = await ProduitsApi.desactiverProduitAdmin(produit.id, raison);
      setProduits((liste) => liste.map((p) => (p.id === produit.id ? res.produit : p)));
    } catch (err) {
      setErreurGestionProduits(err.message);
    } finally {
      setGestionProduitEnCoursId(null);
    }
  };

  // supprime définitivement n'importe quel produit 
  const supprimerUnProduitAdmin = async (produit) => {
    const raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
    if (raison === null) return;
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDeleteProduct"), { danger: true }))) return;
    setGestionProduitEnCoursId(produit.id);
    setErreurGestionProduits(null);
    try {
      await ProduitsApi.supprimerProduitAdmin(produit.id, raison);
      setProduits((liste) => liste.filter((p) => p.id !== produit.id));
    } catch (err) {
      setErreurGestionProduits(err.message);
    } finally {
      setGestionProduitEnCoursId(null);
    }
  };

  const ouvrirFormulaireEdition = (categorie) => {
    setCategorieEnEdition(categorie.id);
    setFormCategorie({
      nom: categorie.nom,
      nom_ht: categorie.nom_ht || "",
      nom_en: categorie.nom_en || "",
      description: categorie.description || "",
    });
    setCategorieErreur(null);
  };

  const annulerFormulaireCategorie = () => {
    setCategorieEnEdition(null);
    setFormCategorie({ nom: "", nom_ht: "", nom_en: "", description: "" });
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
    setFormSousCategorie({
      nom: sousCategorie.nom,
      nom_ht: sousCategorie.nom_ht || "",
      nom_en: sousCategorie.nom_en || "",
      categorie_id: sousCategorie.categorie_id,
    });
    setSousCategorieErreur(null);
  };

  const annulerFormulaireSousCategorie = () => {
    setSousCategorieEnEdition(null);
    setFormSousCategorie({ nom: "", nom_ht: "", nom_en: "", categorie_id: "" });
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
      const payload = {
        nom: formSousCategorie.nom,
        nom_ht: formSousCategorie.nom_ht,
        nom_en: formSousCategorie.nom_en,
        categorie_id: Number(formSousCategorie.categorie_id),
      };
      if (sousCategorieEnEdition) {
        const res = await ProduitsApi.modifierSousCategorie({ id: sousCategorieEnEdition, ...payload });
        setSousCategories((liste) => liste.map((sc) => (sc.id === sousCategorieEnEdition ? res.sous_categorie : sc)));
      } else {
        const res = await ProduitsApi.creerSousCategorie(payload);
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

  // accès réservé aux admins et profil non encore chargé 
  if (profil && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const tuiles = stats && [
    { icon: Users, label: t("admin.dashboard.users"), value: stats.utilisateurs.total, couleur: "vert" },
    { icon: ShieldCheck, label: t("admin.dashboard.sellers"), value: stats.utilisateurs.vendeurs, couleur: "or" },
    { icon: Ban, label: t("admin.dashboard.blocked"), value: stats.utilisateurs.bloques, couleur: "rouge" },
    { icon: Building2, label: t("admin.dashboard.companies"), value: stats.entreprises.total, couleur: "ardoise" },
    { icon: CheckCircle2, label: t("admin.dashboard.verifiedRequests"), value: stats.verifications.verifiees, couleur: "terracotta" },
    { icon: Package, label: t("admin.dashboard.products"), value: stats.produits.total, couleur: "foret" },
    ...(estSuperAdmin ? [
      { icon: FileText, label: t("admin.dashboard.verif.listTitle"), value: demandesRevueManuelle.length, couleur: "or" },
    ] : []),
  ];

  // données des 3 graphiques du tableau de bord 
  const donneesComptesParType = stats && [
    { label: t("admin.dashboard.roleBuyers"), value: stats.utilisateurs.acheteurs },
    { label: t("admin.dashboard.sellers"), value: stats.utilisateurs.vendeurs },
    { label: t("admin.dashboard.roleAdmins"), value: stats.utilisateurs.admins },
  ].filter((d) => d.value > 0);
  const COULEURS_COMPTES = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)"];

  const donneesProduitsParSousCategorie = stats?.produits.par_sous_categorie?.map((c) => ({
    label: nomLocalise(c, lang), value: c.nombre_produits,
  })) || [];

  const donneesProduitsConsultes = stats?.produits.plus_consultes?.map((p) => ({
    label: p.nom, value: p.nombre_vues,
  })) || [];

  const totalAlertes = messagesSupport.length + signalements.length + signalementsVendeurs.length
    + signalementsMessages.length + signalementsAvis.length;

  // ── Gestion des ADMs ───
  const ouvrirCreationAdmin = () => {
    setFormAdmin({ nom: "", prenom: "", email: "", telephone: "", mot_de_passe: "", ...Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, false])) });
    setErreurFormAdmin(null);
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

    setAdminEnCours(true);
    try {
      const res = await AuthentificationApi.creerAdmin(formAdmin);
      setAdmins((liste) => [...liste, res.admin]);
      setFormulaireAdminOuvert(false);
    } catch (err) {
      setErreurFormAdmin(err.message);
    } finally {
      setAdminEnCours(false);
    }
  };

  const ouvrirEditionDroits = (admin) => {
    setDroitsEnEditionId(admin.id);
    setFormDroitsEdition({
      ...Object.fromEntries(DROITS_ASSIGNABLES.map((d) => [d, admin.droits?.[d] || false])),
      ...(estProprietaire ? { super_admin: admin.droits?.super_admin || false } : {}),
    });
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

  const toggleBloquerAdmin = async (admin) => {
    let raison = null;
    if (!admin.est_bloquer) {
      raison = await demanderRaison(t("admin.dashboard.reasonPrompt"));
      if (raison === null) return;
    }
    const msg = t("admin.dashboard.confirmBlockUser").replace("{nom}", `${admin.prenom} ${admin.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBlocageAdminEnCoursId(admin.id);
    setErreurAdmins(null);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(admin.id, raison);
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

  const dateAujourdhui = formatDateLocale(new Date());

  const appliquerRaccourciPeriode = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    setRapportDateDebut(formatDateLocale(debut));
    setRapportDateFin(formatDateLocale(fin));
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

  const appliquerRaccourciPeriodeSupport = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    setRapportSupportDateDebut(formatDateLocale(debut));
    setRapportSupportDateFin(formatDateLocale(fin));
  };

  const telechargerRapportSupport = async () => {
    if (!rapportSupportDateDebut || !rapportSupportDateFin) {
      setErreurRapportSupport(t("admin.dashboard.adms.rapportDatesRequired"));
      return;
    }
    setErreurRapportSupport(null);
    setRapportSupportEnCours(true);
    try {
      const blob = await MessagerieApi.genererRapportSupport(rapportSupportDateDebut, rapportSupportDateFin, rapportSupportAdminId || undefined);
      const heure = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
      const nomFichier = `Report-Audit-Support-${rapportSupportDateDebut}-${rapportSupportDateFin}-${heure}.pdf`;
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreurRapportSupport(err.message);
    } finally {
      setRapportSupportEnCours(false);
    }
  };

  const appliquerRaccourciPeriodeSignalements = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    setRapportSignalementsDateDebut(formatDateLocale(debut));
    setRapportSignalementsDateFin(formatDateLocale(fin));
  };

  const telechargerRapportSignalements = async () => {
    if (!rapportSignalementsDateDebut || !rapportSignalementsDateFin) {
      setErreurRapportSignalements(t("admin.dashboard.adms.rapportDatesRequired"));
      return;
    }
    setErreurRapportSignalements(null);
    setRapportSignalementsEnCours(true);
    try {
      const blob = await ProduitsApi.genererRapportSignalements(rapportSignalementsDateDebut, rapportSignalementsDateFin, rapportSignalementsAdminId || undefined);
      const heure = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
      const nomFichier = `Report-Audit-Signalements-${rapportSignalementsDateDebut}-${rapportSignalementsDateFin}-${heure}.pdf`;
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreurRapportSignalements(err.message);
    } finally {
      setRapportSignalementsEnCours(false);
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

      if (res.historique.destination === "locale" && res.historique.statut === "succes") {
        telechargerSauvegarde(res.historique);
      }
    } catch (err) {
      setErreurSauvegarde(err.message);
      SauvegardeApi.listerHistorique().then((r) => setHistoriqueSauvegardes(r.historique || [])).catch(() => { });
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

  const historiqueParDate = useMemo(() => {
    const groupes = new Map();
    for (const h of historiqueSauvegardes) {
      const cle = new Date(h.date_execution).toLocaleDateString();
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(h);
    }
    return Array.from(groupes.entries());
  }, [historiqueSauvegardes]);

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
      SauvegardeApi.listerHistorique().then((r) => setHistoriqueSauvegardes(r.historique || [])).catch(() => { });
    } catch (err) {
      setErreurRestauration(err.message);
    } finally {
      setRestaurationEnCours(false);
    }
  };

  const onglets = [
    { id: "overview", label: t("admin.dashboard.tabOverview"), icon: LayoutDashboard },
    { id: "produits", label: t("admin.dashboard.tabProducts"), icon: Package },
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
    ...(estSuperAdmin ? [
      { id: "kyc", label: t("admin.dashboard.verif.tabTitle"), icon: FileText, badge: demandesRevueManuelle.length },
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
              <LogOut size={24} />
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
            <Language />

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
                    <User size={24} />
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

          {loading && <p className="admin-field-value">{t("auth.loading")}</p>}
          {error && <p className="admin-error"><XCircle size={20} /> {error}</p>}

          {!loading && !error && activeTab === "overview" && (
            <>
              {stats && (
                <section className="admin-stats-grid">
                  {tuiles.map(({ icon: Icon, label, value, couleur }) => (
                    <div className="admin-stat-card" key={label}>
                      <div className={`admin-stat-card__icon admin-stat-card__icon--${couleur}`}><Icon size={24} /></div>
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
                      <FrequencyChart data={donneesProduitsConsultes} color="var(--chart-series-2)" />
                    )}
                  </div>
                </section>
              )}

              <div className="admin-card">
                <div className="admin-card__header-row">
                  <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.viewsStatsTitleGlobal")}</h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeVuesAdmin(7)}>
                      {t("admin.dashboard.periodWeek")}
                    </button>
                    <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeVuesAdmin(30)}>
                      {t("admin.dashboard.periodMonth")}
                    </button>
                    <input
                      type="date" className="admin-input" value={statsVuesAdminDateDebut}
                      max={statsVuesAdminDateFin} onChange={(e) => setStatsVuesAdminDateDebut(e.target.value)}
                    />
                    <input
                      type="date" className="admin-input" value={statsVuesAdminDateFin}
                      min={statsVuesAdminDateDebut} max={dateAujourdhuiVuesAdmin} onChange={(e) => setStatsVuesAdminDateFin(e.target.value)}
                    />
                  </div>
                </div>

                {erreurStatsVuesAdmin && <p className="admin-error"><XCircle size={20} /> {erreurStatsVuesAdmin}</p>}
                {chargementStatsVuesAdmin && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementStatsVuesAdmin && !erreurStatsVuesAdmin && statsVuesAdmin && (
                  <section className="admin-charts-grid">
                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("admin.dashboard.chartProfileViewsOverTimeTitleGlobal")}</h3>
                      <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartProfileViewsOverTimeSubtitleGlobal")}</p>
                      {statsVuesAdmin.profil.total === 0 ? (
                        <p className="admin-chart-card__empty">{t("admin.dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <LineChart
                          data={statsVuesAdmin.profil.serie_temporelle.map((p) => ({ label: p.date, value: p.value }))}
                          color="var(--chart-series-1)"
                        />
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("admin.dashboard.topVendorsViewedTitle")}</h3>
                      <p className="admin-chart-card__subtitle">{t("admin.dashboard.topVendorsViewedSubtitle")}</p>
                      {statsVuesAdmin.profil.top_vendeurs.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("admin.dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <HistogramChart data={statsVuesAdmin.profil.top_vendeurs} color="var(--chart-series-2)" />
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("admin.dashboard.chartTopProductsViewedTitleGlobal")}</h3>
                      <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartTopProductsViewedSubtitleGlobal")}</p>
                      {statsVuesAdmin.produits_plus_consultes.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("admin.dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <HistogramChart data={statsVuesAdmin.produits_plus_consultes} color="var(--chart-series-3)" />
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("admin.dashboard.chartTopCategoriesViewedTitleGlobal")}</h3>
                      <p className="admin-chart-card__subtitle">{t("admin.dashboard.chartTopCategoriesViewedSubtitleGlobal")}</p>
                      {donneesCategoriesVuesAdmin.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("admin.dashboard.noViewsThisPeriod")}</p>
                      ) : donneesCategoriesVuesAdmin.length <= 3 ? (
                        <DonutChart data={donneesCategoriesVuesAdmin} colors={["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)"]} />
                      ) : (
                        <HistogramChart data={donneesCategoriesVuesAdmin} color="var(--chart-series-1)" />
                      )}
                    </div>
                  </section>
                )}
              </div>

            </>
          )}

          {!loading && !error && activeTab === "utilisateurs" && aLeDroit("gestion_utilisateurs") && (
            <div className="admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title admin-card__title--accent">
                  {t("admin.dashboard.usersListTitle")}
                </h3>
                <button
                  type="button"
                  className="admin-card__toggle-btn"
                  onClick={() => setComptesOuvert((o) => !o)}
                  aria-expanded={comptesOuvert}
                >
                  {comptesOuvert ? t("admin.dashboard.hideList") : t("admin.dashboard.showList")}
                  <ChevronDown
                    size={16}
                    className={`admin-card__toggle-chevron${comptesOuvert ? " admin-card__toggle-chevron--ouvert" : ""}`}
                  />
                </button>
              </div>

              {comptesOuvert && (
                <>
                  <div className="admin-filter-bar">
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-comptes-date-debut">{t("admin.dashboard.filterDateFrom")}</label>
                      <input
                        id="filtre-comptes-date-debut"
                        type="date"
                        value={filtreComptesDateDebut}
                        onChange={(e) => setFiltreComptesDateDebut(e.target.value)}
                      />
                    </div>
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-comptes-date-fin">{t("admin.dashboard.filterDateTo")}</label>
                      <input
                        id="filtre-comptes-date-fin"
                        type="date"
                        value={filtreComptesDateFin}
                        onChange={(e) => setFiltreComptesDateFin(e.target.value)}
                      />
                    </div>
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-comptes-statut">{t("admin.dashboard.filterStatus")}</label>
                      <select
                        id="filtre-comptes-statut"
                        value={filtreComptesStatut}
                        onChange={(e) => setFiltreComptesStatut(e.target.value)}
                      >
                        <option value="">{t("admin.dashboard.filterStatusAll")}</option>
                        <option value="acheteur">{t("admin.dashboard.roleBuyers")}</option>
                        <option value="vendeur">{t("admin.dashboard.sellers")}</option>
                      </select>
                    </div>
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-comptes-nom">{t("admin.dashboard.filterName")}</label>
                      <input
                        id="filtre-comptes-nom"
                        type="text"
                        value={filtreComptesNom}
                        onChange={(e) => setFiltreComptesNom(e.target.value)}
                        placeholder={t("admin.dashboard.filterName")}
                      />
                    </div>
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-comptes-prenom">{t("admin.dashboard.filterFirstName")}</label>
                      <input
                        id="filtre-comptes-prenom"
                        type="text"
                        value={filtreComptesPrenom}
                        onChange={(e) => setFiltreComptesPrenom(e.target.value)}
                        placeholder={t("admin.dashboard.filterFirstName")}
                      />
                    </div>
                    {filtresComptesActifs && (
                      <button type="button" className="admin-filter-bar__reset" onClick={reinitialiserFiltresComptes}>
                        <X size={14} />
                        {t("admin.dashboard.resetFilters")}
                      </button>
                    )}
                  </div>

                  {erreurReactivationVendeur && <p className="admin-error"><XCircle size={20} /> {erreurReactivationVendeur}</p>}
                  {erreurUtilisateurs && <p className="admin-error"><XCircle size={20} /> {erreurUtilisateurs}</p>}

                  {utilisateursFiltres.length === 0 ? (
                    <p className="admin-field-value">
                      {filtresComptesActifs ? t("admin.dashboard.noUsersMatchFilters") : t("admin.dashboard.noUsers")}
                    </p>
                  ) : (
                    <ul className="admin-item-list">
                      {utilisateursFiltres.map((u) => (
                        <li className="admin-item" key={u.id}>
                          <div className="admin-item__avatar">

                            {u.est_entreprise
                              ? (u.nom?.slice(0, 2) || "").toUpperCase()
                              : `${(u.prenom?.[0] || "").toUpperCase()}${(u.nom?.[0] || "").toUpperCase()}`}
                          </div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">{u.est_entreprise ? u.nom : `${u.prenom} ${u.nom}`}</p>
                            <p className="admin-item__contact">{u.email} — {u.telephone}</p>
                            <p className="admin-item__contact">
                              {t("admin.dashboard.createdOn")} {new Date(u.date_inscription).toLocaleDateString()}
                            </p>
                          </div>

                          <span className={`admin-tag ${u.est_entreprise ? "admin-tag--entreprise" : "admin-tag--individuel"}`}>
                            {u.est_entreprise ? t("admin.dashboard.companyBadge") : t("admin.dashboard.individualBadge")}
                          </span>
                          <span className="admin-tag">
                            {u.role === "acheteur" ? t("admin.dashboard.roleBuyers") : u.role === "vendeur" ? t("admin.dashboard.sellers") : u.role}
                          </span>
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

                          {u.id !== utilisateur?.id && (
                            <button
                              className={`admin-action-btn ${u.est_bloquer ? "admin-action-btn--secondary" : "admin-btn--danger"}`}
                              disabled={bloquageEnCours === u.id}
                              onClick={() => toggleBloquer(u)}
                            >
                              {u.est_bloquer ? t("admin.dashboard.unblock") : t("admin.dashboard.block")}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && !error && activeTab === "utilisateurs" && aLeDroit("gestion_utilisateurs") && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.administrativeRequestsTitle")}
              </h3>

              {erreurDemandesAdministratives && <p className="admin-error"><XCircle size={20} /> {erreurDemandesAdministratives}</p>}

              {demandesAdministratives.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noAdministrativeRequests")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {demandesAdministratives.map((d) => (
                    <li className="admin-support-item" key={d.id}>
                      <div className="admin-support-item__entete">
                        <div className="admin-item__avatar">
                          <FileText size={18} />
                        </div>
                        <div className="admin-item__info">
                          <p className="admin-item__name">{d.objet}</p>
                          <p className="admin-item__contact">{d.utilisateur_nom} — {d.utilisateur_email}</p>
                        </div>
                        {d.compte_supprime && (
                          <span className="admin-tag admin-badge--blocked" title={t("admin.dashboard.deletedAccountHint")}>
                            {t("admin.dashboard.deletedAccountBadge")}
                          </span>
                        )}
                        <span className="admin-tag">{new Date(d.date_creation).toLocaleString()}</span>
                      </div>
                      <p className="admin-support-item__contenu">{d.description}</p>
                      <div className="admin-support-item__reponse">
                        <button
                          className="admin-action-btn admin-btn--danger"
                          disabled={decisionDemandeEnCoursId === d.id}
                          onClick={() => rejeterDemande(d)}
                        >
                          <Ban size={16} />
                          {t("admin.dashboard.rejectRequest")}
                        </button>
                        <button
                          className="admin-action-btn admin-action-btn--primary"
                          disabled={decisionDemandeEnCoursId === d.id}
                          onClick={() => approuverDemande(d)}
                        >
                          <CheckCircle2 size={16} />
                          {t("admin.dashboard.approveRequest")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loading && !error && activeTab === "produits" && (
            <div className="admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title admin-card__title--accent">
                  {t("admin.dashboard.productsListTitle")}
                </h3>
                <button
                  type="button"
                  className="admin-card__toggle-btn"
                  onClick={() => setProduitsOuvert((o) => !o)}
                  aria-expanded={produitsOuvert}
                >
                  {produitsOuvert ? t("admin.dashboard.hideList") : t("admin.dashboard.showList")}
                  <ChevronDown
                    size={16}
                    className={`admin-card__toggle-chevron${produitsOuvert ? " admin-card__toggle-chevron--ouvert" : ""}`}
                  />
                </button>
              </div>

              {produitsOuvert && (
                <>
                  <div className="admin-filter-bar">
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-produits-dispo">{t("admin.dashboard.filterAvailability")}</label>
                      <select
                        id="filtre-produits-dispo"
                        value={filtreProduitsDisponibilite}
                        onChange={(e) => setFiltreProduitsDisponibilite(e.target.value)}
                      >
                        <option value="">{t("admin.dashboard.filterAvailabilityAll")}</option>
                        <option value="disponible">{t("admin.dashboard.available")}</option>
                        <option value="indisponible">{t("admin.dashboard.unavailable")}</option>
                      </select>
                    </div>
                    <div className="admin-filter-field">
                      <label htmlFor="filtre-produits-nom">{t("admin.dashboard.filterProductName")}</label>
                      <input
                        id="filtre-produits-nom"
                        type="text"
                        value={filtreProduitsNom}
                        onChange={(e) => setFiltreProduitsNom(e.target.value)}
                        placeholder={t("admin.dashboard.filterProductName")}
                      />
                    </div>
                    {filtresProduitsActifs && (
                      <button type="button" className="admin-filter-bar__reset" onClick={reinitialiserFiltresProduits}>
                        <X size={14} />
                        {t("admin.dashboard.resetFilters")}
                      </button>
                    )}
                  </div>

                  {erreurReactivation && <p className="admin-error"><XCircle size={20} /> {erreurReactivation}</p>}
                  {erreurGestionProduits && <p className="admin-error"><XCircle size={20} /> {erreurGestionProduits}</p>}

                  {produitsFiltres.length === 0 ? (
                    <p className="admin-field-value">
                      {filtresProduitsActifs ? t("admin.dashboard.noProductsMatchFilters") : t("admin.dashboard.noProducts")}
                    </p>
                  ) : (
                    <ul className="admin-item-list">
                      {produitsFiltres.map((p) => (
                        <li className="admin-item" key={p.id}>
                          {p.photos?.[0]?.url_photo ? (
                            <img src={p.photos[0].url_photo} alt={p.nom} className="admin-item__avatar" style={{ objectFit: "cover" }} />
                          ) : (
                            <div className="admin-item__avatar"><Package size={18} /></div>
                          )}
                          <div className="admin-item__info">
                            <p className="admin-item__name">{p.nom}</p>
                            <p className="admin-item__contact">
                              {nomLocalise(p.categorie, lang)} — {p.prix ? `${p.prix} ${symboleDevise(p.unitePrix)}` : t("profile.notSpecified")} {p.unite_De_Mesure}
                            </p>
                          </div>
                          <span className={`admin-tag ${p.est_disponible ? "" : "admin-badge--blocked"}`}>
                            {p.est_disponible ? t("admin.dashboard.available") : t("admin.dashboard.unavailable")}
                          </span>
                          {aLeDroit("gestion_signalements") && (
                            <div className="admin-item__actions">
                              {p.est_disponible ? (
                                <button
                                  type="button"
                                  className="admin-action-btn admin-action-btn--secondary"
                                  disabled={gestionProduitEnCoursId === p.id}
                                  onClick={() => desactiverUnProduitDepuisLaListe(p)}
                                >
                                  <Ban size={20} />
                                  {t("admin.dashboard.disableProduct")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-action-btn admin-action-btn--secondary"
                                  disabled={p.vendeur_bloque || reactivationEnCoursId === p.id || gestionProduitEnCoursId === p.id}
                                  title={p.vendeur_bloque ? t("admin.dashboard.reactivateProductSellerBlocked") : undefined}
                                  onClick={() => reactiverUnProduit(p)}
                                >
                                  <ShieldCheck size={20} />
                                  {t("admin.dashboard.reactivateProduct")}
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-action-btn admin-action-btn--danger"
                                disabled={gestionProduitEnCoursId === p.id}
                                onClick={() => supprimerUnProduitAdmin(p)}
                              >
                                <Trash2 size={20} />
                                {t("admin.dashboard.deleteProduct")}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
                    placeholder={t("admin.dashboard.categoryNameHtPlaceholder")}
                    value={formCategorie.nom_ht}
                    onChange={(e) => setFormCategorie((f) => ({ ...f, nom_ht: e.target.value }))}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder={t("admin.dashboard.categoryNameEnPlaceholder")}
                    value={formCategorie.nom_en}
                    onChange={(e) => setFormCategorie((f) => ({ ...f, nom_en: e.target.value }))}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder={t("admin.dashboard.categoryDescriptionPlaceholder")}
                    value={formCategorie.description}
                    onChange={(e) => setFormCategorie((f) => ({ ...f, description: e.target.value }))}
                    className="admin-input"
                  />
                  {categorieErreur && <p className="admin-error"><XCircle size={20} /> {categorieErreur}</p>}
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
                          <Trash2 size={16} color="red" />
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
                      <option key={c.id} value={c.id}>{nomLocalise(c, lang)}</option>
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
                  <input
                    type="text"
                    placeholder={t("admin.dashboard.categoryNameHtPlaceholder")}
                    value={formSousCategorie.nom_ht}
                    onChange={(e) => setFormSousCategorie((f) => ({ ...f, nom_ht: e.target.value }))}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder={t("admin.dashboard.categoryNameEnPlaceholder")}
                    value={formSousCategorie.nom_en}
                    onChange={(e) => setFormSousCategorie((f) => ({ ...f, nom_en: e.target.value }))}
                    className="admin-input"
                  />
                  {sousCategorieErreur && <p className="admin-error"><XCircle size={20} /> {sousCategorieErreur}</p>}
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
                            {nomLocalise(categories.find((c) => c.id === sc.categorie_id), lang) || t("profile.notSpecified")}
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
              <div className="admin-card__header-row">
                <h3 className="admin-card__title admin-card__title--accent">
                  {t("admin.dashboard.supportListTitle")}
                </h3>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => setModalHistoriqueSupportOuvert(true)}>
                  <History size={16} />
                  {t("admin.dashboard.viewHistory")}
                </button>
              </div>

              {erreurSupport && <p className="admin-error"><XCircle size={20} /> {erreurSupport}</p>}
              {chargementSupport && <p className="admin-field-value">{t("auth.loading")}</p>}

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

          {activeTab === "support" && modalHistoriqueSupportOuvert && (
            <div className="admin-modal-overlay" onClick={() => setModalHistoriqueSupportOuvert(false)}>
              <div className="admin-modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__entete">
                  <h3>{estSuperAdmin ? t("admin.dashboard.supportHistoryTitleAll") : t("admin.dashboard.supportHistoryTitleMine")}</h3>
                  <button type="button" className="admin-modal__fermer" onClick={() => setModalHistoriqueSupportOuvert(false)} aria-label={t("admin.dashboard.cancel")}>
                    <X size={18} />
                  </button>
                </div>

                {chargementSupportRepondus && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementSupportRepondus && messagesSupportRepondus.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.noSupportHistory")}</p>
                ) : (
                  <>
                    {selectionHistoriqueSupport.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span className="admin-field-value">
                          {t("admin.dashboard.historySelectedCount").replace("{n}", selectionHistoriqueSupport.size)}
                        </span>
                        <button
                          type="button" className="admin-action-btn admin-btn--danger"
                          disabled={suppressionHistoriqueSupportEnCours} onClick={supprimerHistoriqueSupportSelectionne}
                        >
                          <Trash2 size={14} />
                          {suppressionHistoriqueSupportEnCours ? t("auth.loading") : t("admin.dashboard.historyDeleteSelected")}
                        </button>
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          onClick={() => setSelectionHistoriqueSupport(new Set())}
                        >
                          {t("admin.dashboard.cancel")}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: "420px", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                      {historiqueSupportParDate.map(([date, entrees], index) => {
                        const idsDuGroupe = entrees.map((m) => m.id);
                        const toutesCochees = idsDuGroupe.every((id) => selectionHistoriqueSupport.has(id));
                        return (
                          <details key={date} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <input
                                type="checkbox"
                                checked={toutesCochees}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectionGroupeHistoriqueSupport(idsDuGroupe)}
                              />
                              <strong>{date}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                            </summary>
                            <ul className="admin-item-list admin-support-list">
                              {entrees.map((m) => {
                                const contenu = m.format_chiffrement !== "e2e_client" ? m.contenu
                                  : historiqueSupportDechiffre[m.id]?.contenu === undefined ? t("messagerie.dechiffrementEnCours")
                                    : historiqueSupportDechiffre[m.id]?.contenu === null ? t("messagerie.contenuIllisible")
                                      : historiqueSupportDechiffre[m.id]?.contenu;
                                const reponse = m.reponse_format_chiffrement !== "e2e_client" ? m.reponse
                                  : historiqueSupportDechiffre[m.id]?.reponse === undefined ? t("messagerie.dechiffrementEnCours")
                                    : historiqueSupportDechiffre[m.id]?.reponse === null ? t("messagerie.contenuIllisible")
                                      : historiqueSupportDechiffre[m.id]?.reponse;
                                return (
                                  <li className="admin-support-item" key={m.id}>
                                    <div className="admin-support-item__entete">
                                      <input
                                        type="checkbox"
                                        checked={selectionHistoriqueSupport.has(m.id)}
                                        onChange={() => toggleSelectionHistoriqueSupport(m.id)}
                                        style={{ marginRight: 4 }}
                                      />
                                      <div className="admin-item__avatar">
                                        <MessageCircle size={18} />
                                      </div>
                                      <div className="admin-item__info">
                                        <p className="admin-item__name">{m.vendeur_nom}</p>
                                        <p className="admin-item__contact">{new Date(m.date_envoi).toLocaleString()}</p>
                                      </div>
                                      {estSuperAdmin && (
                                        <span className="admin-tag">
                                          {m.admin_repondant_nom}{m.admin_repondant_email ? ` — ${m.admin_repondant_email}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <p className="admin-support-item__contenu">{contenu}</p>
                                    <div className="admin-support-item__reponse">
                                      <p className="admin-support-item__contenu">
                                        <strong>{t("admin.dashboard.reply")} : </strong>{reponse}
                                      </p>
                                      <span className="admin-item__contact">{m.date_reponse ? new Date(m.date_reponse).toLocaleString() : ""}</span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "support" && estSuperAdmin && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.supportAuditReportTitle")}</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSupport(1)}>
                  {t("admin.dashboard.adms.today")}
                </button>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSupport(7)}>
                  {t("admin.dashboard.periodWeek")}
                </button>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSupport(30)}>
                  {t("admin.dashboard.periodMonth")}
                </button>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.dateFrom")}</label>
                  <input type="date" className="rk-input" max={dateAujourdhui} value={rapportSupportDateDebut} onChange={(e) => setRapportSupportDateDebut(e.target.value)} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.dateTo")}</label>
                  <input type="date" className="rk-input" max={dateAujourdhui} value={rapportSupportDateFin} onChange={(e) => setRapportSupportDateFin(e.target.value)} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.filterAdmin")}</label>
                  <select className="rk-select" value={rapportSupportAdminId} onChange={(e) => setRapportSupportAdminId(e.target.value)}>
                    <option value="">{t("admin.dashboard.adms.allAdmins")}</option>
                    {admins.filter((a) => a.droits?.gestion_support).map((a) => (
                      <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              {erreurRapportSupport && <p className="rk-error"><XCircle size={20} /> {erreurRapportSupport}</p>}
              <button type="button" className="admin-action-btn admin-action-btn--primary" disabled={rapportSupportEnCours} onClick={telechargerRapportSupport}>
                <Download size={16} />
                {rapportSupportEnCours ? t("auth.loading") : t("admin.dashboard.adms.downloadReport")}
              </button>
            </div>
          )}

          {activeTab === "signalements" && (
            <div className="admin-card">
              <div className="admin-card__header-row">
                <h3 className="admin-card__title admin-card__title--accent">
                  {t("admin.dashboard.reportsListTitle")}
                </h3>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => setModalHistoriqueSignalementsOuvert(true)}>
                  <History size={16} />
                  {t("admin.dashboard.viewHistory")}
                </button>
              </div>

              {erreurSignalements && <p className="admin-error"><XCircle size={20} /> {erreurSignalements}</p>}
              {chargementSignalements && <p className="admin-field-value">{t("auth.loading")}</p>}

              {!chargementSignalements && signalements.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noReports")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {signalementsGroupes.map((groupe) => {
                    const premier = groupe[0];
                    return (
                      <li className="admin-support-item" key={premier.produit_id}>
                        {premier.a_declenche_desactivation_auto && (
                          <p className="admin-auto-banner">{t("admin.dashboard.autoDisabledNotice")}</p>
                        )}
                        <div className="admin-support-item__entete">
                          <div className="admin-item__avatar">
                            <Flag size={18} />
                          </div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">{premier.produit_nom}</p>
                            <p className="admin-item__contact">
                              <Link to={`/vendeur/detail?id=${premier.vendeur_id}`}>{premier.vendeur_nom}</Link>
                            </p>
                          </div>
                          <span className="admin-tag">{t("admin.dashboard.groupedReportsCount").replace("{n}", groupe.length)}</span>
                        </div>
                        <ul className="admin-support-item__sous-liste">
                          {groupe.map((s) => (
                            <li className="admin-support-item__sous-item" key={s.id}>
                              <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                              {" — "}{t(`admin.dashboard.reportType.${s.type_probleme}`)}
                              {" — "}{t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                              <p className="admin-support-item__contenu">{s.motif}</p>
                            </li>
                          ))}
                        </ul>
                        <div className="admin-support-item__reponse">
                          <button
                            className="admin-action-btn admin-btn--danger"
                            disabled={desactivationProduitEnCoursId === premier.id}
                            onClick={() => desactiverUnProduitDepuisSignalement(groupe)}
                          >
                            <Ban size={16} />
                            {t("admin.dashboard.disableProduct")}
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--primary"
                            disabled={traitementEnCoursId === premier.id}
                            onClick={() => traiterUnSignalement(groupe)}
                          >
                            <CheckCircle2 size={16} />
                            {t("admin.dashboard.markReportHandled")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === "signalements" && modalHistoriqueSignalementsOuvert && (
            <div className="admin-modal-overlay" onClick={() => setModalHistoriqueSignalementsOuvert(false)}>
              <div className="admin-modal" style={{ maxWidth: "760px" }} onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__entete">
                  <h3>{t("admin.dashboard.reportsHistoryModalTitle")}</h3>
                  <button type="button" className="admin-modal__fermer" onClick={() => setModalHistoriqueSignalementsOuvert(false)} aria-label={t("admin.dashboard.cancel")}>
                    <X size={18} />
                  </button>
                </div>

                <h4 className="admin-card__title" style={{ fontSize: "0.95em" }}>
                  {t("admin.dashboard.reportsTypeProducts")} — {estSuperAdmin ? t("admin.dashboard.reportsHistoryTitleAll") : t("admin.dashboard.reportsHistoryTitleMine")}
                </h4>

                {chargementSignalementsTraites && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementSignalementsTraites && signalementsTraites.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.noReportsHistory")}</p>
                ) : (
                  <>
                    {selectionHistoriqueSignalements.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span className="admin-field-value">
                          {t("admin.dashboard.historySelectedCount").replace("{n}", selectionHistoriqueSignalements.size)}
                        </span>
                        <button
                          type="button" className="admin-action-btn admin-btn--danger"
                          disabled={suppressionHistoriqueSignalementsEnCours} onClick={supprimerHistoriqueSignalementsSelectionne}
                        >
                          <Trash2 size={14} />
                          {suppressionHistoriqueSignalementsEnCours ? t("auth.loading") : t("admin.dashboard.historyDeleteSelected")}
                        </button>
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          onClick={() => setSelectionHistoriqueSignalements(new Set())}
                        >
                          {t("admin.dashboard.cancel")}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: "420px", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                      {historiqueSignalementsParCible.map((entrees, index) => {
                        const idsDuGroupe = entrees.map((s) => s.id);
                        const toutesCochees = idsDuGroupe.every((id) => selectionHistoriqueSignalements.has(id));
                        return (
                          <details key={entrees[0].produit_id} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <input
                                type="checkbox"
                                checked={toutesCochees}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectionGroupeHistoriqueSignalements(idsDuGroupe)}
                              />
                              <strong>{entrees[0].produit_nom}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                            </summary>
                            <ul className="admin-item-list admin-support-list">
                              {entrees.map((s) => (
                                <li className="admin-support-item" key={s.id}>
                                  <div className="admin-support-item__entete">
                                    <input
                                      type="checkbox"
                                      checked={selectionHistoriqueSignalements.has(s.id)}
                                      onChange={() => toggleSelectionHistoriqueSignalements(s.id)}
                                      style={{ marginRight: 4 }}
                                    />
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
                                    <span className="admin-tag">{new Date(s.date_traitement).toLocaleString()}</span>
                                  </div>
                                  <p className="admin-support-item__contenu">{s.motif}</p>
                                  <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                                    {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                                    {estSuperAdmin && s.admin_traitant_nom && ` — ${t("admin.dashboard.handledBy")} ${s.admin_traitant_nom}${s.admin_traitant_email ? ` (${s.admin_traitant_email})` : ""}`}
                                  </p>
                                  {s.explication_decision && (
                                    <p className="admin-support-item__explication">{t("admin.dashboard.explanationLabel")} {s.explication_decision}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}

                <h4 className="admin-card__title" style={{ fontSize: "0.95em", marginTop: "18px" }}>
                  {t("admin.dashboard.reportsTypeSellers")} — {estSuperAdmin ? t("admin.dashboard.reportsSellersHistoryTitleAll") : t("admin.dashboard.reportsSellersHistoryTitleMine")}
                </h4>

                {chargementSignalementsVendeursTraites && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementSignalementsVendeursTraites && signalementsVendeursTraites.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.noReportsHistory")}</p>
                ) : (
                  <>
                    {selectionHistoriqueSignalementsVendeurs.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span className="admin-field-value">
                          {t("admin.dashboard.historySelectedCount").replace("{n}", selectionHistoriqueSignalementsVendeurs.size)}
                        </span>
                        <button
                          type="button" className="admin-action-btn admin-btn--danger"
                          disabled={suppressionHistoriqueSignalementsVendeursEnCours} onClick={supprimerHistoriqueSignalementsVendeursSelectionne}
                        >
                          <Trash2 size={14} />
                          {suppressionHistoriqueSignalementsVendeursEnCours ? t("auth.loading") : t("admin.dashboard.historyDeleteSelected")}
                        </button>
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          onClick={() => setSelectionHistoriqueSignalementsVendeurs(new Set())}
                        >
                          {t("admin.dashboard.cancel")}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: "420px", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                      {historiqueSignalementsVendeursParCible.map((entrees, index) => {
                        const idsDuGroupe = entrees.map((s) => s.id);
                        const toutesCochees = idsDuGroupe.every((id) => selectionHistoriqueSignalementsVendeurs.has(id));
                        return (
                          <details key={entrees[0].vendeur_id} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <input
                                type="checkbox"
                                checked={toutesCochees}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectionGroupeHistoriqueSignalementsVendeurs(idsDuGroupe)}
                              />
                              <strong>{entrees[0].vendeur_nom}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                            </summary>
                            <ul className="admin-item-list admin-support-list">
                              {entrees.map((s) => (
                                <li className="admin-support-item" key={s.id}>
                                  <div className="admin-support-item__entete">
                                    <input
                                      type="checkbox"
                                      checked={selectionHistoriqueSignalementsVendeurs.has(s.id)}
                                      onChange={() => toggleSelectionHistoriqueSignalementsVendeurs(s.id)}
                                      style={{ marginRight: 4 }}
                                    />
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
                                    <span className="admin-tag">{new Date(s.date_traitement).toLocaleString()}</span>
                                  </div>
                                  <p className="admin-support-item__contenu">{s.motif}</p>
                                  <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                                    {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                                    {estSuperAdmin && s.admin_traitant_nom && ` — ${t("admin.dashboard.handledBy")} ${s.admin_traitant_nom}${s.admin_traitant_email ? ` (${s.admin_traitant_email})` : ""}`}
                                  </p>
                                  {s.explication_decision && (
                                    <p className="admin-support-item__explication">{t("admin.dashboard.explanationLabel")} {s.explication_decision}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}

                <h4 className="admin-card__title" style={{ fontSize: "0.95em", marginTop: "18px" }}>
                  {t("admin.dashboard.reportsTypeMessages")} — {estSuperAdmin ? t("admin.dashboard.reportsMessagesHistoryTitleAll") : t("admin.dashboard.reportsMessagesHistoryTitleMine")}
                </h4>

                {chargementSignalementsMessagesTraites && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementSignalementsMessagesTraites && signalementsMessagesTraites.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.noReportsHistory")}</p>
                ) : (
                  <>
                    {selectionHistoriqueSignalementsMessages.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span className="admin-field-value">
                          {t("admin.dashboard.historySelectedCount").replace("{n}", selectionHistoriqueSignalementsMessages.size)}
                        </span>
                        <button
                          type="button" className="admin-action-btn admin-btn--danger"
                          disabled={suppressionHistoriqueSignalementsMessagesEnCours} onClick={supprimerHistoriqueSignalementsMessagesSelectionne}
                        >
                          <Trash2 size={14} />
                          {suppressionHistoriqueSignalementsMessagesEnCours ? t("auth.loading") : t("admin.dashboard.historyDeleteSelected")}
                        </button>
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          onClick={() => setSelectionHistoriqueSignalementsMessages(new Set())}
                        >
                          {t("admin.dashboard.cancel")}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: "420px", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                      {historiqueSignalementsMessagesParCible.map((entrees, index) => {
                        const idsDuGroupe = entrees.map((s) => s.id);
                        const toutesCochees = idsDuGroupe.every((id) => selectionHistoriqueSignalementsMessages.has(id));
                        return (
                          <details key={entrees[0].message_id} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <input
                                type="checkbox"
                                checked={toutesCochees}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectionGroupeHistoriqueSignalementsMessages(idsDuGroupe)}
                              />
                              <strong>{entrees[0].message_expediteur_nom}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                            </summary>
                            <ul className="admin-item-list admin-support-list">
                              {entrees.map((s) => (
                                <li className="admin-support-item" key={s.id}>
                                  <div className="admin-support-item__entete">
                                    <input
                                      type="checkbox"
                                      checked={selectionHistoriqueSignalementsMessages.has(s.id)}
                                      onChange={() => toggleSelectionHistoriqueSignalementsMessages(s.id)}
                                      style={{ marginRight: 4 }}
                                    />
                                    <div className="admin-item__avatar">
                                      <Flag size={18} />
                                    </div>
                                    <div className="admin-item__info">
                                      <p className="admin-item__name">{s.message_expediteur_nom}</p>
                                      <p className="admin-item__contact">
                                        {t(`admin.dashboard.reportMessageType.${s.type_probleme}`)}
                                      </p>
                                    </div>
                                    <span className="admin-tag">{new Date(s.date_traitement).toLocaleString()}</span>
                                  </div>
                                  <p className="admin-support-item__contenu">« {s.message_contenu || t("messagerie.sharedProduct")} »</p>
                                  <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                                    {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")} — {s.motif}
                                    {estSuperAdmin && s.admin_traitant_nom && ` — ${t("admin.dashboard.handledBy")} ${s.admin_traitant_nom}${s.admin_traitant_email ? ` (${s.admin_traitant_email})` : ""}`}
                                  </p>
                                  {s.explication_decision && (
                                    <p className="admin-support-item__explication">{t("admin.dashboard.explanationLabel")} {s.explication_decision}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}

                <h4 className="admin-card__title" style={{ fontSize: "0.95em", marginTop: "18px" }}>
                  {t("admin.dashboard.reportsTypeReviews")} — {estSuperAdmin ? t("admin.dashboard.reportsAvisHistoryTitleAll") : t("admin.dashboard.reportsAvisHistoryTitleMine")}
                </h4>

                {chargementSignalementsAvisTraites && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementSignalementsAvisTraites && signalementsAvisTraites.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.noReportsHistory")}</p>
                ) : (
                  <>
                    {selectionHistoriqueSignalementsAvis.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span className="admin-field-value">
                          {t("admin.dashboard.historySelectedCount").replace("{n}", selectionHistoriqueSignalementsAvis.size)}
                        </span>
                        <button
                          type="button" className="admin-action-btn admin-btn--danger"
                          disabled={suppressionHistoriqueSignalementsAvisEnCours} onClick={supprimerHistoriqueSignalementsAvisSelectionne}
                        >
                          <Trash2 size={14} />
                          {suppressionHistoriqueSignalementsAvisEnCours ? t("auth.loading") : t("admin.dashboard.historyDeleteSelected")}
                        </button>
                        <button
                          type="button" className="admin-action-btn admin-action-btn--secondary"
                          onClick={() => setSelectionHistoriqueSignalementsAvis(new Set())}
                        >
                          {t("admin.dashboard.cancel")}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: "420px", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                      {historiqueSignalementsAvisParCible.map((entrees, index) => {
                        const idsDuGroupe = entrees.map((s) => s.id);
                        const toutesCochees = idsDuGroupe.every((id) => selectionHistoriqueSignalementsAvis.has(id));
                        return (
                          <details key={entrees[0].avis_id ?? entrees[0].id} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <input
                                type="checkbox"
                                checked={toutesCochees}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectionGroupeHistoriqueSignalementsAvis(idsDuGroupe)}
                              />
                              <strong>{entrees[0].auteur_avis_nom || t("profile.notSpecified")} — {entrees[0].produit_nom}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                              {entrees[0].avis_supprime && <span className="admin-field-value">({t("admin.dashboard.reviewDeletedNotice")})</span>}
                            </summary>
                            <ul className="admin-item-list admin-support-list">
                              {entrees.map((s) => (
                                <li className="admin-support-item" key={s.id}>
                                  <div className="admin-support-item__entete">
                                    <input
                                      type="checkbox"
                                      checked={selectionHistoriqueSignalementsAvis.has(s.id)}
                                      onChange={() => toggleSelectionHistoriqueSignalementsAvis(s.id)}
                                      style={{ marginRight: 4 }}
                                    />
                                    <div className="admin-item__avatar">
                                      <Flag size={18} />
                                    </div>
                                    <div className="admin-item__info">
                                      <p className="admin-item__name">{s.auteur_avis_nom || t("profile.notSpecified")}</p>
                                      <p className="admin-item__contact">
                                        {s.produit_nom} — {t(`admin.dashboard.reportAvisType.${s.type_probleme}`)}
                                      </p>
                                    </div>
                                    <span className="admin-tag">{new Date(s.date_traitement).toLocaleString()}</span>
                                  </div>
                                  <p className="admin-support-item__contenu">
                                    <StarRating note={s.avis_note} taille={13} /> {s.avis_commentaire}
                                  </p>
                                  <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                                    {t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")} — {s.motif}
                                    {estSuperAdmin && s.admin_traitant_nom && ` — ${t("admin.dashboard.handledBy")} ${s.admin_traitant_nom}${s.admin_traitant_email ? ` (${s.admin_traitant_email})` : ""}`}
                                  </p>
                                  {s.explication_decision && (
                                    <p className="admin-support-item__explication">{t("admin.dashboard.explanationLabel")} {s.explication_decision}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "signalements" && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.reportsSellersListTitle")}
              </h3>

              {erreurSignalementsVendeurs && <p className="admin-error"><XCircle size={20} /> {erreurSignalementsVendeurs}</p>}
              {erreurReactivationVendeur && <p className="admin-error"><XCircle size={20} /> {erreurReactivationVendeur}</p>}
              {chargementSignalementsVendeurs && <p className="admin-field-value">{t("auth.loading")}</p>}

              {!chargementSignalementsVendeurs && signalementsVendeurs.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noReportsSellers")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {signalementsVendeursGroupes.map((groupe) => {
                    const premier = groupe[0];
                    return (
                      <li className="admin-support-item" key={premier.vendeur_id}>
                        {premier.a_declenche_suspension_auto && (
                          <p className="admin-auto-banner">{t("admin.dashboard.autoSuspendedNotice")}</p>
                        )}
                        <div className="admin-support-item__entete">
                          <div className="admin-item__avatar">
                            <Flag size={18} />
                          </div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">
                              <Link to={`/vendeur/detail?id=${premier.vendeur_id}`}>{premier.vendeur_nom}</Link>
                            </p>
                          </div>
                          <span className="admin-tag">{t("admin.dashboard.groupedReportsCount").replace("{n}", groupe.length)}</span>
                        </div>
                        <ul className="admin-support-item__sous-liste">
                          {groupe.map((s) => (
                            <li className="admin-support-item__sous-item" key={s.id}>
                              <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                              {" — "}{t(`admin.dashboard.reportSellerType.${s.type_probleme}`)}
                              {" — "}{t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                              <p className="admin-support-item__contenu">{s.motif}</p>
                            </li>
                          ))}
                        </ul>
                        <div className="admin-support-item__reponse">
                          <button
                            className="admin-action-btn admin-btn--danger"
                            disabled={blocageVendeurDepuisRapportEnCoursId === premier.id}
                            onClick={() => bloquerVendeurDepuisSignalementVendeur(groupe)}
                          >
                            <Ban size={16} />
                            {t("admin.dashboard.blockSeller")}
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--primary"
                            disabled={traitementVendeurEnCoursId === premier.id}
                            onClick={() => traiterUnSignalementVendeur(groupe)}
                          >
                            <CheckCircle2 size={16} />
                            {t("admin.dashboard.markReportHandled")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === "signalements" && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.reportsMessagesListTitle")}
              </h3>

              {erreurSignalementsMessages && <p className="admin-error"><XCircle size={20} /> {erreurSignalementsMessages}</p>}
              {chargementSignalementsMessages && <p className="admin-field-value">{t("auth.loading")}</p>}

              {!chargementSignalementsMessages && signalementsMessages.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noReportsMessages")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {signalementsMessagesGroupes.map((groupe) => {
                    const premier = groupe[0];
                    return (
                      <li className="admin-support-item" key={premier.message_id}>
                        <div className="admin-support-item__entete">
                          <div className="admin-item__avatar">
                            <Flag size={18} />
                          </div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">{premier.message_expediteur_nom}</p>
                            <p className="admin-item__contact">« {premier.message_contenu || t("messagerie.sharedProduct")} »</p>
                          </div>
                          <span className="admin-tag">{t("admin.dashboard.groupedReportsCount").replace("{n}", groupe.length)}</span>
                        </div>
                        <ul className="admin-support-item__sous-liste">
                          {groupe.map((s) => (
                            <li className="admin-support-item__sous-item" key={s.id}>
                              <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                              {" — "}{t(`admin.dashboard.reportMessageType.${s.type_probleme}`)}
                              {" — "}{t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                              <p className="admin-support-item__contenu">{s.motif}</p>
                            </li>
                          ))}
                        </ul>
                        <div className="admin-support-item__reponse">
                          <button
                            className="admin-action-btn admin-btn--danger"
                            disabled={blocageUtilisateurMessageEnCoursId === premier.id}
                            onClick={() => bloquerUtilisateurDepuisSignalementMessage(groupe)}
                          >
                            <Ban size={16} />
                            {t("admin.dashboard.blockUser")}
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--primary"
                            disabled={traitementMessageEnCoursId === premier.id}
                            onClick={() => traiterUnSignalementMessage(groupe)}
                          >
                            <CheckCircle2 size={16} />
                            {t("admin.dashboard.markReportHandled")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === "signalements" && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.reportsAvisListTitle")}
              </h3>

              {erreurSignalementsAvis && <p className="admin-error"><XCircle size={20} /> {erreurSignalementsAvis}</p>}
              {chargementSignalementsAvis && <p className="admin-field-value">{t("auth.loading")}</p>}

              {!chargementSignalementsAvis && signalementsAvis.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.noReportsAvis")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {signalementsAvisGroupes.map((groupe) => {
                    const premier = groupe[0];
                    return (
                      <li className="admin-support-item" key={premier.avis_id}>
                        <div className="admin-support-item__entete">
                          <div className="admin-item__avatar">
                            <Flag size={18} />
                          </div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">{premier.auteur_avis_nom || t("profile.notSpecified")}</p>
                            <p className="admin-item__contact">{premier.produit_nom}</p>
                          </div>
                          <span className="admin-tag">{t("admin.dashboard.groupedReportsCount").replace("{n}", groupe.length)}</span>
                        </div>
                        <p className="admin-support-item__contenu">
                          <StarRating note={premier.avis_note} taille={13} /> {premier.avis_commentaire}
                        </p>
                        {premier.auteur_avis_avertissements != null && (
                          <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                            {t("admin.dashboard.warningsCount", { n: premier.auteur_avis_avertissements })}
                          </p>
                        )}
                        <ul className="admin-support-item__sous-liste">
                          {groupe.map((s) => (
                            <li className="admin-support-item__sous-item" key={s.id}>
                              <span className="admin-tag">{new Date(s.date_signalement).toLocaleString()}</span>
                              {" — "}{t(`admin.dashboard.reportAvisType.${s.type_probleme}`)}
                              {" — "}{t("admin.dashboard.reportedBy")} {s.signaleur_nom || t("profile.notSpecified")}
                              <p className="admin-support-item__contenu">{s.motif}</p>
                            </li>
                          ))}
                        </ul>
                        <div className="admin-support-item__reponse">
                          <button
                            className="admin-action-btn admin-btn--danger"
                            disabled={suppressionAvisSignaleEnCoursId === premier.id}
                            onClick={() => supprimerUnAvisSignale(groupe)}
                          >
                            <Trash2 size={16} />
                            {t("admin.dashboard.deleteReview")}
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--primary"
                            disabled={traitementAvisEnCoursId === premier.id}
                            onClick={() => traiterUnSignalementAvis(groupe)}
                          >
                            <CheckCircle2 size={16} />
                            {t("admin.dashboard.markReportHandled")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === "signalements" && estSuperAdmin && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.reportsAuditReportTitle")}</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSignalements(1)}>
                  {t("admin.dashboard.adms.today")}
                </button>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSignalements(7)}>
                  {t("admin.dashboard.periodWeek")}
                </button>
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeSignalements(30)}>
                  {t("admin.dashboard.periodMonth")}
                </button>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.dateFrom")}</label>
                  <input type="date" className="rk-input" max={dateAujourdhui} value={rapportSignalementsDateDebut} onChange={(e) => setRapportSignalementsDateDebut(e.target.value)} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.dateTo")}</label>
                  <input type="date" className="rk-input" max={dateAujourdhui} value={rapportSignalementsDateFin} onChange={(e) => setRapportSignalementsDateFin(e.target.value)} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("admin.dashboard.adms.filterAdmin")}</label>
                  <select className="rk-select" value={rapportSignalementsAdminId} onChange={(e) => setRapportSignalementsAdminId(e.target.value)}>
                    <option value="">{t("admin.dashboard.adms.allAdmins")}</option>
                    {admins.filter((a) => a.droits?.gestion_signalements).map((a) => (
                      <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              {erreurRapportSignalements && <p className="rk-error"><XCircle size={20} /> {erreurRapportSignalements}</p>}
              <button type="button" className="admin-action-btn admin-action-btn--primary" disabled={rapportSignalementsEnCours} onClick={telechargerRapportSignalements}>
                <Download size={16} />
                {rapportSignalementsEnCours ? t("auth.loading") : t("admin.dashboard.adms.downloadReport")}
              </button>
            </div>
          )}

          {activeTab === "kyc" && estSuperAdmin && (
            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.verif.listTitle")}
              </h3>

              {erreurRevueManuelle && <p className="admin-error"><XCircle size={20} /> {erreurRevueManuelle}</p>}
              {chargementRevueManuelle && <p className="admin-field-value">{t("auth.loading")}</p>}

              {!chargementRevueManuelle && demandesRevueManuelle.length === 0 ? (
                <p className="admin-field-value">{t("admin.dashboard.verif.noVerifications")}</p>
              ) : (
                <ul className="admin-item-list admin-support-list">
                  {demandesRevueManuelle.map((d) => (
                    <li className="admin-support-item" key={d.id}>
                      <div className="admin-support-item__entete">
                        <div className="admin-item__avatar">
                          <FileText size={18} />
                        </div>
                        <div className="admin-item__info">
                          <p className="admin-item__name">{d.prenom} {d.nom} — {d.email}</p>
                          <p className="admin-item__contact">
                            {t(d.type_demandeur === "entreprise" ? "admin.dashboard.verif.companyLabel" : "admin.dashboard.verif.individualLabel")}
                            {d.score_correspondance_visage != null && (
                              <> — {t("admin.dashboard.verif.scoreLabel")} {(d.score_correspondance_visage * 100).toFixed(0)}%</>
                            )}
                          </p>
                        </div>
                        <span className="admin-tag">{new Date(d.date_soumission).toLocaleString()}</span>
                      </div>
                      {d.motif_revue_manuelle && (
                        <p className="admin-support-item__contenu">{d.motif_revue_manuelle}</p>
                      )}
                      <div className="admin-support-item__reponse">
                        <button
                          className="admin-action-btn"
                          onClick={() => { setDemandeRevueManuelleOuverte(d); setMotifRevueManuelle(""); }}
                        >
                          <Eye size={16} />
                          {t("admin.dashboard.verif.viewDetails")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {demandeRevueManuelleOuverte && (
                <div className="admin-modal-overlay" onClick={() => setDemandeRevueManuelleOuverte(null)}>
                  <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-modal__entete">
                      <h3>{demandeRevueManuelleOuverte.prenom} {demandeRevueManuelleOuverte.nom}</h3>
                      <button type="button" className="admin-modal__fermer" onClick={() => setDemandeRevueManuelleOuverte(null)} aria-label={t("admin.dashboard.cancel")}>
                        <X size={18} />
                      </button>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <p className="admin-field-value">{t("admin.dashboard.verif.emailLabel")} {demandeRevueManuelleOuverte.email}</p>
                      {demandeRevueManuelleOuverte.type_demandeur === "entreprise" ? (
                        <>
                          <p className="admin-field-value">{t("admin.dashboard.verif.submittedNumberLabel")} {demandeRevueManuelleOuverte.numero_piece_saisi || "—"}</p>
                          <p className="admin-field-value">{t("admin.dashboard.verif.extractedCompanyNumberLabel")} {demandeRevueManuelleOuverte.numero_patente_extrait || "—"}</p>
                        </>
                      ) : (
                        <>
                          <p className="admin-field-value">{t("admin.dashboard.verif.submittedNumberLabel")} {demandeRevueManuelleOuverte.numero_piece_saisi || "—"}</p>
                          <p className="admin-field-value">{t("admin.dashboard.verif.extractedNumberLabel")} {demandeRevueManuelleOuverte.numero_piece_extrait || "—"}</p>
                          <p className="admin-field-value">
                            {t("admin.dashboard.verif.extractedNameLabel")} {[demandeRevueManuelleOuverte.prenom_extrait, demandeRevueManuelleOuverte.nom_extrait].filter(Boolean).join(" ") || "—"}
                          </p>
                          {demandeRevueManuelleOuverte.date_naissance_extraite && (
                            <p className="admin-field-value">
                              {t("admin.dashboard.verif.extractedBirthDateLabel")} {new Date(demandeRevueManuelleOuverte.date_naissance_extraite).toLocaleDateString()}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {demandeRevueManuelleOuverte.type_demandeur === "entreprise" ? (
                      demandeRevueManuelleOuverte.certificat_patente && (
                        <a href={demandeRevueManuelleOuverte.certificat_patente} target="_blank" rel="noopener noreferrer">
                          <img src={demandeRevueManuelleOuverte.certificat_patente} alt="certificat de patente" style={{ width: "100%", borderRadius: "8px", marginBottom: "12px" }} />
                        </a>
                      )
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                        {demandeRevueManuelleOuverte.selfie && (
                          <img src={demandeRevueManuelleOuverte.selfie} alt="selfie" style={{ width: "31%", minWidth: "140px", borderRadius: "8px" }} />
                        )}
                        {demandeRevueManuelleOuverte.document_recto && (
                          <img src={demandeRevueManuelleOuverte.document_recto} alt="pièce recto" style={{ width: "31%", minWidth: "140px", borderRadius: "8px" }} />
                        )}
                      </div>
                    )}

                    {demandeRevueManuelleOuverte.score_correspondance_visage != null && (
                      <p className="admin-field-value">
                        {t("admin.dashboard.verif.scoreLabel")} {(demandeRevueManuelleOuverte.score_correspondance_visage * 100).toFixed(0)}%
                      </p>
                    )}
                    {demandeRevueManuelleOuverte.motif_revue_manuelle && (
                      <p className="admin-field-value">
                        {t("admin.dashboard.verif.motifLabel")} {demandeRevueManuelleOuverte.motif_revue_manuelle}
                      </p>
                    )}

                    <div className="rk-field">
                      <label className="rk-label">{t("admin.dashboard.verif.rejectMotifPlaceholder")}</label>
                      <textarea
                        className="rk-input"
                        rows={2}
                        value={motifRevueManuelle}
                        onChange={(e) => setMotifRevueManuelle(e.target.value)}
                      />
                    </div>

                    <div className="admin-support-item__reponse">
                      <button
                        className="admin-action-btn admin-btn--danger"
                        disabled={decisionRevueManuelleEnCoursId === demandeRevueManuelleOuverte.id}
                        onClick={() => traiterDemandeRevueManuelle(demandeRevueManuelleOuverte, "rejeter")}
                      >
                        <XCircle size={16} />
                        {t("admin.dashboard.verif.reject")}
                      </button>
                      <button
                        className="admin-action-btn admin-action-btn--primary"
                        disabled={decisionRevueManuelleEnCoursId === demandeRevueManuelleOuverte.id}
                        onClick={() => traiterDemandeRevueManuelle(demandeRevueManuelleOuverte, "approuver")}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.verif.approve")}
                      </button>
                    </div>
                  </div>
                </div>
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

                {erreurAdmins && <p className="admin-error"><XCircle size={20} /> {erreurAdmins}</p>}
                {chargementAdmins && <p className="admin-field-value">{t("auth.loading")}</p>}

                {!chargementAdmins && admins.length === 0 ? (
                  <p className="admin-field-value">{t("admin.dashboard.adms.noAdmins")}</p>
                ) : (
                  <ul className="admin-item-list">
                    {admins.map((a) => {
                      const estMoi = a.id === utilisateur?.id;
                      const estIntouchable = !!a.droits?.est_super_super_admin;

                      const peutGererCeCompte = !estMoi && !estIntouchable && estSuperAdmin && peutAgirSurAdmin(droits, a.droits);
                      const peutReinitCeMdp = !estMoi && !estIntouchable && peutReinitialiserMdp(droits, a.droits);
                      return (
                        <li className="admin-item" key={a.id}>
                          <div className="admin-item__avatar"><UserCog size={18} /></div>
                          <div className="admin-item__info">
                            <p className="admin-item__name">{a.est_entreprise ? a.nom : `${a.prenom} ${a.nom}`}</p>
                            <p className="admin-item__contact">{a.email} — {a.telephone}</p>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                              {a.est_entreprise && (
                                <span className="admin-tag admin-tag--entreprise">{t("admin.dashboard.companyBadge")}</span>
                              )}
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
                                {erreurFormInfos && <p className="rk-error"><XCircle size={20} /> {erreurFormInfos}</p>}
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
                                    {estProprietaire && (
                                      <label className="rk-checkbox-row">
                                        <input
                                          type="checkbox"
                                          checked={!!formDroitsEdition.super_admin}
                                          onChange={(e) => setFormDroitsEdition((f) => ({ ...f, super_admin: e.target.checked }))}
                                        />
                                        <strong>{t("admin.dashboard.adms.superAdmin")}</strong>
                                      </label>
                                    )}
                                    {DROITS_ASSIGNABLES.map((d) => (
                                      <label key={d} className="rk-checkbox-row">
                                        <input
                                          type="checkbox"
                                          checked={!!formDroitsEdition[d]}
                                          disabled={!!formDroitsEdition.super_admin}
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
                          {estProprietaire && (
                            <label className="rk-checkbox-row">
                              <input
                                type="checkbox"
                                checked={!!formAdmin.super_admin}
                                onChange={(e) => setFormAdmin((f) => ({ ...f, super_admin: e.target.checked }))}
                              />
                              <strong>{t("admin.dashboard.adms.superAdmin")}</strong>
                            </label>
                          )}
                          {DROITS_ASSIGNABLES.map((d) => (
                            <label key={d} className="rk-checkbox-row">
                              <input
                                type="checkbox"
                                checked={!!formAdmin[d]}
                                disabled={!!formAdmin.super_admin}
                                onChange={(e) => setFormAdmin((f) => ({ ...f, [d]: e.target.checked }))}
                              />
                              {t(`admin.dashboard.adms.droits.${d}`)}
                            </label>
                          ))}
                        </div>
                      </div>

                      {erreurFormAdmin && <p className="rk-error"><XCircle size={20} /> {erreurFormAdmin}</p>}
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
                  {erreurRapport && <p className="rk-error"><XCircle size={20} /> {erreurRapport}</p>}
                  <button type="button" className="admin-action-btn admin-action-btn--primary" disabled={rapportEnCours} onClick={telechargerRapportAudit}>
                    <Download size={16} />
                    {rapportEnCours ? t("auth.loading") : t("admin.dashboard.adms.downloadReport")}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "sauvegarde" && aLeDroit("gestion_sauvegardes") && (
            <>
              {erreurSauvegarde && <p className="admin-error"><XCircle size={20} /> {erreurSauvegarde}</p>}
              {messageGoogle && (
                <p className={messageGoogle === "connecte" ? "admin-field-value" : "admin-error"}>
                  {messageGoogle === "connecte" && `<Check size={20}/> ${t("admin.dashboard.sauvegarde.googleConnected")}`}
                  {messageGoogle === "refuse" && `<XCircle size={20}/> ${t("admin.dashboard.sauvegarde.googleDenied")}`}
                  {messageGoogle === "erreur" && `<XCircle size={20}/> ${t("admin.dashboard.sauvegarde.googleError")}`}
                  {" "}
                  <button type="button" className="admin-icon-btn" onClick={() => setMessageGoogle(null)} aria-label={t("common.close")}>
                    <X size={14} />
                  </button>
                </p>
              )}

              <div className="admin-card">
                <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.configTitle")}</h3>

                {chargementConfigSauvegarde && <p className="admin-field-value">{t("auth.loading")}</p>}

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
                      {configSauvegardeEnCours ? t("auth.loading") : t("admin.dashboard.save")}
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
                  {declenchementEnCours ? t("auth.loading") : t("admin.dashboard.sauvegarde.runNow")}
                </button>

                {erreurSauvegarde && <p className="admin-error"><XCircle size={20} /> {erreurSauvegarde}</p>}

                {progressionSauvegarde && (
                  <div className="admin-progress-wrap">
                    <div className="admin-progress-header">
                      <span>{t("admin.dashboard.sauvegarde.uploadingToCloud")}</span>
                      <span>{progressionSauvegarde.pourcentage}%</span>
                    </div>
                    <div className="admin-progress-track">
                      <div className="admin-progress-fill" style={{ width: `${progressionSauvegarde.pourcentage}%` }} />
                    </div>
                    <p className="admin-field-value" style={{ fontSize: "0.85em" }}>
                      {progressionSauvegarde.minutesRestantes == null
                        ? t("admin.dashboard.sauvegarde.estimatingTime")
                        : progressionSauvegarde.minutesRestantes === 0
                          ? t("admin.dashboard.sauvegarde.almostDone")
                          : t("admin.dashboard.sauvegarde.minutesRemaining", { n: progressionSauvegarde.minutesRestantes })}
                    </p>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.historyTitle")}</h3>

                {erreurSauvegarde && <p className="admin-error"><XCircle size={20} /> {erreurSauvegarde}</p>}
                <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => setModalHistoriqueSauvegardeOuvert(true)}>
                  <History size={16} />
                  {t("admin.dashboard.viewHistory")}
                </button>
              </div>

              {modalHistoriqueSauvegardeOuvert && (
                <div className="admin-modal-overlay" onClick={() => setModalHistoriqueSauvegardeOuvert(false)}>
                  <div className="admin-modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
                    <div className="admin-modal__entete">
                      <h3>{t("admin.dashboard.sauvegarde.historyTitle")}</h3>
                      <button type="button" className="admin-modal__fermer" onClick={() => setModalHistoriqueSauvegardeOuvert(false)} aria-label={t("admin.dashboard.cancel")}>
                        <X size={18} />
                      </button>
                    </div>

                    {chargementHistoriqueSauvegardes && <p className="admin-field-value">{t("auth.loading")}</p>}
                    {!chargementHistoriqueSauvegardes && historiqueSauvegardes.length === 0 ? (
                      <p className="admin-field-value">{t("admin.dashboard.sauvegarde.noHistory")}</p>
                    ) : (
                      <div style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: "8px", padding: "2px 10px" }}>
                        {historiqueParDate.map(([date, entrees], index) => (
                          <details key={date} open={index === 0} style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border, #e5e7eb)" }}>
                            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", listStyle: "revert" }}>
                              <strong>{date}</strong>
                              <span className="admin-field-value">({entrees.length})</span>
                            </summary>
                            <ul className="admin-item-list">
                              {entrees.map((h) => (
                                <li className="admin-item" key={h.id}>
                                  <div className="admin-item__avatar"><HardDrive size={18} /></div>
                                  <div className="admin-item__info">
                                    <p className="admin-item__name">
                                      {new Date(h.date_execution).toLocaleTimeString()}
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
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {estSuperAdmin && (
                <div className="admin-card">
                  <h3 className="admin-card__title admin-card__title--accent">{t("admin.dashboard.sauvegarde.restoreTitle")}</h3>
                  <p className="admin-field-value">{t("admin.dashboard.sauvegarde.restoreSubtitle")}</p>

                  <input
                    type="file" accept=".rhtbackup"
                    onChange={(e) => choisirFichierRestauration(e.target.files?.[0])}
                    style={{ margin: "12px 0" }}
                  />

                  {erreurRestauration && <p className="admin-error"><XCircle size={20} /> {erreurRestauration}</p>}

                  {fichierRestauration && !analyseRestauration && !resultatRestauration && (
                    <button type="button" className="admin-action-btn admin-action-btn--secondary" disabled={analyseEnCours} onClick={analyserFichierRestauration}>
                      <Upload size={14} />
                      {analyseEnCours ? t("auth.loading") : t("admin.dashboard.sauvegarde.analyze")}
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
                        {restaurationEnCours ? t("auth.loading") : t("admin.dashboard.sauvegarde.confirmButton")}
                      </button>
                    </div>
                  )}

                  {resultatRestauration && (
                    <p className="admin-field-value" style={{ marginTop: "12px" }}>
                      <Check size={20} /> {t("admin.dashboard.sauvegarde.restoreDone", { n: resultatRestauration.nombre_enregistrements_restaures })}
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

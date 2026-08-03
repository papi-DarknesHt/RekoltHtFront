import React, { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Users, Building2, ShieldCheck, Package, Ban, CheckCircle2,
  LayoutDashboard, Tag, Pencil, Trash2, Plus, X, MessageCircle, Send, Flag,
  Menu, ArrowLeft, LogOut, Sun, Moon, Bell, User, ChevronDown,
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
  const [nominationEnCours, setNominationEnCours] = useState(null);
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
  const [blocageVendeurEnCoursId, setBlocageVendeurEnCoursId] = useState(null);
  const [reactivationEnCoursId, setReactivationEnCoursId] = useState(null);
  const [erreurReactivation, setErreurReactivation] = useState(null);

  // signalements de vendeurs en attente (voir Produits/models/signalementVendeurModel.py)
  // — même principe de file partagée que signalements ci-dessus
  const [signalementsVendeurs, setSignalementsVendeurs] = useState([]);
  const [chargementSignalementsVendeurs, setChargementSignalementsVendeurs] = useState(true);
  const [erreurSignalementsVendeurs, setErreurSignalementsVendeurs] = useState(null);
  const [traitementVendeurEnCoursId, setTraitementVendeurEnCoursId] = useState(null);
  const [reactivationVendeurEnCoursId, setReactivationVendeurEnCoursId] = useState(null);
  const [erreurReactivationVendeur, setErreurReactivationVendeur] = useState(null);

  // signalements de messages en attente (voir Messagerie/models.py::SignalementMessage)
  // — même principe de file partagée que signalements/signalementsVendeurs ci-dessus
  const [signalementsMessages, setSignalementsMessages] = useState([]);
  const [chargementSignalementsMessages, setChargementSignalementsMessages] = useState(true);
  const [erreurSignalementsMessages, setErreurSignalementsMessages] = useState(null);
  const [traitementMessageEnCoursId, setTraitementMessageEnCoursId] = useState(null);
  const [suppressionMessageEnCoursId, setSuppressionMessageEnCoursId] = useState(null);

  // signalements d'avis en attente (voir Produits/models/signalementAvisModel.py)
  // — même principe de file partagée que les autres signalements ci-dessus
  const [signalementsAvis, setSignalementsAvis] = useState([]);
  const [chargementSignalementsAvis, setChargementSignalementsAvis] = useState(true);
  const [erreurSignalementsAvis, setErreurSignalementsAvis] = useState(null);
  const [traitementAvisEnCoursId, setTraitementAvisEnCoursId] = useState(null);
  const [suppressionAvisSignaleEnCoursId, setSuppressionAvisSignaleEnCoursId] = useState(null);

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
    Promise.all([
      AuthentificationApi.obtenirDashboardAdmin(),
      AuthentificationApi.listerUtilisateursAdmin(),
      ProduitsApi.listerProduits(),
      ProduitsApi.listerCategories(),
      ProduitsApi.listerSousCategories(),
    ])
      .then(([statsRes, utilisateursRes, produitsRes, categoriesRes, sousCategoriesRes]) => {
        setStats(statsRes);
        setUtilisateurs(utilisateursRes.utilisateurs || []);
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

  const nommerAdmin = async (utilisateur) => {
    const msg = t("admin.dashboard.confirmNominateAdmin").replace("{nom}", `${utilisateur.prenom} ${utilisateur.nom}`);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setNominationEnCours(utilisateur.id);
    try {
      await AuthentificationApi.nommerAdminUtilisateur(utilisateur.id);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === utilisateur.id ? { ...u, role: "admin" } : u))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setNominationEnCours(null);
    }
  };

  const soumettreReponseSupport = async (messageSupport) => {
    const texte = (reponsesBrouillon[messageSupport.id] || "").trim();
    if (!texte) return;
    setReponseEnCoursId(messageSupport.id);
    setErreurSupport(null);
    try {
      // chiffrement en enveloppe de la réponse — vendeur/acheteur d'origine +
      // tous les admins actuels (dont moi-même), voir e2eCrypto.js::chiffrerEnEnveloppe
      const clePrivee = await garantirCleE2E();
      const admins = await obtenirClesAdmins();
      const clePubliqueAuteur = await obtenirClePubliqueDe(messageSupport.vendeur_id);
      const destinataires = [...admins, { utilisateur_id: messageSupport.vendeur_id, cle_publique: clePubliqueAuteur }];
      const { contenu: reponseChiffree, iv, cles } = await chiffrerEnEnveloppe(clePrivee, texte, destinataires);
      await MessagerieApi.repondreMessageAdmin(messageSupport.id, reponseChiffree, iv, cles);
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

  // action de blocage directement depuis un signalement — c'est à l'admin de
  // juger si le compte doit être bloqué ou non (voir signalementModel.py) ;
  // même endpoint toggle que la liste "Utilisateurs", donc bascule aussi bien
  // un compte déjà bloqué (permet de le débloquer depuis ici si besoin)
  const bloquerVendeurDepuisSignalement = async (signalement) => {
    const msg = t("admin.dashboard.confirmBlockSellerFromReport").replace("{nom}", signalement.vendeur_nom);
    if (!(await demanderConfirmation(msg, { danger: true }))) return;
    setBlocageVendeurEnCoursId(signalement.id);
    setErreurSignalements(null);
    try {
      await AuthentificationApi.bloquerUtilisateurAdmin(signalement.vendeur_id);
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === signalement.vendeur_id ? { ...u, est_bloquer: !u.est_bloquer } : u))
      );
    } catch (err) {
      setErreurSignalements(err.message);
    } finally {
      setBlocageVendeurEnCoursId(null);
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

  // supprime définitivement le message signalé — CASCADE retire aussi tout
  // autre signalement en attente sur ce même message (voir
  // supprimerMessageAdmin, Messagerie/views.py) ; action irréversible, d'où
  // la confirmation renforcée
  const supprimerUnMessageSignale = async (signalement) => {
    if (!(await demanderConfirmation(t("admin.dashboard.confirmDeleteMessage"), { danger: true }))) return;
    setSuppressionMessageEnCoursId(signalement.id);
    setErreurSignalementsMessages(null);
    try {
      await MessagerieApi.supprimerMessageAdmin(signalement.message_id);
      setSignalementsMessages((liste) => liste.filter((s) => s.message_id !== signalement.message_id));
    } catch (err) {
      setErreurSignalementsMessages(err.message);
    } finally {
      setSuppressionMessageEnCoursId(null);
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
        setCategories((liste) => [...liste, res.categorie]);
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
        setSousCategories((liste) => [...liste, res.sous_categorie]);
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

  const onglets = [
    { id: "overview",   label: t("admin.dashboard.tabOverview"),   icon: LayoutDashboard },
    { id: "produits",   label: t("admin.dashboard.tabProducts"),   icon: Package },
    { id: "categories", label: t("admin.dashboard.tabCategories"), icon: Tag },
    { id: "sous-categories", label: t("admin.dashboard.tabSubCategories"), icon: Tag },
    { id: "support",    label: t("admin.dashboard.tabSupport"),    icon: MessageCircle, badge: messagesSupport.length },
    { id: "signalements", label: t("admin.dashboard.tabReports"),  icon: Flag, badge: signalements.length + signalementsVendeurs.length + signalementsMessages.length + signalementsAvis.length },
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

            <div className="admin-card">
              <h3 className="admin-card__title admin-card__title--accent">
                {t("admin.dashboard.usersListTitle")}
              </h3>

              {erreurReactivationVendeur && <p className="admin-error">✗ {erreurReactivationVendeur}</p>}

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
                    {u.role !== "admin" && (
                      <button
                        className="admin-action-btn admin-action-btn--secondary"
                        disabled={nominationEnCours === u.id}
                        onClick={() => nommerAdmin(u)}
                      >
                        <ShieldCheck size={14} />
                        {t("admin.dashboard.nominateAdmin")}
                      </button>
                    )}
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
                  </li>
                ))}
              </ul>
            </div>
          </>
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
                    {p.desactive_par_signalements && (
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
                        className="admin-action-btn admin-action-btn--secondary"
                        disabled={blocageVendeurEnCoursId === s.id}
                        onClick={() => bloquerVendeurDepuisSignalement(s)}
                      >
                        <Ban size={16} />
                        {t("admin.dashboard.blockSellerFromReport")}
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
                        className="admin-action-btn admin-action-btn--secondary"
                        disabled={reactivationVendeurEnCoursId === s.id}
                        onClick={() => reactiverUnVendeur(s.vendeur_id, s.id)}
                      >
                        <CheckCircle2 size={16} />
                        {t("admin.dashboard.reactivateSeller")}
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
                        disabled={suppressionMessageEnCoursId === s.id}
                        onClick={() => supprimerUnMessageSignale(s)}
                      >
                        <Trash2 size={16} />
                        {t("admin.dashboard.deleteMessage")}
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
        </main>
      </div>
    </div>
  );
}

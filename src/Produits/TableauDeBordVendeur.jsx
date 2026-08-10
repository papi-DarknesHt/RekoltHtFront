import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, Package, MessageCircle, User, Clock,
  Menu, ArrowLeft, LogOut, Sun, Moon, ChevronDown, Download, Eye,
  Send, ShieldCheck, Plus, CheckCircle2, XCircle, Pencil,
} from "lucide-react";
import { HistogramChart, LineChart, DonutChart } from "../components/AdminCharts.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useThemeStore } from "../api/themeStore.js";
import { useE2eStore } from "../api/e2eStore.js";
import { dechiffrerEnveloppe } from "../utils/e2eCrypto.js";
import { ProduitsApi } from "../api/produits";
import { AuthentificationApi } from "../api/auth";
import { MessagerieApi } from "../api/messagerie";
import { formaterLocalisationProduit } from "../utils/localisationProduit.js";
import logoSite from "../assets/Images/Asset5.svg";
import "../assets/CSS/TableauDeBordVendeur.css";

// texte à afficher pour contenu/reponse d'un message support déjà (tentative
// de) déchiffré — undefined = pas encore tenté, null = échec du déchiffrement
// (voir e2eCrypto.js::dechiffrerEnveloppe) — même logique que Support/ContacterAdmin.jsx
function texteSupportChamp(valeur, t) {
  if (valeur === undefined) return t("messagerie.dechiffrementEnCours");
  if (valeur === null) return t("messagerie.contenuIllisible");
  return valeur;
}

// convertit un produit tel que renvoyé par l'API (voir _serialiseProduit,
// Produits/views/produitsViews.py) au format attendu par ProductCard.jsx —
// portée depuis l'ancienne page mesProduits.jsx, désormais intégrée ici
function versProduitAffiche(p, texteNonPrecise, texteHaiti) {
  return {
    id: p.id,
    nom: p.nom,
    lieu: formaterLocalisationProduit(p, texteHaiti) || texteNonPrecise,
    prix: p.prix,
    devise: p.unitePrix,
    image: p.photos?.[0]?.url_photo || null,
  };
}

const NOMBRE_PRODUITS_GRAPHE = 8;

// date locale (fuseau du NAVIGATEUR) au format AAAA-MM-JJ — même fonction que
// AdminDashboard.jsx (dupliquée ici : les deux pages n'ont volontairement
// aucune dépendance croisée, voir commentaire du composant plus bas)
function formatDateLocale(d) {
  const annee = d.getFullYear();
  const mois  = String(d.getMonth() + 1).padStart(2, "0");
  const jour  = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

// même DESIGN que le shell d'AdminDashboard.jsx (sidebar + topbar) mais
// classes/variables CSS propres à cette page (voir TableauDeBordVendeur.css,
// préfixe "tdb-") — aucune des deux pages ne dépend du fichier CSS de l'autre,
// pour qu'un ajustement sur l'une n'affecte jamais l'autre
export default function TableauDeBordVendeur() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const deconnexion = useAuthStore((s) => s.deconnexion);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const contactEvent = useGlobalStore((s) => s.contactEvent);
  const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);

  // "overview" / "produits" (ex-page mesProduits.jsx, désormais intégrée ici)
  // / "support" ("Contacter un admin") — trois onglets internes à CETTE page,
  // aucune navigation : tout reste dans le même shell. ?tab=... permet un
  // lien direct vers un onglet précis (voir AjouterProduit.jsx/
  // modifierProduits.jsx qui renvoient ici après une action produit)
  const [searchParams] = useSearchParams();
  const [sectionActive, setSectionActive] = useState(() => searchParams.get("tab") || "overview");

  const [sidebarOuvert, setSidebarOuvert] = useState(false);
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);
  const menuCompteRef = useRef(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState(null);

  // "Contacter un admin" — même logique que Support/ContacterAdmin.jsx
  // (chiffrement en enveloppe, voir e2eStore.js/e2eCrypto.js), portée ici
  // pour vivre directement dans le tableau de bord plutôt que sur une page à part
  const [messagesSupport, setMessagesSupport] = useState([]);
  const [chargementSupport, setChargementSupport] = useState(true);
  const [erreurSupport, setErreurSupport] = useState(null);
  const [brouillonSupport, setBrouillonSupport] = useState("");
  const [envoiSupportEnCours, setEnvoiSupportEnCours] = useState(false);
  const garantirCleE2E = useE2eStore((s) => s.garantirCleE2E);
  const clePriveeCryptoKey = useE2eStore((s) => s.clePriveeCryptoKey);
  const clePubliqueJwk = useE2eStore((s) => s.clePubliqueJwk);
  const obtenirClePubliqueDe = useE2eStore((s) => s.obtenirClePubliqueDe);
  // id -> { contenu?, reponse? } déjà déchiffrés — undefined/null, voir texteSupportChamp
  const [dechiffresSupport, setDechiffresSupport] = useState({});

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

  const [produits, setProduits] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [vuesProfil, setVuesProfil] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  // statistiques de vues (profil/produits/catégories) filtrables par période
  // — défaut : 7 derniers jours (demande explicite), voir Produits/views/
  // vuesViews.py::statistiquesVuesVendeur
  const dateAujourdhuiVues = formatDateLocale(new Date());
  const [statsVuesDateDebut, setStatsVuesDateDebut] = useState(() => {
    const debut = new Date();
    debut.setDate(debut.getDate() - 6);
    return formatDateLocale(debut);
  });
  const [statsVuesDateFin, setStatsVuesDateFin] = useState(dateAujourdhuiVues);
  const [statsVues, setStatsVues] = useState(null);
  const [chargementStatsVues, setChargementStatsVues] = useState(true);
  const [erreurStatsVues, setErreurStatsVues] = useState(null);

  const appliquerRaccourciPeriodeVues = (jours) => {
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - (jours - 1));
    setStatsVuesDateDebut(formatDateLocale(debut));
    setStatsVuesDateFin(formatDateLocale(fin));
  };

  useEffect(() => {
    if (!statsVuesDateDebut || !statsVuesDateFin) return;
    setChargementStatsVues(true);
    setErreurStatsVues(null);
    ProduitsApi.statistiquesVuesVendeur(statsVuesDateDebut, statsVuesDateFin)
      .then((res) => setStatsVues(res))
      .catch((err) => setErreurStatsVues(err.message))
      .finally(() => setChargementStatsVues(false));
  }, [statsVuesDateDebut, statsVuesDateFin]);

  const donneesCategoriesVues = (statsVues?.categories_plus_consultees || []).map((c) => ({
    label: c.label || t("dashboard.uncategorized"),
    value: c.value,
  }));

  useEffect(() => {
    Promise.all([
      ProduitsApi.mesProduits(),
      ProduitsApi.historiqueContactsVendeur(),
      AuthentificationApi.getprofil(),
    ])
      .then(([produitsRes, contactsRes, profilRes]) => {
        setProduits(produitsRes.produits || []);
        setContacts(contactsRes.contacts || []);
        setVuesProfil(profilRes.utilisateur?.nombre_vues_profil || 0);
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend) : le
  // nombre de produits / les graphiques se mettent à jour sans rechargement —
  // produitEvent diffuse les produits de tout le monde, filtré ici à ce vendeur
  useEffect(() => {
    if (!produitEvent) return;
    const { type, data } = produitEvent;
    if (data.vendeur_id !== undefined && data.vendeur_id !== utilisateur?.id) return;
    setProduits((liste) => {
      if (type === "produit.deleted") {
        return liste.filter((p) => p.id !== data.id);
      }
      const existe = liste.some((p) => p.id === data.id);
      return existe
        ? liste.map((p) => (p.id === data.id ? { ...p, ...data } : p))
        : [...liste, data];
    });
  }, [produitEvent, utilisateur?.id]);

  // réactivité temps réel (voir Produits/signals.py::broadcast_contact_produit)
  // — diffusé uniquement au vendeur concerné (groupe WebSocket personnel), pas
  // besoin de filtrer par vendeur_id ici
  useEffect(() => {
    if (!contactEvent) return;
    setContacts((liste) => [contactEvent.data, ...liste]);
  }, [contactEvent]);

  // "Contacter un admin" — charge l'historique dès le montage (même si
  // l'onglet "support" n'est pas encore ouvert, pour que la pastille/l'attente
  // ne bloque pas l'ouverture de l'onglet) ; voir Support/ContacterAdmin.jsx
  useEffect(() => {
    // uniquement nécessaire pour déchiffrer d'éventuels messages LEGACY
    // encore au format E2E client (voir ci-dessous) — échec silencieux
    garantirCleE2E().catch(() => {});
    MessagerieApi.mesMessagesAdmin()
      .then((res) => setMessagesSupport(res.messages_admin || []))
      .catch((err) => setErreurSupport(err.message))
      .finally(() => setChargementSupport(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // déchiffre contenu (chiffré pour moi-même, l'auteur) et reponse (chiffrée
  // par l'admin qui a répondu — il faut sa clé publique, pas la mienne) —
  // uniquement pour les messages encore au format legacy 'e2e_client' (voir
  // Messagerie/views.py::_serialiseMessageAdmin) : les nouveaux messages
  // passent par le coffre support, déjà en clair dans m.contenu/m.reponse
  useEffect(() => {
    if (messagesSupport.length === 0) return;
    let annule = false;
    (async () => {
      const resultats = {};
      for (const m of messagesSupport) {
        const entree = {};
        if (m.chiffre && m.format_chiffrement === "e2e_client") {
          if (!clePriveeCryptoKey || !clePubliqueJwk) {
            // pas encore prête — retentera au prochain passage de cet effet
          } else if (m.cle_contenu_moi) {
            try {
              entree.contenu = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueJwk, m.contenu, m.iv_contenu, m.cle_contenu_moi, m.iv_cle_contenu_moi
              );
            } catch { entree.contenu = null; }
          } else {
            entree.contenu = null;
          }
        }
        if (m.reponse && m.reponse_format_chiffrement === "e2e_client") {
          if (!clePriveeCryptoKey) {
            // pas encore prête
          } else if (m.cle_reponse_moi) {
            try {
              const clePubliqueAdmin = await obtenirClePubliqueDe(m.admin_repondant_id);
              entree.reponse = await dechiffrerEnveloppe(
                clePriveeCryptoKey, clePubliqueAdmin, m.reponse, m.iv_reponse, m.cle_reponse_moi, m.iv_cle_reponse_moi
              );
            } catch { entree.reponse = null; }
          } else {
            entree.reponse = null;
          }
        }
        if (Object.keys(entree).length > 0) resultats[m.id] = entree;
      }
      if (!annule && Object.keys(resultats).length > 0) setDechiffresSupport((prev) => ({ ...prev, ...resultats }));
    })();
    return () => { annule = true; };
  }, [messagesSupport, clePriveeCryptoKey, clePubliqueJwk, obtenirClePubliqueDe]);

  // réactivité temps réel (voir Messagerie/views.py::repondreMessageAdmin) —
  // diffusé au groupe personnel "user_<id>" de ce vendeur dès qu'un admin répond
  useEffect(() => {
    if (!messageAdminEvent || messageAdminEvent.type !== "message_admin.repondu") return;
    const data = messageAdminEvent.data;
    if (data.vendeur_id !== utilisateur?.id) return;
    setMessagesSupport((liste) => liste.map((m) => (m.id === data.id ? data : m)));
  }, [messageAdminEvent, utilisateur?.id]);

  const envoyerMessageSupport = async (e) => {
    e.preventDefault();
    const contenu = brouillonSupport.trim();
    if (!contenu) return;
    setEnvoiSupportEnCours(true);
    setErreurSupport(null);
    try {
      // chiffré côté serveur ("coffre support") — aucun chiffrement client
      // requis, voir Messagerie/services/support_chiffrement_service.py
      const res = await MessagerieApi.contacterAdmin(contenu);
      setMessagesSupport((liste) => [res.message_admin, ...liste]);
      setBrouillonSupport("");
    } catch (err) {
      setErreurSupport(err.message);
    } finally {
      setEnvoiSupportEnCours(false);
    }
  };

  const totalProduits = produits.length;
  const totalDisponibles = produits.filter((p) => p.est_disponible).length;
  const totalContacts = produits.reduce((somme, p) => somme + (p.nombre_contacts || 0), 0);
  const totalVues = produits.reduce((somme, p) => somme + (p.nombre_vues || 0), 0);

  const donneesPlusConsultes = [...produits]
    .filter((p) => (p.nombre_vues || 0) > 0)
    .sort((a, b) => (b.nombre_vues || 0) - (a.nombre_vues || 0))
    .slice(0, NOMBRE_PRODUITS_GRAPHE)
    .map((p) => ({ label: p.nom, value: p.nombre_vues || 0 }));

  const donneesPlusContactes = [...produits]
    .filter((p) => (p.nombre_contacts || 0) > 0)
    .sort((a, b) => (b.nombre_contacts || 0) - (a.nombre_contacts || 0))
    .slice(0, NOMBRE_PRODUITS_GRAPHE)
    .map((p) => ({ label: p.nom, value: p.nombre_contacts || 0 }));

  const donneesApercu = [
    { label: t("dashboard.profileViews"), value: vuesProfil },
    { label: t("dashboard.totalProductViews"), value: totalVues },
    { label: t("dashboard.totalContacts"), value: totalContacts },
  ].filter((d) => d.value > 0);

  // "RekoltHT-Report-2026-08-06-14h32.pdf" — nom du fichier au moment du
  // téléchargement (pas celui de génération du rapport côté serveur, qui
  // n'est pas renvoyé) ; ":" évité dans l'heure (invalide dans un nom de
  // fichier Windows).
  const nomFichierRapport = () => {
    const maintenant = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())}`;
    const heure = `${pad(maintenant.getHours())}h${pad(maintenant.getMinutes())}`;
    return `RekoltHT-Report-${date}-${heure}.pdf`;
  };

  const telechargerRapport = () => {
    setTelechargementEnCours(true);
    setErreurTelechargement(null);
    ProduitsApi.statistiquesVendeurPdf()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement("a");
        lien.href = url;
        lien.download = nomFichierRapport();
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setErreurTelechargement(t("dashboard.downloadReportError")))
      .finally(() => setTelechargementEnCours(false));
  };

  // Intl ne reconnaît pas "ht" (créole haïtien) comme locale BCP47 valide —
  // on retombe sur le français pour le formatage de date dans ce cas
  const localeAffichage = { fr: "fr-FR", en: "en-US", ht: "fr-HT" }[lang] || "fr-FR";
  const formaterDate = (iso) => new Date(iso).toLocaleString(localeAffichage, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const nomAffiche = utilisateur ? `${utilisateur.prenom || ""} ${utilisateur.nom || ""}`.trim() : "";

  // trois onglets internes (voir sectionActive plus haut) — "Mes produits"
  // vivait auparavant sur sa propre route (/produits/mesProduits, voir
  // mesProduits.jsx), désormais intégré ici comme "support" l'est déjà
  const onglets = [
    { section: "overview", label: t("dashboard.tabOverview"), Icone: LayoutDashboard },
    { section: "produits", label: t("dashboard.tabMyProducts"), Icone: Package },
    { section: "support", label: t("dashboard.tabSupport"), Icone: MessageCircle, badge: messagesSupport.filter((m) => !m.reponse).length },
  ];

  return (
    <div className="tdb-shell">
      <aside className={`tdb-sidebar ${sidebarOuvert ? "tdb-sidebar--ouverte" : ""}`}>
        <div className="tdb-sidebar__brand">
          <img src={logoSite} alt="" className="tdb-sidebar__logo" />
          <div>
            <p className="tdb-sidebar__brand-name">RekoltHt</p>
            <p className="tdb-sidebar__brand-tag">{t("dashboard.sidebarTag")}</p>
          </div>
        </div>

        <nav className="tdb-sidebar__nav">
          <p className="tdb-sidebar__nav-label">{t("admin.sidebar.navigation")}</p>
          {onglets.map(({ section, label, Icone, badge }) => (
            <button
              key={section}
              type="button"
              className={`tdb-sidebar__link ${sectionActive === section ? "tdb-sidebar__link--active" : ""}`}
              onClick={() => { setSectionActive(section); setSidebarOuvert(false); }}
            >
              <Icone size={18} />
              <span>{label}</span>
              {!!badge && <span className="tdb-sidebar__badge">{badge}</span>}
            </button>
          ))}
        </nav>

        <div className="tdb-sidebar__footer">
          <button type="button" className="tdb-sidebar__back" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            {t("admin.sidebar.backToSite")}
          </button>
          <div className="tdb-sidebar__user">
            <div className="tdb-sidebar__avatar">
              <User size={16} />
            </div>
            <div className="tdb-sidebar__user-info">
              <p className="tdb-sidebar__user-name">{nomAffiche || t("dashboard.sidebarRole")}</p>
              <p className="tdb-sidebar__user-role">{t("dashboard.sidebarRole")}</p>
            </div>
            <button
              type="button"
              className="tdb-sidebar__logout"
              onClick={handleDeconnexion}
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOuvert && <div className="tdb-sidebar__overlay" onClick={() => setSidebarOuvert(false)} />}

      <div className="tdb-content">
        <header className="tdb-topbar">
          <button
            type="button"
            className="tdb-topbar__menu-btn"
            onClick={() => setSidebarOuvert(true)}
            aria-label={t("admin.sidebar.openMenu")}
          >
            <Menu size={20} />
          </button>

          <nav className="tdb-topbar__breadcrumb" aria-label="Breadcrumb">
            <span>{t("dashboard.title")}</span>
            <span className="tdb-topbar__breadcrumb-sep">/</span>
            <span className="tdb-topbar__breadcrumb-current">
              {onglets.find((o) => o.section === sectionActive)?.label}
            </span>
          </nav>

          <div className="tdb-topbar__actions">
            <button
              type="button"
              className="tdb-topbar__icon-btn"
              onClick={telechargerRapport}
              disabled={telechargementEnCours}
              aria-label={t("dashboard.downloadReport")}
              title={t("dashboard.downloadReport")}
            >
              <Download size={18} />
            </button>

            <button
              type="button"
              className="tdb-topbar__icon-btn"
              onClick={toggleTheme}
              aria-label={t("nav.toggleTheme")}
              title={t("nav.toggleTheme")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="tdb-topbar__account" ref={menuCompteRef}>
              <button
                type="button"
                className="tdb-topbar__account-btn"
                onClick={() => setMenuCompteOuvert((o) => !o)}
              >
                <div className="tdb-topbar__avatar">
                  <User size={16} />
                </div>
                <span className="tdb-topbar__account-name">{nomAffiche}</span>
                <ChevronDown size={14} className={menuCompteOuvert ? "tdb-topbar__chevron--ouvert" : ""} />
              </button>
              {menuCompteOuvert && (
                <div className="tdb-topbar__dropdown">
                  <button type="button" onClick={() => { navigate("/profil"); setMenuCompteOuvert(false); }}>
                    <User size={14} />
                    {t("nav.myProfile")}
                  </button>
                  <div className="tdb-topbar__dropdown-divider" />
                  <button type="button" className="tdb-topbar__dropdown-item--danger" onClick={handleDeconnexion}>
                    <LogOut size={14} />
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="tdb-main">
          <div className="tdb-page-header">
            <div>
              <h1 className="tdb-page-title">{t("dashboard.title")}</h1>
              <p className="tdb-page-subtitle">{t("dashboard.subtitle")}</p>
            </div>
          </div>

          {sectionActive === "overview" && chargement && <p className="tdb-field-value">{t("profile.loading")}</p>}
          {sectionActive === "overview" && erreur && <p className="tdb-error">✗ {erreur}</p>}
          {sectionActive === "overview" && erreurTelechargement && <p className="tdb-error">✗ {erreurTelechargement}</p>}

          {sectionActive === "overview" && !chargement && !erreur && (
            <>
              <section className="tdb-stats-grid">
                <div className="tdb-stat-card">
                  <div className="tdb-stat-card__icon tdb-stat-card__icon--foret"><Package size={20} /></div>
                  <div>
                    <p className="tdb-stat-card__value">{totalProduits}</p>
                    <p className="tdb-stat-card__label">{t("dashboard.totalProducts")}</p>
                  </div>
                </div>
                <div className="tdb-stat-card">
                  <div className="tdb-stat-card__icon tdb-stat-card__icon--vert"><Package size={20} /></div>
                  <div>
                    <p className="tdb-stat-card__value">{totalDisponibles}</p>
                    <p className="tdb-stat-card__label">{t("dashboard.availableProducts")}</p>
                  </div>
                </div>
                <div className="tdb-stat-card">
                  <div className="tdb-stat-card__icon tdb-stat-card__icon--terracotta"><MessageCircle size={20} /></div>
                  <div>
                    <p className="tdb-stat-card__value">{totalContacts}</p>
                    <p className="tdb-stat-card__label">{t("dashboard.totalContacts")}</p>
                  </div>
                </div>
                <div className="tdb-stat-card">
                  <div className="tdb-stat-card__icon tdb-stat-card__icon--ardoise"><Eye size={20} /></div>
                  <div>
                    <p className="tdb-stat-card__value">{vuesProfil}</p>
                    <p className="tdb-stat-card__label">{t("dashboard.profileViews")}</p>
                  </div>
                </div>
              </section>

              <section className="admin-charts-grid">
                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("dashboard.chartMostViewedTitle")}</h3>
                  <p className="admin-chart-card__subtitle">{t("dashboard.chartMostViewedSubtitle")}</p>
                  {donneesPlusConsultes.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("admin.dashboard.noChartData")}</p>
                  ) : (
                    <HistogramChart data={donneesPlusConsultes} color="var(--chart-series-1)" />
                  )}
                </div>

                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("dashboard.topProductsTitle")}</h3>
                  <p className="admin-chart-card__subtitle">{t("dashboard.chartMostContactedSubtitle")}</p>
                  {donneesPlusContactes.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("dashboard.topProductsEmpty")}</p>
                  ) : (
                    <HistogramChart data={donneesPlusContactes} color="var(--chart-series-2)" />
                  )}
                </div>

                <div className="admin-chart-card">
                  <h3 className="admin-chart-card__title">{t("dashboard.chartProfileOverviewTitle")}</h3>
                  <p className="admin-chart-card__subtitle">{t("dashboard.chartProfileOverviewSubtitle")}</p>
                  {donneesApercu.length === 0 ? (
                    <p className="admin-chart-card__empty">{t("admin.dashboard.noChartData")}</p>
                  ) : (
                    <HistogramChart data={donneesApercu} color="var(--chart-series-3)" />
                  )}
                </div>
              </section>

              <div className="tdb-card">
                <div className="admin-card__header-row">
                  <h3 className="tdb-card__title tdb-card__title--accent">{t("dashboard.viewsStatsTitle")}</h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeVues(7)}>
                      {t("admin.dashboard.periodWeek")}
                    </button>
                    <button type="button" className="admin-action-btn admin-action-btn--secondary" onClick={() => appliquerRaccourciPeriodeVues(30)}>
                      {t("admin.dashboard.periodMonth")}
                    </button>
                    <input
                      type="date" className="admin-input" value={statsVuesDateDebut}
                      max={statsVuesDateFin} onChange={(e) => setStatsVuesDateDebut(e.target.value)}
                    />
                    <input
                      type="date" className="admin-input" value={statsVuesDateFin}
                      min={statsVuesDateDebut} max={dateAujourdhuiVues} onChange={(e) => setStatsVuesDateFin(e.target.value)}
                    />
                  </div>
                </div>

                {erreurStatsVues && <p className="tdb-error">✗ {erreurStatsVues}</p>}
                {chargementStatsVues && <p className="tdb-field-value">{t("profile.loading")}</p>}

                {!chargementStatsVues && !erreurStatsVues && statsVues && (
                  <section className="admin-charts-grid">
                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("dashboard.chartProfileViewsOverTimeTitle")}</h3>
                      <p className="admin-chart-card__subtitle">{t("dashboard.chartProfileViewsOverTimeSubtitle")}</p>
                      {statsVues.profil.total === 0 ? (
                        <p className="admin-chart-card__empty">{t("dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <LineChart
                          data={statsVues.profil.serie_temporelle.map((p) => ({ label: p.date, value: p.value }))}
                          color="var(--chart-series-1)"
                        />
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("dashboard.viewersListTitle")}</h3>
                      <p className="admin-chart-card__subtitle">{t("dashboard.viewersListSubtitle")}</p>
                      {statsVues.profil.visiteurs.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <ul className="admin-item-list">
                          {statsVues.profil.visiteurs.map((v) => (
                            <li key={v.id} className="tdb-field-value" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                              <span>{v.nom}</span>
                              <span>{t("dashboard.viewsCount", { n: v.nombre_vues })}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("dashboard.chartTopProductsViewedTitle")}</h3>
                      <p className="admin-chart-card__subtitle">{t("dashboard.chartTopProductsViewedSubtitle")}</p>
                      {statsVues.produits_plus_consultes.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("dashboard.noViewsThisPeriod")}</p>
                      ) : (
                        <HistogramChart data={statsVues.produits_plus_consultes} color="var(--chart-series-2)" />
                      )}
                    </div>

                    <div className="admin-chart-card">
                      <h3 className="admin-chart-card__title">{t("dashboard.chartTopCategoriesViewedTitle")}</h3>
                      <p className="admin-chart-card__subtitle">{t("dashboard.chartTopCategoriesViewedSubtitle")}</p>
                      {donneesCategoriesVues.length === 0 ? (
                        <p className="admin-chart-card__empty">{t("dashboard.noViewsThisPeriod")}</p>
                      ) : donneesCategoriesVues.length <= 3 ? (
                        <DonutChart data={donneesCategoriesVues} colors={["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)"]} />
                      ) : (
                        <HistogramChart data={donneesCategoriesVues} color="var(--chart-series-3)" />
                      )}
                    </div>
                  </section>
                )}
              </div>

              <div className="tdb-card">
                <h3 className="tdb-card__title tdb-card__title--accent">
                  <Clock size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
                  {t("dashboard.historyTitle")}
                </h3>

                {contacts.length === 0 ? (
                  <p className="tdb-field-value">{t("dashboard.historyEmpty")}</p>
                ) : (
                  <ul className="tdb-historique">
                    {contacts.map((c) => (
                      <li className="tdb-historique-ligne" key={c.id}>
                        <div className="tdb-historique-icone"><User size={15} /></div>
                        <div className="tdb-historique-texte">
                          <p className="tdb-historique-titre">
                            <strong>{c.acheteur_nom || t("dashboard.anonymousBuyer")}</strong>
                            {" "}{t("dashboard.contactedProduct")}{" "}
                            <strong>{c.produit_nom}</strong>
                          </p>
                          <p className="tdb-historique-date">{formaterDate(c.date_contact)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {sectionActive === "produits" && (
            <>
              <div className="tdb-produits-header">
                <div>
                  <h1 className="tdb-page-title">{t("myProducts.title")}</h1>
                  <p className="tdb-page-subtitle">{t("myProducts.subtitle")}</p>
                </div>
                <button type="button" className="tdb-btn tdb-btn--primary" onClick={() => navigate("/produits/ajouter")}>
                  <Plus size={16} />
                  {t("myProducts.addProduct")}
                </button>
              </div>

              {chargement && <p className="tdb-field-value">{t("profile.loading")}</p>}
              {erreur && <p className="tdb-error">✗ {erreur}</p>}

              {!chargement && !erreur && (
                produits.length === 0 ? (
                  <div className="tdb-card tdb-produits-vide">
                    <p className="tdb-field-value">{t("myProducts.noProducts")}</p>
                    <button type="button" className="tdb-btn tdb-btn--primary" onClick={() => navigate("/produits/ajouter")}>
                      <Plus size={16} />
                      {t("myProducts.addProduct")}
                    </button>
                  </div>
                ) : (
                  <div className="tdb-produits-grid">
                    {produits.map((p) => (
                      <ProductCard
                        key={p.id}
                        produit={versProduitAffiche(p, t("profile.notSpecified"), t("auth.haiti"))}
                        extra={
                          <div className="tdb-produits-card-extra">
                            <span className={`tdb-produits-badge ${p.est_disponible ? "tdb-produits-badge--dispo" : "tdb-produits-badge--indispo"}`}>
                              {p.est_disponible ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              {p.est_disponible ? t("myProducts.available") : t("myProducts.unavailable")}
                            </span>
                            <span className="tdb-produits-contacts">
                              <MessageCircle size={14} />
                              {p.nombre_contacts || 0} {t("myProducts.contactsLabel")}
                            </span>
                          </div>
                        }
                        onDetails={(pr) => navigate(`/produits/modifier?id=${pr.id}`)}
                        detailsLabel={t("myProducts.editProduct")}
                        detailsIcon={<Pencil size={15} strokeWidth={2.2} />}
                        utilisateurId={utilisateur?.id}
                      />
                    ))}
                  </div>
                )
              )}
            </>
          )}

          {sectionActive === "support" && (
            <>
              <div className="tdb-card">
                <div className="tdb-support-header">
                  <div className="tdb-support-header__icon"><ShieldCheck size={22} /></div>
                  <div>
                    <h3 className="tdb-card__title tdb-card__title--accent">{t("supportAdmin.title")}</h3>
                    <p className="tdb-field-value">{t("supportAdmin.subtitle")}</p>
                  </div>
                </div>

                <form className="tdb-support-form" onSubmit={envoyerMessageSupport}>
                  <textarea
                    className="tdb-textarea"
                    placeholder={t("supportAdmin.placeholder")}
                    value={brouillonSupport}
                    onChange={(e) => setBrouillonSupport(e.target.value)}
                  />
                  <button type="submit" className="tdb-btn tdb-btn--primary" disabled={envoiSupportEnCours || !brouillonSupport.trim()}>
                    <Send size={16} />
                    {envoiSupportEnCours ? t("profile.loading") : t("supportAdmin.send")}
                  </button>
                  {erreurSupport && <p className="tdb-error">✗ {erreurSupport}</p>}
                </form>
              </div>

              <div className="tdb-card">
                <h3 className="tdb-card__title tdb-card__title--accent">{t("supportAdmin.historyTitle")}</h3>

                {chargementSupport && <p className="tdb-field-value">{t("profile.loading")}</p>}
                {!chargementSupport && messagesSupport.length === 0 && (
                  <p className="tdb-field-value">{t("supportAdmin.noMessages")}</p>
                )}

                {!chargementSupport && messagesSupport.length > 0 && (
                  <ul className="tdb-support-liste">
                    {messagesSupport.map((m) => (
                      <li className="tdb-support-item" key={m.id}>
                        <div className="tdb-support-item__bulle tdb-support-item__bulle--envoye">
                          <p className="tdb-support-item__texte">
                            {m.format_chiffrement === "e2e_client" ? texteSupportChamp(dechiffresSupport[m.id]?.contenu, t) : m.contenu}
                          </p>
                          <span className="tdb-support-item__date">{formaterDate(m.date_envoi)}</span>
                        </div>

                        {m.reponse ? (
                          <div className="tdb-support-item__bulle tdb-support-item__bulle--reponse">
                            <p className="tdb-support-item__auteur">
                              <ShieldCheck size={14} />
                              {m.admin_repondant_nom}
                            </p>
                            <p className="tdb-support-item__texte">
                              {m.reponse_format_chiffrement === "e2e_client" ? texteSupportChamp(dechiffresSupport[m.id]?.reponse, t) : m.reponse}
                            </p>
                            <span className="tdb-support-item__date">{formaterDate(m.date_reponse)}</span>
                          </div>
                        ) : (
                          <p className="tdb-support-item__attente">
                            <Clock size={14} />
                            {t("supportAdmin.awaitingReply")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

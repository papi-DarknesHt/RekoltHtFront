import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, MessageCircle, User, Clock,
  Menu, ArrowLeft, LogOut, Sun, Moon, ChevronDown, Download, Eye,
} from "lucide-react";
import Footer from "../components/Footer.jsx";
import { HistogramChart } from "../components/AdminCharts.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useThemeStore } from "../api/themeStore.js";
import { ProduitsApi } from "../api/produits";
import { AuthentificationApi } from "../api/auth";
import logoSite from "../assets/Images/Asset5.svg";
import "../assets/CSS/TableauDeBordVendeur.css";

const NOMBRE_PRODUITS_GRAPHE = 8;

// même DESIGN que le shell d'AdminDashboard.jsx (sidebar + topbar) mais
// classes/variables CSS propres à cette page (voir TableauDeBordVendeur.css,
// préfixe "tdb-") — aucune des deux pages ne dépend du fichier CSS de l'autre,
// pour qu'un ajustement sur l'une n'affecte jamais l'autre
export default function TableauDeBordVendeur() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const deconnexion = useAuthStore((s) => s.deconnexion);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const contactEvent = useGlobalStore((s) => s.contactEvent);

  const [sidebarOuvert, setSidebarOuvert] = useState(false);
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);
  const menuCompteRef = useRef(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState(null);

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

  const telechargerRapport = () => {
    setTelechargementEnCours(true);
    setErreurTelechargement(null);
    ProduitsApi.statistiquesVendeurPdf()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement("a");
        lien.href = url;
        lien.download = "rapport-rekoltht.pdf";
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

  const onglets = [
    { to: "/produits/tableau-de-bord", label: t("dashboard.tabOverview"), Icone: LayoutDashboard },
    { to: "/produits/mesProduits", label: t("dashboard.tabMyProducts"), Icone: Package },
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
          {onglets.map(({ to, label, Icone }) => (
            <Link
              key={to}
              to={to}
              className={`tdb-sidebar__link ${location.pathname === to ? "tdb-sidebar__link--active" : ""}`}
              onClick={() => setSidebarOuvert(false)}
            >
              <Icone size={18} />
              <span>{label}</span>
            </Link>
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

          {chargement && <p className="tdb-field-value">{t("profile.loading")}</p>}
          {erreur && <p className="tdb-error">✗ {erreur}</p>}
          {erreurTelechargement && <p className="tdb-error">✗ {erreurTelechargement}</p>}

          {!chargement && !erreur && (
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
        </main>
      </div>

      <Footer />
    </div>
  );
}

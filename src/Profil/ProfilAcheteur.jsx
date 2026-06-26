import React from "react";
import {
  Bell,
  ShoppingCart,
  User,
  Camera,
  MessageSquare,
  ChevronRight,
  Mail,
  Lock,
  BellRing,
  LogOut,
  MapPin,
  Pencil,
  History,
  Shield,
  ClipboardEdit,
  Building2,
  Users,
} from "lucide-react";
import "../assets/CSS/ProfilAcheteur.css";
import NavBar from "../components/NavBar.jsx";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "./ProfilStore.js"
import Footer from "../components/Footer.jsx"
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";

// Données statiques de démonstration — à remplacer par les données réelles
// venant de votre API / store (utilisateur, produits consultés, vendeurs...).
const user = {
  name: "Jean Samantha",
  role: "Agricultural Producer",
  badge: "Achteur", // "Acheteur" dans la maquette
  location: "Artibonite, HT",
  email: "j.dupont@rekoltht.com",
  phone: "+509 37XX-XXXX",
  address: "Route Nationale #1, Gonaïves, Artibonite, Haïti",
};

const recentProducts = [
  {
    id: 1,
    name: "Engrais Organique NPK",
    price: "4,500 HTG",
    unit: "/ sac",
    image: "/images/engrais-npk.jpg",
    badge: "En Stock",
  },
  {
    id: 2,
    name: "Semences de Riz TCS-10",
    price: "2,200 HTG",
    unit: "/ kg",
    image: "/images/semences-riz.jpg",
  },
  {
    id: 3,
    name: "Citron",
    price: "20 HTG",
    image: "/images/citron.jpg",
  },
  {
    id: 4,
    name: "Zaboka",
    price: "30 HTG",
    image: "/images/zaboka.jpg",
  },
];

const contactedSellers = [
  {
    id: 1,
    initials: "AS",
    name: "Agro-Supply Haiti",
    lastContact: "DERNIER CONTACT: HIER",
  },
  {
    id: 2,
    initials: "SV",
    name: "Semences de la Vallée",
    lastContact: "DERNIER CONTACT: 3 J.",
  },
];

const accountActions = [
  {
    id: "email",
    icon: Mail,
    title: "Changer l'adresse e-mail",
    description: `L'e-mail actuel est ${user.email}`,
  },
  {
    id: "security",
    icon: Lock,
    title: "Mot de passe et Sécurité",
    description: "Dernière modification il y a 3 mois",
  },
  {
    id: "notifications",
    icon: BellRing,
    title: "Préférences de notification",
    description: "Gérer les alertes SMS et e-mail",
  },
];



export default function ProfilAcheteur() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const entreprise  = useAuthStore((s) => s.entreprise);
  const deconnexion = useAuthStore((s) => s.deconnexion);

  // ── profil réel (bio, adresse, photo, ...) venant de /Registration/profil/
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);

  // Un compte "Antrepriz" affiche le nom/logo de l'entreprise à la place
  // de l'identité personnelle de l'utilisateur connecté : l'entreprise
  // doit appartenir à l'utilisateur connecté (proprietaire_id === utilisateur.id).
  const isEntreprise = !!(entreprise && entreprise.proprietaire_id === utilisateur?.id);
  const nomAffiche = isEntreprise
    ? entreprise.nom_Entreprise
    : `${utilisateur?.nom || ""} ${utilisateur?.prenom || ""}`.trim();
  const avatarAffiche = isEntreprise
    ? entreprise.logo
    : profil?.photo_profil;

  const [activeTab, setActiveTab] = useState("personal");

  // Un admin (profil.role === 'admin') voit deux onglets supplémentaires :
  // la liste de tous les utilisateurs et celle de toutes les entreprises créées.
  const isAdmin = profil?.role === "admin" || "Admin";
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminEntreprises, setAdminEntreprises] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);

  // au montage : on récupère le profil à jour (photo de profil, adresse, ...)
  useEffect(() => {
    afficherProfil().catch(() => {
      // l'erreur est déjà stockée dans le store, rien d'autre à faire ici
    });
  }, [afficherProfil]);

  useEffect(() => {
    if (activeTab === "admin_users" && isAdmin) {
      setAdminLoading(true);
      setAdminError(null);
      AuthentificationApi.listerUtilisateursAdmin()
        .then((res) => setAdminUsers(res.utilisateurs || []))
        .catch((err) => setAdminError(err.message))
        .finally(() => setAdminLoading(false));
    }
    if (activeTab === "admin_entreprises" && isAdmin) {
      setAdminLoading(true);
      setAdminError(null);
      AuthentificationApi.listerEntreprises()
        .then((res) => setAdminEntreprises(res.entreprises || []))
        .catch((err) => setAdminError(err.message))
        .finally(() => setAdminLoading(false));
    }
  }, [activeTab, isAdmin]);

  const handleDeconnexion2 = async () => {
    await deconnexion();
    navigate("/");
  };

  // Si l'utilisateur n'est pas encore chargé, on évite d'accéder à utilisateur.nom
  if (!utilisateur) {
    return (
      <div className="profil-page">
        <NavBar />
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p>{t("profile.loading")}</p>
          <button onClick={() => navigate("/auth")}>{t("profile.signIn")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profil-page">

      {/* ===== Barre de navigation ===== */}
      <NavBar />

      <div className="profil-layout">
        {/* ===== Barre latérale ===== */}
        <aside className="profil-sidebar">
          <div className="profil-sidebar__user">
            <div className="profil-sidebar__avatar">
              {avatarAffiche ? (
                <img src={avatarAffiche} alt={isEntreprise ? "Logo entreprise" : "Photo profil"} className="profil-sidebar__avatar-image" />
              ) : (
                <User size={20} />
              )}
            </div>
            <div>
              <p className="profil-sidebar__name">{nomAffiche}</p>
            </div>
          </div>

          <nav className="profil-sidebar__nav">
            <a
              href="#"
              className={`profil-sidebar__item ${activeTab === "personal" ? "profil-sidebar__item--active" : ""}`}
              onClick={(e) => { e.preventDefault(); setActiveTab("personal"); }}
            >
              <User size={18} />
              {t("profile.personalInfoTab")}
            </a>
            {isEntreprise && (
              <a
                href="#"
                className={`profil-sidebar__item ${activeTab === "entreprise" ? "profil-sidebar__item--active" : ""}`}
                onClick={(e) => { e.preventDefault(); setActiveTab("entreprise"); }}
              >
                <Building2 size={18} />
                {t("profile.companyTab")}
              </a>
            )}
            {isAdmin && (
              <>
                <a
                  href="#"
                  className={`profil-sidebar__item ${activeTab === "admin_users" ? "profil-sidebar__item--active" : ""}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab("admin_users"); }}
                >
                  <Users size={18} />
                  {t("profile.adminUsersTab")}
                </a>
                <a
                  href="#"
                  className={`profil-sidebar__item ${activeTab === "admin_entreprises" ? "profil-sidebar__item--active" : ""}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab("admin_entreprises"); }}
                >
                  <Building2 size={18} />
                  {t("profile.adminCompaniesTab")}
                </a>
              </>
            )}
          </nav>

          <div className="profil-sidebar__footer ">
            <button onClick={handleDeconnexion2} className="profil-sidebar__item profil-sidebar__item--active">
              <LogOut size={18} />
              {t("profile.logout")}
            </button>
          </div>
        </aside>

        {/* ===== Contenu principal ===== */}
        <main className="profil-main">
          {activeTab === "personal" && (
            <>
              <div className="profil-header">
                <div>
                  <h1 className="profil-title">{t("profile.title")}</h1>
                  <p className="profil-subtitle">
                    {t("profile.subtitle")}
                  </p>
                </div>
                <button className="profil-btn profil-btn--primary" onClick={() => navigate("/update_profil")}>
                  <Pencil size={16} />
                  {t("profile.editProfile")}
                </button>
              </div>

              {/* ----- Carte profil + Informations de contact ----- */}
              <section className="profil-cards">
                <div className="profil-card profil-card--identity">
                  <div className="profil-avatar-wrapper">
                    {/* photo_profil / entreprise_logo viennent du backend en URL absolue (request.build_absolute_uri) */}
                    {avatarAffiche ? (
                      <img
                        src={avatarAffiche}
                        alt={nomAffiche}
                        className="profil-avatar-image"
                      />
                    ) : (
                      <div className="profil-avatar-image profil-avatar-image--placeholder">
                        <User size={32} />
                      </div>
                    )}

                  </div>
                  <h2 className="profil-identity__name">{nomAffiche}</h2>
                  <span className="profil-badge">{profil.role}</span>
                  <p className="profil-identity__location">
                    <MapPin size={14} />
                    {profil?.adresse || user.location}
                  </p>
                </div>

                <div className="profil-card profil-card--contact">
                  <h3 className="profil-card__title">{t("profile.contactInfo")}</h3>

                  <div className="profil-contact-grid">
                    <div>
                      <p className="profil-field-label">{t("profile.workEmail")}</p>
                      <p className="profil-field-value">{utilisateur.email}</p>
                    </div>
                    <div>
                      <p className="profil-field-label">{t("profile.phone")}</p>
                      <p className="profil-field-value">{utilisateur.telephone}</p>
                    </div>
                  </div>

                  <hr className="profil-divider" />

                  <div className="profil-contact-grid profil-contact-grid--bottom">
                    <div>
                      <p className="profil-field-label">{t("profile.deliveryAddress")}</p>
                      <p className="profil-field-value">{profil?.adresse || t("profile.notSpecified")}</p>
                    </div>

                  </div>
                </div>
              </section>

              {/* ----- Vendeurs contactés + Avis ----- */}
              <section className="profil-cards profil-cards--bottom">
                <div className="profil-card">
                  <h3 className="profil-card__title profil-card__title--accent">
                    {t("profile.contactedSellers")}
                  </h3>

                  <ul className="profil-seller-list">
                    {contactedSellers.map((seller) => (
                      <li className="profil-seller" key={seller.id}>
                        <div className="profil-seller__avatar">{seller.initials}</div>
                        <div className="profil-seller__info">
                          <p className="profil-seller__name">{seller.name}</p>
                          <p className="profil-seller__contact">{seller.lastContact}</p>
                        </div>
                        <button className="profil-icon-btn" aria-label={`Message à ${seller.name}`}>
                          <MessageSquare size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="profil-card profil-card--empty">
                  <div className="profil-empty">
                    <div className="profil-empty__icon">
                      <ClipboardEdit size={28} />
                    </div>
                    <h3 className="profil-empty__title">{t("profile.reviewsTitle")}</h3>
                    <p className="profil-empty__text">
                      {t("profile.reviewsText")}
                    </p>
                    <button className="profil-btn profil-btn--secondary">
                      {t("profile.searchProducts")}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "entreprise" && isEntreprise && (
            <>
              <div className="profil-header">
                <div>
                  <h1 className="profil-title">{t("profile.companyTitle")}</h1>
                  <p className="profil-subtitle">
                    {t("profile.companySubtitle")}
                  </p>
                </div>
              </div>

              {/* ----- Carte entreprise + Informations de contact ----- */}
              <section className="profil-cards">
                <div className="profil-card profil-card--identity">
                  <div className="profil-avatar-wrapper">
                    {entreprise.logo ? (
                      <img
                        src={entreprise.logo}
                        alt={entreprise.nom_Entreprise}
                        className="profil-avatar-image"
                      />
                    ) : (
                      <div className="profil-avatar-image profil-avatar-image--placeholder">
                        <Building2 size={32} />
                      </div>
                    )}
                  </div>
                  <h2 className="profil-identity__name">{entreprise.nom_Entreprise}</h2>
                  <span className="profil-badge">{entreprise.secteur}</span>
                  <p className="profil-identity__location">
                    <MapPin size={14} />
                    {entreprise.adresse || entreprise.commune || t("profile.notSpecified")}
                  </p>
                </div>

                <div className="profil-card profil-card--contact">
                   <h3 className="profil-card__title profil-card__title--accent">
                    {t("profile.companyDetailsTitle")}
                  </h3>

                  <div className="profil-contact-grid">
                    <div>
                      <p className="profil-field-label">{t("profile.companyRegNum")}</p>
                      <p className="profil-field-value">{entreprise.num_Enregistrement}</p>
                    </div>
                    <div>
                      <p className="profil-field-label">{t("profile.companySector")}</p>
                      <p className="profil-field-value">{entreprise.secteur}</p>
                    </div>
                  </div>

                  <hr className="profil-divider" />

                  <div className="profil-contact-grid profil-contact-grid--bottom">
                    <div>
                      <p className="profil-field-label">{t("profile.companyStatus")}</p>
                      <p className="profil-field-value">{entreprise.statut_verification}</p>
                    </div>
                    <div>
                      <p className="profil-field-label">{t("profile.companyCreatedAt")}</p>
                      <p className="profil-field-value">
                        {entreprise.date_creation ? new Date(entreprise.date_creation).toLocaleDateString() : t("profile.notSpecified")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "admin_users" && isAdmin && (
            <>
              <div className="profil-header">
                <div>
                  <h1 className="profil-title">{t("profile.adminUsersTitle")}</h1>
                  <p className="profil-subtitle">{t("profile.adminUsersSubtitle")}</p>
                </div>
              </div>

              <div className="profil-card">
                <h3 className="profil-card__title profil-card__title--accent">
                  {t("profile.adminUsersTitle")}
                </h3>

                {adminLoading && <p className="profil-field-value">{t("profile.loading")}</p>}
                {adminError && <p className="rk-error">✗ {adminError}</p>}

                {!adminLoading && !adminError && (
                  <ul className="profil-seller-list">
                    {adminUsers.map((u) => (
                      <li className="profil-seller" key={u.id}>
                        <div className="profil-seller__avatar">
                          {(u.prenom?.[0] || "").toUpperCase()}{(u.nom?.[0] || "").toUpperCase()}
                        </div>
                        <div className="profil-seller__info">
                          <p className="profil-seller__name">{u.prenom} {u.nom}</p>
                          <p className="profil-seller__contact">{u.email} — {u.telephone}</p>
                        </div>
                        <span className="profil-badge">{u.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {activeTab === "admin_entreprises" && isAdmin && (
            <>
              <div className="profil-header">
                <div>
                  <h1 className="profil-title">{t("profile.adminCompaniesTitle")}</h1>
                  <p className="profil-subtitle">{t("profile.adminCompaniesSubtitle")}</p>
                </div>
              </div>

              <div className="profil-card">
                <h3 className="profil-card__title profil-card__title--accent">
                  {t("profile.adminCompaniesTitle")}
                </h3>

                {adminLoading && <p className="profil-field-value">{t("profile.loading")}</p>}
                {adminError && <p className="rk-error">✗ {adminError}</p>}

                {!adminLoading && !adminError && (
                  <ul className="profil-seller-list">
                    {adminEntreprises.map((e) => (
                      <li className="profil-seller" key={e.id}>
                        {e.logo ? (
                          <img src={e.logo} alt={e.nom_Entreprise} className="profil-seller__avatar" style={{ objectFit: "cover" }} />
                        ) : (
                          <div className="profil-seller__avatar">
                            <Building2 size={18} />
                          </div>
                        )}
                        <div className="profil-seller__info">
                          <p className="profil-seller__name">{e.nom_Entreprise}</p>
                          <p className="profil-seller__contact">{e.num_Enregistrement} — {e.secteur}</p>
                        </div>
                        <span className="profil-badge">{e.statut_verification}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

        </main>
      </div>
      {/* footer */}
      <Footer />
    </div>
  );
}

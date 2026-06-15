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
} from "lucide-react";
import "../assets/CSS/ProfilAcheteur.css";
import NavBar from "../components/NavBar.jsx";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "./ProfilStore.js"
import Footer from "../components/Footer.jsx"

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
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const deconnexion = useAuthStore((s) => s.deconnexion);

  // ── profil réel (bio, adresse, photo, ...) venant de /Registration/profil/
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);

  // au montage : on récupère le profil à jour (photo de profil, adresse, ...)
  useEffect(() => {
    afficherProfil().catch(() => {
      // l'erreur est déjà stockée dans le store, rien d'autre à faire ici
    });
  }, [afficherProfil]);

  // constante pour deconnexion

  const handleDeconnexion2 = async () => {
    await deconnexion();
    // window.location.href = "/";
    navigate("/");
  };

  // Si l'utilisateur n'est pas encore chargé, on évite d'accéder à utilisateur.nom
  if (!utilisateur) {
    return (
      <div className="profil-page">
        <NavBar />
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p>Chargement du profil ou utilisateur non connecté.</p>
          <button onClick={() => navigate("/auth")}>Se connecter</button>
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
              <User size={20} />
            </div>
            <div>
              <p className="profil-sidebar__name">{utilisateur.nom}</p>
              {/* <p className="profil-sidebar__role">{profil.role}</p> */}
            </div>
          </div>

          <nav className="profil-sidebar__nav">
            <a href="#" className="profil-sidebar__item profil-sidebar__item--active">
              <User size={18} />
              Personal Info
            </a>
          </nav>

          <div className="profil-sidebar__footer">
            <button onClick={handleDeconnexion2} className="profil-sidebar__logout">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* ===== Contenu principal ===== */}
        <main className="profil-main">
          <div className="profil-header">
            <div>
              <h1 className="profil-title">Mon Profil</h1>
              <p className="profil-subtitle">
                Gérez vos informations personnelles et vos préférences.
              </p>
            </div>
            <button className="profil-btn profil-btn--primary" onClick={() => navigate("/update_profil")}>
              <Pencil size={16} />
              Modifier le profil
            </button>
          </div>

          {/* ----- Carte profil + Informations de contact ----- */}
          <section className="profil-cards">
            <div className="profil-card profil-card--identity">
              <div className="profil-avatar-wrapper">
                {/* photo_profil vient du backend en URL absolue (request.build_absolute_uri) */}
                {profil?.photo_profil ? (
                  <img
                    src={profil.photo_profil}
                    alt={utilisateur.nom}
                    className="profil-avatar-image"
                  />
                ) : (
                  <div className="profil-avatar-image profil-avatar-image--placeholder">
                    <User size={32} />
                  </div>
                )}
                <button className="profil-avatar-edit" aria-label="Changer la photo de profil" onClick={() => navigate("/update_profil")}>
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="profil-identity__name">{utilisateur.nom} {utilisateur.prenom}</h2>
              <span className="profil-badge">{profil.role}</span>
              <p className="profil-identity__location">
                <MapPin size={14} />
                {profil?.adresse || user.location}
              </p>
            </div>

            <div className="profil-card profil-card--contact">
              <h3 className="profil-card__title">Informations de contact</h3>

              <div className="profil-contact-grid">
                <div>
                  <p className="profil-field-label">Email Professionnel</p>
                  <p className="profil-field-value">{utilisateur.email}</p>
                </div>
                <div>
                  <p className="profil-field-label">Téléphone</p>
                  <p className="profil-field-value">{utilisateur.telephone}</p>
                </div>
              </div>

              <hr className="profil-divider" />

              <div className="profil-contact-grid profil-contact-grid--bottom">
                <div>
                  {/* affiche l'adresse réelle du profil au lieu de la date d'inscription */}
                  <p className="profil-field-label">Adresse de livraison</p>
                  <p className="profil-field-value">{profil?.adresse || "Non renseignée"}</p>
                </div>

              </div>
            </div>
          </section>



          {/* ----- Vendeurs contactés + Avis ----- */}
          <section className="profil-cards profil-cards--bottom">
            <div className="profil-card">
              <h3 className="profil-card__title profil-card__title--accent">
                Vendeurs contactés
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
                <h3 className="profil-empty__title">Avis et Commentaires</h3>
                <p className="profil-empty__text">
                  Vous n'avez pas encore laissé d'avis sur vos produits.
                </p>
                <button className="profil-btn profil-btn--secondary">
                  Rechercher des produits
                </button>
              </div>
            </div>
          </section>

          {/* ----- Gestion du compte ----- */}
          <h2 className="profil-section-title">Gestion du Compte</h2>

          <section className="profil-card profil-account">
            {accountActions.map((action) => {
              const Icon = action.icon;
              return (
                <button className="profil-account__item" key={action.id}>
                  <span className="profil-account__icon">
                    <Icon size={20} />
                  </span>
                  <span className="profil-account__text">
                    <span className="profil-account__title">{action.title}</span>
                    <span className="profil-account__description">{action.description}</span>
                  </span>
                  <ChevronRight size={18} className="profil-account__chevron" />
                </button>
              );
            })}


          </section>
        </main>
      </div>
      {/* footer */}
      <Footer />
    </div>
  );
}

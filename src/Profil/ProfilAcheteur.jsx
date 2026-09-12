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
  Building2,
  Users,
  Store,
} from "lucide-react";
import "../assets/CSS/ProfilAcheteur.css";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "./ProfilStore.js"
import Footer from "../components/Footer.jsx"
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import { ProduitsApi } from "../api/produits";
import StarRating from "../components/StarRating.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";


export default function ProfilAcheteur() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const entreprise = useAuthStore((s) => s.entreprise);
  const chargerEntreprise = useAuthStore((s) => s.chargerEntreprise);
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

  // Adresse affichée au format "Section Communale, Commune, Département,
  // Haïti" (champs cascade renseignés via ModifierProfil.jsx) plutôt que le
  // champ libre "adresse" seul — plus complet et cohérent avec la saisie
  // structurée du formulaire de modification.
  const partiesAdresse = [profil?.section_communale, profil?.commune, profil?.departement].filter(Boolean);
  const adresseComplete = partiesAdresse.length > 0
    ? [...partiesAdresse, t("auth.haiti")].join(", ")
    : t("profile.notSpecified");

  // même construction que adresseComplete ci-dessus, mais à partir des
  // champs de localisation d'Entreprise (pas de Profil) — utilisée sur
  // l'onglet "entreprise" pour que la carte d'identité ressemble en tout
  // point à celle d'un compte individuel (demande explicite)
  const partiesAdresseEntreprise = isEntreprise
    ? [entreprise.section_communale, entreprise.commune, entreprise.departement].filter(Boolean)
    : [];
  const adresseCompleteEntreprise = partiesAdresseEntreprise.length > 0
    ? [...partiesAdresseEntreprise, t("auth.haiti")].join(", ")
    : t("profile.notSpecified");

  // Un admin (profil.role === 'admin') voit deux onglets supplémentaires :
  // la liste de tous les utilisateurs et celle de toutes les entreprises créées.
  const isAdmin = profil?.role === "admin";
  // détermine la section "Avis et commentaires" affichée dans l'onglet
  // "personal" ci-dessous : un vendeur voit les avis REÇUS sur ses produits
  // (demande explicite : produit concerné, date, auteur), un acheteur n'a
  // pas cette section du tout (ni "rechercher des produits", retiré pour les
  // deux rôles).
  const isVendeur = profil?.role === "vendeur";

  // L'onglet par défaut dépend du type de compte : un compte entreprise/admin
  // n'a pas d'onglet "personal" dans la sidebar, donc on ne peut pas démarrer
  // sur "personal" pour eux (initialisation paresseuse : entreprise/profil
  // viennent du localStorage donc déjà connus dès le premier rendu).
  const [activeTab, setActiveTab] = useState(() => {
    if (isEntreprise) return "entreprise";
    if (isAdmin) return "admin_users";
    return "personal";
  });

  // TODO: brancher sur une vraie liste de vendeurs contactés quand l'API existera
  const contactedSellers = [];
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminEntreprises, setAdminEntreprises] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);

  // avis reçus sur mes produits (vendeur uniquement, voir isVendeur plus
  // haut) — Produits/views/avisViews.py::listerAvisRecusVendeur
  const [avisRecus, setAvisRecus] = useState([]);
  const [chargementAvisRecus, setChargementAvisRecus] = useState(false);

  const chargerAvisRecus = () => {
    setChargementAvisRecus(true);
    ProduitsApi.listerAvisRecusVendeur()
      .then((res) => setAvisRecus(res.avis || []))
      .catch(() => {})
      .finally(() => setChargementAvisRecus(false));
  };

  // voir reconnectedAt, api/globalStore.js : tout évènement diffusé pendant
  // une coupure WebSocket est perdu — chaque liste de cette page se
  // re-synchronise donc aussi sur une reconnexion, pas seulement sur les
  // évènements individuels (même principe que Messagerie.jsx)
  const reconnectedAt = useGlobalStore((s) => s.reconnectedAt);

  useEffect(() => {
    // "personal" pour un compte individuel, "entreprise" pour une entreprise
    // devenue vendeur — même section "Avis reçus" affichée dans les deux cas
    if ((activeTab !== "personal" && activeTab !== "entreprise") || !isVendeur) return;
    chargerAvisRecus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isVendeur, reconnectedAt]);

  // réactivité temps réel (voir Produits/signals.py::broadcast_avis côté
  // backend) : le payload avisEvent ne porte que produit_id (pas produit_nom
  // ni le vendeur concerné, voir _serialiser_avis) — pas assez pour patcher
  // la liste en place sans un aller-retour supplémentaire ; un simple
  // rechargement de listerAvisRecusVendeur() sur chaque évènement reste
  // largement assez léger ici (liste courte, onglet peu visité) et suit le
  // même principe que Messagerie.jsx (refetch de mesConversations() sur
  // messageEvent plutôt qu'un patch en place)
  const avisEvent = useGlobalStore((s) => s.avisEvent);
  useEffect(() => {
    if (!avisEvent || (activeTab !== "personal" && activeTab !== "entreprise") || !isVendeur) return;
    chargerAvisRecus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisEvent]);

  // au montage, ET après une reconnexion WebSocket : on récupère le profil à
  // jour (photo de profil, adresse, ...)
  useEffect(() => {
    afficherProfil().catch(() => {
      // l'erreur est déjà stockée dans le store, rien d'autre à faire ici
    });
    if (isEntreprise) chargerEntreprise().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afficherProfil, reconnectedAt]);

  // La sidebar n'offre pas le même onglet "personal" à tous les types de
  // compte (entreprise → "entreprise", admin → "admin_users") : on aligne
  // l'onglet actif dès que le type de compte est connu, plutôt que de
  // rester bloqué sur "personal" par défaut.
  useEffect(() => {
    if (isEntreprise) {
      setActiveTab("entreprise");
    } else if (isAdmin) {
      setActiveTab((prev) => (
        prev === "admin_users" || prev === "admin_entreprises" || prev === "personal" ? prev : "admin_users"
      ));
    }
  }, [isEntreprise, isAdmin]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin, reconnectedAt]);

  // réactivité temps réel de la liste "Comptes utilisateurs" (voir
  // Registration/signals.py::broadcast_utilisateur côté backend) — même
  // mécanisme que AdminDashboard.jsx (applyListEvent + utilisateurEvent) :
  // un compte créé/modifié/supprimé par un autre admin (ou depuis
  // AdminDashboard) se reflète ici sans rechargement de page
  const utilisateurEvent = useGlobalStore((s) => s.utilisateurEvent);
  useEffect(() => {
    if (!utilisateurEvent || activeTab !== "admin_users" || !isAdmin) return;
    setAdminUsers((liste) => applyListEvent(liste, utilisateurEvent));
  }, [utilisateurEvent, activeTab, isAdmin]);

  // même principe pour la liste "Entreprises" (voir Registration/signals.py::
  // broadcast_entreprise côté backend)
  const entrepriseEvent = useGlobalStore((s) => s.entrepriseEvent);
  useEffect(() => {
    if (!entrepriseEvent || activeTab !== "admin_entreprises" || !isAdmin) return;
    setAdminEntreprises((liste) => applyListEvent(liste, entrepriseEvent));
  }, [entrepriseEvent, activeTab, isAdmin]);

  // réactivité temps réel du PROPRE profil du visiteur (pas les onglets
  // admin ci-dessus) — sans ça, un statut de vérification KYC validé par un
  // admin, ou un profil modifié depuis un autre appareil, ne se reflète
  // jamais tant que la page n'est pas rechargée manuellement. Même pattern
  // de filtrage par id que DevenirVendeur.jsx (verificationEvent).
  const verificationEvent = useGlobalStore((s) => s.verificationEvent);
  useEffect(() => {
    if (!verificationEvent || String(verificationEvent.utilisateur_id) !== String(utilisateur?.id)) return;
    afficherProfil().catch(() => { });
    if (isEntreprise) chargerEntreprise().catch(() => { });
  }, [verificationEvent]);

  const profilEvent = useGlobalStore((s) => s.profilEvent);
  useEffect(() => {
    if (!utilisateurEvent || String(utilisateurEvent.data?.id) !== String(utilisateur?.id)) return;
    afficherProfil().catch(() => { });
  }, [utilisateurEvent]);

  useEffect(() => {
    if (!profilEvent || String(profilEvent.data?.user_id) !== String(utilisateur?.id)) return;
    afficherProfil().catch(() => { });
  }, [profilEvent]);

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
                <img src={avatarAffiche} alt={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")} className="profil-sidebar__avatar-image" />
              ) : (
                <User size={20} />
              )}
            </div>
            <div>
              <p className="profil-sidebar__name">{nomAffiche}</p>
            </div>
          </div>

          <nav className="profil-sidebar__nav">

            {isEntreprise ? (
              <>
                <a
                  href="#"
                  className={`profil-sidebar__item ${activeTab === "entreprise" ? "profil-sidebar__item--active" : ""}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab("entreprise"); }}
                >
                  <Building2 size={18} />
                  {t("profile.companyTab")}
                </a>
                {/* une entreprise reste une entreprise, mais elle démarre
                    'acheteur' comme n'importe quel compte et doit pouvoir
                    devenir vendeur exactement de la même façon (voir
                    DevenirVendeur.jsx, qui adapte déjà son parcours —
                    patente au lieu de pièce d'identité — pour ce cas) —
                    demande explicite : mêmes fonctionnalités qu'un compte
                    particulier */}
                {!isVendeur && (
                  <a
                    href="#"
                    className="profil-sidebar__item"
                    onClick={(e) => { e.preventDefault(); navigate("/Devenir_Vendeur"); }}
                  >
                    <Store size={18} />
                    {t("profile.becomeSellerTab")}
                  </a>
                )}
              </>
            ) : isAdmin ? (
              <>
                <a
                  href="#"
                  className={`profil-sidebar__item ${activeTab === "personal" ? "profil-sidebar__item--active" : ""}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab("personal"); }}
                >
                  <User size={18} />
                  {t("profile.personalInfoTab")}
                </a>
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
            ) : (
              <>
                <a
                  href="#"
                  className={`profil-sidebar__item ${activeTab === "personal" ? "profil-sidebar__item--active" : ""}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab("personal"); }}
                >
                  <User size={18} />
                  {t("profile.personalInfoTab")}
                </a>
                {/* réservé à un acheteur qui n'est pas encore vendeur — un
                    vendeur l'est déjà, pas besoin de le lui reproposer (voir
                    même garde côté NavBar.jsx) */}
                {!isVendeur && (
                  <a
                    href="#"
                    className="profil-sidebar__item"
                    onClick={(e) => { e.preventDefault(); navigate("/Devenir_Vendeur"); }}
                  >
                    <Store size={18} />
                    {t("profile.becomeSellerTab")}
                  </a>
                )}
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
          <BoutonRetour />
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
                  <span className="profil-badge">{profil?.role}</span>
                  <p className="profil-identity__location">
                    <MapPin size={14} />
                    {adresseComplete}
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
                </div>
              </section>

              {/* ----- Vendeurs contactés + Avis ----- */}
              {/* sans objet pour un compte admin (pas d'achats/avis) — voir isAdmin plus haut */}
              {!isAdmin && (
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
                          <button className="profil-icon-btn" aria-label={t("profile.messageToAria", { nom: seller.name })}>
                            <MessageSquare size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* "Avis et commentaires" : réservé au vendeur (avis REÇUS
                      sur ses produits — voir listerAvisRecusVendeur) ; retiré
                      entièrement côté acheteur, de même que "Rechercher des
                      produits" pour les deux rôles (demande explicite) */}
                  {isVendeur && (
                    <div className="profil-card">
                      <h3 className="profil-card__title profil-card__title--accent">
                        {t("profile.reviewsTitle")}
                      </h3>

                      {chargementAvisRecus && <p className="profil-field-value">{t("auth.loading")}</p>}

                      {!chargementAvisRecus && avisRecus.length === 0 ? (
                        <p className="profil-field-value">{t("profile.noReviewsReceived")}</p>
                      ) : (
                        <ul className="profil-seller-list">
                          {avisRecus.map((a) => (
                            <li className="profil-seller" key={a.id}>
                              <div className="profil-seller__avatar">
                                <StarRating note={a.note} taille={13} />
                              </div>
                              <div className="profil-seller__info">
                                <p className="profil-seller__name">{a.produit_nom}</p>
                                <p className="profil-seller__contact">
                                  {t("profile.reviewBy", { nom: a.auteur_nom || t("profile.notSpecified") })}
                                  {" — "}
                                  {new Date(a.date_avis).toLocaleDateString()}
                                </p>
                                {a.commentaire && (
                                  <p className="profil-seller__contact">{a.commentaire}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}
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
                <button className="profil-btn profil-btn--primary" onClick={() => navigate("/update_profil")}>
                  <Pencil size={16} />
                  {t("profile.editProfile")}
                </button>
              </div>

              {/* ----- Carte identité + Informations de contact — même
                  structure que l'onglet "personal" d'un compte individuel
                  (demande explicite : mêmes fonctionnalités affichées) */}
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
                  <span className="profil-badge">{profil?.role}</span>
                  <p className="profil-identity__location">
                    <Building2 size={14} />
                    {entreprise.secteur}
                  </p>
                  <p className="profil-identity__location">
                    <MapPin size={14} />
                    {adresseCompleteEntreprise}
                  </p>
                </div>

                <div className="profil-card profil-card--contact">
                  <h3 className="profil-card__title">{t("profile.contactInfo")}</h3>

                  <div className="profil-contact-grid">
                    <div>
                      <p className="profil-field-label">{t("profile.workEmail")}</p>
                      <p className="profil-field-value">{entreprise.email}</p>
                    </div>
                    <div>
                      <p className="profil-field-label">{t("profile.phone")}</p>
                      <p className="profil-field-value">{entreprise.telephone}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ----- Vendeurs contactés + Avis — identique à l'onglet
                  "personal" (voir contactedSellers/avisRecus plus haut) ----- */}
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
                        <button className="profil-icon-btn" aria-label={t("profile.messageToAria", { nom: seller.name })}>
                          <MessageSquare size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {isVendeur && (
                  <div className="profil-card">
                    <h3 className="profil-card__title profil-card__title--accent">
                      {t("profile.reviewsTitle")}
                    </h3>

                    {chargementAvisRecus && <p className="profil-field-value">{t("auth.loading")}</p>}

                    {!chargementAvisRecus && avisRecus.length === 0 ? (
                      <p className="profil-field-value">{t("profile.noReviewsReceived")}</p>
                    ) : (
                      <ul className="profil-seller-list">
                        {avisRecus.map((a) => (
                          <li className="profil-seller" key={a.id}>
                            <div className="profil-seller__avatar">
                              <StarRating note={a.note} taille={13} />
                            </div>
                            <div className="profil-seller__info">
                              <p className="profil-seller__name">{a.produit_nom}</p>
                              <p className="profil-seller__contact">
                                {t("profile.reviewBy", { nom: a.auteur_nom || t("profile.notSpecified") })}
                                {" — "}
                                {new Date(a.date_avis).toLocaleDateString()}
                              </p>
                              {a.commentaire && (
                                <p className="profil-seller__contact">{a.commentaire}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
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

                {adminLoading && <p className="profil-field-value">{t("auth.loading")}</p>}
                {adminError && <p className="rk-error"><XCircle size={20}/> {adminError}</p>}

                {!adminLoading && !adminError && (
                  <ul className="profil-seller-list">
                    {adminUsers.map((u) => (
                      <li className="profil-seller" key={u.id}>
                        <div className="profil-seller__avatar">
                          {/* une Entreprise (héritage multi-tables de Utilisateur) a toujours
                              prenom='' — même repli que AdminDashboard.jsx */}
                          {u.est_entreprise
                            ? (u.nom?.slice(0, 2) || "").toUpperCase()
                            : `${(u.prenom?.[0] || "").toUpperCase()}${(u.nom?.[0] || "").toUpperCase()}`}
                        </div>
                        <div className="profil-seller__info">
                          <p className="profil-seller__name">{u.est_entreprise ? u.nom : `${u.prenom} ${u.nom}`}</p>
                          <p className="profil-seller__contact">{u.email} — {u.telephone}</p>
                        </div>
                        {/* type de compte (particulier/entreprise) — indépendant du rôle,
                            même principe que AdminDashboard.jsx : une entreprise reste une
                            entreprise quel que soit son rôle courant (acheteur/vendeur) */}
                        <span className={`profil-badge ${u.est_entreprise ? "admin-tag--entreprise" : "admin-tag--individuel"}`}>
                          {u.est_entreprise ? t("admin.dashboard.companyBadge") : t("admin.dashboard.individualBadge")}
                        </span>
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

                {adminLoading && <p className="profil-field-value">{t("auth.loading")}</p>}
                {adminError && <p className="rk-error"><XCircle size={20}/> {adminError}</p>}

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
                          <p className="profil-seller__contact">{e.secteur}</p>
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

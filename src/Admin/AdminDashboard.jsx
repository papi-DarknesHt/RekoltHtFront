import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Users, Building2, ShieldCheck, Package, Ban, CheckCircle2,
  LayoutDashboard, Tag, Pencil, Trash2, Plus, X,
} from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/ProfilAcheteur.css";
import "../assets/CSS/AdminDashboard.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const isAdmin = profil?.role === "admin";
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const categorieEvent = useGlobalStore((s) => s.categorieEvent);

  const [activeTab, setActiveTab] = useState("overview");

  const [stats, setStats] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bloquageEnCours, setBloquageEnCours] = useState(null);

  // formulaire catégorie — même objet sert à la création (categorieEnEdition
  // === null) et à la modification (categorieEnEdition === id de la catégorie)
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);
  const [formCategorie, setFormCategorie] = useState({ nom: "", description: "" });
  const [categorieEnCours, setCategorieEnCours] = useState(false);
  const [categorieErreur, setCategorieErreur] = useState(null);

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
    ])
      .then(([statsRes, utilisateursRes, produitsRes, categoriesRes]) => {
        setStats(statsRes);
        setUtilisateurs(utilisateursRes.utilisateurs || []);
        setProduits(produitsRes.produits || []);
        setCategories(categoriesRes.categories || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) chargerDonnees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

  const toggleBloquer = async (utilisateur) => {
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
    if (!window.confirm(t("admin.dashboard.confirmDeleteCategory").replace("{nom}", categorie.nom))) return;
    try {
      await ProduitsApi.supprimerCategorie(categorie.id);
      setCategories((liste) => liste.filter((c) => c.id !== categorie.id));
    } catch (err) {
      setError(err.message);
    }
  };

  // accès réservé aux admins — profil non encore chargé -> on attend avant de trancher
  if (profil && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const tuiles = stats && [
    { icon: Users,       label: t("admin.dashboard.users"),        value: stats.utilisateurs.total },
    { icon: ShieldCheck, label: t("admin.dashboard.sellers"),       value: stats.utilisateurs.vendeurs },
    { icon: Ban,         label: t("admin.dashboard.blocked"),       value: stats.utilisateurs.bloques },
    { icon: Building2,   label: t("admin.dashboard.companies"),     value: stats.entreprises.total },
    { icon: CheckCircle2,label: t("admin.dashboard.verifiedRequests"), value: stats.verifications.verifiees },
    { icon: Package,     label: t("admin.dashboard.products"),      value: stats.produits.total },
  ];

  const onglets = [
    { id: "overview",   label: t("admin.dashboard.tabOverview"),   icon: LayoutDashboard },
    { id: "produits",   label: t("admin.dashboard.tabProducts"),   icon: Package },
    { id: "categories", label: t("admin.dashboard.tabCategories"), icon: Tag },
  ];

  return (
    <div className="profil-page">
      <NavBar />

      <div className="admin-dashboard-container">
        <div className="profil-header">
          <div>
            <h1 className="profil-title">{t("admin.dashboard.title")}</h1>
            <p className="profil-subtitle">{t("admin.dashboard.subtitle")}</p>
          </div>
        </div>

        <nav className="admin-tabs">
          {onglets.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`admin-tabs__item ${activeTab === id ? "admin-tabs__item--active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {loading && <p className="profil-field-value">{t("profile.loading")}</p>}
        {error && <p className="admin-error">✗ {error}</p>}

        {!loading && !error && activeTab === "overview" && (
          <>
            {stats && (
              <section className="admin-stats-grid">
                {tuiles.map(({ icon: Icon, label, value }) => (
                  <div className="profil-card admin-stat-card" key={label}>
                    <div className="admin-stat-card__icon"><Icon size={20} /></div>
                    <div>
                      <p className="admin-stat-card__value">{value}</p>
                      <p className="admin-stat-card__label">{label}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <div className="profil-card">
              <h3 className="profil-card__title profil-card__title--accent">
                {t("admin.dashboard.usersListTitle")}
              </h3>

              <ul className="profil-seller-list">
                {utilisateurs.map((u) => (
                  <li className="profil-seller" key={u.id}>
                    <div className="profil-seller__avatar">
                      {(u.prenom?.[0] || "").toUpperCase()}{(u.nom?.[0] || "").toUpperCase()}
                    </div>
                    <div className="profil-seller__info">
                      <p className="profil-seller__name">{u.prenom} {u.nom}</p>
                      <p className="profil-seller__contact">{u.email} — {u.telephone}</p>
                    </div>
                    <span className="profil-badge">{u.role}</span>
                    {u.est_bloquer && (
                      <span className="profil-badge admin-badge--blocked">{t("admin.dashboard.blockedBadge")}</span>
                    )}
                    <button
                      className={`profil-btn ${u.est_bloquer ? "profil-btn--secondary" : "admin-btn--danger"}`}
                      disabled={bloquageEnCours === u.id}
                      onClick={() => toggleBloquer(u)}
                    >
                      {u.est_bloquer ? t("admin.dashboard.unblock") : t("admin.dashboard.block")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {!loading && !error && activeTab === "produits" && (
          <div className="profil-card">
            <h3 className="profil-card__title profil-card__title--accent">
              {t("admin.dashboard.productsListTitle")}
            </h3>

            {produits.length === 0 ? (
              <p className="profil-field-value">{t("admin.dashboard.noProducts")}</p>
            ) : (
              <ul className="profil-seller-list">
                {produits.map((p) => (
                  <li className="profil-seller" key={p.id}>
                    {p.photos?.[0]?.url_photo ? (
                      <img src={p.photos[0].url_photo} alt={p.nom} className="profil-seller__avatar" style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="profil-seller__avatar"><Package size={18} /></div>
                    )}
                    <div className="profil-seller__info">
                      <p className="profil-seller__name">{p.nom}</p>
                      <p className="profil-seller__contact">
                        {p.categorie?.nom} — {p.prix ? `${p.prix} HTG` : t("profile.notSpecified")} {p.unite}
                      </p>
                    </div>
                    <span className={`profil-badge ${p.est_disponible ? "" : "admin-badge--blocked"}`}>
                      {p.est_disponible ? t("admin.dashboard.available") : t("admin.dashboard.unavailable")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && !error && activeTab === "categories" && (
          <>
            <div className="profil-card">
              <div className="admin-card-header">
                <h3 className="profil-card__title profil-card__title--accent">
                  {categorieEnEdition ? t("admin.dashboard.editCategory") : t("admin.dashboard.newCategory")}
                </h3>
                {categorieEnEdition && (
                  <button className="profil-icon-btn" onClick={annulerFormulaireCategorie} aria-label={t("admin.dashboard.cancel")}>
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
                <button type="submit" className="profil-btn profil-btn--primary" disabled={categorieEnCours}>
                  <Plus size={16} />
                  {categorieEnEdition ? t("admin.dashboard.saveCategory") : t("admin.dashboard.addCategory")}
                </button>
              </form>
            </div>

            <div className="profil-card">
              <h3 className="profil-card__title profil-card__title--accent">
                {t("admin.dashboard.categoriesListTitle")}
              </h3>

              {categories.length === 0 ? (
                <p className="profil-field-value">{t("admin.dashboard.noCategories")}</p>
              ) : (
                <ul className="profil-seller-list">
                  {categories.map((c) => (
                    <li className="profil-seller" key={c.id}>
                      <div className="profil-seller__avatar"><Tag size={18} /></div>
                      <div className="profil-seller__info">
                        <p className="profil-seller__name">{c.nom}</p>
                        <p className="profil-seller__contact">{c.description || t("profile.notSpecified")}</p>
                      </div>
                      <button className="profil-icon-btn" onClick={() => ouvrirFormulaireEdition(c)} aria-label={t("admin.dashboard.editCategory")}>
                        <Pencil size={16} />
                      </button>
                      <button className="profil-icon-btn admin-icon-btn--danger" onClick={() => supprimerCategorie(c)} aria-label={t("admin.dashboard.deleteCategory")}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

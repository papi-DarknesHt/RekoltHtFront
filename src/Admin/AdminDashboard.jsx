import React, { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Users, Building2, ShieldCheck, Package, Ban, CheckCircle2,
  LayoutDashboard, Tag, Pencil, Trash2, Plus, X, MessageCircle, Send,
} from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { applyListEvent } from "../api/applyListEvent.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import { ProduitsApi } from "../api/produits";
import { MessagerieApi } from "../api/messagerie";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import categorieProduitsData from "../assets/Produits/categorieProduits.json";
import "../assets/CSS/ProfilAcheteur.css";
import "../assets/CSS/AdminDashboard.css";

// noms de sous-catégories suggérés (référentiel standard, voir
// categorieProduits.json) — simple aide à la saisie, l'admin reste libre de
// taper un autre nom via le <datalist> ci-dessous
const SUGGESTIONS_SOUS_CATEGORIES = (categorieProduitsData["Sous-Categories"] || [])
  .map((sc) => sc["Sous-Categorie"]);

export default function AdminDashboard() {
  const { t } = useTranslation();
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const isAdmin = profil?.role === "admin";
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const categorieEvent = useGlobalStore((s) => s.categorieEvent);
  const sousCategorieEvent = useGlobalStore((s) => s.sousCategorieEvent);
  const utilisateurEvent = useGlobalStore((s) => s.utilisateurEvent);
  const profilEvent = useGlobalStore((s) => s.profilEvent);
  const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);
  const setMessagesSupportEnAttenteBadge = useMessagerieBadgeStore((s) => s.setMessagesSupportEnAttente);

  // permet un lien direct vers un onglet précis (ex: la pastille de la
  // sonnette "demandes vendeur" de NavBar.jsx renvoie vers ?tab=support)
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

  const [stats, setStats] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sousCategories, setSousCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bloquageEnCours, setBloquageEnCours] = useState(null);
  const [nominationEnCours, setNominationEnCours] = useState(null);

  // messages vendeur -> admins en attente de réponse (voir Messagerie/models.py
  // ::MessageSupport) — file partagée entre tous les admins, premier à
  // répondre "prend" le message (voir soumettreReponseSupport plus bas)
  const [messagesSupport, setMessagesSupport] = useState([]);
  const [chargementSupport, setChargementSupport] = useState(true);
  const [erreurSupport, setErreurSupport] = useState(null);
  const [reponsesBrouillon, setReponsesBrouillon] = useState({});
  const [reponseEnCoursId, setReponseEnCoursId] = useState(null);

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
    setChargementSupport(true);
    MessagerieApi.listerMessagesAdminEnAttente()
      .then((res) => setMessagesSupport(res.messages_admin || []))
      .catch((err) => setErreurSupport(err.message))
      .finally(() => setChargementSupport(false));
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

  const nommerAdmin = async (utilisateur) => {
    if (!window.confirm(t("admin.dashboard.confirmNominateAdmin").replace("{nom}", `${utilisateur.prenom} ${utilisateur.nom}`))) return;
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
      await MessagerieApi.repondreMessageAdmin(messageSupport.id, texte);
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
    if (!window.confirm(t("admin.dashboard.confirmDeleteSubCategory").replace("{nom}", sousCategorie.nom))) return;
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
    { id: "sous-categories", label: t("admin.dashboard.tabSubCategories"), icon: Tag },
    { id: "support",    label: t("admin.dashboard.tabSupport"),    icon: MessageCircle, badge: messagesSupport.length },
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
          {onglets.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`admin-tabs__item ${activeTab === id ? "admin-tabs__item--active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              {label}
              {!!badge && <span className="admin-tabs__badge">{badge}</span>}
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
                    {u.role !== "admin" && (
                      <button
                        className="profil-btn profil-btn--secondary"
                        disabled={nominationEnCours === u.id}
                        onClick={() => nommerAdmin(u)}
                      >
                        <ShieldCheck size={14} />
                        {t("admin.dashboard.nominateAdmin")}
                      </button>
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
                        {p.categorie?.nom} — {p.prix ? `${p.prix} ${p.unitePrix}` : t("profile.notSpecified")} {p.unite_De_Mesure}
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

        {!loading && !error && activeTab === "sous-categories" && (
          <>
            <div className="profil-card">
              <div className="admin-card-header">
                <h3 className="profil-card__title profil-card__title--accent">
                  {sousCategorieEnEdition ? t("admin.dashboard.editSubCategory") : t("admin.dashboard.newSubCategory")}
                </h3>
                {sousCategorieEnEdition && (
                  <button className="profil-icon-btn" onClick={annulerFormulaireSousCategorie} aria-label={t("admin.dashboard.cancel")}>
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
                <button type="submit" className="profil-btn profil-btn--primary" disabled={sousCategorieEnCours}>
                  <Plus size={16} />
                  {sousCategorieEnEdition ? t("admin.dashboard.saveSubCategory") : t("admin.dashboard.addSubCategory")}
                </button>
              </form>
            </div>

            <div className="profil-card">
              <h3 className="profil-card__title profil-card__title--accent">
                {t("admin.dashboard.subCategoriesListTitle")}
              </h3>

              {sousCategories.length === 0 ? (
                <p className="profil-field-value">{t("admin.dashboard.noSubCategories")}</p>
              ) : (
                <ul className="profil-seller-list">
                  {sousCategories.map((sc) => (
                    <li className="profil-seller" key={sc.id}>
                      <div className="profil-seller__avatar"><Tag size={18} /></div>
                      <div className="profil-seller__info">
                        <p className="profil-seller__name">{sc.nom}</p>
                        <p className="profil-seller__contact">
                          {categories.find((c) => c.id === sc.categorie_id)?.nom || t("profile.notSpecified")}
                        </p>
                      </div>
                      <button className="profil-icon-btn" onClick={() => ouvrirFormulaireEditionSousCategorie(sc)} aria-label={t("admin.dashboard.editSubCategory")}>
                        <Pencil size={16} />
                      </button>
                      <button className="profil-icon-btn admin-icon-btn--danger" onClick={() => supprimerSousCategorie(sc)} aria-label={t("admin.dashboard.deleteSubCategory")}>
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
          <div className="profil-card">
            <h3 className="profil-card__title profil-card__title--accent">
              {t("admin.dashboard.supportListTitle")}
            </h3>

            {erreurSupport && <p className="admin-error">✗ {erreurSupport}</p>}
            {chargementSupport && <p className="profil-field-value">{t("profile.loading")}</p>}

            {!chargementSupport && messagesSupport.length === 0 ? (
              <p className="profil-field-value">{t("admin.dashboard.noSupportMessages")}</p>
            ) : (
              <ul className="profil-seller-list admin-support-list">
                {messagesSupport.map((m) => (
                  <li className="admin-support-item" key={m.id}>
                    <div className="admin-support-item__entete">
                      <div className="profil-seller__avatar">
                        <MessageCircle size={18} />
                      </div>
                      <div className="profil-seller__info">
                        <p className="profil-seller__name">{m.vendeur_nom}</p>
                        <p className="profil-seller__contact">{new Date(m.date_envoi).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="admin-support-item__contenu">{m.contenu}</p>
                    <div className="admin-support-item__reponse">
                      <textarea
                        className="admin-input admin-support-item__textarea"
                        placeholder={t("admin.dashboard.replyPlaceholder")}
                        value={reponsesBrouillon[m.id] || ""}
                        onChange={(e) => setReponsesBrouillon((b) => ({ ...b, [m.id]: e.target.value }))}
                      />
                      <button
                        className="profil-btn profil-btn--primary"
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
      </div>

      <Footer />
    </div>
  );
}

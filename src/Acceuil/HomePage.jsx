/**
 * HomePage.jsx — Page d'accueil RekoltHT
 * Sections : Navbar, Hero, Pwodi resan, Prosesis, Kat + Sant Ed, Footer
 */

import { useState, useEffect } from "react";
import "../assets/CSS/HomePage.css";
import "../assets/CSS/Authentification.css";
import logo from "../assets/Images/Asset5.svg";
import { useNavigate } from "react-router-dom";
import MapHaiti from "../components/MapHaiti";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import { useGlobalStore } from "../api/globalStore.js";
import { ProduitsApi } from "../api/produits";
import { formaterLocalisationProduit } from "../utils/localisationProduit.js";

// Convertit un produit tel que renvoyé par l'API (voir _serialiseProduit,
// Produits/views/produitsViews.py) au format attendu par ProductCard.jsx
function versProduitAffiche(p, texteNonPrecise, texteHaiti) {
  return {
    id: p.id,
    nom: p.nom,
    description: p.description,
    vendeurId: p.vendeur_id,
    vendeurNom: p.vendeur_nom,
    vendeurTelephone: p.vendeur_telephone,
    noteMoyenne: p.note_moyenne,
    nombreAvis: p.nombre_avis,
    lieu: formaterLocalisationProduit(p, texteHaiti) || texteNonPrecise,
    prix: p.prix,
    devise: p.unitePrix,
    image: p.photos?.[0]?.url_photo || null,
  };
}

// Étapes du processus affichées dans la section "Kijan prosesis la ye?"

// Articles d'aide affichés dans la section "Sant Ed"


// Carousel réutilisable (produits récents ET, plus bas, "mes produits" pour
// un vendeur déjà connecté) — encapsule son propre index/nombre visible/
// écoute du resize, pour que chaque instance défile indépendamment
function ProduitsCarousel({ produits, onDetails, onContact, onWhatsapp, utilisateurId }) {
  const { t } = useTranslation();
  const getVisible = () => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth <= 480) return 1;
    if (window.innerWidth <= 768) return 2;
    return 4;
  };

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(getVisible());

  useEffect(() => {
    const onResize = () => {
      const v = getVisible();
      setVisible(v);
      setIndex((i) => Math.min(i, Math.max(0, produits.length - v)));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [produits.length]);

  const produitsVisibles = produits.slice(index, index + visible);
  const next = () => { if (index + visible < produits.length) setIndex((i) => i + 1); };
  const prev = () => { if (index > 0) setIndex((i) => i - 1); };

  return (
    <>
      <div className="carousel">
        <button className="carousel-nav-btn" onClick={prev} disabled={index === 0} aria-label={t("home.carouselPrev")}>‹</button>

        <div
          className="carousel-cards"
          style={{ gridTemplateColumns: `repeat(${visible}, minmax(0, 1fr))` }}
        >
          {produitsVisibles.map((p) => (
            <ProductCard key={p.id} produit={p} onDetails={onDetails} onContact={onContact} onWhatsapp={onWhatsapp} utilisateurId={utilisateurId} />
          ))}
        </div>

        <button className="carousel-nav-btn" onClick={next} disabled={index + visible >= produits.length} aria-label={t("home.carouselNext")}>›</button>
      </div>

      {produits.length > visible && (
        <div className="carousel-dots">
          {Array.from({ length: Math.max(0, produits.length - visible + 1) }).map((_, i) => (
            <button
              key={i}
              className={`carousel-dot${i === index ? " carousel-dot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={t("home.carouselPage", { n: i + 1 })}
            />
          ))}
        </div>
      )}
    </>
  );
}

// pour la navigation entre les pages

export default function HomePage() {
  const [search, setSearch] = useState("");

  const [produits, setProduits] = useState([]);
  const [chargementProduits, setChargementProduits] = useState(true);
  const [erreurProduits, setErreurProduits] = useState(null);
  const produitEvent = useGlobalStore((s) => s.produitEvent);

  const navigate = useNavigate();
  const { t } = useTranslation();

  // produits disponibles pour affichage public — seuls les "disponible"
  // doivent être visibles (voir Produits/views/produitsViews.py::listerProduits,
  // filtre ?disponible=true)
  useEffect(() => {
    ProduitsApi.listerProduits({ disponible: "true" })
      .then((res) => setProduits(res.produits || []))
      .catch((err) => setErreurProduits(err.message))
      .finally(() => setChargementProduits(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend) : un
  // produit publié/rendu disponible par n'importe quel vendeur apparaît ici
  // sans rechargement de page ; un produit rendu indisponible ou supprimé en
  // disparaît de la même façon
  useEffect(() => {
    if (!produitEvent) return;
    const { type, data } = produitEvent;
    setProduits((liste) => {
      if (type === "produit.deleted" || (data.est_disponible === false)) {
        return liste.filter((p) => p.id !== data.id);
      }
      const existe = liste.some((p) => p.id === data.id);
      return existe
        ? liste.map((p) => (p.id === data.id ? { ...p, ...data } : p))
        : [...liste, data];
    });
  }, [produitEvent]);

  const produitsAffiches = produits.map((p) => versProduitAffiche(p, t("profile.notSpecified"), t("auth.haiti")));

  // enregistre le clic "Contacter" (alimente nombre_contacts affiché au
  // vendeur sur "Mes produits") puis ouvre directement la messagerie avec ce
  // vendeur (voir Messagerie.jsx, qui lit ?avec=/?produit= pour démarrer la
  // conversation et y partager la fiche produit). Un visiteur non connecté
  // ne peut pas contacter un vendeur : il est redirigé vers la connexion
  // (voir Produits/views/produitsViews.py::contacterProduit, qui refuse
  // désormais toute requête anonyme).
  const contacterProduit = (produit) => {
    if (!isConnected) {
      navigate("/auth");
      return;
    }
    ProduitsApi.contacterProduit(produit.id).catch(() => {});
    if (produit.vendeurId) {
      navigate(`/messages?avec=${produit.vendeurId}&produit=${produit.id}`);
    }
  };
  // le clic ouvre directement WhatsApp (lien <a>, voir ProductCard.jsx) —
  // ici on ne fait qu'enregistrer le contact pour les stats du vendeur
  const contacterViaWhatsapp = (produit) => {
    ProduitsApi.contacterProduit(produit.id).catch(() => {});
  };
  const ETAPES = [
    { n: "1", texte: t("home.stepCreateAccount") },
    { n: "2", texte: t("home.stepSearchProduct") },
    { n: "3", texte: t("home.stepContactSeller") },
    { n: "4", texte: t("home.stepMakeDeal") },
  ];
  // chaque bouton renvoie vers la page Aide (voir pages/aide.jsx) sur la
  // section correspondante — clés alignées avec aide.sections.<cle> dans les
  // fichiers de traduction
  const SANT_ED = [
    { label: t("home.producerGuide"), section: "devenirVendeur" },
    { label: t("home.howSearchProduct"), section: "recherche" },
    { label: t("home.securityTrust"), section: "securite" },
  ];


  const isConnected = useAuthStore((s) => s.isConnected);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const profil = useProfilStore((s) => s.profil);
  const isVendeur = profil?.role === "vendeur";
  // un compte admin ne peut pas devenir vendeur (rôles mutuellement
  // exclusifs, voir DevenirVendeur.jsx et soumettre_verification côté
  // backend) — l'onboarding acheteur/vendeur "Comment ça marche" ne le
  // concerne donc pas.
  const isAdmin = profil?.role === "admin";

  // remplace le bouton "Devenir vendeur" par un carousel "Mes produits" une
  // fois que le compte connecté est déjà vendeur — inutile de lui proposer
  // à nouveau de le devenir (voir section "Kijan prosesis la ye?" plus bas)
  const [mesProduits, setMesProduits] = useState([]);
  const [chargementMesProduits, setChargementMesProduits] = useState(true);

  useEffect(() => {
    if (!isConnected || !isVendeur) {
      setChargementMesProduits(false);
      return;
    }
    ProduitsApi.mesProduits()
      .then((res) => setMesProduits(res.produits || []))
      .catch(() => {})
      .finally(() => setChargementMesProduits(false));
  }, [isConnected, isVendeur]);

  // réactivité temps réel (voir Produits/signals.py côté backend), filtrée
  // à ce vendeur — même principe que mesProduits.jsx
  useEffect(() => {
    if (!produitEvent || !isVendeur) return;
    const { type, data } = produitEvent;
    if (data.vendeur_id !== undefined && data.vendeur_id !== utilisateur?.id) return;
    setMesProduits((liste) => {
      if (type === "produit.deleted") return liste.filter((p) => p.id !== data.id);
      const existe = liste.some((p) => p.id === data.id);
      return existe
        ? liste.map((p) => (p.id === data.id ? { ...p, ...data } : p))
        : [...liste, data];
    });
  }, [produitEvent, isVendeur, utilisateur?.id]);

  const mesProduitsAffiches = mesProduits.map((p) => versProduitAffiche(p, t("profile.notSpecified"), t("auth.haiti")));

  return (
    <>

      {/* ── NAVBAR ── */}
      <NavBar />

      {/* ── HERO — Section principale avec titre et recherche ── */}
      <section className="hero">
        <h1 className="hero-title">
          {t("home.heroTitleLine1")}<br />
          {t("home.heroTitleLine2")} {" "}
          <span className="accent">{t("home.heroTitleAccent")}</span>{" "}
          {t("home.heroTitleLine3")}
        </h1>
        <p className="hero-sub">{t("home.heroSubtitle")}</p>

        {/* Barre de recherche — redirige vers le catalogue (/produits), qui
            filtre par nom de produit ou de vendeur (voir afficherProduits.jsx) */}
        <form
          className="hero-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/produits${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
          }}
        >
          <input
            className="hero-search"
            type="text"
            placeholder={t("home.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </section>

      {/* ── PWODI RESAN — Carousel des produits récents ── */}
      <section className="section">
        <h2 className="section-title">{t("home.recentProducts")}</h2>

        {chargementProduits && (
          <p className="produits-etat">{t("home.loadingProducts")}</p>
        )}

        {!chargementProduits && erreurProduits && (
          <p className="produits-etat produits-etat--erreur">{erreurProduits}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsAffiches.length === 0 && (
          <p className="produits-etat">{t("home.noProductsYet")}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsAffiches.length > 0 && (
          <ProduitsCarousel
            produits={produitsAffiches}
            onDetails={(pr) => navigate(`/produits/detail?id=${pr.id}`)}
            onContact={contacterProduit}
            onWhatsapp={contacterViaWhatsapp}
            utilisateurId={utilisateur?.id}
          />
        )}
      </section>
      {/*Section comment devenir vendeur */}
      {!(isConnected && isAdmin) && (
      <section className="section-brown">
        {isConnected && isVendeur ? (
          <div className="mes-produits-accueil">
            <h2 className="section-title">{t("myProducts.title")}</h2>

            {chargementMesProduits && (
              <p className="produits-etat produits-etat--clair">{t("home.loadingProducts")}</p>
            )}

            {!chargementMesProduits && mesProduitsAffiches.length === 0 && (
              <p className="produits-etat produits-etat--clair">{t("myProducts.noProducts")}</p>
            )}

            {!chargementMesProduits && mesProduitsAffiches.length > 0 && (
              <ProduitsCarousel
                produits={mesProduitsAffiches}
                onDetails={(pr) => navigate(`/produits/modifier?id=${pr.id}`)}
                utilisateurId={utilisateur?.id}
              />
            )}

            <button className="btn-cta" onClick={() => navigate("/produits/mesProduits")} style={{ marginTop: "1.5rem" }}>
              {t("home.viewAllMyProducts")}
            </button>
          </div>
        ) : (
          <>
            <h2 className="section-title">{t("home.processTitle")}</h2>

            {/* Étapes avec flèches entre chaque */}
            <div className="etapes">
              {ETAPES.map((e, i) => (
                <>
                  {/* Boîte de l'étape */}
                  <div className="etape-box" key={e.n}>
                    {e.n}. {e.texte}
                  </div>

                  {/* Flèche entre les étapes (pas après la dernière) */}
                  {i < ETAPES.length - 1 && (
                    <span className="etape-arrow" key={`arrow-${i}`}>→</span>
                  )}
                </>
              ))}
            </div>

            <button
              className="btn-cta"
              onClick={() => navigate(isConnected ? "/Devenir_Vendeur" : "/auth")}
            >
              {isConnected ? t("home.becomeASalesperson") : t("auth.cardTitleRegister")}
            </button>
          </>
        )}
      </section>
      )}

      {/* Section carte et centre d'aide*/}
      <div className="section-map-help">
        {/* carte de localisation */}
        <div>
          <p className="subsection-title">{t("home.mapTitle")}</p>
          <div>
            <MapHaiti />
          </div>
        </div>
        
        {/* Colonne droite : articles d'aide */}
        <div>
          <p className="subsection-title">{t("home.helpCenter")}</p>
          {/* On itère sur les articles d'aide */}
          {SANT_ED.map((item) => (
            <button
              className="sant-ed-btn"
              key={item.section}
              onClick={() => navigate(`/aide?section=${item.section}`)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <Footer />
    </>
  );
}

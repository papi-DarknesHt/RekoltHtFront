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
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useAuthStore } from "../Registration/AuthentificationStore";

// Liste des produits récents affichés dans la section "Pwodi resan"
const PRODUITS = [
  { id: 1, nom: "Zaboka", lieu: "Hinche, Centre", prix: 25, emoji: "🥑" },
  { id: 2, nom: "Sitwon", lieu: "Mayisad, Centre", prix: 15, emoji: "🍋" },
  { id: 3, nom: "Kalalou", lieu: "Hinche, Centre", prix: 5, emoji: "🫑" },
  { id: 4, nom: "Bannann", lieu: "Jacmel, Sud-Est", prix: 10, emoji: "🍌" },
  { id: 5, nom: "Mango", lieu: "Gonaïves, Artib.", prix: 8, emoji: "🥭" },
  { id: 6, nom: "Pistach", lieu: "Cap-Haïtien, Nord", prix: 20, emoji: "🥜" },
];

// Étapes du processus affichées dans la section "Kijan prosesis la ye?"

// Articles d'aide affichés dans la section "Sant Ed"


// pour la navigation entre les pages

export default function HomePage() {

  const getVisible = () => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth <= 480) return 1;
    if (window.innerWidth <= 768) return 2;
    return 4;
  };

  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(getVisible);

  useEffect(() => {
    const onResize = () => {
      const v = getVisible();
      setVisible(v);
      setIndex(i => Math.min(i, Math.max(0, PRODUITS.length - v)));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const produitsVisibles = PRODUITS.slice(index, index + visible);
  const next = () => { if (index + visible < PRODUITS.length) setIndex(i => i + 1); };
  const prev = () => { if (index > 0) setIndex(i => i - 1); };
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ETAPES = [
    { n: "1", texte: t("home.stepCreateAccount") },
    { n: "2", texte: t("home.stepSearchProduct") },
    { n: "3", texte: t("home.stepContactSeller") },
    { n: "4", texte: t("home.stepMakeDeal") },
  ];
  const SANT_ED = [
    t("home.producerGuide"),
    t("home.howSearchProduct"),
    t("home.securityTrust"),
  ];


  const isConnected = useAuthStore((s) => s.isConnected);

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

        {/* Barre de recherche */}
        <input
          className="hero-search"
          type="text"
          placeholder={t("home.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {/* ── PWODI RESAN — Carousel des produits récents ── */}
      <section className="section">
        <h2 className="section-title">{t("home.recentProducts")}</h2>

        <div className="carousel">
          <button
            className="carousel-nav-btn"
            onClick={prev}
            disabled={index === 0}
            aria-label="Précédent"
          >‹</button>

          <div
            className="carousel-cards"
            style={{ gridTemplateColumns: `repeat(${visible}, minmax(0, 1fr))` }}
          >
            {produitsVisibles.map((p) => (
              <div className="produit-card" key={p.id}>
                <div className="produit-img">
                  <span className="produit-emoji">{p.emoji}</span>
                  <span className="produit-prix-badge">{p.prix}{t("home.priceSuffix")}</span>
                </div>
                <div className="produit-info">
                  <p className="produit-nom">{p.nom}</p>
                  <p className="produit-lieu">{t("home.locationPrefix")}{p.lieu}</p>
                  <div className="produit-btns">
                    <button className="btn-detay">{t("home.details")}</button>
                    <button className="btn-kontakte">{t("home.contact")}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="carousel-nav-btn"
            onClick={next}
            disabled={index + visible >= PRODUITS.length}
            aria-label="Suivant"
          >›</button>
        </div>

        <div className="carousel-dots">
          {Array.from({ length: Math.max(0, PRODUITS.length - visible + 1) }).map((_, i) => (
            <button
              key={i}
              className={`carousel-dot${i === index ? " carousel-dot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── PROSESIS — Comment ça marche ── */}
      <section className="section-brown">
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

        {/* Bouton d'appel à l'action */}
        <button
          className="btn-cta"
          onClick={() => navigate(isConnected ? "/Devenir_Vendeur" : "/auth")}
        >
          {isConnected ? t("home.becomeASalesperson") : t("auth.cardTitleRegister")}
        </button>
      </section>

      {/* ── KAT + SANT ED — Carte & Aide côte à côte ── */}
      <div className="section-map-help">

        {/* Colonne gauche : carte de localisation */}
        <div>
          <p className="subsection-title">{t("home.mapTitle")}</p>

          {/* Placeholder de Google Maps (à remplacer par un vrai composant Map) */}
          <div>
            {/* Google Maps réel */}
            <MapHaiti />
            {/* Légende */}
            <div className="map-legend">
              <span>
                <span className="legend-dot" style={{ background: "#e23" }}></span>
                Lwen
              </span>
              <span>
                <span className="legend-dot" style={{ background: "#f5f0c0" }}></span>
                Pre
              </span>
            </div>
          </div>
        </div>

        {/* Colonne droite : articles d'aide */}
        <div>
          <p className="subsection-title">{t("home.helpCenter")}</p>

          {/* On itère sur les articles d'aide */}
          {SANT_ED.map((item) => (
            <button className="sant-ed-btn" key={item}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <Footer />
    </>
  );
}

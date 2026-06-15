/**
 * HomePage.jsx — Page d'accueil RekoltHT
 * Sections : Navbar, Hero, Pwodi resan, Prosesis, Kat + Sant Ed, Footer
 */

import { useState } from "react";
import "../assets/CSS/HomePage.css";
import "../assets/CSS/Authentification.css";
import logo from "../assets/Images/Asset5.svg";
import { useNavigate } from "react-router-dom";
import MapHaiti from "../components/MapHaiti";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";

// Liste des produits récents affichés dans la section "Pwodi resan"
const PRODUITS = [
  { id: 1, nom: "Zaboka",  lieu: "Hinche, Centre",  prix: 25, emoji: "🥑" },
  { id: 2, nom: "Sitwon",  lieu: "Mayisad, Centre", prix: 15, emoji: "🍋" },
  { id: 3, nom: "Kalalou", lieu: "Hinche, Centre",  prix: 5,  emoji: "🫑" },
  { id: 4, nom: "Bannann",  lieu: "Jacmel, Sud-Est",  prix: 10, emoji: "🍌" },
  { id: 5, nom: "Mango",    lieu: "Gonaïves, Artib.", prix: 8,  emoji: "🥭" },
  { id: 6, nom: "Pistach",  lieu: "Cap-Haïtien, Nord",prix: 20, emoji: "🥜" },
];

// Étapes du processus affichées dans la section "Kijan prosesis la ye?"
const ETAPES = [
  { n: "1", texte: "Kreye yon kont" },
  { n: "2", texte: "Cheche pwodwi" },
  { n: "3", texte: "Kontakte vande" },
  { n: "4", texte: "Fe afè" },
];

// Articles d'aide affichés dans la section "Sant Ed"
const SANT_ED = [
  "Gid pwodikte",
  "Kijan cheche pwodi",
  "Sekirite ak konfyans",
];

// pour la navigation entre les pages

export default function HomePage() {

  // State pour la barre de recherche du hero
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const VISIBLE = 4;

  // calcule les produits visibles selon l'index actuel
  const produitsVisibles = PRODUITS.slice(index, index + VISIBLE);

  // avancer — empêche de dépasser la fin
  const next = () => {
    if (index + VISIBLE < PRODUITS.length) setIndex(index + 1);
  };

  // reculer — empêche de dépasser le début
  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
      <>

        {/* ── NAVBAR ── */}
        <NavBar />

        {/* ── HERO — Section principale avec titre et recherche ── */}
        <section className="hero">
          <h1 className="hero-title">
            {t("home.heroTitleLine1")}<br/>
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

        {/* ── PWODI RESAN — Grille des produits récents ── */}
        <section className="section">
          <h2 className="section-title">{t("home.recentProducts")}</h2>

          {/* Conteneur du carousel avec boutons précédent/suivant */}
          <div style={{display: "flex", alignItems: "center", gap: "12px", maxWidth: "900px", margin: "0 auto"}}>

            {/* Bouton précédent — grisé si on est au début */}
            <button className="rk-btn-pre"
                onClick={prev}
                disabled={index === 0}
                style={{
                  background: index === 0 ? "#f0f0f0" : "#fff",
                  cursor: index === 0 ? "not-allowed" : "pointer",
                }}
            >
              ‹
            </button>

            {/* Zone des cartes visibles */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "1.5rem",
              flex: 1,
              overflow: "hidden"
            }}>
              {produitsVisibles.map((p) => (
                  <div className="produit-card" key={p.id}>
                    <div className="produit-img">{p.emoji}</div>
                    <div className="produit-info">
                      <p className="produit-nom">{p.nom}</p>
                      <p className="produit-lieu">{t("home.locationPrefix")}{p.lieu}</p>
                      <p className="produit-prix">{p.prix}{t("home.priceSuffix")}</p>
                      <div className="produit-btns">
                        <button className="btn-detay">{t("home.details")}</button>
                        <button className="btn-kontakte">{t("home.contact")}</button>
                      </div>
                    </div>
                  </div>
              ))}
            </div>

            {/* Bouton suivant — grisé si on est à la fin */}
            <button
                onClick={next}
                disabled={index + VISIBLE >= PRODUITS.length}
                style={{
                  width: "40px", height: "40px",
                  borderRadius: "50%",
                  border: "1.5px solid #ccc",
                  background: index + VISIBLE >= PRODUITS.length ? "#f0f0f0" : "#fff",
                  cursor: index + VISIBLE >= PRODUITS.length ? "not-allowed" : "pointer",
                  fontSize: "18px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s"
                }}
            >
              ›
            </button>

          </div>

          {/* Indicateurs de position (points) */}
          <div style={{display: "flex", justifyContent: "center", gap: "6px", marginTop: "1.2rem"}}>
            {Array.from({length: PRODUITS.length - VISIBLE + 1}).map((_, i) => (
                <div
                    key={i}
                    onClick={() => setIndex(i)}
                    style={{
                      width: i === index ? "20px" : "8px",
                      height: "8px",
                      borderRadius: "4px",
                      background: i === index ? "#b85c1a" : "#ccc",
                      cursor: "pointer",
                      transition: "all 0.3s"
                    }}
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
          <button className="btn-cta">Kreye kont mwen!</button>
        </section>

        {/* ── KAT + SANT ED — Carte & Aide côte à côte ── */}
        <div className="section-map-help">

          {/* Colonne gauche : carte de localisation */}
          <div>
            <p className="subsection-title">{t("home.mapTitle")}</p>

            {/* Placeholder de Google Maps (à remplacer par un vrai composant Map) */}
            <div>
              {/* Google Maps réel */}
              <MapHaiti/>
              {/* Légende */}
              <div className="map-legend">
                <span>
                  <span className="legend-dot" style={{background: "#e23"}}></span>
                  Lwen
                </span>
                            <span>
                  <span className="legend-dot" style={{background: "#f5f0c0"}}></span>
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
        <Footer/>
      </>
  );
}

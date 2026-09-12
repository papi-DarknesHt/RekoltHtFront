
import { useState, useEffect, useRef } from "react";
import { User, Building2 } from "lucide-react";
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

// Convertit un produit tel que renvoyé par l'API 
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
    dateAjout: p.date_ajout,
  };
}

const TROIS_JOURS_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_PRODUITS_RECENTS = 5;
const PRODUITS_PAR_PAGE = 8;

function produitsRecents(produits) {
  const seuil = Date.now() - TROIS_JOURS_MS;
  return [...produits]
    .filter((p) => p.dateAjout && new Date(p.dateAjout).getTime() >= seuil)
    .sort((a, b) => new Date(b.dateAjout) - new Date(a.dateAjout))
    .slice(0, MAX_PRODUITS_RECENTS);
}

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

function ProduitsPagines({ produits, onDetails, onContact, onWhatsapp, utilisateurId }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(produits.length / PRODUITS_PAR_PAGE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const produitsPage = produits.slice(page * PRODUITS_PAR_PAGE, (page + 1) * PRODUITS_PAR_PAGE);
  const suivant = () => setPage((p) => Math.min(p + 1, totalPages - 1));
  const precedent = () => setPage((p) => Math.max(p - 1, 0));

  return (
    <>
      <div className="carousel">
        <button className="carousel-nav-btn" onClick={precedent} disabled={page === 0} aria-label={t("home.carouselPrev")}>‹</button>

        <div className="produits-page-grid">
          {produitsPage.map((p) => (
            <ProductCard key={p.id} produit={p} onDetails={onDetails} onContact={onContact} onWhatsapp={onWhatsapp} utilisateurId={utilisateurId} />
          ))}
        </div>

        <button className="carousel-nav-btn" onClick={suivant} disabled={page >= totalPages - 1} aria-label={t("home.carouselNext")}>›</button>
      </div>

      {totalPages > 1 && (
        <p className="produits-page-indicateur">{t("home.pageIndicator", { page: page + 1, total: totalPages })}</p>
      )}
    </>
  );
}

// Largeur d'une carte vendeur + son espacement
const CARTE_LARGEUR = 150;
const CARTE_ECART = 20; // 1.25rem
const CARTE_PAS = CARTE_LARGEUR + CARTE_ECART;
const VITESSE_PX_PAR_S = 40;

// en dessous de ce nombre de vendeurs, la rangée reste STATIQUE 
const SEUIL_DEFILEMENT = 5;

// Carousel "Nos vendeurs". 
function VendeursCarouselAuto({ vendeurs, onClick }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const decalageRef = useRef(0);
  const enPauseRef = useRef(false);
  const [ordre, setOrdre] = useState([]);

  useEffect(() => {
    if (vendeurs.length === 0) { setOrdre([]); return; }
    decalageRef.current = 0;
    if (trackRef.current) trackRef.current.style.transform = "translateX(0)";

    if (vendeurs.length < SEUIL_DEFILEMENT) {
      // sous le seuil : une seule copie, immobile — voir SEUIL_DEFILEMENT
      setOrdre(vendeurs.map((v) => ({ ...v, _cle: `${v.vendeur_id}` })));
      return;
    }

    const largeurEcran = typeof window !== "undefined" ? window.innerWidth : 1280;
    const largeurUnLot = vendeurs.length * CARTE_PAS;
    const repetitions = Math.max(1, Math.ceil((largeurEcran * 2) / largeurUnLot));
    const liste = Array.from({ length: repetitions }, (_, copie) =>
      vendeurs.map((v) => ({ ...v, _cle: `${v.vendeur_id}-${copie}` }))
    ).flat();
    setOrdre(liste);
  }, [vendeurs]);

  useEffect(() => {

    if (ordre.length === 0 || vendeurs.length < SEUIL_DEFILEMENT) return;
    let dernierTimestamp = null;
    let idAnimation;

    const animer = (timestamp) => {
      if (dernierTimestamp === null) dernierTimestamp = timestamp;
      const delta = (timestamp - dernierTimestamp) / 1000;
      dernierTimestamp = timestamp;

      if (!enPauseRef.current) {
        decalageRef.current += VITESSE_PX_PAR_S * delta;
        if (decalageRef.current >= CARTE_PAS) {
          decalageRef.current -= CARTE_PAS;
          setOrdre((liste) => [...liste.slice(1), liste[0]]);
        }
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${-decalageRef.current}px)`;
      }

      idAnimation = requestAnimationFrame(animer);
    };

    idAnimation = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(idAnimation);
  }, [ordre.length, vendeurs.length]);

  if (ordre.length === 0) return null;

  const statique = vendeurs.length < SEUIL_DEFILEMENT;

  return (
    <div
      className={`vendeurs-auto__viewport${statique ? " vendeurs-auto__viewport--statique" : ""}`}
      onMouseEnter={() => { enPauseRef.current = true; }}
      onMouseLeave={() => { enPauseRef.current = false; }}
    >
      <div className="vendeurs-auto__track" ref={trackRef}>
        {ordre.map((v) => (
          <button
            type="button"
            className="vendeur-auto-carte"
            key={v._cle}
            onClick={() => onClick(v)}
          >
            {v.photo ? (
              <img src={v.photo} alt={v.nom} className="vendeur-auto-carte__photo" />
            ) : (
              <div className="vendeur-auto-carte__photo vendeur-auto-carte__photo--placeholder">
                {v.est_entreprise ? <Building2 size={26} /> : <User size={26} />}
              </div>
            )}
            <p className="vendeur-auto-carte__nom">{v.nom}</p>
            <p className="vendeur-auto-carte__meta">
              {t("home.vendorProductsCount", { n: v.nombre_produits })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [search, setSearch] = useState("");

  const [produits, setProduits] = useState([]);
  const [chargementProduits, setChargementProduits] = useState(true);
  const [erreurProduits, setErreurProduits] = useState(null);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const reconnectedAt = useGlobalStore((s) => s.reconnectedAt);

  const navigate = useNavigate();
  const { t } = useTranslation();

  // produits disponibles pour affichage public 
  const chargerProduits = () => {
    ProduitsApi.listerProduits({ disponible: "true" })
      .then((res) => setProduits(res.produits || []))
      .catch((err) => setErreurProduits(err.message))
      .finally(() => setChargementProduits(false));
  };
  useEffect(chargerProduits, []);
  useEffect(() => {
    if (!reconnectedAt) return;
    chargerProduits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectedAt]);

  // réactivité temps réel un produit publié/rendu disponible par n'importe quel vendeur 
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
  const produitsRecentsAffiches = produitsRecents(produitsAffiches);

  const [vendeurs, setVendeurs] = useState([]);
  const [chargementVendeurs, setChargementVendeurs] = useState(true);

  const chargerVendeurs = () => {
    ProduitsApi.listerVendeursPublics()
      .then((res) => setVendeurs(res.vendeurs || []))
      .catch(() => { })
      .finally(() => setChargementVendeurs(false));
  };

  useEffect(() => { chargerVendeurs(); }, []);

  // un produit publié/retiré peut faire apparaître/disparaître un vendeur de la liste. 
  useEffect(() => {
    if (!produitEvent) return;
    chargerVendeurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitEvent]);
  useEffect(() => {
    if (!reconnectedAt) return;
    chargerVendeurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectedAt]);

  // enregistre le clic "Contacter" (alimente nombre_contacts affiché au
  // vendeur sur "Mes produits").
  const contacterProduit = (produit) => {
    if (!isConnected) {
      navigate("/auth");
      return;
    }
    ProduitsApi.contacterProduit(produit.id).catch(() => { });
    if (produit.vendeurId) {
      navigate(`/messages?avec=${produit.vendeurId}&produit=${produit.id}`);
    }
  };

  const contacterViaWhatsapp = (produit) => {
    ProduitsApi.contacterProduit(produit.id).catch(() => { });
  };
  const ETAPES = [
    { n: "1", texte: t("home.stepCreateAccount") },
    { n: "2", texte: t("home.stepSearchProduct") },
    { n: "3", texte: t("home.stepContactSeller") },
    { n: "4", texte: t("home.stepMakeDeal") },
  ];

  const SANT_ED = [
    { label: t("home.producerGuide"), section: "devenirVendeur" },
    { label: t("home.howSearchProduct"), section: "recherche" },
    { label: t("home.securityTrust"), section: "securite" },
  ];


  const isConnected = useAuthStore((s) => s.isConnected);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const profil = useProfilStore((s) => s.profil);
  const isVendeur = profil?.role === "vendeur";
  const isAdmin = profil?.role === "admin";

  const [mesProduits, setMesProduits] = useState([]);
  const [chargementMesProduits, setChargementMesProduits] = useState(true);

  const chargerMesProduits = () => {
    if (!isConnected || !isVendeur) {
      setChargementMesProduits(false);
      return;
    }
    ProduitsApi.mesProduits()
      .then((res) => setMesProduits(res.produits || []))
      .catch(() => { })
      .finally(() => setChargementMesProduits(false));
  };
  useEffect(chargerMesProduits, [isConnected, isVendeur]);
  useEffect(() => {
    if (!reconnectedAt) return;
    chargerMesProduits();
  }, [reconnectedAt]);

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

      {/* ── Section principale avec titre et recherche ── */}
      <section className="hero">
        <h1 className="hero-title">
          {t("home.heroTitleLine1")}<br />
          {t("home.heroTitleLine2")} {" "}
          <span className="accent">{t("home.heroTitleAccent")}</span>{" "}
          {t("home.heroTitleLine3")}
        </h1>
        <p className="hero-sub">{t("home.heroSubtitle")}</p>

        {/* Barre de recherche  */}
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

      {/* ── PWODI RESAN ── */}
      <section className="section">
        <h2 className="section-title">{t("home.recentProducts")}</h2>

        {chargementProduits && (
          <p className="produits-etat">{t("home.loadingProducts")}</p>
        )}

        {!chargementProduits && erreurProduits && (
          <p className="produits-etat produits-etat--erreur">{erreurProduits}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsRecentsAffiches.length === 0 && (
          <p className="produits-etat">{t("home.noRecentProducts")}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsRecentsAffiches.length > 0 && (
          <ProduitsCarousel
            produits={produitsRecentsAffiches}
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

              <div className="etapes">
                {ETAPES.map((e, i) => (
                  <>
                    <div className="etape-box" key={e.n}>
                      {e.n}. {e.texte}
                    </div>

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

      {/* ── TOUS LES PRODUITS ── */}
      <section className="section">
        <h2 className="section-title">{t("home.allProductsTitle")}</h2>

        {chargementProduits && (
          <p className="produits-etat">{t("home.loadingProducts")}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsAffiches.length === 0 && (
          <p className="produits-etat">{t("home.noProductsYet")}</p>
        )}

        {!chargementProduits && !erreurProduits && produitsAffiches.length > 0 && (
          <ProduitsPagines
            produits={produitsAffiches}
            onDetails={(pr) => navigate(`/produits/detail?id=${pr.id}`)}
            onContact={contacterProduit}
            onWhatsapp={contacterViaWhatsapp}
            utilisateurId={utilisateur?.id}
          />
        )}
      </section>

      {/* ── NOS VENDEURS ── */}
      {!chargementVendeurs && vendeurs.length > 0 && (
        <section className="section-brown section-brown--vendeurs">
          <h2 className="section-title">{t("home.ourVendorsTitle")}</h2>
          <VendeursCarouselAuto
            vendeurs={vendeurs}
            onClick={(v) => navigate(`/vendeur/detail?id=${v.vendeur_id}`)}
          />
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

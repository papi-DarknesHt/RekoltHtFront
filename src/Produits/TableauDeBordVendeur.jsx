import { useEffect, useState } from "react";
import { LayoutDashboard, Package, MessageCircle, User, Clock } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import VendeurTabs from "./VendeurTabs.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { useGlobalStore } from "../api/globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { ProduitsApi } from "../api/produits";
import "../assets/CSS/TableauDeBordVendeur.css";

const NOMBRE_PRODUITS_GRAPHE = 5;

export default function TableauDeBordVendeur() {
  const { t, lang } = useTranslation();
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const produitEvent = useGlobalStore((s) => s.produitEvent);
  const contactEvent = useGlobalStore((s) => s.contactEvent);

  const [produits, setProduits] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    Promise.all([
      ProduitsApi.mesProduits(),
      ProduitsApi.historiqueContactsVendeur(),
    ])
      .then(([produitsRes, contactsRes]) => {
        setProduits(produitsRes.produits || []);
        setContacts(contactsRes.contacts || []);
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Produits/signals.py côté backend) : le
  // nombre de produits / le graphe des plus contactés se met à jour sans
  // rechargement — produitEvent diffuse les produits de tout le monde,
  // filtré ici à ce vendeur
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

  const produitsPlusContactes = [...produits]
    .filter((p) => (p.nombre_contacts || 0) > 0)
    .sort((a, b) => (b.nombre_contacts || 0) - (a.nombre_contacts || 0))
    .slice(0, NOMBRE_PRODUITS_GRAPHE);

  const maxContacts = Math.max(1, ...produitsPlusContactes.map((p) => p.nombre_contacts || 0));

  // Intl ne reconnaît pas "ht" (créole haïtien) comme locale BCP47 valide —
  // on retombe sur le français pour le formatage de date dans ce cas
  const localeAffichage = { fr: "fr-FR", en: "en-US", ht: "fr-HT" }[lang] || "fr-FR";
  const formaterDate = (iso) => new Date(iso).toLocaleString(localeAffichage, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="tdb-page">
      <NavBar />

      <div className="tdb-container">
        <div className="tdb-header">
          <div className="tdb-header__icon"><LayoutDashboard size={22} /></div>
          <div className="tdb-header__texte">
            <h1 className="tdb-header__title">{t("dashboard.title")}</h1>
            <p className="tdb-header__subtitle">{t("dashboard.subtitle")}</p>
          </div>
        </div>

        <VendeurTabs />

        {chargement && <p className="tdb-hint">{t("profile.loading")}</p>}
        {!chargement && erreur && <p className="tdb-alert tdb-alert--error">{erreur}</p>}

        {!chargement && !erreur && (
          <>
            <div className="tdb-stats">
              <div className="tdb-stat">
                <div className="tdb-stat__icon"><Package size={18} /></div>
                <div>
                  <p className="tdb-stat__value">{totalProduits}</p>
                  <p className="tdb-stat__label">{t("dashboard.totalProducts")}</p>
                </div>
              </div>
              <div className="tdb-stat">
                <div className="tdb-stat__icon tdb-stat__icon--green"><Package size={18} /></div>
                <div>
                  <p className="tdb-stat__value">{totalDisponibles}</p>
                  <p className="tdb-stat__label">{t("dashboard.availableProducts")}</p>
                </div>
              </div>
              <div className="tdb-stat">
                <div className="tdb-stat__icon tdb-stat__icon--terracotta"><MessageCircle size={18} /></div>
                <div>
                  <p className="tdb-stat__value">{totalContacts}</p>
                  <p className="tdb-stat__label">{t("dashboard.totalContacts")}</p>
                </div>
              </div>
            </div>

            <div className="tdb-card">
              <h3 className="tdb-card__heading">
                <MessageCircle size={16} />
                {t("dashboard.topProductsTitle")}
              </h3>

              {produitsPlusContactes.length === 0 ? (
                <p className="tdb-hint">{t("dashboard.topProductsEmpty")}</p>
              ) : (
                <div className="tdb-graphe">
                  {produitsPlusContactes.map((p) => (
                    <div className="tdb-graphe-colonne" key={p.id}>
                      <span className="tdb-graphe-valeur">{p.nombre_contacts || 0}</span>
                      <div className="tdb-graphe-barre-piste">
                        <div
                          className="tdb-graphe-barre"
                          style={{ height: `${((p.nombre_contacts || 0) / maxContacts) * 100}%` }}
                        />
                      </div>
                      <span className="tdb-graphe-nom" title={p.nom}>{p.nom}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tdb-card">
              <h3 className="tdb-card__heading">
                <Clock size={16} />
                {t("dashboard.historyTitle")}
              </h3>

              {contacts.length === 0 ? (
                <p className="tdb-hint">{t("dashboard.historyEmpty")}</p>
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
      </div>

      <Footer />
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/NotFound.css";

// page provisoire — la création de produits n'est pas encore implémentée
// (voir Produits/models.py et Produits/views.py côté backend, vides pour
// l'instant) ; sert de destination valide au bouton "Ajouter un produit"
// affiché après une vérification vendeur réussie (DevenirVendeur.jsx)
export default function AjouterProduit() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <NavBar />
      <div className="nf-root">
        <div className="nf-container">
          <h1 className="nf-title">{t("product.comingSoonTitle")}</h1>
          <p className="nf-sub">{t("product.comingSoonText")}</p>

          <div className="nf-actions">
            <button className="nf-btn-primary" onClick={() => navigate("/")}>
              {t("product.backToHome")}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

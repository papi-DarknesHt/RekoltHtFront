import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx"
import { useTranslation } from "../assets/Translate/i18n.jsx";

export default function produits(){
    const navigate = useNavigate();
    const { t } = useTranslation();
    return (
        <>
        <NavBar />
              <div className="nf-root">
                <div className="nf-container">
                  <h1 className="nf-title">{t("aide.title")}</h1>
                  <p className="nf-sub">{t("aide.text")}</p>
        
                  <div className="nf-actions">
                    <button className="nf-btn-primary" onClick={() => navigate("/")}>
                      {t("product.backToHome")}
                    </button>
                  </div>
                </div>
              </div>
              <Footer />

        </>
    )
};
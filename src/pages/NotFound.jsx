import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <NavBar />
      <div className="nf-root">
        <div className="nf-container">

          <div className="nf-code">404</div>

          <h1 className="nf-title">{t("notFound.title")}</h1>
          <p className="nf-sub">
            {t("notFound.subtitle")}
          </p>

          <div className="nf-actions">
            <button className="nf-btn-primary" onClick={() => navigate("/")}>
              {t("notFound.backHome")}
            </button>
            <button className="nf-btn-secondary" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>
              {t("notFound.goBack")}
            </button>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}

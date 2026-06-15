import "../assets/CSS/Footer.css";
import logo from "../assets/Images/Asset5.svg";
import { Link } from "react-router-dom";
import { useTranslation } from "../assets/Translate/i18n.jsx";

export default function Footer() {
    const { t } = useTranslation();
    return (
        <>
            {/* ===== Pied de page ===== */}
            <footer className="profil-footer">
                <div className="profil-footer__brand">
                    <p className="profil-footer__logo">
                        <img style={{ width: "50%" }} src={logo} alt="Logo" />
                    </p>
                    <p className="profil-footer__tagline">
                        {t("footer.tagline")}
                    </p>
                </div>

                <div className="profil-footer__column">
                    <h4 className="profil-footer__title">{t("footer.navigation")}</h4>
                    <Link to="/">{t("nav.home")}</Link>
                    <a href="#">{t("nav.products")}</a>
                    <a href="#">{t("nav.help")}</a>
                </div>

                <div className="profil-footer__column">
                    <h4 className="profil-footer__title">{t("footer.information")}</h4>
                    <a href="#">{t("footer.about")}</a>
                    <a href="#">{t("footer.helpCenter")}</a>
                    <a href="#">{t("footer.terms")}</a>
                    <a href="#">{t("footer.contact")}</a>
                </div>
            </footer>
        </>
    )
}
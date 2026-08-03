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
                        <img style={{ width: "50%" }} src={logo} alt={t("common.logoAlt")} />
                    </p>
                    <p className="profil-footer__tagline">
                        {t("footer.tagline")}
                    </p>
                </div>

                <div className="profil-footer__column">
                    <h4 className="profil-footer__title">{t("footer.navigation")}</h4>
                    <Link to="/">{t("nav.home")}</Link>
                    <Link to="/produits">{t("nav.products")}</Link>
                    <Link to="/aide">{t("nav.help")}</Link>
                </div>

                <div className="profil-footer__column">
                    <h4 className="profil-footer__title">{t("footer.information")}</h4>
                    <Link to="/qui-sommes-nous">{t("footer.about")}</Link>
                    <Link to="/aide">{t("footer.helpCenter")}</Link>
                    <Link to="/politique-utilisation">{t("footer.terms")}</Link>
                    <Link to="/contact">{t("footer.contact")}</Link>
                </div>
            </footer>
        </>
    )
}
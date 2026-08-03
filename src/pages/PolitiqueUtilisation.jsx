import { Link } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/PolitiqueUtilisation.css";

// nombre de sections fixe, voir terms.s1Title/s1Text .. s10Title/s10Text
// dans les fichiers de traduction (src/assets/Translate/*.json)
const NOMBRE_SECTIONS = 10;

export default function PolitiqueUtilisation() {
  const { t } = useTranslation();

  return (
    <div className="pu-page">
      <NavBar />

      <div className="pu-container">
        <BoutonRetour />

        <div className="pu-header">
          <h1 className="pu-header__title">{t("terms.title")}</h1>
          <p className="pu-header__updated">{t("terms.lastUpdated")}</p>
        </div>

        <p className="pu-intro">{t("terms.intro")}</p>

        {Array.from({ length: NOMBRE_SECTIONS }, (_, i) => i + 1).map((n) => (
          <section className="pu-section" key={n}>
            <h2 className="pu-section__title">{t(`terms.s${n}Title`)}</h2>
            <p className="pu-section__text">{t(`terms.s${n}Text`)}</p>
          </section>
        ))}

        <div className="pu-contact">
          <p className="pu-contact__text">{t("terms.contactPrompt")}</p>
          <Link to="/contact" className="pu-contact__link">{t("terms.contactLink")}</Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/Aide.css";
import { SECTIONS_AIDE as SECTIONS } from "../assets/Translate/faqSections.js";

export default function Aide() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  // permet un lien direct vers une section précise (ex: les boutons "Centre
  // d'aide" de HomePage.jsx renvoient vers /aide?section=devenirVendeur) —
  // retombe sur la première section si le paramètre est absent ou invalide
  const sectionDemandee = searchParams.get("section");
  const [sectionActive, setSectionActive] = useState(
    SECTIONS.some((s) => s.cle === sectionDemandee) ? sectionDemandee : SECTIONS[0].cle
  );

  const section = SECTIONS.find((s) => s.cle === sectionActive);

  return (
    <div className="aide-page">
      <NavBar />

      <div className="aide-container">
        <BoutonRetour />
        <div className="aide-header">
          <h1 className="aide-header__title">{t("aide.title")}</h1>
          <p className="aide-header__subtitle">{t("aide.subtitle")}</p>
        </div>

        <div className="aide-layout">
          <nav className="aide-sidebar">
            {SECTIONS.map((s) => (
              <button
                key={s.cle}
                type="button"
                className={`aide-sidebar__item ${s.cle === sectionActive ? "aide-sidebar__item--active" : ""}`}
                onClick={() => setSectionActive(s.cle)}
              >
                {t(`aide.sections.${s.cle}.menuLabel`)}
              </button>
            ))}
          </nav>

          <div className="aide-content">
            <h2 className="aide-content__title">{t(`aide.sections.${section.cle}.title`)}</h2>

            {Array.from({ length: section.nombreItems }, (_, i) => i + 1).map((n) => (
              <div className="aide-item" key={n}>
                <p className="aide-item__question">{t(`aide.sections.${section.cle}.q${n}`)}</p>
                <p className="aide-item__reponse">{t(`aide.sections.${section.cle}.a${n}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

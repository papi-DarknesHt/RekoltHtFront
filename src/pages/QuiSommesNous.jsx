import { useNavigate } from "react-router-dom";
import { Target, Gift, Users, MapPin, ShieldCheck, ArrowRight } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import Footer from "../components/Footer.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/QuiSommesNous.css";

export default function QuiSommesNous() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const valeurs = [
    { Icone: Gift, titre: t("about.value1Title"), texte: t("about.value1Text") },
    { Icone: Users, titre: t("about.value2Title"), texte: t("about.value2Text") },
    { Icone: MapPin, titre: t("about.value3Title"), texte: t("about.value3Text") },
    { Icone: ShieldCheck, titre: t("about.value4Title"), texte: t("about.value4Text") },
  ];

  return (
    <div className="qs-page">
      <NavBar />

      <div className="qs-container">
        <BoutonRetour />

        <div className="qs-header">
          <div className="qs-header__icon"><Target size={22} /></div>
          <div>
            <h1 className="qs-header__title">{t("about.title")}</h1>
            <p className="qs-header__subtitle">{t("about.subtitle")}</p>
          </div>
        </div>

        <section className="qs-mission">
          <h2 className="qs-mission__title">{t("about.missionTitle")}</h2>
          <p className="qs-mission__text">{t("about.missionText")}</p>
        </section>

        <section>
          <h2 className="qs-values__title">{t("about.valuesTitle")}</h2>
          <div className="qs-values-grid">
            {valeurs.map(({ Icone, titre, texte }) => (
              <div className="qs-value-card" key={titre}>
                <div className="qs-value-card__icon"><Icone size={22} /></div>
                <h3 className="qs-value-card__title">{titre}</h3>
                <p className="qs-value-card__text">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="qs-cta">
          <h2 className="qs-cta__title">{t("about.ctaTitle")}</h2>
          <p className="qs-cta__text">{t("about.ctaText")}</p>
          <button type="button" className="qs-cta__btn" onClick={() => navigate("/auth")}>
            {t("about.ctaButton")}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <Footer />
    </div>
  );
}

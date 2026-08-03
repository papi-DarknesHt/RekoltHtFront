import { useEffect, useState } from "react";
import { Lock, ShieldCheck, X } from "lucide-react";
import { useE2eStore } from "../api/e2eStore.js";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/ModalPinE2E.css";

// Modale globale du code PIN de la messagerie chiffrée de bout en bout —
// consomme e2eStore.js::requetePin (même principe promesse que ConfirmModal
// consomme confirmStore.js). Deux modes possibles :
//  - "creer"        : première configuration (PIN + confirmation)
//  - "deverrouiller" : déverrouillage sur cet appareil (PIN seul), avec un
//    lien "PIN oublié ?" qui bascule localement vers un nouveau PIN +
//    confirmation (voir e2eStore.js::confirmerRegeneration).
export default function ModalPinE2E() {
  const { t } = useTranslation();
  const requetePin = useE2eStore((s) => s.requetePin);
  const repondrePin = useE2eStore((s) => s.repondrePin);
  const confirmerRegeneration = useE2eStore((s) => s.confirmerRegeneration);
  const annulerPin = useE2eStore((s) => s.annulerPin);

  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [modeOublie, setModeOublie] = useState(false);
  const [erreurLocale, setErreurLocale] = useState(null);

  useEffect(() => {
    setPin("");
    setConfirmation("");
    setModeOublie(false);
    setErreurLocale(null);
  }, [requetePin]);

  if (!requetePin) return null;

  const demandeConfirmation = requetePin.mode === "creer" || modeOublie;
  const validerPin = (valeur) => /^\d{4,8}$/.test(valeur);

  const soumettre = (e) => {
    e.preventDefault();
    setErreurLocale(null);

    if (!validerPin(pin)) {
      setErreurLocale(t("e2e.pinFormatInvalide"));
      return;
    }
    if (demandeConfirmation && pin !== confirmation) {
      setErreurLocale(t("e2e.pinMismatch"));
      return;
    }

    if (modeOublie) {
      confirmerRegeneration(pin);
    } else {
      repondrePin(pin);
    }
  };

  const titre = modeOublie ? t("e2e.titreOublie")
    : requetePin.mode === "creer" ? t("e2e.titreCreer")
    : t("e2e.titreDeverrouiller");

  const description = modeOublie ? t("e2e.descriptionOublie")
    : requetePin.mode === "creer" ? t("e2e.descriptionCreer")
    : t("e2e.descriptionDeverrouiller");

  return (
    <div className="pin-e2e-overlay">
      <div className="pin-e2e-modal">
        <button type="button" className="pin-e2e-modal__close" onClick={annulerPin} aria-label={t("common.close")}>
          <X size={18} />
        </button>
        <div className="pin-e2e-modal__icon"><ShieldCheck size={22} /></div>
        <h3 className="pin-e2e-modal__titre">{titre}</h3>
        <p className="pin-e2e-modal__description">{description}</p>

        <form className="pin-e2e-modal__form" onSubmit={soumettre}>
          <div className="pin-e2e-modal__champ">
            <Lock size={15} />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder={demandeConfirmation ? t("e2e.placeholderNouveauPin") : t("e2e.placeholderPin")}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          {demandeConfirmation && (
            <div className="pin-e2e-modal__champ">
              <Lock size={15} />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("e2e.placeholderConfirmationPin")}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
          )}

          {(erreurLocale || requetePin.erreur === "PIN_INCORRECT") && (
            <p className="pin-e2e-modal__erreur">{erreurLocale || t("e2e.pinIncorrect")}</p>
          )}

          <button type="submit" className="pin-e2e-modal__btn pin-e2e-modal__btn--primary">
            {modeOublie ? t("e2e.btnRegenerer") : requetePin.mode === "creer" ? t("e2e.btnCreer") : t("e2e.btnDeverrouiller")}
          </button>

          {requetePin.mode === "deverrouiller" && !modeOublie && (
            <button type="button" className="pin-e2e-modal__lien" onClick={() => setModeOublie(true)}>
              {t("e2e.lienOublie")}
            </button>
          )}
          {modeOublie && (
            <button type="button" className="pin-e2e-modal__lien" onClick={() => setModeOublie(false)}>
              {t("e2e.lienRetour")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

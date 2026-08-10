import { useEffect, useState } from "react";
import { Send, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import Footer from "../components/Footer.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { AuthentificationApi } from "../api/auth";
import { useGlobalStore } from "../api/globalStore.js";
import "../assets/CSS/ContacterAdmin.css";

function formaterDate(iso) {
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// demande formelle à l'administration (objet + description), distincte de la
// messagerie support libre (voir ContacterAdmin.jsx, même page shell
// ca-page/ca-container réutilisée pour rester cohérent visuellement) : ici la
// demande aboutit toujours à une décision agréée/rejetée, notifiée par email
// (voir Registration/models.py::DemandeAdministrative). Le lien vers cette
// page est inclus dans l'email envoyé quand un compte est bloqué (voir
// toggleBloquerUtilisateur, Registration/views.py)
export default function DemandeAdministrative() {
  const { t } = useTranslation();

  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [objet, setObjet] = useState("");
  const [description, setDescription] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    AuthentificationApi.mesDemandesAdministratives()
      .then((res) => setDemandes(res.demandes || []))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, []);

  // réactivité temps réel (voir Registration/signals.py::
  // broadcast_demande_administrative côté backend, groupe personnel
  // "user_<id>") : dès qu'un admin agrée/rejette la demande, le statut de
  // cette page se met à jour sans rechargement — sans ça, la demande restait
  // affichée "en attente" jusqu'à ce que l'utilisateur revienne sur la page.
  const demandeAdministrativeEvent = useGlobalStore((s) => s.demandeAdministrativeEvent);
  useEffect(() => {
    if (!demandeAdministrativeEvent || demandeAdministrativeEvent.type !== "demande_administrative.traitee") return;
    const { data } = demandeAdministrativeEvent;
    setDemandes((liste) => liste.map((d) => (d.id === data.id ? data : d)));
  }, [demandeAdministrativeEvent]);

  const envoyer = async (e) => {
    e.preventDefault();
    if (!objet.trim() || !description.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const res = await AuthentificationApi.creerDemandeAdministrative(objet.trim(), description.trim());
      setDemandes((liste) => [res.demande, ...liste]);
      setObjet("");
      setDescription("");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const IconeStatut = { en_attente: Clock, approuvee: CheckCircle2, rejetee: XCircle };

  return (
    <div className="ca-page">
      <NavBar />

      <div className="ca-container">
        <BoutonRetour />
        <div className="ca-header">
          <div className="ca-header__icon"><FileText size={22} /></div>
          <div>
            <h1 className="ca-header__title">{t("demandeAdministrative.title")}</h1>
            <p className="ca-header__subtitle">{t("demandeAdministrative.subtitle")}</p>
          </div>
        </div>

        <form className="ca-form" onSubmit={envoyer}>
          <input
            className="ca-textarea" style={{ minHeight: "auto" }}
            placeholder={t("demandeAdministrative.objetPlaceholder")}
            value={objet} onChange={(e) => setObjet(e.target.value)} maxLength={200}
          />
          <textarea
            className="ca-textarea"
            placeholder={t("demandeAdministrative.descriptionPlaceholder")}
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="ca-btn ca-btn--primary" disabled={envoiEnCours || !objet.trim() || !description.trim()}>
            <Send size={16} />
            {envoiEnCours ? t("profile.loading") : t("demandeAdministrative.envoyer")}
          </button>
          {erreur && <p className="ca-alert">{erreur}</p>}
        </form>

        <h2 className="ca-historique-titre">{t("demandeAdministrative.historiqueTitle")}</h2>

        {chargement && <p className="ca-hint">{t("profile.loading")}</p>}
        {!chargement && demandes.length === 0 && <p className="ca-hint">{t("demandeAdministrative.aucune")}</p>}

        {!chargement && demandes.length > 0 && (
          <ul className="ca-liste">
            {demandes.map((d) => {
              const Icone = IconeStatut[d.statut] || Clock;
              return (
                <li className="ca-item" key={d.id}>
                  <div className="ca-item__bulle ca-item__bulle--envoye">
                    <p className="ca-item__auteur"><strong>{d.objet}</strong></p>
                    <p className="ca-item__texte">{d.description}</p>
                    <span className="ca-item__date">{formaterDate(d.date_creation)}</span>
                  </div>

                  {d.statut === "en_attente" ? (
                    <p className="ca-item__attente">
                      <Clock size={14} />
                      {t("demandeAdministrative.statut.en_attente")}
                    </p>
                  ) : (
                    <div className="ca-item__bulle ca-item__bulle--reponse">
                      <p className="ca-item__auteur">
                        <Icone size={14} />
                        {t(`demandeAdministrative.statut.${d.statut}`)}
                      </p>
                      {d.reponse_admin && <p className="ca-item__texte">{d.reponse_admin}</p>}
                      <span className="ca-item__date">{formaterDate(d.date_traitement)}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Footer />
    </div>
  );
}

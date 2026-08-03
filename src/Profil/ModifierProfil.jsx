import React from "react";
import {
  Bell,
  Settings,
  User,
  Camera,
  Briefcase,
  FileText,
  Mail,
  Phone,
  Lock,
  KeyRound,
  Share2,
  Plus,
  Trash2,
  MessageCircle,
  Globe,
  HeartCrack,
  Save,
  Image,
  Truck,
  Shield,
  Building2,
} from "lucide-react";
import "../assets/CSS/ModifierProfil.css";
import NavBar from "../components/NavBar.jsx";
import BoutonRetour from "../components/BoutonRetour.jsx";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "./ProfilStore.js"
import Footer from "../components/Footer.jsx"
import MapSelectionGPS from "../components/MapSelectionGPS.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import departementsData from "../assets/Departements/haiti_departements.json";
import { fusionnerLocalisationDetectee, niveauDetecteDepuisLoc } from "../utils/geoLookup.js";
import { useConfirmStore } from "../api/confirmStore.js";
import { useE2eStore } from "../api/e2eStore.js";



export default function ModifierProfil() {
  const [tab, settab] = useState("initialProfile");

  const navigate = useNavigate();
  const { t } = useTranslation();

  // ── données réelles de l'utilisateur connecté (store d'authentification)
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const entreprise = useAuthStore((s) => s.entreprise);
  const modifierUtilisateur = useAuthStore((s) => s.modifierUtilisateur);
  const modifierMotDePasse = useAuthStore((s) => s.modifierMotDePasse);
  const modifierEntreprise = useAuthStore((s) => s.modifierEntreprise);
  const supprimerLogoEntreprise = useAuthStore((s) => s.supprimerLogoEntreprise);

  // Un compte "Antrepriz" modifie les informations de son entreprise plutôt
  // que son identité personnelle — même logique que dans ProfilAcheteur.
  const isEntreprise = !!(entreprise && entreprise.proprietaire_id === utilisateur?.id);

  // ── données réelles du profil (store profil)
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const modifierProfil = useProfilStore((s) => s.modifierProfil);
  const supprimerPhotoProfil = useProfilStore((s) => s.supprimerPhotoProfil);
  const demanderConfirmation = useConfirmStore((s) => s.demander);

  // ── état du formulaire "Informations personnelles" — localisation gérée
  // comme dans Registration/DevenirVendeur.jsx (adresse + cascade
  // département/commune/section communale + point GPS)
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    bio: "",
    adresse: "",
    departement: "",
    commune: "",
    section_communale: "",
    coord: null,   // { lat, lng }
  });
  const [localisationNiveauDetecte, setLocalisationNiveauDetecte] = useState(null);

  // ── état du formulaire "Informations de l'entreprise" (compte Antrepriz)
  const [entrepriseForm, setEntrepriseForm] = useState({
    nom_Entreprise: "",
    secteur: "",
    description: "",
    email: "",
    telephone: "",
    adresse: "",
    departement: "",
    commune: "",
    section_communale: "",
    coord: null,   // { lat, lng }
  });

  // ── état du formulaire "Sécurité" (changement de mot de passe)
  const [passwordForm, setPasswordForm] = useState({
    ancien: "",
    nouveau: "",
    confirmation: "",
  });

  // ── état du formulaire "Code de sécurité des messages" (changement du PIN
  // de chiffrement de bout en bout — voir api/e2eStore.js)
  const [pinForm, setPinForm] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState(null);
  const changerPin = useE2eStore((s) => s.changerPin);
  const regenererCleVolontairement = useE2eStore((s) => s.regenererCleVolontairement);

  // ── photo de profil : aperçu local + données à envoyer au backend
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoData, setPhotoData] = useState(null);
  const fileInputRef = useRef(null);

  // ── messages de retour (succès / erreur) pour l'utilisateur
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // au montage : on récupère le profil à jour depuis l'API
  useEffect(() => {
    afficherProfil().catch(() => {});
  }, [afficherProfil]);

  // dès que l'utilisateur ou le profil sont chargés/mis à jour, on synchronise le formulaire
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nom: utilisateur?.nom ?? prev.nom,
      prenom: utilisateur?.prenom ?? prev.prenom,
      email: utilisateur?.email ?? prev.email,
      telephone: utilisateur?.telephone ?? prev.telephone,
      bio: profil?.bio ?? prev.bio,
      adresse: profil?.adresse ?? prev.adresse,
      departement: profil?.departement ?? prev.departement,
      commune: profil?.commune ?? prev.commune,
      section_communale: profil?.section_communale ?? prev.section_communale,
      coord: prev.coord || (profil?.latitude != null && profil?.longitude != null
        ? { lat: profil.latitude, lng: profil.longitude }
        : null),
    }));
  }, [utilisateur, profil]);

  // dès que l'entreprise est chargée/mise à jour, on synchronise son formulaire
  useEffect(() => {
    if (!entreprise) return;
    setEntrepriseForm((prev) => ({
      ...prev,
      nom_Entreprise: entreprise.nom_Entreprise ?? prev.nom_Entreprise,
      secteur: entreprise.secteur ?? prev.secteur,
      description: entreprise.description ?? prev.description,
      email: entreprise.email ?? prev.email,
      telephone: entreprise.telephone ?? prev.telephone,
      adresse: entreprise.adresse ?? prev.adresse,
      departement: entreprise.departement ?? prev.departement,
      commune: entreprise.commune ?? prev.commune,
      section_communale: entreprise.section_communale ?? prev.section_communale,
      coord: prev.coord || (entreprise.latitude != null && entreprise.longitude != null
        ? { lat: entreprise.latitude, lng: entreprise.longitude }
        : null),
    }));
  }, [entreprise]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleEntrepriseChange = (field) => (event) => {
    setEntrepriseForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePinFormChange = (field) => (event) => {
    setPinForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  // ── sélection d'une nouvelle photo de profil : on la convertit en base64
  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
      setPhotoData({ filename: file.name, content: reader.result });
    };
    reader.readAsDataURL(file);
  };

  // ── supprime l'aperçu local non sauvegardé, et si une photo/logo est déjà
  // enregistré(e) côté serveur, la supprime aussi via l'API
  const handleRemovePhoto = async () => {
    if (isEntreprise) {
      if (entreprise?.logo) {
        if (!(await demanderConfirmation(t("profile.removeLogoConfirm"), { danger: true }))) return;
        setPhotoPreview(null);
        setPhotoData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage(null);
        try {
          await supprimerLogoEntreprise(entreprise.id);
          setMessage({ type: "success", text: t("profile.removeLogoSuccess") });
        } catch (error) {
          setMessage({ type: "error", text: error.message });
        }
        return;
      }
      setPhotoPreview(null);
      setPhotoData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (profil?.photo_profil) {
      if (!(await demanderConfirmation(t("profile.removePhotoConfirm"), { danger: true }))) return;
      setPhotoPreview(null);
      setPhotoData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(null);
      try {
        await supprimerPhotoProfil();
        setMessage({ type: "success", text: t("profile.removePhotoSuccess") });
      } catch (error) {
        setMessage({ type: "error", text: error.message });
      }
      return;
    }

    setPhotoPreview(null);
    setPhotoData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── enregistre les informations personnelles + le profil (et la photo si modifiée)
  const handleSave = async () => {
    if (!(await demanderConfirmation(t("profile.saveConfirm")))) return;
    setSaving(true);
    setMessage(null);
    try {
      if (isEntreprise) {
        await modifierEntreprise({
          id: entreprise.id,
          nom_Entreprise: entrepriseForm.nom_Entreprise,
          secteur: entrepriseForm.secteur,
          description: entrepriseForm.description,
          email: entrepriseForm.email,
          telephone: entrepriseForm.telephone,
          adresse: entrepriseForm.adresse,
          departement: entrepriseForm.departement,
          commune: entrepriseForm.commune,
          section_communale: entrepriseForm.section_communale,
          latitude: entrepriseForm.coord?.lat ?? null,
          longitude: entrepriseForm.coord?.lng ?? null,
          ...(photoData ? { logo: photoData } : {}),
        });
      } else {
        await modifierUtilisateur({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone,
        });

        await modifierProfil({
          adresse: form.adresse,
          departement: form.departement,
          commune: form.commune,
          section_communale: form.section_communale,
          latitude: form.coord?.lat ?? null,
          longitude: form.coord?.lng ?? null,
          ...(photoData ? { photo_profil: photoData } : {}),
        });
      }

      setMessage({ type: "success", text: t("profile.saveSuccess") });
      setPhotoData(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // ── changement de mot de passe
  const handleChangePassword = async () => {
    setMessage(null);

    if (passwordForm.nouveau !== passwordForm.confirmation) {
      setMessage({ type: "error", text: t("profile.passwordMismatch") });
      return;
    }
    if (!(await demanderConfirmation(t("profile.passwordChangeConfirm")))) return;

    try {
      await modifierMotDePasse({
        ancien_mot_de_passe: passwordForm.ancien,
        nouveau_mot_de_passe: passwordForm.nouveau,
      });
      setMessage({ type: "success", text: t("profile.passwordSuccess") });
      setPasswordForm({ ancien: "", nouveau: "", confirmation: "" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  // ── changement du code PIN de la messagerie chiffrée de bout en bout (voir
  // api/e2eStore.js) — indépendant du mot de passe du compte
  const handleChangerPin = async () => {
    setPinMessage(null);
    if (!/^\d{4,8}$/.test(pinForm.nouveau)) {
      setPinMessage({ type: "error", text: t("e2e.pinFormatInvalide") });
      return;
    }
    if (pinForm.nouveau !== pinForm.confirmation) {
      setPinMessage({ type: "error", text: t("e2e.pinMismatch") });
      return;
    }
    if (!(await demanderConfirmation(t("e2e.confirmChangerPin")))) return;

    setPinSaving(true);
    try {
      await changerPin(pinForm.ancien, pinForm.nouveau);
      setPinMessage({ type: "success", text: t("e2e.pinChangeSuccess") });
      setPinForm({ ancien: "", nouveau: "", confirmation: "" });
    } catch {
      // dechiffrerClePrivee échoue silencieusement (OperationError) sur un
      // mauvais ancien PIN — pas d'autre cause probable ici
      setPinMessage({ type: "error", text: t("e2e.pinIncorrect") });
    } finally {
      setPinSaving(false);
    }
  };

  // ── régénération complète de la clé de chiffrement (PIN oublié) — rend
  // tous les anciens messages chiffrés définitivement illisibles, voir
  // e2eStore.js::regenererCleVolontairement
  const handleRegenererCle = async () => {
    setPinMessage(null);
    try {
      const resultat = await regenererCleVolontairement();
      if (resultat) setPinMessage({ type: "success", text: t("e2e.pinChangeSuccess") });
    } catch (error) {
      setPinMessage({ type: "error", text: error.message });
    }
  };

  // photo/logo affiché(e) : aperçu local en priorité, sinon celui déjà enregistré
  const photoAffichee = photoPreview || (isEntreprise ? entreprise?.logo : profil?.photo_profil) || null;

  return (
    <div className="edit-page">
      {/* ===== Barre de navigation ===== */}
      <NavBar />

      <div className="edit-layout">

        {/* ===== Barre latérale ===== */}
        <aside className="edit-sidebar">
          <h1 className="edit-sidebar__title">{t("profile.editSidebarTitle")}</h1>
          <p className="edit-sidebar__subtitle">{t("profile.editSidebarSubtitle")}</p>

          <nav className="edit-sidebar__nav">
            <button className={`edit-sidebar__item  rk-tab ${tab === "initialProfile" ? "active" : ""}`} onClick={() => settab("initialProfile")}>
              {t("profile.personalInfoTab")}
            </button>
            <button className={`edit-sidebar__item  rk-tab ${tab === "securite" ? "active" : ""}`} onClick={() => settab("securite")}>
              {t("profile.tabSecurity")}
            </button>

          </nav>
        </aside>

        {/* ===== Contenu principal ===== */}
        <main className="edit-main">
          <BoutonRetour />
          <div className="edit-header">
            <div>
              <h1 className="edit-title">{t("profile.editPageTitle")}</h1>
              <p className="edit-subtitle">
                {t("profile.editPageSubtitle")}
              </p>
            </div>
          </div>

          {/* ── message de retour (succès / erreur) ── */}
          {message && (
            <div
              className="edit-message"
              style={{
                margin: "0 0 16px",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.9rem",
                color: message.type === "success" ? "#1f5e2e" : "#a02b2b",
                background: message.type === "success" ? "#e3f3e8" : "#fbe7e7",
              }}
            >
              {message.text}
            </div>
          )}
          <div className="edit-grid">

            {/* -------------------------------------Tab information personel-------------- */}
            {tab === "initialProfile" ? (
              <>

                {/* ----- Photo de profil ----- */}
                <div className="edit-card edit-card--photo">
                  <h3 className="edit-card__title edit-card__title--center">
                    {isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
                  </h3>

                  <div className="edit-photo-wrapper">
                    <div className="edit-photo">
                      {photoAffichee ? (
                        <img
                          src={photoAffichee}
                          alt={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : isEntreprise ? (
                        <Building2 size={48} />
                      ) : (
                        <User size={48} />
                      )}
                    </div>
                    <button
                      className="edit-photo-edit"
                      aria-label={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
                      onClick={() => fileInputRef.current?.click()}
                      type="button" >
                      <Camera size={16} />
                    </button>

                    {/* input fichier caché, déclenché par le bouton appareil photo */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      style={{ display: "none" }}
                    />
                  </div>
                  <p className="edit-photo-hint">{t("profile.photoHint")}</p>
                  <button type="button" className="edit-link edit-link--danger" onClick={handleRemovePhoto}>
                    {isEntreprise ? t("profile.removeLogo") : t("profile.removePhoto")}
                  </button>
                </div>

                {isEntreprise ? (
                  <>
                    {/* ----- Informations de l'entreprise ----- */}
                    <div className="edit-card">
                      <h3 className="edit-card__title">
                        <Building2 size={18} className="edit-card__icon" />
                        {t("profile.personalInfoTitle")}
                      </h3>

                      <div className="edit-field">
                        <label className="edit-label" htmlFor="nomEntreprise">
                          {t("profile.companyNameLabel")}
                        </label>
                        <input
                          id="nomEntreprise"
                          type="text"
                          className="edit-input"
                          value={entrepriseForm.nom_Entreprise}
                          onChange={handleEntrepriseChange("nom_Entreprise")}
                        />
                      </div>

                      <div className="edit-field">
                        <label className="edit-label" htmlFor="secteur">
                          {t("profile.companySector")}
                        </label>
                        <input
                          id="secteur"
                          type="text"
                          className="edit-input"
                          value={entrepriseForm.secteur}
                          onChange={handleEntrepriseChange("secteur")}
                        />
                      </div>

                      <div className="edit-field">
                        <label className="edit-label" htmlFor="description">
                          {t("profile.companyDescriptionLabel")}
                        </label>
                        <textarea
                          id="description"
                          className="edit-input"
                          rows={3}
                          value={entrepriseForm.description}
                          onChange={handleEntrepriseChange("description")}
                        />
                      </div>
                    </div>

                    {/* ----- Contact & Localisation ----- */}
                    <div className="edit-card">
                      <h3 className="edit-card__title">
                        <FileText size={18} className="edit-card__icon" />
                        {t("profile.contactTitle")}
                      </h3>

                      <div className="edit-field">
                        <div className="edit-field">
                          <label className="edit-label" htmlFor="entrepriseEmail">
                            {t("profile.workEmail")}
                          </label>
                          <div className="edit-input-with-icon">
                            <Mail size={16} className="edit-input-icon" />
                            <input
                              id="entrepriseEmail"
                              type="email"
                              className="edit-input"
                              value={entrepriseForm.email}
                              onChange={handleEntrepriseChange("email")}
                            />
                          </div>
                        </div>

                        <div className="edit-field">
                          <label className="edit-label" htmlFor="entreprisePhone">
                            {t("profile.phoneNumber")}
                          </label>
                          <div className="edit-input-with-icon">
                            <Phone size={16} className="edit-input-icon" />
                            <input
                              id="entreprisePhone"
                              type="tel"
                              className="edit-input"
                              value={entrepriseForm.telephone}
                              onChange={handleEntrepriseChange("telephone")}
                            />
                          </div>
                        </div>
                        <div className="edit-field">
                          <MapSelectionGPS
                            value={entrepriseForm.coord}
                            onChange={(coord) => setEntrepriseForm((prev) => ({ ...prev, coord }))}
                            onLocalisationDetectee={(loc) => {
                              setEntrepriseForm((prev) => fusionnerLocalisationDetectee(prev, loc).valeurs);
                              setLocalisationNiveauDetecte(niveauDetecteDepuisLoc(loc));
                            }}
                            onAdresseDetectee={(texte) => setEntrepriseForm((prev) => ({ ...prev, adresse: prev.adresse || texte }))}
                          />
                          {localisationNiveauDetecte === "aucun" && (
                            <p className="rk-hint">{t("seller.locationDetectNone")}</p>
                          )}
                          {localisationNiveauDetecte === "departement" && (
                            <p className="rk-hint">{t("seller.locationDetectCommuneOnly")}</p>
                          )}
                          {localisationNiveauDetecte === "commune" && (
                            <p className="rk-hint">{t("seller.locationDetectSectionOnly")}</p>
                          )}
                        </div>

                        <div className="edit-field-row">
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="entrepriseDepartement">{t("auth.departement")}</label>
                            <select
                              id="entrepriseDepartement" className="edit-input"
                              value={entrepriseForm.departement} onChange={handleEntrepriseChange("departement")}
                            >
                              <option value="">— {t("auth.chooseADepartement")} —</option>
                              {departementsData.map((d) => (
                                <option key={d.departement} value={d.departement}>{d.departement}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="entrepriseCommune">
                              {t("profile.companyCommuneLabel")}
                            </label>
                            <select
                              id="entrepriseCommune" className="edit-input"
                              value={entrepriseForm.commune} disabled={!entrepriseForm.departement}
                              onChange={(e) => setEntrepriseForm((prev) => ({ ...prev, commune: e.target.value, section_communale: "" }))}
                            >
                              <option value="">— {t("auth.chooseCommune")} —</option>
                              {(departementsData.find((d) => d.departement === entrepriseForm.departement)?.communes || []).map((c) => (
                                <option key={c.commune} value={c.commune}>{c.commune}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="edit-field-row">
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="entrepriseSection">{t("auth.sectionCommunale")}</label>
                            <select
                              id="entrepriseSection" className="edit-input"
                              value={entrepriseForm.section_communale}
                              disabled={!entrepriseForm.commune}
                              onChange={handleEntrepriseChange("section_communale")}
                            >
                              <option value="">— {t("auth.chooseSection")} —</option>
                              {(departementsData.find((d) => d.departement === entrepriseForm.departement)
                                ?.communes.find((c) => c.commune === entrepriseForm.commune)?.sections_communales || []
                              ).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="entreprisePays">
                              {t("profile.companyPaysLabel")}
                            </label>
                            <input id="entreprisePays" className="edit-input" value={t("auth.haiti")} disabled readOnly />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* ----- Informations personnelles ----- */}
                    <div className="edit-card">
                      <h3 className="edit-card__title">
                        <Briefcase size={18} className="edit-card__icon" />
                        {t("profile.personalInfoTitle")}
                      </h3>

                      <div className="edit-field-row">
                        <div className="edit-field">
                          <label className="edit-label" htmlFor="nom">
                            {t("profile.lastName")}
                          </label>
                          <input
                            id="nom"
                            type="text"
                            className="edit-input"
                            value={form.nom}
                            onChange={handleChange("nom")}
                          />
                        </div>

                        <div className="edit-field">
                          <label className="edit-label" htmlFor="prenom">
                            {t("profile.firstName")}
                          </label>
                          <input
                            id="prenom"
                            type="text"
                            className="edit-input"
                            value={form.prenom}
                            onChange={handleChange("prenom")}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ----- Contact & Localisation ----- */}
                    <div className="edit-card">
                      <h3 className="edit-card__title">
                        <FileText size={18} className="edit-card__icon" />
                        {t("profile.contactTitle")}
                      </h3>

                      <div className="edit-field">
                        <div className="edit-field">
                          <label className="edit-label" htmlFor="email">
                            {t("profile.workEmail")}
                          </label>
                          <div className="edit-input-with-icon">
                            <Mail size={16} className="edit-input-icon" />
                            <input
                              id="email"
                              type="email"
                              className="edit-input"
                              value={form.email}
                              onChange={handleChange("email")}
                            />
                          </div>
                        </div>

                        <div className="edit-field">
                          <label className="edit-label" htmlFor="phone">
                            {t("profile.phoneNumber")}
                          </label>
                          <div className="edit-input-with-icon">
                            <Phone size={16} className="edit-input-icon" />
                            <input
                              id="phone"
                              type="tel"
                              className="edit-input"
                              value={form.telephone}
                              onChange={handleChange("telephone")}
                            />
                          </div>
                        </div>
                        <div className="edit-field">
                          <MapSelectionGPS
                            value={form.coord}
                            onChange={(coord) => setForm((prev) => ({ ...prev, coord }))}
                            onLocalisationDetectee={(loc) => {
                              setForm((prev) => fusionnerLocalisationDetectee(prev, loc).valeurs);
                              setLocalisationNiveauDetecte(niveauDetecteDepuisLoc(loc));
                            }}
                            onAdresseDetectee={(texte) => setForm((prev) => ({ ...prev, adresse: prev.adresse || texte }))}
                          />
                          {localisationNiveauDetecte === "aucun" && (
                            <p className="rk-hint">{t("seller.locationDetectNone")}</p>
                          )}
                          {localisationNiveauDetecte === "departement" && (
                            <p className="rk-hint">{t("seller.locationDetectCommuneOnly")}</p>
                          )}
                          {localisationNiveauDetecte === "commune" && (
                            <p className="rk-hint">{t("seller.locationDetectSectionOnly")}</p>
                          )}
                        </div>

                        <div className="edit-field-row">
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="departement">{t("auth.departement")}</label>
                            <select
                              id="departement" className="edit-input"
                              value={form.departement} onChange={handleChange("departement")}
                            >
                              <option value="">— {t("auth.chooseADepartement")} —</option>
                              {departementsData.map((d) => (
                                <option key={d.departement} value={d.departement}>{d.departement}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="commune">{t("auth.commune")}</label>
                            <select
                              id="commune" className="edit-input"
                              value={form.commune} disabled={!form.departement}
                              onChange={(e) => setForm((prev) => ({ ...prev, commune: e.target.value, section_communale: "" }))}
                            >
                              <option value="">— {t("auth.chooseCommune")} —</option>
                              {(departementsData.find((d) => d.departement === form.departement)?.communes || []).map((c) => (
                                <option key={c.commune} value={c.commune}>{c.commune}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="edit-field-row">
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="sectionCommunale">{t("auth.sectionCommunale")}</label>
                            <select
                              id="sectionCommunale" className="edit-input"
                              value={form.section_communale} disabled={!form.commune}
                              onChange={handleChange("section_communale")}
                            >
                              <option value="">— {t("auth.chooseSection")} —</option>
                              {(departementsData.find((d) => d.departement === form.departement)
                                ?.communes.find((c) => c.commune === form.commune)?.sections_communales || []
                              ).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-field">
                            <label className="edit-label" htmlFor="pays">{t("auth.country")}</label>
                            <input id="pays" className="edit-input" value={t("auth.haiti")} disabled readOnly />
                          </div>
                        </div>
                      </div>


                    </div>
                  </>
                )}

              </>

            ) : (
              <>
                {/* ----- Sécurité ----- */}
                <div className="edit-card">
                  <h3 className="edit-card__title">
                    <Shield size={18} className="edit-card__icon" />
                    {t("profile.tabSecurity")}
                  </h3>

                  <div className="edit-field">
                    <label className="edit-label" htmlFor="currentPassword">
                      {t("profile.currentPassword")}
                    </label>
                    <div className="edit-input-with-icon">
                      <Lock size={16} className="edit-input-icon" />
                      <input
                        id="currentPassword"
                        type="password"
                        className="edit-input"
                        value={passwordForm.ancien}
                        onChange={handlePasswordChange("ancien")}
                      />
                    </div>
                  </div>

                  <div className="edit-field-row">
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="newPassword">
                        {t("profile.newPassword")}
                      </label>
                      <div className="edit-input-with-icon">
                        <Lock size={16} className="edit-input-icon" />
                        <input
                          id="newPassword"
                          type="password"
                          className="edit-input"
                          value={passwordForm.nouveau}
                          onChange={handlePasswordChange("nouveau")}
                        />
                      </div>
                    </div>

                    <div className="edit-field">
                      <label className="edit-label" htmlFor="confirmPassword">
                        {t("profile.confirmNewPassword")}
                      </label>
                      <div className="edit-input-with-icon">
                        <KeyRound size={16} className="edit-input-icon" />
                        <input
                          id="confirmPassword"
                          type="password"
                          className="edit-input"
                          value={passwordForm.confirmation}
                          onChange={handlePasswordChange("confirmation")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ----- Code de sécurité des messages (chiffrement de bout en bout) ----- */}
                <div className="edit-card">
                  <h3 className="edit-card__title">
                    <KeyRound size={18} className="edit-card__icon" />
                    {t("e2e.securityCardTitle")}
                  </h3>
                  <p style={{ margin: "0 0 16px", fontSize: "0.85rem", opacity: 0.75 }}>{t("e2e.securityCardHint")}</p>

                  <div className="edit-field">
                    <label className="edit-label" htmlFor="currentPin">{t("e2e.currentPin")}</label>
                    <div className="edit-input-with-icon">
                      <Lock size={16} className="edit-input-icon" />
                      <input
                        id="currentPin"
                        type="password"
                        inputMode="numeric"
                        className="edit-input"
                        value={pinForm.ancien}
                        onChange={handlePinFormChange("ancien")}
                      />
                    </div>
                  </div>

                  <div className="edit-field-row">
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="newPin">{t("e2e.newPin")}</label>
                      <div className="edit-input-with-icon">
                        <Lock size={16} className="edit-input-icon" />
                        <input
                          id="newPin"
                          type="password"
                          inputMode="numeric"
                          className="edit-input"
                          value={pinForm.nouveau}
                          onChange={handlePinFormChange("nouveau")}
                        />
                      </div>
                    </div>

                    <div className="edit-field">
                      <label className="edit-label" htmlFor="confirmPin">{t("e2e.confirmNewPin")}</label>
                      <div className="edit-input-with-icon">
                        <KeyRound size={16} className="edit-input-icon" />
                        <input
                          id="confirmPin"
                          type="password"
                          inputMode="numeric"
                          className="edit-input"
                          value={pinForm.confirmation}
                          onChange={handlePinFormChange("confirmation")}
                        />
                      </div>
                    </div>
                  </div>

                  {pinMessage && (
                    <div
                      style={{
                        margin: "0 0 16px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                        color: pinMessage.type === "success" ? "#1f5e2e" : "#a02b2b",
                        background: pinMessage.type === "success" ? "#e3f3e8" : "#fbe7e7",
                      }}
                    >
                      {pinMessage.text}
                    </div>
                  )}

                  <div className="edit-actions__buttons">
                    <button type="button" className="edit-btn edit-btn--primary" onClick={handleChangerPin} disabled={pinSaving}>
                      <Save size={16} />
                      {pinSaving ? t("profile.saving") : t("e2e.changePinButton")}
                    </button>
                    <button type="button" className="edit-link edit-link--danger" onClick={handleRegenererCle}>
                      {t("e2e.lienOublie")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ----- Actions finales ----- */}
          <div className="edit-actions">
            <button className="edit-link edit-link--danger edit-link--deactivate">
              <HeartCrack size={16} />
              {t("profile.deactivateAccount")}
            </button>

            <div className="edit-actions__buttons">
              <button className="edit-btn edit-btn--outline" onClick={() => navigate("/profil")}>{t("profile.cancel")}</button>
              {tab === "initialProfile" ? (
                <>
                  <button className="edit-btn edit-btn--primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} />
                    {saving ? t("profile.saving") : t("profile.save")}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="edit-btn edit-btn--primary" onClick={handleChangePassword}>
                    <Save size={16} />
                    {saving ? t("profile.saving") : t("profile.changePassword")}
                  </button>
                </>
              )
              }
            </div>
          </div>
        </main>
      </div>

      {/* ===== Pied de page ===== */}
      <Footer />
    </div>
  );
}

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
  MapPin,
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
} from "lucide-react";
import "../assets/CSS/ModifierProfil.css";
import NavBar from "../components/NavBar.jsx";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "./ProfilStore.js"
import Footer from "../components/Footer.jsx"
import MapHaiti from "../components/MapHaiti.jsx";
import { useTranslation } from "../assets/Translate/i18n.jsx";

const socialLinks = [
  {
    id: "whatsapp",
    icon: MessageCircle,
    iconColor: "#25d366",
    label: "WhatsApp",
    value: "+509 3744-5566",
  },
  {
    id: "facebook",
    icon: Globe,
    iconColor: "#1877f2",
    label: "Facebook",
    value: "facebook.com/ferme.dupont",
  },
];


export default function ModifierProfil() {
  const [tab, settab] = useState("initialProfile");

  const navigate = useNavigate();
  const { t } = useTranslation();

  // ── données réelles de l'utilisateur connecté (store d'authentification)
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const modifierUtilisateur = useAuthStore((s) => s.modifierUtilisateur);
  const modifierMotDePasse = useAuthStore((s) => s.modifierMotDePasse);

  // ── données réelles du profil (store profil)
  const profil = useProfilStore((s) => s.profil);
  const afficherProfil = useProfilStore((s) => s.afficherProfil);
  const modifierProfil = useProfilStore((s) => s.modifierProfil);
  const supprimerPhotoProfil = useProfilStore((s) => s.supprimerPhotoProfil);

  // ── état du formulaire "Informations personnelles"
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    bio: "",
    adresse: "",
    commune: "",
    ville: "",
    pays: "",
  });

  // ── état du formulaire "Sécurité" (changement de mot de passe)
  const [passwordForm, setPasswordForm] = useState({
    ancien: "",
    nouveau: "",
    confirmation: "",
  });

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
      commune: profil?.commune ?? prev.commune,
      ville: profil?.ville ?? prev.ville,
      pays: profil?.pays ?? prev.pays,
    }));
  }, [utilisateur, profil]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
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

  // ── supprime l'aperçu local non sauvegardé, et si une photo est déjà
  // enregistrée côté serveur, la supprime aussi via l'API
  const handleRemovePhoto = async () => {
    setPhotoPreview(null);
    setPhotoData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (profil?.photo_profil) {
      setMessage(null);
      try {
        await supprimerPhotoProfil();
        setMessage({ type: "success", text: t("profile.removePhotoSuccess") });
      } catch (error) {
        setMessage({ type: "error", text: error.message });
      }
    }
  };

  // ── enregistre les informations personnelles + le profil (et la photo si modifiée)
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await modifierUtilisateur({
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
      });

      await modifierProfil({
        adresse: form.adresse,
        commune: form.commune,
        ville: form.ville,
        pays: form.pays,
        ...(photoData ? { photo_profil: photoData } : {}),
      });

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

  // photo affichée : aperçu local en priorité, sinon la photo déjà enregistrée
  const photoAffichee = photoPreview || profil?.photo_profil || null;

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
            {tab == "initialProfile" ? (
              <>

                {/* ----- Photo de profil ----- */}
                <div className="edit-card edit-card--photo">
                  <h3 className="edit-card__title edit-card__title--center">{t("profile.photoTitle")}</h3>

                  <div className="edit-photo-wrapper">
                    <div className="edit-photo">
                      {photoAffichee ? (
                        <img
                          src={photoAffichee}
                          alt={t("profile.photoTitle")}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : (
                        <User size={48} />
                      )}
                    </div>
                    <button
                      className="edit-photo-edit"
                      aria-label={t("profile.photoTitle")}
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
                    {t("profile.removePhoto")}
                  </button>
                </div>

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
                      <label className="edit-label" htmlFor="address">
                        {t("profile.deliveryAddress")}
                      </label>
                      <div className="edit-input-with-icon">
                        <MapPin size={16} className="edit-input-icon" />
                        <input
                          id="address"
                          type="text"
                          className="edit-input edit-input--highlight"
                          value={form.adresse}
                          onChange={handleChange("adresse")}
                        />
                      </div>

                    </div>
                    <div className="edit-field">
                      <MapHaiti />
                    </div>
                  </div>


                </div>

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

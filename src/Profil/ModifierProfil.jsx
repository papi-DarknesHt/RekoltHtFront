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

// creation des different table


export default function ModifierProfil() {
  // ── correction : l'onglet par défaut doit correspondre aux clés utilisées
  // plus bas ("initialProfile" / "securite"), sinon l'onglet Sécurité
  // s'affichait par erreur au chargement.
  const [tab, settab] = useState("initialProfile");

  const navigate = useNavigate();

  // ── données réelles de l'utilisateur connecté (store d'authentification)
  const utilisateur          = useAuthStore((s) => s.utilisateur);
  const modifierUtilisateur  = useAuthStore((s) => s.modifierUtilisateur);
  const modifierMotDePasse   = useAuthStore((s) => s.modifierMotDePasse);

  // ── données réelles du profil (store profil)
  const profil          = useProfilStore((s) => s.profil);
  const afficherProfil   = useProfilStore((s) => s.afficherProfil);
  const modifierProfil   = useProfilStore((s) => s.modifierProfil);

  // ── état du formulaire "Informations personnelles"
  // initialisé vide puis rempli dès que l'utilisateur/profil sont disponibles
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
  const [photoData, setPhotoData]       = useState(null);
  const fileInputRef = useRef(null);

  // ── messages de retour (succès / erreur) pour l'utilisateur
  const [message, setMessage] = useState(null);
  const [saving, setSaving]   = useState(false);

  // au montage : on récupère le profil à jour depuis l'API (photo, bio, adresse, ...)
  useEffect(() => {
    afficherProfil().catch(() => {
      // l'erreur est déjà stockée dans le store, rien d'autre à faire ici
    });
  }, [afficherProfil]);

  // dès que l'utilisateur ou le profil sont chargés/mis à jour, on synchronise le formulaire
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nom:       utilisateur?.nom       ?? prev.nom,
      prenom:    utilisateur?.prenom    ?? prev.prenom,
      email:     utilisateur?.email     ?? prev.email,
      telephone: utilisateur?.telephone ?? prev.telephone,
      bio:       profil?.bio     ?? prev.bio,
      adresse:   profil?.adresse ?? prev.adresse,
      commune:   profil?.commune ?? prev.commune,
      ville:     profil?.ville   ?? prev.ville,
      pays:      profil?.pays    ?? prev.pays,
    }));
  }, [utilisateur, profil]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  // ── sélection d'une nouvelle photo de profil : on la convertit en base64
  // au format attendu par le backend ({ filename, content }) et on affiche
  // un aperçu immédiat
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

  // ── retire l'aperçu local de la photo (la suppression côté serveur n'est
  // pas encore prise en charge par le backend)
  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── enregistre les informations personnelles + le profil (et la photo si modifiée)
  // appelle les deux nouveaux endpoints séparés du backend :
  // /Registration/modifier-utilisateur/ et /Registration/modifier-profil/
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await modifierUtilisateur({
        nom:       form.nom,
        prenom:    form.prenom,
        email:     form.email,
        telephone: form.telephone,
      });

      await modifierProfil({
        bio:     form.bio,
        adresse: form.adresse,
        commune: form.commune,
        ville:   form.ville,
        pays:    form.pays,
        ...(photoData ? { photo_profil: photoData } : {}),
      });

      setMessage({ type: "success", text: "Profil mis à jour avec succès." });
      setPhotoData(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // ── changement de mot de passe via /Registration/modifier-mdp/
  const handleChangePassword = async () => {
    setMessage(null);

    if (passwordForm.nouveau !== passwordForm.confirmation) {
      setMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }

    try {
      await modifierMotDePasse({
        ancien_mot_de_passe:  passwordForm.ancien,
        nouveau_mot_de_passe: passwordForm.nouveau,
      });
      setMessage({ type: "success", text: "Mot de passe modifié avec succès." });
      setPasswordForm({ ancien: "", nouveau: "", confirmation: "" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  // photo affichée : aperçu local en priorité, sinon la photo déjà enregistrée
  // (URL absolue renvoyée par le backend grâce à request.build_absolute_uri)
  const photoAffichee = photoPreview || profil?.photo_profil || null;

  return (
    <div className="edit-page">
      {/* ===== Barre de navigation ===== */}
      <NavBar />

      <div className="edit-layout">
        {/* ===== Barre latérale ===== */}
        <aside className="edit-sidebar">
          <h1 className="edit-sidebar__title">Edit Profile</h1>
          <p className="edit-sidebar__subtitle">Manage your account settings</p>

          <nav className="edit-sidebar__nav">
              <button className={`edit-sidebar__item  rk-tab ${tab === "initialProfile" ? "active" : ""}`} onClick={() => settab("initialProfile")}>
                Personal Info
              </button>
              <button className={`edit-sidebar__item  rk-tab ${tab === "securite" ? "active" : ""}`} onClick={() => settab("securite")}>
                Sécurité
              </button>

          </nav>
        </aside>

        {/* ===== Contenu principal ===== */}
        <main className="edit-main">
          <div className="edit-header">
            <div>
              <h1 className="edit-title">Modifier le Profil</h1>
              <p className="edit-subtitle">
                Mettez à jour vos informations et gérez votre visibilité sur la plateforme.
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
                  <h3 className="edit-card__title edit-card__title--center">Photo de Profil</h3>

                  <div className="edit-photo-wrapper">
                    <div className="edit-photo">
                      {photoAffichee ? (
                        <img
                          src={photoAffichee}
                          alt="Photo de profil"
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : (
                        <User size={48} />
                      )}
                    </div>
                    <button
                      className="edit-photo-edit"
                      aria-label="Changer la photo"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
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

                  <p className="edit-photo-hint">JPG, PNG ou GIF. Max 5MB.</p>
                  <button type="button" className="edit-link edit-link--danger" onClick={handleRemovePhoto}>
                    Supprimer la photo
                  </button>
                </div>
                {/* ----- Informations personnelles ----- */}
                <div className="edit-card">
                  <h3 className="edit-card__title">
                    <Briefcase size={18} className="edit-card__icon" />
                    Informations Personnelles
                  </h3>

                  {/* Nom et Prénom séparés pour correspondre aux champs du backend (Utilisateur.nom / Utilisateur.prenom) */}
                  <div className="edit-field-row">
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="nom">
                        Nom
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
                        Prénom
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

                  <div className="edit-field">
                    <label className="edit-label" htmlFor="bio">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      className="edit-input edit-textarea"
                      rows={4}
                      value={form.bio}
                      onChange={handleChange("bio")}
                    />
                  </div>
                </div>
                {/* ----- Contact & Localisation ----- */}
                <div className="edit-card">
                  <h3 className="edit-card__title">
                    <FileText size={18} className="edit-card__icon" />
                    Contact &amp; Localisation
                  </h3>

                  <div className="edit-field">
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="email">
                        Email professionnel
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
                        Numéro de téléphone
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
                      Adresse de livraison
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
                     <MapHaiti/>
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
                    Sécurité
                  </h3>

                  <div className="edit-field">
                    <label className="edit-label" htmlFor="currentPassword">
                      Mot de passe actuel
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
                        Nouveau mot de passe
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
                        Confirmer le nouveau mot de passe
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

                  <div className="edit-card__footer">
                    <button type="button" className="edit-link" onClick={handleChangePassword}>
                      Changer le mot de passe
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
              Désactiver mon compte
            </button>

            <div className="edit-actions__buttons">
              <button className="edit-btn edit-btn--outline" onClick={() => navigate("/profil")}>Annuler</button>
              {/* le bouton "Sauvegarder" n'enregistre que l'onglet "Informations personnelles"
                  (les champs utilisateur + profil + photo). Le changement de mot de passe
                  a son propre bouton dans l'onglet Sécurité. */}
              {tab === "initialProfile" && (
                <button className="edit-btn edit-btn--primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? "Enregistrement..." : "Sauvegarder les modifications"}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ===== Pied de page ===== */}
      <Footer />
    </div>
  );
}

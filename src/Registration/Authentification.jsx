import { useState, useRef, useEffect } from "react";
import "../assets/CSS/Authentification.css"
import logo from "../assets/Images/Asset5.svg";
import ReCAPTCHA from "react-google-recaptcha";
import { api } from "../api/client";
import { useAuthStore } from "./AuthentificationStore";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import departementsData from "../assets/Departements/haiti_departements.json";

export default function RekoltHtAuth() {

  const navigate = useNavigate();
  const { inscription, connexion, loading, error, clearError } = useAuthStore();
  const [success, setSuccess] = useState(null);
  const [tab, setTab] = useState("login");
  const googleConnexion = useAuthStore((s) => s.googleConnexion);
  const googleInscription = useAuthStore((s) => s.googleInscription);

  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", mot_de_passe: "", telephone: "", role: "acheteur",
    bio: "", adresse: "", commune: "", ville: "", pays: "Haiti", latitude: "", longitude: "",
    mot_de_passe_confirmation: "", entreprise_nom: "", entreprise_type: "", departement: "", section_communale: "",
  });

  const { t } = useTranslation();

  const [fieldErrors, setFieldErrors] = useState({});
  const [gpsStatus, setGpsStatus] = useState("en attente");
  const recaptchaRef = useRef(null);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState(false);
  const [mdpError, setMdpError] = useState(null);

  // ——— Mot de passe oublié ———
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // ——— Visibilité des mots de passe ———
  const [showMdp, setShowMdp] = useState(false);
  const [showMdpConfirm, setShowMdpConfirm] = useState(false);

  const switchTab = (newTab) => {
    setTab(newTab);
    setFieldErrors({});
    setMdpError(null);
    setShowForgot(false);
    setForgotSuccess(false);
    setShowMdp(false);
    setShowMdpConfirm(false);
    clearError();
  };

  // Normalise le numéro de téléphone en +509XXXXXXXX avant envoi
  const formatTelephone = (tel) => {
    const digits = tel.replace(/\D/g, "");
    if (digits.startsWith("509") && digits.length === 11) return `+${digits}`;
    if (digits.length === 8) return `+509${digits}`;
    return `+509${digits}`;
  };

  const handleChange = (e) => {
    clearError();
    let { name, value } = e.target;

    // Téléphone : seulement +, chiffres et espaces
    if (name === "telephone") {
      value = value.replace(/[^\d+\s]/g, "");
    }
    // Non / Siyati : seulement lettres, espaces, tirets
    if (name === "nom" || name === "prenom") {
      value = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s-]/g, "");
    }

    const newForm = { ...form, [name]: value };
    if (name === "departement") { newForm.commune = ""; newForm.section_communale = ""; }
    if (name === "commune") { newForm.section_communale = ""; }
    setForm(newForm);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (name === "mot_de_passe" || name === "mot_de_passe_confirmation") {
      const mdp1 = name === "mot_de_passe" ? value : newForm.mot_de_passe;
      const mdp2 = name === "mot_de_passe_confirmation" ? value : newForm.mot_de_passe_confirmation;
      if (mdp2 && mdp1 !== mdp2) {
        setMdpError(t("auth.passwordMismatch"));
      } else {
        setMdpError(null);
      }
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidName = (n) => /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ -][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(n.trim());
  const isValidTelephone = (tel) => {
    const digits = tel.replace(/\D/g, "");
    return digits.length === 8 || (digits.length === 11 && digits.startsWith("509"));
  };

  const validateForm = () => {
    const errors = {};

    if (tab === "login") {
      if (!form.email.trim()) errors.email = t("auth.messageEmailRequired");
      else if (!isValidEmail(form.email)) errors.email = t("auth.messageInvalidMail");
      if (!form.mot_de_passe) errors.mot_de_passe = t("auth.messagePasswordRequired");
    } else {
      if (tab === "entreprise") {
        if (!form.entreprise_nom.trim()) errors.entreprise_nom = t("auth.messageNameEntrepriseRequired");
        if (!form.entreprise_type) errors.entreprise_type = t("auth.messageTypeEntrepriseRequired");
      }
      if (!form.nom.trim()) errors.nom = t("auth.messageNameRequired");
      else if (!isValidName(form.nom)) errors.nom = t("auth.messageNamePattern");
      if (!form.prenom.trim()) errors.prenom = t("auth.messageFirstNameRequired");
      else if (!isValidName(form.prenom)) errors.prenom = t("auth.messageFirstNamePattern");
      if (!form.email.trim()) errors.email = t("auth.messageEmailRequired");
      else if (!isValidEmail(form.email)) errors.email = t("auth.messageInvalidMail");
      if (!form.telephone.trim()) errors.telephone = t("auth.messageTelRequired");
      else if (!isValidTelephone(form.telephone)) errors.telephone = t("auth.messageTelPattern");
      if (!form.mot_de_passe) errors.mot_de_passe = t("auth.messagePasswordRequired");
      if (!form.mot_de_passe_confirmation) errors.mot_de_passe_confirmation = t("auth.messagePasswordComfirmRequired");
      if (form.mot_de_passe && form.mot_de_passe_confirmation && form.mot_de_passe !== form.mot_de_passe_confirmation) {
        errors.mot_de_passe_confirmation = t("auth.passwordMismatch");
      }
      if (!form.departement) errors.departement = t("auth.messageDepartementRequired");
      if (!form.commune) errors.commune = t("auth.messageCommuneRequired");
      if (!form.section_communale && sectionsDisponibles.length > 0) errors.section_communale = t("auth.messageSectionRequired");
      if (!recaptchaToken) {
        setRecaptchaError(true);
        errors.recaptcha = t("auth.recaptchaError");
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    if (tab !== "register" && tab !== "entreprise") return;
    if (!navigator.geolocation) { setGpsStatus(t("auth.NotSupported")); return; }
    setGpsStatus(t("auth.loading"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setGpsStatus("ok");
      },
      (err) => {
        setGpsStatus(t("auth.denied"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [tab]);

  const handleSubmit = async () => {
    clearError();
    if (!validateForm()) return;

    try {
      if (tab === "login") {
        const res = await connexion({ email: form.email, mot_de_passe: form.mot_de_passe });
        if (res && res.token) {
          setSuccess(t("auth.succesConnection"));
          setTimeout(() => navigate("/"), 500);
        }
      } else {
        const payload = {
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          mot_de_passe: form.mot_de_passe,
          telephone: formatTelephone(form.telephone),
          role: tab === "entreprise" ? "vendeur" : form.role,
          bio: form.bio,
          adresse: form.adresse,
          departement: form.departement,
          commune: form.commune,
          section_communale: form.section_communale,
          ville: form.ville,
          pays: form.pays,
          latitude: form.latitude,
          longitude: form.longitude,
          recaptcha: recaptchaToken,
        };
        if (tab === "entreprise") {
          payload.entreprise_nom = form.entreprise_nom;
          payload.entreprise_type = form.entreprise_type;
        }
        const res = await inscription(payload);
        if (res) {
          setSuccess(t("auth.messageCreateCompteSuccess"));
          recaptchaRef.current?.reset();
          setRecaptchaToken(null);
          setTimeout(() => navigate("/"), 1000);
        }
      }
    } catch (err) {
      console.error("Erreur soumission :", err.message);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError(null);
    if (!forgotEmail.trim() || !isValidEmail(forgotEmail)) {
      setForgotError(t("auth.messageInvalidMail"));
      return;
    }
    try {
      setForgotLoading(true);
      await api.post("/auth/mot-de-passe-oublie", { email: forgotEmail });
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(err.response?.data?.message || t("auth.messageCriticalErrorLoading"));
    } finally {
      setForgotLoading(false);
    }
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        const res = tab === "login"
          ? await googleConnexion(response.access_token)
          : await googleInscription(response.access_token);
        if (res && res.token) {
          setSuccess(tab === "login" ? t("auth.succesConnection") : t("auth.messageSuccesInscription"));
          setTimeout(() => navigate("/"), 1000);
        }
      } catch (err) {
        console.error("Erreur Google :", err.message);
      }
    },
    onError: () => console.error(t("auth.messageConnectionGoogleCancel")),
  });

  const isRegisterTab = tab === "register" || tab === "entreprise";

  const communesDisponibles = form.departement
    ? (departementsData.find(d => d.departement === form.departement)?.communes || [])
    : [];
  const sectionsDisponibles = form.commune
    ? (communesDisponibles.find(c => c.commune === form.commune)?.sections_communales || [])
    : [];
  const googleSVG = (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );

  return (
    <div className="rk-root">

      {/* LEFT — panneau fixe */}
      <div className="rk-left">
        <div className="rk-logo-left">
          <img className="logo" src={logo} alt="Logo" />
        </div>
        <div style={{ width: "100%" }}>
          <p className="rk-avantaj-title">{t("auth.advantagesTitle")}</p>
          <p className="rk-avantaj-sub">{t("auth.advantagesSubtitle")}</p>
          {[
            { num: "1", titre: t("auth.feature1Desc") },
            { num: "2", titre: t("auth.feature2Desc") },
            { num: "3", titre: t("auth.feature3Desc") },
          ].map((f) => (
            <div key={f.num} className="rk-feature">
              <div className="rk-feature-num">{f.num}</div>
              <div className="rk-feature-text"><strong>{f.titre}</strong></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — panneau défilant */}
      <div className="rk-right">
        <div className="rk-card">
          <p className="rk-card-title">
            {tab === "login" ? t("auth.loginHere") : tab === "register" ? t("auth.cardTitleRegister") : t("auth.cardTitleEntreprise")}
          </p>
          <p className="rk-card-sub">
            {tab === "login"
              ? t("auth.cardSubtitleLogin")
              : tab === "entreprise"
                ? t("auth.cardsubtitleEntreprise")
                : t("auth.cardSubtitleRegister")}
          </p>

          {/* ——— TABS ——— */}
          <div className="rk-tabs">
            <button className={`rk-tab ${tab === "login" ? "active" : ""}`} onClick={() => switchTab("login")}>
              {t("auth.tabLogin")}
            </button>
            <button className={`rk-tab ${tab === "register" ? "active" : ""}`} onClick={() => switchTab("register")}>
              {t("auth.tabRegister")}
            </button>
            <button className={`rk-tab ${tab === "entreprise" ? "active" : ""}`} onClick={() => switchTab("entreprise")}>
              {t("auth.tabEntreprise")}
            </button>
          </div>

          {success && <div className="rk-success">✓ {success}</div>}

          {/* ——— CONNEXION ——— */}
          {tab === "login" && !showForgot && (
            <>
              <div className="rk-field">
                <label className="rk-label">{t("auth.email")}<span className="red">*</span></label>
                <input
                  className="rk-input" name="email" type="email"
                  placeholder="ou@exemple.com"
                  onChange={handleChange} required inputMode="email" autoComplete="email"
                />
                {fieldErrors.email && <p className="rk-error"> X {fieldErrors.email}</p>}
              </div>
              <div className="rk-field">
                <label className="rk-label">{t("auth.password")}<span className="red">*</span></label>
                <div className="rk-pw-wrap">
                  <input
                    className="rk-input" name="mot_de_passe" type={showMdp ? "text" : "password"}
                    placeholder="••••••••" onChange={handleChange}
                    required autoComplete="current-password"
                  />
                  <button type="button" className="rk-pw-toggle" onClick={() => setShowMdp(p => !p)} tabIndex={-1}>
                    {showMdp ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.mot_de_passe && <p className="rk-error">X {fieldErrors.mot_de_passe}</p>}
                <div className="rk-label-row">
                  
                  <button type="button" className="rk-forgot-link" onClick={() => setShowForgot(true)}>
                    {t("auth.forgotPassword")}.
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ——— MOT DE PASSE OUBLIÉ ——— */}
          {tab === "login" && showForgot && (
            <div className="rk-forgot-box">
              {forgotSuccess ? (
                <div className="rk-success">
                  ✓ {t("auth.mailcheckSuccess")}
                </div>
              ) : (
                <>
                  <p className="rk-forgot-desc">
                    {t("auth.mailMessageReset")}
                  </p>
                  <div className="rk-field">
                    <label className="rk-label">{t("auth.email")}<span className="red">*</span></label>
                    <input
                      className="rk-input" type="email" placeholder="ou@exemple.com"
                      value={forgotEmail} onChange={(e) => { setForgotEmail(e.target.value); setForgotError(null); }}
                      inputMode="email" autoComplete="email"
                    />
                    {forgotError && <p className="rk-error"> {forgotError}</p>}
                  </div>
                  <button className="rk-btn" onClick={handleForgotPassword} disabled={forgotLoading}>
                    {forgotLoading ? t("auth.loading")+"..." : t("auth.resetmail")}
                  </button>
                </>
              )}
              <button type="button" className="rk-back-link" onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotError(null); setForgotEmail(""); }}>
              <ArrowLeft /> 
              </button>
            </div>
          )}

          {/* ——— INSCRIPTION (individuel & entreprise) ——— */}
          {isRegisterTab && (
            <>
              {/* Champs exclusifs Antrepriz */}
              {tab === "entreprise" && (
                <>
                  <div className="rk-field">
                    <label className="rk-label">{t("auth.entrepriseName")}<span className="red">*</span></label>
                    <input
                      className="rk-input" name="entreprise_nom"
                      placeholder="Eg. Rekolt Haiti S.A."
                      onChange={handleChange}
                      required maxLength={120} autoComplete="organization"
                    />
                    {fieldErrors.entreprise_nom && <p className="rk-error">X {fieldErrors.entreprise_nom}</p>}
                  </div>
                  <div className="rk-field">
                    <label className="rk-label">{t("auth.entrepriseType")}<span className="red">*</span></label>
                    <div className="rk-select-wrap">
                      <select
                        className="rk-select" name="entreprise_type"
                        onChange={handleChange} required
                      >
                        <option value="">— {t("auth.chooseAType")} —</option>
                        <option value="Agriculture">{t("auth.agriculture")}</option>
                        <option value="Commerce">{t("auth.trade")}</option>
                        <option value="Industrie">{t("auth.industry")}</option>
                        <option value="touriste">{t("auth.tourism")}</option>
                        <option value="Autre">{t("auth.other")}</option>
                      </select>
                    </div>
                    {fieldErrors.entreprise_type && <p className="rk-error">X {fieldErrors.entreprise_type}</p>}
                  </div>
                </>
              )}

              <div className="rk-row">
                <div className="rk-field">
                  <label className="rk-label">{t("auth.firstName")}<span className="red">*</span></label>
                  <input
                    className="rk-input" name="nom" placeholder={t("auth.firstName")}
                    value={form.nom} onChange={handleChange} required
                    inputMode="text" autoComplete="family-name"
                    title="Se sèlman lèt ak tirè, pa gen chif"
                  />
                  {fieldErrors.nom && <p className="rk-error">X {fieldErrors.nom}</p>}
                </div>
                <div className="rk-field">
                  <label className="rk-label">{t("auth.lastName")}<span className="red">*</span></label>
                  <input
                    className="rk-input" name="prenom" placeholder={t("auth.lastName")}
                    value={form.prenom} onChange={handleChange} required
                    inputMode="text" autoComplete="given-name"
                    title="Se sèlman lèt ak tirè, pa gen chif"
                  />
                  {fieldErrors.prenom && <p className="rk-error">X {fieldErrors.prenom}</p>}
                </div>
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.emailRequired")}<span className="red">*</span></label>
                <input
                  className="rk-input" name="email" type="email"
                  placeholder="ou@exemple.com"
                  onChange={handleChange} required inputMode="email" autoComplete="email"
                />
                {fieldErrors.email && <p className="rk-error">X {fieldErrors.email}</p>}
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.phone")}<span className="red">*</span></label>
                <input
                  className="rk-input" name="telephone" type="tel"
                  placeholder={"Ex: 3000 1234 "+t("auth.or")+" 509 3000 1234"}
                  value={form.telephone} onChange={handleChange}
                  required inputMode="tel" maxLength={16} autoComplete="tel"
                />
                {fieldErrors.telephone && <p className="rk-error">✗ {fieldErrors.telephone}</p>}
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.password")}<span className="red">*</span></label>
                <div className="rk-pw-wrap">
                  <input
                    className="rk-input" name="mot_de_passe" type={showMdp ? "text" : "password"}
                    placeholder="••••••••" onChange={handleChange}
                    required autoComplete="new-password" minLength={8}
                  />
                  <button type="button" className="rk-pw-toggle" onClick={() => setShowMdp(p => !p)} tabIndex={-1}>
                    {showMdp ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.mot_de_passe && <p className="rk-error">X {fieldErrors.mot_de_passe}</p>}
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.confirmPassword")}<span className="red">*</span></label>
                <div className="rk-pw-wrap">
                  <input
                    className="rk-input" name="mot_de_passe_confirmation" type={showMdpConfirm ? "text" : "password"}
                    placeholder="••••••••" onChange={handleChange} required
                    autoComplete="new-password" style={{
                      borderColor: mdpError ? "#e24b4a"
                        : form.mot_de_passe_confirmation && !mdpError ? "#1D9E75" : "",
                    }}
                  />
                  <button type="button" className="rk-pw-toggle" onClick={() => setShowMdpConfirm(p => !p)} tabIndex={-1}>
                    {showMdpConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.mot_de_passe_confirmation && <p className="rk-error">X {fieldErrors.mot_de_passe_confirmation}</p>}
                {mdpError && !fieldErrors.mot_de_passe_confirmation && <p className="rk-error">✗ {mdpError}</p>}
                {form.mot_de_passe_confirmation && !mdpError && (
                  <p style={{ color: "#1D9E75", fontSize: "12px", marginTop: "4px" }}>✓ {t("auth.passwordMatch")}</p>
                )}
              </div>
              <div className="rk-field">
                <label className="rk-label">{t("auth.departement")}<span className="red">*</span></label>
                <div className="rk-select-wrap">
                  <select
                    className="rk-select" name="departement"
                    value={form.departement} onChange={handleChange} required
                  >
                    <option value="">— {t("auth.chooseADepartement")} —</option>
                    {departementsData.map(d => (
                      <option key={d.departement} value={d.departement}>{d.departement}</option>
                    ))}
                  </select>
                </div>
                {fieldErrors.departement && <p className="rk-error">✗ {fieldErrors.departement}</p>}
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.commune")}<span className="red">*</span></label>
                <div className="rk-select-wrap">
                  <select
                    className="rk-select" name="commune"
                    value={form.commune} onChange={handleChange} required
                    disabled={!form.departement}
                  >
                    <option value="">— {t("auth.chooseCommune")} —</option>
                    {communesDisponibles.map(c => (
                      <option key={c.commune} value={c.commune}>{c.commune}</option>
                    ))}
                  </select>
                </div>
                {fieldErrors.commune && <p className="rk-error">✗ {fieldErrors.commune}</p>}
              </div>

              <div className="rk-field">
                <label className="rk-label">{t("auth.sectionCommunale")}<span className="red">*</span></label>
                <div className="rk-select-wrap">
                  <select
                    className="rk-select" name="section_communale"
                    value={form.section_communale} onChange={handleChange} required
                    disabled={!form.commune || sectionsDisponibles.length === 0}
                  >
                    <option value="">— {t("auth.chooseSection")} —</option>
                    {sectionsDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {fieldErrors.section_communale && <p className="rk-error">✗ {fieldErrors.section_communale}</p>}
              </div>

              {/* reCAPTCHA */}
              <div style={{ margin: "1rem 0 0.5rem" }}>
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_KEY}
                  onChange={(token) => { setRecaptchaToken(token); setRecaptchaError(false); }}
                  onExpired={() => { setRecaptchaToken(null); setRecaptchaError(true); }}
                />
                {recaptchaError && (
                  <p style={{ color: "#c0392b", fontSize: "12px", marginTop: "6px" }}>
                    {t("auth.recaptchaError")}
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div style={{
              background: "#fef0f0", border: "1px solid #f5c6c6", borderRadius: "8px",
              padding: "10px 14px", fontSize: "13px", color: "#c0392b",
              marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px",
            }}>
              ✗ {error}
            </div>
          )}

          {/* Google + bouton principal — masqués pendant "modpas bliye" et pour l'onglet Antrepriz */}
          {!(tab === "login" && showForgot) && tab !== "entreprise" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1rem 0" }}>
                <div style={{ flex: 1, height: "1px", background: "#eee" }} />
                <span style={{ fontSize: "12px", color: "#888" }}>{t("auth.or")}</span>
                <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              </div>
              <button
                onClick={() => loginGoogle()}
                style={{
                  width: "100%", padding: "11px", borderRadius: "10px",
                  border: "1.5px solid #e8e8e8", background: "#fff", cursor: "pointer",
                  fontSize: "14px", fontWeight: "500", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s",
                }}
              >
                {googleSVG} {t("auth.googleContinue")}
              </button>
            </>
          )}

          {!(tab === "login" && showForgot) && (
            <button className="rk-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? t("auth.loading")+"..."
                : tab === "login" ? t("auth.tabLogin")
                  : t("auth.submitRegister")}
            </button>
          )}

          <div className="rk-switch">
            {tab === "login" ? (
              <>{t("auth.noAccount")}? <a onClick={() => switchTab("register")}>{t("auth.signUpFree")}</a></>
            ) : (
              <>{t("auth.alreadyAccount")}? <a onClick={() => switchTab("login")}>{t("auth.tabLogin")}</a></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

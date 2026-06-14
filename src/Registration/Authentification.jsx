import { useState, useRef, useEffect } from "react";
import "../assets/CSS/Authentification.css"
import logo from "../assets/Images/Asset5.svg";
import ReCAPTCHA from "react-google-recaptcha";
import { api } from "../api/client";
import { useAuthStore } from "./AuthentificationStore";
import { useNavigate } from "react-router-dom";

export default function RekoltHtAuth() {
  // state pour gérer les données du formulaire, les erreurs, le succès, et le type de tab (login/register)
  const navigate = useNavigate();
  const { inscription, connexion, loading, error, clearError } = useAuthStore();
  const [success, setSuccess] = useState(null);
  const [tab, setTab] = useState("login");
  // --------------constant pour naviguer entre les types de comptes dans le formulaire d'inscription----------------
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", mot_de_passe: "", telephone: "", role: "acheteur",
    bio: "", adresse: "", commune: "", ville: "", pays: "Haiti", latitude: "", longitude: "",
    mot_de_passe_confirmation: "",
  });
  const [submitted, setSubmitted] = useState(false);
  // -------------------------------state pour la géolocalisation------------------------------
  const [gpsStatus, setGpsStatus] = useState("en attente"); // statut GPS


  // ------------------------------------reCAPTCHA------------------------------------
  // ref pour accéder au widget reCAPTCHA
  const recaptchaRef = useRef(null);

  // stocke le token reCAPTCHA après validation
  const [recaptchaToken, setRecaptchaToken] = useState(null);

  // stocke l'erreur si l'utilisateur n'a pas coché
  const [recaptchaError, setRecaptchaError] = useState(false);
  // ------------------------------------validation du mot de passe------------------------------------
  const [mdpError, setMdpError] = useState(null);

  // ---------------------------------- gestion du formulaire ------------------------------------
  const handleChange = (e) => {
    clearError();
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);
    // vérifie si les mots de passe correspondent
    if (name === "mot_de_passe" || name === "mot_de_passe_confirmation") {
      const mdp1 = name === "mot_de_passe" ? value : newForm.mot_de_passe;
      const mdp2 = name === "mot_de_passe_confirmation" ? value : newForm.mot_de_passe_confirmation;

      if (mdp2 && mdp1 !== mdp2) {
        setMdpError("Modpas yo pa menm");   // ← affiché en temps réel
      } else {
        setMdpError(null);                  // ← efface l'erreur
      }
    }

  };

  // ── GPS  ──────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "register") return;

    if (!navigator.geolocation) {
      setGpsStatus("non supporté");
      return;
    }

    setGpsStatus("chargement");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setGpsStatus("ok");
      },
      (error) => {
        console.warn("GPS refusé :", error.message);
        setGpsStatus("refusé");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [tab]);
  const handleSubmit = async () => {
    clearError();
    // vérifie que le reCAPTCHA est coché avant de soumettre
    if (tab === "register" && !recaptchaToken) {
      setRecaptchaError(true);  // affiche le message d'erreur
      return;                   // bloque la soumission
    }
    try {
      // -------------------------------------------- CONNEXION ------------------------------------
      if (tab === "login") {

        console.log("Données envoyées :", {
          email: form.email,
          mot_de_passe: form.mot_de_passe,
        });

        const res = await connexion({
          email: form.email,
          mot_de_passe: form.mot_de_passe,
        });

        if (res && res.token) {
          setSuccess("Koneksyon reyisi!");
          setTimeout(() => navigate("/"), 500);
        }
        // -----------------------------Fin connexion------------------------------------
      } else {
        // -------------------------------------------- INSCRIPTION ---- ------------------------------------
        const res = await inscription({
          // ----------------------Les champs n'ecessaires pour l'inscription----------------------
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          mot_de_passe: form.mot_de_passe,
          telephone: form.telephone,
          // -------------------------Champ optionnel pour l'inscription-------------------------
          role: form.role,
          bio: form.bio,
          adresse: form.adresse,
          commune: form.commune,
          ville: form.ville,
          pays: form.pays,
          latitude: form.latitude,
          longitude: form.longitude,

          // ----------------------envoie le token reCAPTCHA au backend----------------------
          recaptcha: recaptchaToken,
        });
        if (res) {
          setSuccess("Kont kreye avèk siksè!");
          recaptchaRef.current?.reset();  // remet le reCAPTCHA à zéro
          setRecaptchaToken(null);  // efface le token du state
          setTimeout(() => navigate("/"), 1000);
        }
      }
    }
    catch (error) {
      console.error("Erreur connexion :", error.message);
    }
  };
  return (
    <>
      <div className="rk-root">

        {/* LEFT */}
        <div className="rk-left">
          {/*logo*/}
          <div className="rk-logo-left">
            <img className="logo" src={logo} alt="Logo" />
          </div>


          <div style={{ width: "100%" }}>
            <p className="rk-avantaj-title">Avantaj</p>
            <p className="rk-avantaj-sub">
              Nou konekte vandè ak achtè nan tout peyi a.
            </p>

            {[
              {
                num: "1",
                titre: "Sevis la gratis, okenn frè pap soti sou kontak ou yo",
                desc: "Ekri kò ou la gratis, dèwn ou paje è ou jwenn aksè nan tout resous yo"
              },
              {
                num: "2",
                titre: "Vizib sou tout kat nasyonal la",
                desc: "Pwofi tout rezo sèvis nou yo pou jwenn plis kliyan"
              },
              {
                num: "3",
                titre: "Sistèm evalyasyon pou pwoteje tout moun",
                desc: "Ekip nou an toujou disponib pou rèpond tout kesyon ou"
              },
            ].map((f) => (
              <div key={f.num} className="rk-feature">
                <div className="rk-feature-num">{f.num}</div>
                <div className="rk-feature-text">
                  <strong>{f.titre}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="rk-right">
          <div className="rk-card">
            <p className="rk-card-title">
              {tab === "login" ? "Konekte" : "Kreye kont ou "}
            </p>
            <p className="rk-card-sub">
              {tab === "login" ? "Bon retou! Antre enfòmasyon ou yo." : "Kreye kont ou gratis jodi a."}
            </p>

            <div className="rk-tabs">
              <button className={`rk-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>
                Konekte
              </button>
              <button className={`rk-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
                Enskri
              </button>
            </div>

            {success && (
              <div className="rk-success">
                ✓ {success}
              </div>
            )}

            {tab === "login" ? (
              <>
                <div className="rk-field">
                  <label className="rk-label">Adrès Imèl</label>
                  <input className="rk-input" name="email" type="email"
                    placeholder="ou@exemple.com" value={form.email} onChange={handleChange} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">Modpas</label>
                  <input className="rk-input" name="mot_de_passe" type="password"
                    placeholder="••••••••" value={form.mot_de_passe} onChange={handleChange} />
                </div>
              </>
            ) : (
              <>
                <div className="rk-row">
                  <div className="rk-field">
                    <label className="rk-label">Non*</label>
                    <input className="rk-input" name="nom" placeholder="Non"
                      value={form.nom} onChange={handleChange} />
                  </div>
                  <div className="rk-field">
                    <label className="rk-label">Siyati*</label>
                    <input className="rk-input" name="prenom" placeholder="Prenon"
                      value={form.prenom} onChange={handleChange} />
                  </div>
                </div>
                <div className="rk-field">
                  <label className="rk-label">Adrès Imèl*</label>
                  <input className="rk-input" name="email" type="email"
                    placeholder="ou@exemple.com" value={form.email} onChange={handleChange} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">Telefonn*</label>
                  <input className="rk-input" name="telephone" type="tel"
                    placeholder="0000-0000" value={form.telephone} onChange={handleChange} />
                </div>


                <div className="rk-field">
                  <label className="rk-label">Modpas*</label>
                  <input className="rk-input" name="mot_de_passe" type="password"
                    placeholder="••••••••" value={form.mot_de_passe} onChange={handleChange} />
                </div>
                <div className="rk-field">
                  <label className="rk-label">konfime Modpas la*</label>
                  <input
                    className={`rk-input ${mdpError ? "input-error" : ""}`}
                    name="mot_de_passe_confirmation"
                    type="password"
                    placeholder="••••••••"
                    value={form.mot_de_passe_confirmation}
                    onChange={handleChange}
                    style={{
                      borderColor: mdpError ? "#e24b4a" : form.mot_de_passe_confirmation && !mdpError ? "#1D9E75" : ""
                    }}
                  />
                  {/* message d'erreur en temps réel */}
                  {mdpError && (
                    <p style={{ color: "#e24b4a", fontSize: "12px", marginTop: "4px" }}>
                      ✗ {mdpError}
                    </p>
                  )}

                  {/* message de succès quand les mots de passe correspondent */}
                  {form.mot_de_passe_confirmation && !mdpError && (
                    <p style={{ color: "#1D9E75", fontSize: "12px", marginTop: "4px" }}>
                      ✓ Modpas yo menm
                    </p>
                  )}
                </div>

                <div className="rk-row">
                  <div className="rk-field">
                    <label className="rk-label">Commune</label>
                    <input className="rk-input" name="commune" placeholder="commune"
                      value={form.commune} onChange={handleChange} />
                  </div>
                  <div className="rk-field">
                    <label className="rk-label">Ville</label>
                    <input className="rk-input" name="ville" placeholder="Ville"
                      value={form.ville} onChange={handleChange} />
                  </div>
                </div>
              </>
            )}
            {tab === "register" && (
              <>
                {/* reCAPTCHA — juste avant le bouton */}
                <div style={{ margin: "1rem 0 0.5rem" }}>
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_KEY}

                    // appelé quand l'utilisateur coche la case
                    onChange={(token) => {
                      setRecaptchaToken(token);  // sauvegarde le token
                      setRecaptchaError(false);  // efface l'erreur
                    }}

                    // appelé si le token expire (après 2 minutes)
                    onExpired={() => {
                      setRecaptchaToken(null);
                      setRecaptchaError(true);
                    }}
                  />
                  {/* Message d'erreur si pas coché */}
                  {recaptchaError && (
                    <p style={{
                      color: "#c0392b",
                      fontSize: "12px",
                      marginTop: "6px"
                    }}>
                      Tanpri konfime ou pa yon robot
                    </p>
                  )}
                </div>
              </>
            )}
            {error && (
              <div style={{
                background: "#fef0f0",
                border: "1px solid #f5c6c6",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#c0392b",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                ✗ {error}
              </div>
            )}
            <button className="rk-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Chargement..." : tab === "login" ? "Konekte" : "Kreye kont mwen"}
            </button>

            <div className="rk-switch">
              {tab === "login" ? (
                <>Pa gen kont? <a onClick={() => setTab("register")}>Enskri gratis</a></>
              ) : (
                <>Deja gen kont? <a onClick={() => setTab("login")}>Konekte</a></>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

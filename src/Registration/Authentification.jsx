import { useState, useRef, useEffect } from "react";
import "../assets/CSS/Authentification.css"
import logo from "../assets/Images/Asset5.svg";
import ReCAPTCHA from "react-google-recaptcha";
import { api } from "../api/client";
import { useAuthStore } from "./AuthentificationStore";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";

export default function RekoltHtAuth() {

  // state pour gérer les données du formulaire, les erreurs, le succès, et le type de tab (login/register)
  const navigate = useNavigate();
  const { inscription, connexion, loading, error, clearError } = useAuthStore();
  const [success, setSuccess] = useState(null);
  const [tab, setTab] = useState("login");
  const googleConnexion   = useAuthStore((s) => s.googleConnexion);
const googleInscription = useAuthStore((s) => s.googleInscription);

  // --------------constant pour naviguer entre les types de comptes dans le formulaire d'inscription----------------
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", mot_de_passe: "", telephone: "", role: "acheteur",
    bio: "", adresse: "", commune: "", ville: "", pays: "Haiti", latitude: "", longitude: "",
    mot_de_passe_confirmation: "",
  });

  //  -------------------UseState pour soumission----------------
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

  // ---------------------------------- GPS ---------------------------------------------------  
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
  // -------------Fin Gps ----------------------------------

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

        // console.log("Données envoyées :", {
        //   email: form.email,
        //   mot_de_passe: form.mot_de_passe,
        // });

        const res = await connexion({
          email: form.email,
          mot_de_passe: form.mot_de_passe,
        });

        if (res && res.token) {
          setSuccess("Koneksyon reyisi!");
          setTimeout(() => navigate("/"), 500);
        }
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
    //------------------------------------ fin fonction handlesubmit ------------------------------------
  };

  //------------------------------------ authentification avec google --------------------------------------
  // déclenche le login Google
  const loginGoogle = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        const res = tab === "login"
          ? await googleConnexion(response.access_token)
          : await googleInscription(response.access_token);

        if (res && res.token) {
          setSuccess(tab === "login" ? "Koneksyon reyisi!" : "Enskripsyon reyisi!");
          setTimeout(() => navigate("/"), 1000);
        }
      } catch (err) {
        console.error("Erreur Google :", err.message);
      }
    },
    onError: () => console.error("Connexion Google annulée"),
  });
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

            {/* Séparateur */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: "12px", margin: "1rem 0"
            }}>
              <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              <span style={{ fontSize: "12px", color: "#888" }}>oswa</span>
              <div style={{ flex: 1, height: "1px", background: "#eee" }} />
            </div>
            {/* Bouton Google */}
            <button
              onClick={() => loginGoogle()}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: "10px",
                border: "1.5px solid #e8e8e8",
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.2s",
              }}
            >
              {/* Logo Google SVG */}
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Kontinye ak Google
            </button>

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

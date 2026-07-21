import { useState, useEffect } from "react";
import "../assets/CSS/Authentification.css";
import "../assets/CSS/DevenirVendeur.css";
import { api } from "../api/client";
import { useAuthStore } from "./AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import departementsData from "../assets/Departements/haiti_departements.json";
<<<<<<< Updated upstream

const CATEGORIES = [
    { value: "legim", label: "Legim (Légumes)" },
    { value: "fwi", label: "Fwi (Fruits)" },
    { value: "sereyal", label: "Sereyal (Céréales)" },
    { value: "rasin", label: "Rasin & Tibibèl (Tubercules)" },
    { value: "pwason", label: "Pwason & Fwi Mè" },
    { value: "vyann", label: "Vyann & Volatil" },
    { value: "pwodui_let", label: "Pwodui Lèt" },
    { value: "epis", label: "Epis & Kondiman" },
    { value: "semans", label: "Semans & Pye Bwa" },
    { value: "lot", label: "Lòt" },
];
=======
import CaptureSelfie from "../components/CaptureSelfie.jsx";
import MapSelectionGPS from "../components/MapSelectionGPS.jsx";
import { useChatbotStore } from "../components/chatbotStore.js";

// clé de traduction du libellé pour chaque type_document (DemandeVerification.TYPE_DOCUMENT côté backend)
const LABEL_TYPE_DOCUMENT = { passeport: "seller.passport", permis: "seller.driverLicense", cin: "seller.nationalId" };

// clé de traduction du libellé du champ numéro, selon le type de pièce choisi
// (Paspò nimewo/N° Passeport, Numéro de carte/Nimewo kat la, NIF, Numéro de patente)
const LABEL_NUMERO_PIECE = { passeport: "seller.numeroPasseport", permis: "seller.numeroPermis", cin: "seller.numeroCin" };

const FORM_INITIAL = {
    type_document: "",
    numero_piece_saisi: "",
    document_recto: null,
    document_verso: null,
    certificat_patente: null,
    selfie: null,
    departement: "",
    commune: "",
    section_communale: "",
    coord: null,   // { lat, lng }
};

// retrouve le département contenant une commune déjà connue (prefill), pour
// que le <select> commune (dont les options dépendent du département choisi)
// ne se retrouve pas avec une valeur sans option correspondante
function trouverDepartementPourCommune(commune) {
    if (!commune) return "";
    return departementsData.find(d => d.communes.some(c => c.commune === commune))?.departement || "";
}

// ── BROUILLON localStorage (reprise après rechargement) ──────────────────────
// Limite volontaire : les fichiers (File) ne peuvent pas être sérialisés en
// localStorage — seuls les champs texte/GPS sont sauvegardés. Au retour, on
// ne peut donc jamais restaurer une étape au-delà de l'upload des documents
// (étape 2) : les pièces/le selfie doivent toujours être re-fournis.
const CLE_BROUILLON = "rekoltht_devenir_vendeur_wizard";

function chargerBrouillon() {
    try {
        const brut = localStorage.getItem(CLE_BROUILLON);
        return brut ? JSON.parse(brut) : null;
    } catch {
        return null;
    }
}

function sauvegarderBrouillon(etape, form) {
    try {
        localStorage.setItem(CLE_BROUILLON, JSON.stringify({
            etape,
            form: {
                type_document: form.type_document,
                numero_piece_saisi: form.numero_piece_saisi,
                departement: form.departement,
                commune: form.commune,
                section_communale: form.section_communale,
                coord: form.coord,
            },
        }));
    } catch {
        // quota dépassé ou navigation privée : non bloquant, on continue sans brouillon
    }
}

function effacerBrouillon() {
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* non bloquant */ }
}

// champ fichier réutilisable (recto / verso / certificat de patente) — même
// balisage que le champ "document" du formulaire d'origine
function ChampFichier({ id, label, hint, accept, value, onChange, error, placeholder }) {
    return (
        <div className="rk-field">
            <label className="rk-label">
                {label}<span style={{ color: "#e24b4a" }}>*</span>
            </label>
            <div className="dv-file-wrap">
                <label className={`dv-file-label ${value ? "has-file" : ""}`} htmlFor={id}>
                    <span className="dv-file-icon">{value ? "✓" : "📎"}</span>
                    {value ? value.name : placeholder}
                </label>
                <input
                    id={id}
                    type="file"
                    className="dv-file-input"
                    accept={accept}
                    onChange={(e) => onChange(e.target.files?.[0] || null)}
                />
            </div>
            {hint && <span className="rk-hint">{hint}</span>}
            {error && <p className="rk-error">X {error}</p>}
        </div>
    );
}

// barre de progression du wizard
function Stepper({ index, total, label }) {
    const pct = Math.round(((index + 1) / total) * 100);
    return (
        <div className="dv-stepper">
            <p className="dv-stepper-label">{label}</p>
            <div className="dv-stepper-track">
                <div className="dv-stepper-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// étape 6 — écran de statut (en_attente / vérifié / échoué)
function EcranStatut({ verification, onRetry, navigate, t }) {
    const statut = verification?.statut;
    return (
        <div className="rk-card dv-status-card">
            {statut === "en_attente" && (
                <>
                    <div className="dv-status-icon dv-status-pending">⏳</div>
                    <h2 className="dv-status-title">{t("seller.statusPendingTitle")}</h2>
                    <p className="dv-status-text">{t("seller.statusPendingText")}</p>
                </>
            )}
            {statut === "en_attente_manuelle" && (
                <>
                    <div className="dv-status-icon dv-status-pending">👤</div>
                    <h2 className="dv-status-title">{t("seller.statusManualTitle")}</h2>
                    <p className="dv-status-text">{t("seller.statusManualText")}</p>
                </>
            )}
            {statut === "verifie" && (
                <>
                    <div className="dv-status-icon dv-status-success">✓</div>
                    <h2 className="dv-status-title">{t("seller.statusVerifiedTitle")}</h2>
                    <p className="dv-status-text">{t("seller.statusVerifiedText")}</p>
                    {verification.contrat_pdf && (
                        <a
                            className="rk-btn dv-status-link"
                            href={verification.contrat_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t("seller.viewContract")}
                        </a>
                    )}
                    <div className="dv-status-actions">
                        <button type="button" className="rk-btn dv-btn-outline" onClick={() => navigate("/")}>
                            {t("seller.backToHome")}
                        </button>
                        <button type="button" className="rk-btn" onClick={() => navigate("/produits/ajouter")}>
                            {t("seller.addProduct")}
                        </button>
                    </div>
                </>
            )}
            {statut === "echoue" && (
                <>
                    <div className="dv-status-icon dv-status-failed">✗</div>
                    <h2 className="dv-status-title">{t("seller.statusFailedTitle")}</h2>
                    <p className="dv-status-text">{verification.motif_echec}</p>
                    <button type="button" className="rk-btn" onClick={onRetry}>
                        {t("seller.retrySubmission")}
                    </button>
                </>
            )}
        </div>
    );
}
>>>>>>> Stashed changes

export default function DevenirVendeur() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const utilisateur = useAuthStore((s) => s.utilisateur);
    const profil = useProfilStore((s) => s.profil);
    const afficherProfil = useProfilStore((s) => s.afficherProfil);
    const profilLoading = useProfilStore((s) => s.loading);

    useEffect(() => {
        afficherProfil().catch(() => { });
    }, [afficherProfil]);

    const isEntreprise = !!(
        profil?.role === "entreprise" ||
        profil?.entreprise_nom ||
        utilisateur?.entreprise_nom
    );

    const [form, setForm] = useState({
        bio: "",
        departement: "",
        commune: "",
        section_communale: "",
        categorie_produit: "",
        entreprise_nom: "",
        document: null,
    });

<<<<<<< Updated upstream
=======
    // alimente la bulle de conseils (ChatbotVendeur, montée globalement dans
    // App.jsx) avec le contexte du wizard — remis à zéro en quittant la page,
    // pour que les autres pages retrouvent le conseil générique par défaut
    const setChatbotContexte = useChatbotStore((s) => s.setContexte);
    useEffect(() => {
        if (vue === "wizard") setChatbotContexte(etape, null);
        else if (vue === "statut") setChatbotContexte(null, verification?.statut);
        else setChatbotContexte(null, null);
        return () => setChatbotContexte(null, null);
    }, [vue, etape, verification?.statut, setChatbotContexte]);

    // au chargement : une demande existe déjà (peu importe son statut) → afficher
    // directement l'écran de statut plutôt que de faire re-remplir le wizard.
    // Sinon, un brouillon localStorage peut exister (voir chargerBrouillon) — les
    // champs texte/GPS sont restaurés ici ; l'étape réelle est calculée plus bas
    // (validateEtape), une fois isEntreprise connu.
    useEffect(() => {
        if (!utilisateur) return;
        let annule = false;
        AuthentificationApi.obtenirStatutVerification()
            .then((res) => { if (!annule) { setVerification(res); setVue("statut"); } })
            .catch(() => {
                if (annule) return;
                const brouillon = chargerBrouillon();
                if (brouillon) {
                    setForm(prev => ({ ...prev, ...brouillon.form }));
                    setDraftEtape(brouillon.etape || 1);
                }
                setVue("wizard");
            });
        return () => { annule = true; };
    }, [utilisateur]);

    // pré-remplissage localisation depuis le compte (déjà géré auparavant pour
    // commune côté individuel — étendu ici à l'entreprise et au point GPS)
>>>>>>> Stashed changes
    useEffect(() => {
        if (!profil) return;
        setForm(prev => ({
            ...prev,
            bio: profil.bio || "",
            departement: profil.departement || "",
            commune: profil.commune || "",
            section_communale: profil.section_communale || "",
            categorie_produit: profil.categorie_produit || "",
            entreprise_nom: profil.entreprise_nom || utilisateur?.entreprise_nom || "",
        }));
    }, [profil]);

    const [fieldErrors, setFieldErrors] = useState({});
    const [submitLoading, setSubmitLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [serverError, setServerError] = useState(null);

    const communesDisponibles = form.departement
        ? (departementsData.find(d => d.departement === form.departement)?.communes || [])
        : [];
    const sectionsDisponibles = form.commune
        ? (communesDisponibles.find(c => c.commune === form.commune)?.sections_communales || [])
        : [];

    const handleChange = (e) => {
        setServerError(null);
        const { name, value } = e.target;
        const newForm = { ...form, [name]: value };
        if (name === "departement") { newForm.commune = ""; newForm.section_communale = ""; }
        if (name === "commune") { newForm.section_communale = ""; }
        setForm(newForm);
        setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    const handleFile = (e) => {
        setServerError(null);
        const file = e.target.files[0] || null;
        setForm(prev => ({ ...prev, document: file }));
        setFieldErrors(prev => { const n = { ...prev }; delete n.document; return n; });
    };

    const validate = () => {
        const errors = {};
        if (isEntreprise && !form.entreprise_nom.trim()) errors.entreprise_nom = t("seller.validationEntrepriseName");
        if (!form.bio.trim()) errors.bio = t("seller.validationBio");
        if (!form.departement) errors.departement = t("seller.validationDepartement");
        if (!form.commune) errors.commune = t("seller.validationCommune");
        if (!form.section_communale && sectionsDisponibles.length > 0)
            errors.section_communale = t("seller.validationSection");
        if (!form.categorie_produit) errors.categorie_produit = t("seller.validationCategory");
        if (isEntreprise && !form.document) errors.document = t("seller.validationDocument");
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async () => {
        setServerError(null);
        if (!validate()) return;
        try {
            setSubmitLoading(true);
            const formData = new FormData();
            formData.append("bio", form.bio);
            formData.append("departement", form.departement);
            formData.append("commune", form.commune);
            formData.append("section_communale", form.section_communale);
            formData.append("categorie_produit", form.categorie_produit);
            if (isEntreprise) {
                formData.append("entreprise_nom", form.entreprise_nom);
                if (form.document) formData.append("document", form.document);
            }
            await api.post("/auth/devenir-vendeur", formData);
            setSuccess(true);
            setTimeout(() => navigate("/"), 2500);
        } catch (err) {
            setServerError(err.response?.data?.message || t("seller.serverError"));
        } finally {
            setSubmitLoading(false);
        }
    };

    if (!utilisateur) {
        return (
            <div className="dv-root">
                <div className="dv-container" style={{ textAlign: "center", paddingTop: "4rem" }}>
                    <p style={{ color: "#888", marginBottom: "1rem" }}>
                        {t("seller.notConnected")}
                    </p>
                    <button className="rk-btn" style={{ maxWidth: 240 }} onClick={() => navigate("/auth")}>
                        {t("seller.goToLogin")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dv-root">
            <div className="dv-container">

                <div className="dv-header">
                    <h1 className="dv-title">{t("seller.pageTitle")}</h1>
                    <p className="dv-subtitle">{t("seller.pageSubtitle")}</p>
                </div>

                <div className="rk-card">

<<<<<<< Updated upstream
                    {success && (
                        <div className="rk-success">
                            ✓ {t("seller.successMessage")}
                        </div>
                    )}
=======
                {vue === "statut" && (
                    <EcranStatut verification={verification} onRetry={relancerDemande} navigate={navigate} t={t} />
                )}
>>>>>>> Stashed changes

                    {/* ——— Identité (pré-rempli, désactivé) ——— */}
                    <p className="dv-section-label">{t("seller.identitySection")}</p>

                    {isEntreprise ? (
                        <div className="rk-field">
                            <label className="rk-label">
                                {t("seller.entrepriseName")}<span style={{ color: "#e24b4a" }}>*</span>
                            </label>
                            <input
                                className="rk-input"
                                name="entreprise_nom"
                                value={form.entreprise_nom}
                                onChange={handleChange}
                                placeholder={t("seller.entrepriseNamePlaceholder")}
                                maxLength={120}
                            />
                            {fieldErrors.entreprise_nom && (
                                <p className="rk-error">✗ {fieldErrors.entreprise_nom}</p>
                            )}
                        </div>
                    ) : (
                        <div className="rk-row">
                            <div className="rk-field">
                                <label className="rk-label">{t("seller.lastName")}</label>
                                <input
                                    className="rk-input dv-disabled"
                                    value={utilisateur.nom || ""}
                                    disabled readOnly
                                />
                            </div>
                            <div className="rk-field">
                                <label className="rk-label">{t("seller.firstName")}</label>
                                <input
                                    className="rk-input dv-disabled"
                                    value={utilisateur.prenom || ""}
                                    disabled readOnly
                                />
                            </div>
                        </div>
                    )}

                    <div className="rk-field">
                        <label className="rk-label">{t("seller.email")}</label>
                        <input
                            className="rk-input dv-disabled"
                            value={utilisateur.email || ""}
                            disabled readOnly
                            type="email"
                        />
                    </div>

                    {/* ——— Profil vendeur ——— */}
                    <p className="dv-section-label">{t("seller.sellerProfileSection")}</p>

                    {profilLoading && !profil ? (
                        <p style={{ color: "#aaa", fontSize: 13, marginBottom: "1rem" }}>
                            {t("seller.profileLoading")}
                        </p>
                    ) : null}

                    <div className="rk-field">
                        <label className="rk-label">
                            {t("seller.bio")}<span style={{ color: "#e24b4a" }}>*</span>
                        </label>
                        <textarea
                            className="rk-input dv-textarea"
                            name="bio"
                            placeholder={t("seller.bioPlaceholder")}
                            value={form.bio}
                            onChange={handleChange}
                            rows={4}
                            maxLength={500}
                        />
                        <span className="dv-char-count">{form.bio.length}/500</span>
                        {fieldErrors.bio && <p className="rk-error">✗ {fieldErrors.bio}</p>}
                    </div>

                    <div className="rk-field">
                        <label className="rk-label">
                            {t("seller.productCategory")}<span style={{ color: "#e24b4a" }}>*</span>
                        </label>
                        <div className="rk-select-wrap">
                            <select
                                className="rk-select"
                                name="categorie_produit"
                                value={form.categorie_produit}
                                onChange={handleChange}
                            >
                                <option value="">— {t("seller.chooseCategory")} —</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        {fieldErrors.categorie_produit && (
                            <p className="rk-error">✗ {fieldErrors.categorie_produit}</p>
                        )}
                    </div>

                    {/* ——— Localisation ——— */}
                    <p className="dv-section-label">{t("seller.locationSection")}</p>

                    <div className="rk-field">
                        <label className="rk-label">
                            {t("auth.departement")}<span style={{ color: "#e24b4a" }}>*</span>
                        </label>
                        <div className="rk-select-wrap">
                            <select
                                className="rk-select"
                                name="departement"
                                value={form.departement}
                                onChange={handleChange}
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
                        <label className="rk-label">
                            {t("auth.commune")}<span style={{ color: "#e24b4a" }}>*</span>
                        </label>
                        <div className="rk-select-wrap">
                            <select
                                className="rk-select"
                                name="commune"
                                value={form.commune}
                                onChange={handleChange}
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
                        <label className="rk-label">
                            {t("auth.sectionCommunale")}<span style={{ color: "#e24b4a" }}>*</span>
                        </label>
                        <div className="rk-select-wrap">
                            <select
                                className="rk-select"
                                name="section_communale"
                                value={form.section_communale}
                                onChange={handleChange}
                                disabled={!form.commune || sectionsDisponibles.length === 0}
                            >
                                <option value="">— {t("auth.chooseSection")} —</option>
                                {sectionsDisponibles.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        {fieldErrors.section_communale && (
                            <p className="rk-error">✗ {fieldErrors.section_communale}</p>
                        )}
                    </div>

                    {/* ——— Document (entreprise seulement) ——— */}
                    {isEntreprise && (
                        <>
                            <p className="dv-section-label">{t("seller.officialDocSection")}</p>
                            <div className="rk-field">
                                <label className="rk-label">
                                    {t("seller.officialDoc")}<span style={{ color: "#e24b4a" }}>*</span>
                                </label>
                                <div className="dv-file-wrap">
                                    <label
                                        className={`dv-file-label ${form.document ? "has-file" : ""}`}
                                        htmlFor="dv-doc-input"
                                    >
                                        <span className="dv-file-icon">{form.document ? "✓" : "📎"}</span>
                                        {form.document ? form.document.name : t("seller.fileChoose")}
                                    </label>
                                    <input
                                        id="dv-doc-input"
                                        type="file"
                                        className="dv-file-input"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleFile}
                                    />
                                </div>
                                <span className="rk-hint">{t("seller.fileHint")}</span>
                                {fieldErrors.document && <p className="rk-error">✗ {fieldErrors.document}</p>}
                            </div>
                        </>
                    )}

                    {serverError && (
                        <div style={{
                            background: "#fef0f0", border: "1px solid #f5c6c6", borderRadius: "8px",
                            padding: "10px 14px", fontSize: "13px", color: "#c0392b",
                            marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px",
                        }}>
                            ✗ {serverError}
                        </div>
<<<<<<< Updated upstream
                    )}

                    <button
                        className="rk-btn"
                        onClick={handleSubmit}
                        disabled={submitLoading || success}
                    >
                        {submitLoading ? t("seller.saving") : t("seller.submit")}
                    </button>
                </div>
=======
                    </div>
                )}
>>>>>>> Stashed changes
            </div>
        </div>
    );
}

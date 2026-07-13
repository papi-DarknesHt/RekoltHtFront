import { useEffect, useRef, useState } from "react";
import "../assets/CSS/Authentification.css";
import "../assets/CSS/DevenirVendeur.css";
import { AuthentificationApi } from "../api/auth";
import { useAuthStore } from "./AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useGlobalStore } from "../api/globalStore.js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import departementsData from "../assets/Departements/haiti_departements.json";
import CaptureSelfie from "../components/CaptureSelfie.jsx";
import MapSelectionGPS from "../components/MapSelectionGPS.jsx";
import ChatbotVendeur from "../components/ChatbotVendeur.jsx";

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
            {error && <p className="rk-error">✗ {error}</p>}
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
function EcranStatut({ verification, onRetry, t }) {
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

export default function DevenirVendeur() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const utilisateur = useAuthStore((s) => s.utilisateur);
    const entreprise = useAuthStore((s) => s.entreprise);
    const chargerEntreprise = useAuthStore((s) => s.chargerEntreprise);
    const profil = useProfilStore((s) => s.profil);
    const afficherProfil = useProfilStore((s) => s.afficherProfil);
    const profilLoading = useProfilStore((s) => s.loading);
    const verificationEvent = useGlobalStore((s) => s.verificationEvent);

    useEffect(() => {
        afficherProfil().catch(() => { });
        chargerEntreprise().catch(() => { });
    }, [afficherProfil, chargerEntreprise]);

    // est_entreprise vient du backend (Registration/profil/) : calculé via
    // Profil.obtenir_utilisateur_type(), qui vérifie l'existence d'une ligne
    // Entreprise pour ce compte. "role" ne vaut jamais "entreprise" (voir
    // Profil.ROLES côté backend : acheteur/vendeur/admin uniquement).
    const isEntreprise = !!profil?.est_entreprise;

    // 'chargement' (vérification du statut existant) → 'wizard' (étapes 1-5) → 'statut' (étape 6)
    const [vue, setVue] = useState("chargement");
    const [etape, setEtape] = useState(1);
    const [verification, setVerification] = useState(null);
    const [form, setForm] = useState(FORM_INITIAL);
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitLoading, setSubmitLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [serverError, setServerError] = useState(null);
    const [selfiePreviewUrl, setSelfiePreviewUrl] = useState(null);
    const [draftEtape, setDraftEtape] = useState(null);       // étape du brouillon localStorage, en attente de validation
    const [draftApplied, setDraftApplied] = useState(false);  // affiche la notice "progression restaurée"
    const draftAppliedRef = useRef(false);

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
    useEffect(() => {
        if (!profil) return;
        const communeExistante = isEntreprise ? (entreprise?.commune || "") : (profil.commune || "");
        const coordExistant = isEntreprise
            ? (entreprise?.latitude != null && entreprise?.longitude != null ? { lat: entreprise.latitude, lng: entreprise.longitude } : null)
            : (profil.latitude != null && profil.longitude != null ? { lat: profil.latitude, lng: profil.longitude } : null);
        setForm(prev => ({
            ...prev,
            departement: prev.departement || trouverDepartementPourCommune(communeExistante),
            commune: prev.commune || communeExistante,
            coord: prev.coord || coordExistant,
        }));
    }, [profil, entreprise, isEntreprise]);

    // polling — filet de sécurité si le WebSocket est indisponible/déconnecté
    // (en_attente_manuelle inclus : un admin peut valider/rejeter à tout moment,
    // voir DemandeVerificationAdmin.valider_selectionnees/rejeter_selectionnees)
    useEffect(() => {
        if (vue !== "statut" || !["en_attente", "en_attente_manuelle"].includes(verification?.statut)) return;
        const id = setInterval(() => {
            AuthentificationApi.obtenirStatutVerification().then(setVerification).catch(() => { });
        }, 8000);
        return () => clearInterval(id);
    }, [vue, verification?.statut]);

    // rafraîchissement immédiat via WebSocket (broadcast_verification, Registration/signals.py)
    useEffect(() => {
        if (!verificationEvent || vue !== "statut") return;
        if (String(verificationEvent.utilisateur_id) !== String(utilisateur?.id)) return;
        AuthentificationApi.obtenirStatutVerification().then(setVerification).catch(() => { });
    }, [verificationEvent, vue, utilisateur?.id]);

    // aperçu du selfie déjà capturé, pour la récapitulatif (étape 5)
    useEffect(() => {
        if (!form.selfie) { setSelfiePreviewUrl(null); return; }
        const url = URL.createObjectURL(form.selfie);
        setSelfiePreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [form.selfie]);

    const communesDisponibles = form.departement
        ? (departementsData.find(d => d.departement === form.departement)?.communes || [])
        : [];
    const sectionsDisponibles = form.commune
        ? (communesDisponibles.find(c => c.commune === form.commune)?.sections_communales || [])
        : [];

    // étapes réellement affichées : le selfie (3) ne concerne que les comptes individuels
    const STEPS = isEntreprise ? [1, 2, 4, 5] : [1, 2, 3, 4, 5];
    const stepIdx = STEPS.indexOf(etape);

    // vérité booléenne d'une étape (sans effet de bord sur fieldErrors) — utilisée
    // à la fois par validateEtape (navigation) et par la restauration du brouillon
    const estEtapeValide = (n, f = form) => {
        if (n === 1) return isEntreprise || !!f.type_document;
        if (n === 2) {
            if (!f.numero_piece_saisi?.trim()) return false;
            if (isEntreprise) return !!f.certificat_patente;
            if (!f.document_recto) return false;
            if (f.type_document === "cin" && !f.document_verso) return false;
            return true;
        }
        if (n === 3) return isEntreprise || !!f.selfie;
        if (n === 4) {
            if (!f.departement || !f.commune) return false;
            const communes = departementsData.find(d => d.departement === f.departement)?.communes || [];
            const sections = communes.find(c => c.commune === f.commune)?.sections_communales || [];
            if (!f.section_communale && sections.length > 0) return false;
            if (!f.coord) return false;
            return true;
        }
        return true;
    };

    // restaure l'étape du brouillon une fois isEntreprise fiable (profil chargé) —
    // limité à la plus haute étape RÉELLEMENT valide (les fichiers ne survivent
    // jamais à un rechargement, voir chargerBrouillon plus haut)
    useEffect(() => {
        if (draftAppliedRef.current || draftEtape == null || !profil) return;
        draftAppliedRef.current = true;

        let etapeAtteinte = 1;
        for (const s of STEPS) {
            if (s > draftEtape || !estEtapeValide(s, form)) break;
            etapeAtteinte = s;
        }
        setEtape(etapeAtteinte);
        if (etapeAtteinte > 1) setDraftApplied(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftEtape, profil, isEntreprise]);

    // sauvegarde continue du brouillon (hors fichiers, non sérialisables —
    // voir sauvegarderBrouillon, qui n'extrait que le sous-ensemble sérialisable)
    useEffect(() => {
        if (vue !== "wizard") return;
        sauvegarderBrouillon(etape, form);
    }, [vue, etape, form]);

    const handleChange = (e) => {
        setServerError(null);
        const { name, value } = e.target;
        setForm(prev => {
            const next = { ...prev, [name]: value };
            if (name === "departement") { next.commune = ""; next.section_communale = ""; }
            if (name === "commune") { next.section_communale = ""; }
            if (name === "type_document" && value !== "cin") { next.document_verso = null; }
            return next;
        });
        setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    const handleFile = (name, file) => {
        setServerError(null);
        setForm(prev => ({ ...prev, [name]: file }));
        setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    const validateEtape = (n) => {
        const errors = {};
        if (n === 1 && !estEtapeValide(1)) {
            errors.type_document = t("seller.validationDocumentType");
        }
        if (n === 2 && !estEtapeValide(2)) {
            if (!form.numero_piece_saisi?.trim()) errors.numero_piece_saisi = t("seller.validationNumeroPiece");
            if (isEntreprise) {
                if (!form.certificat_patente) errors.certificat_patente = t("seller.validationPatente");
            } else {
                if (!form.document_recto) errors.document_recto = t("seller.validationRecto");
                if (form.type_document === "cin" && !form.document_verso) errors.document_verso = t("seller.validationVerso");
            }
        }
        if (n === 3 && !estEtapeValide(3)) {
            errors.selfie = t("seller.validationSelfie");
        }
        if (n === 4 && !estEtapeValide(4)) {
            if (!form.departement) errors.departement = t("seller.validationDepartement");
            if (!form.commune) errors.commune = t("seller.validationCommune");
            if (!form.section_communale && sectionsDisponibles.length > 0) errors.section_communale = t("seller.validationSection");
            if (!form.coord) errors.coord = t("seller.validationGps");
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // FormData commun à la soumission finale et à la prévisualisation du
    // contrat — mêmes champs, rien de plus (previsualiser_contrat ne persiste
    // jamais rien côté serveur, voir Registration/views.py)
    const construireFormData = () => {
        const formData = new FormData();
        formData.append("numero_piece_saisi", form.numero_piece_saisi.trim());
        if (isEntreprise) {
            formData.append("certificat_patente", form.certificat_patente);
        } else {
            formData.append("type_document", form.type_document);
            formData.append("document_recto", form.document_recto);
            if (form.type_document === "cin") formData.append("document_verso", form.document_verso);
            formData.append("selfie", form.selfie);
        }
        return formData;
    };

    const handleSubmit = async () => {
        setServerError(null);
        try {
            setSubmitLoading(true);
            const formData = construireFormData();
            formData.append("latitude", form.coord.lat);
            formData.append("longitude", form.coord.lng);

            const res = await AuthentificationApi.soumettreVerification(formData);
            setVerification(res.verification);
            setVue("statut");
            effacerBrouillon();
        } catch (err) {
            setServerError(err.message || t("seller.serverError"));
        } finally {
            setSubmitLoading(false);
        }
    };

    const handlePreview = async () => {
        setServerError(null);
        try {
            setPreviewLoading(true);
            const blob = await AuthentificationApi.previsualiserContrat(construireFormData());
            // pas de revokeObjectURL immédiat : l'onglet nouvellement ouvert a
            // besoin que l'URL reste valide le temps d'afficher le PDF
            window.open(URL.createObjectURL(blob), "_blank");
        } catch (err) {
            setServerError(err.message || t("seller.serverError"));
        } finally {
            setPreviewLoading(false);
        }
    };

    const goNext = () => {
        if (!validateEtape(etape)) return;
        if (etape === 5) { handleSubmit(); return; }
        setEtape(STEPS[stepIdx + 1]);
    };

    const goBack = () => {
        setServerError(null);
        setFieldErrors({});
        setEtape(STEPS[stepIdx - 1]);
    };

    const relancerDemande = () => {
        effacerBrouillon();
        setVerification(null);
        setForm(FORM_INITIAL);
        setFieldErrors({});
        setServerError(null);
        setDraftApplied(false);
        setEtape(1);
        setVue("wizard");
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

                {vue === "chargement" && (
                    <div className="rk-card">
                        <p style={{ color: "#aaa", fontSize: 13 }}>{t("seller.statusLoading")}</p>
                    </div>
                )}

                {vue === "statut" && (
                    <EcranStatut verification={verification} onRetry={relancerDemande} t={t} />
                )}

                {vue === "wizard" && (
                    <div className="rk-card">

                        <Stepper
                            index={stepIdx}
                            total={STEPS.length}
                            label={t("seller.stepIndicator", { current: stepIdx + 1, total: STEPS.length })}
                        />

                        {profilLoading && !profil && (
                            <p style={{ color: "#aaa", fontSize: 13, marginBottom: "1rem" }}>
                                {t("seller.profileLoading")}
                            </p>
                        )}

                        {draftApplied && (
                            <p className="rk-success" style={{ fontSize: 12 }}>
                                ✓ {t("seller.draftRestored")}
                            </p>
                        )}

                        {/* ——— Étape 1 : type de compte + choix du document ——— */}
                        {etape === 1 && (
                            <>
                                <p className="dv-section-label">{t("seller.step1Title")}</p>

                                {isEntreprise ? (
                                    <div className="rk-field">
                                        <label className="rk-label">{t("seller.entrepriseName")}</label>
                                        <input
                                            className="rk-input dv-disabled"
                                            value={entreprise?.nom_Entreprise || ""}
                                            disabled readOnly
                                        />
                                    </div>
                                ) : (
                                    <div className="rk-row">
                                        <div className="rk-field">
                                            <label className="rk-label">{t("seller.lastName")}</label>
                                            <input className="rk-input dv-disabled" value={utilisateur.nom || ""} disabled readOnly />
                                        </div>
                                        <div className="rk-field">
                                            <label className="rk-label">{t("seller.firstName")}</label>
                                            <input className="rk-input dv-disabled" value={utilisateur.prenom || ""} disabled readOnly />
                                        </div>
                                    </div>
                                )}

                                <div className="rk-field">
                                    <label className="rk-label">{t("seller.email")}</label>
                                    <input className="rk-input dv-disabled" value={utilisateur.email || ""} disabled readOnly type="email" />
                                </div>

                                {!isEntreprise && (
                                    <div className="rk-field">
                                        <label className="rk-label">
                                            {t("seller.chooseDocumentType")}<span style={{ color: "#e24b4a" }}>*</span>
                                        </label>
                                        <div className="rk-select-wrap">
                                            <select className="rk-select" name="type_document" value={form.type_document} onChange={handleChange}>
                                                <option value="">— {t("seller.chooseDocumentType")} —</option>
                                                <option value="passeport">{t("seller.passport")}</option>
                                                <option value="permis">{t("seller.driverLicense")}</option>
                                                <option value="cin">{t("seller.nationalId")}</option>
                                            </select>
                                        </div>
                                        {fieldErrors.type_document && <p className="rk-error">✗ {fieldErrors.type_document}</p>}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ——— Étape 2 : upload du/des document(s) ——— */}
                        {etape === 2 && (
                            <>
                                <p className="dv-section-label">{t("seller.step2Title")}</p>

                                <div className="rk-field">
                                    <label className="rk-label">
                                        {t(isEntreprise ? "seller.numeroPatente" : (LABEL_NUMERO_PIECE[form.type_document] || "seller.numeroPiece"))}
                                        <span style={{ color: "#e24b4a" }}>*</span>
                                    </label>
                                    <input
                                        className="rk-input"
                                        name="numero_piece_saisi"
                                        value={form.numero_piece_saisi}
                                        onChange={handleChange}
                                        placeholder={t("seller.numeroPiecePlaceholder")}
                                        maxLength={100}
                                    />
                                    <span className="rk-hint">{t("seller.numeroPieceHint")}</span>
                                    {fieldErrors.numero_piece_saisi && <p className="rk-error">✗ {fieldErrors.numero_piece_saisi}</p>}
                                </div>

                                {isEntreprise ? (
                                    <ChampFichier
                                        id="dv-patente-input"
                                        label={t("seller.uploadPatente")}
                                        hint={t("seller.patenteHint")}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        value={form.certificat_patente}
                                        onChange={(file) => handleFile("certificat_patente", file)}
                                        error={fieldErrors.certificat_patente}
                                        placeholder={t("seller.fileChoose")}
                                    />
                                ) : (
                                    <>
                                        <ChampFichier
                                            id="dv-recto-input"
                                            label={t("seller.uploadRecto")}
                                            accept=".jpg,.jpeg,.png"
                                            value={form.document_recto}
                                            onChange={(file) => handleFile("document_recto", file)}
                                            error={fieldErrors.document_recto}
                                            placeholder={t("seller.fileChoose")}
                                        />
                                        {form.type_document === "cin" && (
                                            <ChampFichier
                                                id="dv-verso-input"
                                                label={t("seller.uploadVerso")}
                                                accept=".jpg,.jpeg,.png"
                                                value={form.document_verso}
                                                onChange={(file) => handleFile("document_verso", file)}
                                                error={fieldErrors.document_verso}
                                                placeholder={t("seller.fileChoose")}
                                            />
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* ——— Étape 3 : selfie (individuel uniquement) ——— */}
                        {etape === 3 && (
                            <>
                                <p className="dv-section-label">{t("seller.step3Title")}</p>
                                <p style={{ fontSize: 13, color: "#888", marginBottom: "1rem" }}>{t("seller.step3Subtitle")}</p>
                                <CaptureSelfie value={form.selfie} onChange={(file) => handleFile("selfie", file)} />
                                {fieldErrors.selfie && <p className="rk-error">✗ {fieldErrors.selfie}</p>}
                            </>
                        )}

                        {/* ——— Étape 4 : localisation ——— */}
                        {etape === 4 && (
                            <>
                                <p className="dv-section-label">{t("seller.step4Title")}</p>

                                <div className="rk-field">
                                    <label className="rk-label">
                                        {t("auth.departement")}<span style={{ color: "#e24b4a" }}>*</span>
                                    </label>
                                    <div className="rk-select-wrap">
                                        <select className="rk-select" name="departement" value={form.departement} onChange={handleChange}>
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
                                            className="rk-select" name="commune" value={form.commune}
                                            onChange={handleChange} disabled={!form.departement}
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
                                            className="rk-select" name="section_communale" value={form.section_communale}
                                            onChange={handleChange} disabled={!form.commune || sectionsDisponibles.length === 0}
                                        >
                                            <option value="">— {t("auth.chooseSection")} —</option>
                                            {sectionsDisponibles.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {fieldErrors.section_communale && <p className="rk-error">✗ {fieldErrors.section_communale}</p>}
                                </div>

                                <p className="dv-section-label">{t("seller.gpsSectionLabel")}</p>
                                <MapSelectionGPS value={form.coord} onChange={(coord) => setForm(prev => ({ ...prev, coord }))} />
                                {fieldErrors.coord && <p className="rk-error">✗ {fieldErrors.coord}</p>}
                            </>
                        )}

                        {/* ——— Étape 5 : récapitulatif ——— */}
                        {etape === 5 && (
                            <>
                                <p className="dv-section-label">{t("seller.step5Title")}</p>

                                <div className="dv-recap-row">
                                    <span className="dv-recap-label">{t("seller.recapAccountType")}</span>
                                    <span className="dv-recap-value">
                                        {isEntreprise ? t("seller.accountTypeCompany") : t("seller.accountTypeIndividual")}
                                    </span>
                                </div>

                                {!isEntreprise && (
                                    <>
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapDocumentType")}</span>
                                            <span className="dv-recap-value">{t(LABEL_TYPE_DOCUMENT[form.type_document])}</span>
                                        </div>
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapNumeroPiece")}</span>
                                            <span className="dv-recap-value">{form.numero_piece_saisi}</span>
                                        </div>
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapRecto")}</span>
                                            <span className="dv-recap-value">{form.document_recto?.name}</span>
                                        </div>
                                        {form.type_document === "cin" && (
                                            <div className="dv-recap-row">
                                                <span className="dv-recap-label">{t("seller.recapVerso")}</span>
                                                <span className="dv-recap-value">{form.document_verso?.name}</span>
                                            </div>
                                        )}
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapSelfie")}</span>
                                            {selfiePreviewUrl && <img src={selfiePreviewUrl} alt="Selfie" className="dv-recap-selfie" />}
                                        </div>
                                    </>
                                )}

                                {isEntreprise && (
                                    <>
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapNumeroPiece")}</span>
                                            <span className="dv-recap-value">{form.numero_piece_saisi}</span>
                                        </div>
                                        <div className="dv-recap-row">
                                            <span className="dv-recap-label">{t("seller.recapPatente")}</span>
                                            <span className="dv-recap-value">{form.certificat_patente?.name}</span>
                                        </div>
                                    </>
                                )}

                                <div className="dv-recap-row">
                                    <span className="dv-recap-label">{t("seller.recapLocation")}</span>
                                    <span className="dv-recap-value">
                                        {[form.section_communale, form.commune, form.departement].filter(Boolean).join(", ")}
                                    </span>
                                </div>

                                <div className="dv-recap-row">
                                    <span className="dv-recap-label">{t("seller.recapGps")}</span>
                                    <span className="dv-recap-value">
                                        {form.coord ? `${form.coord.lat.toFixed(5)}, ${form.coord.lng.toFixed(5)}` : "—"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="rk-btn dv-btn-secondary"
                                    onClick={handlePreview}
                                    disabled={previewLoading || submitLoading}
                                    style={{ marginTop: "0.5rem" }}
                                >
                                    {previewLoading ? t("seller.previewLoading") : t("seller.previewContract")}
                                </button>

                                <p className="rk-hint" style={{ display: "block", margin: "1rem 0" }}>
                                    {t("seller.recapConfirmHint")}
                                </p>
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
                        )}

                        <div className="dv-step-nav">
                            {stepIdx > 0 && (
                                <button type="button" className="rk-btn dv-btn-secondary" onClick={goBack} disabled={submitLoading}>
                                    {t("seller.back")}
                                </button>
                            )}
                            <button type="button" className="rk-btn" onClick={goNext} disabled={submitLoading}>
                                {etape === 5 ? (submitLoading ? t("seller.saving") : t("seller.submit")) : t("seller.continue")}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {(vue === "wizard" || vue === "statut") && (
                <ChatbotVendeur etape={etape} statut={vue === "statut" ? verification?.statut : null} />
            )}
        </div>
    );
}

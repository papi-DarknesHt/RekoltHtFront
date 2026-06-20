import { useState, useEffect } from "react";
import "../assets/CSS/Authentification.css";
import "../assets/CSS/DevenirVendeur.css";
import { api } from "../api/client";
import { useAuthStore } from "./AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import departementsData from "../assets/Departements/haiti_departements.json";

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

export default function DevenirVendeur() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const utilisateur = useAuthStore((s) => s.utilisateur);
    const profil = useProfilStore((s) => s.profil);
    const afficherProfil = useProfilStore((s) => s.afficherProfil);
    const profilLoading = useProfilStore((s) => s.loading);

    useEffect(() => {
        afficherProfil().catch(() => { });
    }, []);

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
            await api.post("/auth/devenir-vendeur", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
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

                    {success && (
                        <div className="rk-success">
                            ✓ {t("seller.successMessage")}
                        </div>
                    )}

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
                    )}

                    <button
                        className="rk-btn"
                        onClick={handleSubmit}
                        disabled={submitLoading || success}
                    >
                        {submitLoading ? t("seller.saving") : t("seller.submit")}
                    </button>
                </div>
            </div>
        </div>
    );
}

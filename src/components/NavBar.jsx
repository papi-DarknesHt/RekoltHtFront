import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Language from "./language";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import {
    Bell,
    User,
    ChevronDown,
    LogOut,
    Menu,
    X,
} from "lucide-react";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import logo from "../assets/Images/Asset5.svg";
import "../assets/CSS/NavBar.css";


export default function Navbar() {
    const navigate = useNavigate();
    const isConnecte  = useAuthStore((s) => s.isConnected);
    const utilisateur = useAuthStore((s) => s.utilisateur);
    const entreprise  = useAuthStore((s) => s.entreprise);
    const deconnexion = useAuthStore((s) => s.deconnexion);
    const chargerEntreprise = useAuthStore((s) => s.chargerEntreprise);
    const profil      = useProfilStore((s) => s.profil);
    const afficherProfil = useProfilStore((s) => s.afficherProfil);

    // S'assure que le logo de l'entreprise et la photo de profil sont à jour
    // même si la session était déjà ouverte avant le rechargement de la page
    // (token persistant) — pas seulement juste après un connexion() de la session.
    useEffect(() => {
        if (isConnecte) {
            chargerEntreprise();
            afficherProfil().catch(() => {});
        }
    }, [isConnecte, chargerEntreprise, afficherProfil]);

    // Un compte "Antrepriz" affiche le nom/logo de l'entreprise à la place
    // de l'identité personnelle de l'utilisateur connecté : l'entreprise
    // doit appartenir à l'utilisateur connecté (proprietaire_id === utilisateur.id).
    const isEntreprise = !!(entreprise && entreprise.proprietaire_id === utilisateur?.id);
    const nomAffiche = isEntreprise
        ? entreprise.nom_Entreprise
        : `${utilisateur?.prenom || ""} ${utilisateur?.nom || ""}`.trim();
    const prenomAffiche = isEntreprise
        ? entreprise.nom_Entreprise
        : (utilisateur?.prenom || "Mon compte");
    const avatarAffiche = isEntreprise
        ? entreprise.logo
        : profil?.photo_profil;
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) setMobileOpen(false);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleDeconnexion = async () => {
        await deconnexion();
        setMenuOpen(false);
        setMobileOpen(false);
        navigate("/");
    };

    const { t } = useTranslation();
    const closeMobile = () => setMobileOpen(false);

    return (
        <div className={`nav-wrapper${scrolled ? " nav--scrolled" : ""}`}>
            <nav className="nav">
                {/* Logo */}
                <div className="nav-logo">
                    <img style={{ width: "50%" }} src={logo} alt="Logo" />
                </div>

                {/* Liens de navigation — desktop */}
                <ul className="nav-links">
                    <li><Link to="/">{t("nav.home")}</Link></li>
                    <li><a href="#">{t("nav.products")}</a></li>
                    <li><a href="#">{t("nav.help")}</a></li>
                </ul>

                {/* Actions — desktop */}
                <div className="profil-navbar__actions">
                    <Language />
                    {isConnecte ? (
                        <>
                            <button className="profil-icon-btn" aria-label="Notifications">
                                <Bell size={20} color={"var(--white)"} />
                            </button>
                            <div className="user-menu" ref={menuRef}>
                                <button
                                    className="user-btn"
                                    onClick={() => setMenuOpen(!menuOpen)}
                                >
                                    {avatarAffiche ? (
                                        <img
                                            src={avatarAffiche}
                                            alt={isEntreprise ? "Logo entreprise" : "Photo profil"}
                                            className="nav-avatar"
                                        />
                                    ) : (
                                        <User size={16} />
                                    )}
                                    {prenomAffiche}
                                    <ChevronDown
                                        size={14}
                                        className={menuOpen ? "rotate" : ""}
                                    />
                                </button>
                                {menuOpen && (
                                    <div className="dropdown-menu">
                                        <div className="dropdown-header">
                                            <div className="dropdown-avatar-row">
                                                {avatarAffiche ? (
                                                    <img
                                                        src={avatarAffiche}
                                                        alt={isEntreprise ? "Logo entreprise" : "Photo profil"}
                                                        className="dropdown-avatar"
                                                    />
                                                ) : (
                                                    <div className="dropdown-avatar-placeholder">
                                                        <User size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <p>{nomAffiche}</p>
                                                    <span>{utilisateur?.email}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => { navigate("/profil"); setMenuOpen(false); }}
                                        >
                                            <User size={16} />
                                            {t("nav.myProfile")}
                                        </button>
                                        <div className="divider" />
                                        <button
                                            className="dropdown-item logout"
                                            onClick={handleDeconnexion}
                                        >
                                            <LogOut size={16} />
                                            {t("nav.logout")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <button className="nav-btn" onClick={() => navigate("/auth")}>
                            {t("nav.login")}
                        </button>
                    )}
                </div>

                {/* Hamburger — mobile uniquement */}
                <button
                    className="nav-hamburger"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Menu"
                >
                    {mobileOpen
                        ? <X size={24} color="var(--white)" />
                        : <Menu size={24} color="var(--white)" />
                    }
                </button>
            </nav>

            {/* Panneau mobile */}
            {mobileOpen && (
                <div className="nav-mobile-panel">
                    <ul className="nav-mobile-links">
                        <li><Link to="/" onClick={closeMobile}>{t("nav.home")}</Link></li>
                        <li><a href="#" onClick={closeMobile}>{t("nav.products")}</a></li>
                        <li><a href="#" onClick={closeMobile}>{t("nav.help")}</a></li>
                    </ul>

                    <div className="nav-mobile-actions">
                        <Language />

                        {isConnecte ? (
                            <div className="nav-mobile-user">
                                <div className="nav-mobile-user-info">
                                    {avatarAffiche ? (
                                        <img
                                            src={avatarAffiche}
                                            alt={isEntreprise ? "Logo entreprise" : "Photo profil"}
                                            className="nav-avatar"
                                        />
                                    ) : (
                                        <div className="dropdown-avatar-placeholder nav-mobile-avatar">
                                            <User size={16} />
                                        </div>
                                    )}
                                    <span>{nomAffiche}</span>
                                </div>
                                <button
                                    className="nav-mobile-link-btn"
                                    onClick={() => { navigate("/profil"); closeMobile(); }}
                                >
                                    <User size={16} />
                                    {t("nav.myProfile")}
                                </button>
                                <button
                                    className="nav-mobile-link-btn logout"
                                    onClick={handleDeconnexion}
                                >
                                    <LogOut size={16} />
                                    {t("nav.logout")}
                                </button>
                            </div>
                        ) : (
                            <button
                                className="nav-btn"
                                onClick={() => { navigate("/auth"); closeMobile(); }}
                            >
                                {t("nav.login")}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

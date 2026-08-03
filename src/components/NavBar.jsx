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
    MessageCircle,
    ShieldCheck,
    Sun,
    Moon,
} from "lucide-react";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore";
import { useGlobalStore } from "../api/globalStore.js";
import { useMessagerieBadgeStore } from "../api/messagerieBadgeStore.js";
import { useThemeStore } from "../api/themeStore.js";
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
    const isAdmin = profil?.role === "admin";
    const isVendeur = profil?.role === "vendeur";

    const theme = useThemeStore((s) => s.theme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    // pastille de la sonnette : nombre de messages non lus (voir
    // messagerieBadgeStore.js) — rafraîchi à chaque montage (donc à chaque
    // navigation, NavBar étant remonté par page) et à chaque message reçu en
    // temps réel (voir Messagerie/signals.py côté backend)
    const messageEvent = useGlobalStore((s) => s.messageEvent);
    const nonLus = useMessagerieBadgeStore((s) => s.nonLus);
    const rafraichirNonLus = useMessagerieBadgeStore((s) => s.rafraichir);

    useEffect(() => {
        if (isConnecte) rafraichirNonLus();
    }, [isConnecte, rafraichirNonLus]);

    useEffect(() => {
        if (isConnecte && messageEvent) rafraichirNonLus();
    }, [messageEvent, isConnecte, rafraichirNonLus]);

    // pastille "demandes vendeur" (admin uniquement) — un vendeur qui envoie
    // un message via "Contacter un admin" (voir Support/ContacterAdmin.jsx)
    // doit déclencher une notification visible de n'importe quelle page,
    // pas seulement depuis l'onglet "Messages vendeurs" du tableau de bord admin
    const messageAdminEvent = useGlobalStore((s) => s.messageAdminEvent);
    const messagesSupportEnAttente = useMessagerieBadgeStore((s) => s.messagesSupportEnAttente);
    const rafraichirSupport = useMessagerieBadgeStore((s) => s.rafraichirSupport);

    useEffect(() => {
        if (isConnecte && isAdmin) rafraichirSupport();
    }, [isConnecte, isAdmin, rafraichirSupport]);

    useEffect(() => {
        if (isConnecte && isAdmin && messageAdminEvent) rafraichirSupport();
    }, [messageAdminEvent, isConnecte, isAdmin, rafraichirSupport]);

    const totalNotifications = nonLus + (isAdmin ? messagesSupportEnAttente : 0);

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
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const menuRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
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

    const allerVersMessagerie = () => {
        setNotifOpen(false);
        navigate("/messages");
    };

    const allerVersSupportAdmin = () => {
        setNotifOpen(false);
        navigate("/admin/dashboard?tab=support");
    };

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
                    <img style={{ width: "50%" }} src={logo} alt={t("common.logoAlt")} />
                </div>

                {/* Liens de navigation — desktop */}
                <ul className="nav-links">
                    <li><Link to="/">{t("nav.home")}</Link></li>
                    <li><a href="/produits">{t("nav.products")}</a></li>
                    <li><a href="/aide">{t("nav.help")}</a></li>
                    {isConnecte && isVendeur && (
                        <li><Link to="/produits/tableau-de-bord">{t("nav.vendorDashboard")}</Link></li>
                    )}
                    {isConnecte && isAdmin && (
                        <li><Link to="/admin/dashboard">{t("nav.dashboard")}</Link></li>
                    )}
                </ul>

                {/* Actions — desktop */}
                <div className="profil-navbar__actions">
                    <button
                        type="button"
                        className="profil-icon-btn nav-theme-btn"
                        aria-label={t("nav.toggleTheme")}
                        title={t("nav.toggleTheme")}
                        onClick={toggleTheme}
                    >
                        {theme === "dark" ? <Sun size={20} color="var(--white)" /> : <Moon size={20} color="var(--white)" />}
                    </button>
                    <Language />
                    {isConnecte ? (
                        <>
                            <button
                                className="profil-icon-btn nav-bell-btn"
                                aria-label={t("nav.messages")}
                                onClick={allerVersMessagerie}
                            >
                                <MessageCircle size={20} color={"var(--white)"} />
                                {nonLus > 0 && (
                                    <span className="nav-bell-badge">{nonLus > 9 ? "9+" : nonLus}</span>
                                )}
                            </button>
                            <div className="user-menu" ref={notifRef}>
                                <button
                                    className="profil-icon-btn nav-bell-btn"
                                    aria-label={t("nav.notifications")}
                                    onClick={() => setNotifOpen(!notifOpen)}
                                >
                                    <Bell size={20} color={"var(--white)"} />
                                    {totalNotifications > 0 && (
                                        <span className="nav-bell-badge">{totalNotifications > 9 ? "9+" : totalNotifications}</span>
                                    )}
                                </button>
                                {notifOpen && (
                                    <div className="dropdown-menu nav-notif-dropdown">
                                        <div className="dropdown-header">
                                            <p>{t("nav.notifications")}</p>
                                        </div>
                                        {nonLus > 0 && (
                                            <button className="dropdown-item" onClick={allerVersMessagerie}>
                                                <MessageCircle size={16} />
                                                {t("nav.newMessagesNotification", { count: nonLus })}
                                            </button>
                                        )}
                                        {isAdmin && messagesSupportEnAttente > 0 && (
                                            <button className="dropdown-item" onClick={allerVersSupportAdmin}>
                                                <ShieldCheck size={16} />
                                                {t("nav.newSupportRequestsNotification", { count: messagesSupportEnAttente })}
                                            </button>
                                        )}
                                        {totalNotifications === 0 && (
                                            <p className="nav-notif-vide">{t("nav.noNotifications")}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="user-menu" ref={menuRef}>
                                <button
                                    className="user-btn"
                                    onClick={() => setMenuOpen(!menuOpen)}
                                >
                                    {avatarAffiche ? (
                                        <img
                                            src={avatarAffiche}
                                            alt={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
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
                                                        alt={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
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
                    aria-label={t("nav.menuAria")}
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
                        {isConnecte && (
                            <li><Link to="/messages" onClick={closeMobile}>{t("nav.messages")}</Link></li>
                        )}
                        {isConnecte && isVendeur && (
                            <li><Link to="/produits/tableau-de-bord" onClick={closeMobile}>{t("nav.vendorDashboard")}</Link></li>
                        )}
                        {isConnecte && isVendeur && (
                            <li><Link to="/contacter-admin" onClick={closeMobile}>{t("nav.contactAdmin")}</Link></li>
                        )}
                        {isConnecte && isAdmin && (
                            <li><Link to="/admin/dashboard" onClick={closeMobile}>{t("nav.dashboard")}</Link></li>
                        )}
                    </ul>

                    <div className="nav-mobile-actions">
                        <button
                            type="button"
                            className="nav-mobile-link-btn nav-theme-btn-mobile"
                            onClick={toggleTheme}
                        >
                            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                            {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
                        </button>
                        <Language />

                        {isConnecte ? (
                            <div className="nav-mobile-user">
                                <div className="nav-mobile-user-info">
                                    {avatarAffiche ? (
                                        <img
                                            src={avatarAffiche}
                                            alt={isEntreprise ? t("profile.logoTitle") : t("profile.photoTitle")}
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

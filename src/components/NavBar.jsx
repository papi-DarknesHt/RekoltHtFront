import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Language from "./language";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import {
    Bell,
    ShoppingCart,
    User,
    Camera,
    MessageSquare,
    ChevronRight,
    Mail,
    Lock,
    BellRing,
    LogOut,
    MapPin,
    Pencil,
    History,
    Shield,
    ClipboardEdit,
    ChevronDown,
} from "lucide-react";
import { useAuthStore } from "../Registration/AuthentificationStore";
import logo from "../assets/Images/Asset5.svg";
import "../assets/CSS/NavBar.css";


export default function Navbar() {
    const navigate = useNavigate();
    const isConnecte = useAuthStore((s) => s.isConnected);
    const utilisateur = useAuthStore((s) => s.utilisateur);
    const deconnexion = useAuthStore((s) => s.deconnexion);
    const [menuOpen, setMenuOpen] = useState(false);
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

    const handleDeconnexion = async () => {
        await deconnexion();
        setMenuOpen(false);
        navigate("/");
    };

    const { t } = useTranslation();

    return (
        <>
            <nav className="nav">
                {/* Logo cliquable */}
                <div className="nav-logo"><img style={{ width: "50%" }} src={logo} alt="Logo" /></div>

                {/* Liens de navigation */}
                <ul className="nav-links">
                    <li>
                        <Link to="/">{t("nav.home")}</Link>
                    </li>
                    <li><a href="#">{t("nav.products")}</a></li>
                    <li><a href="#">{t("nav.help")}</a></li>
                </ul>

                <div className="profil-navbar__actions">
                    {/* ajout du composant pour la gestion des langues */}
                    <Language/>
                    <button className="profil-icon-btn" aria-label="Notifications">
                        <Bell size={20} color={"var(--white)"}/>
                    </button>              

                {isConnecte ? (
                    <>
                        <div className="user-menu" ref={menuRef}>

                            {/* Bouton */}
                            <button
                                className="user-btn"
                                onClick={() => setMenuOpen(!menuOpen)}
                            >
                                <User size={16} />
                                {utilisateur?.prenom || "Mon compte"}
                                <ChevronDown
                                    size={14}
                                    className={menuOpen ? "rotate" : ""}
                                />
                            </button>

                            {/* Menu déroulant */}
                            {menuOpen && (
                                <div className="dropdown-menu">

                                    <div className="dropdown-header">
                                        <p>{utilisateur?.prenom} {utilisateur?.nom}</p>
                                        <span>{utilisateur?.email}</span>
                                    </div>

                                    <button
                                        className="dropdown-item"
                                        onClick={() => {
                                            navigate("/profil");
                                            setMenuOpen(false);
                                        }}
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
                    <button className="nav-btn" onClick={() => navigate("/auth")}>{t("nav.login")}</button>
                )}
                </div>
            </nav>
        </>
    );
}

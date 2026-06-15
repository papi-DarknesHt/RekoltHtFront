import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import logo from "../assets/Images/Asset5.svg";
import "../assets/CSS/NavBar.css";
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
    Bell
} from "lucide-react";
export default function Navbar() {
    const navigate = useNavigate();
    const isConnecte = useAuthStore((s) => s.isConnected);
    const utilisateur = useAuthStore((s) => s.utilisateur);
    const deconnexion = useAuthStore((s) => s.deconnexion);

    const handleDeconnexion = async () => {
        await deconnexion();
        navigate("/");
    };

    return (
        <>
            <nav className="nav">
                {/* Logo cliquable */}
                <div className="nav-logo"><img style={{ width: "50%" }} src={logo} alt="Logo" /></div>

                {/* Liens de navigation */}
                <ul className="nav-links">
                    <li>
                        <Link to="/">Akey</Link>
                    </li>
                    <li><a href="#">Gid</a></li>
                    <li><a href="#">Ed</a></li>
                    <li><Link to="/profil">Voir mon profil</Link></li>
                </ul>

                <div className="profil-navbar__actions">
                    <button className="profil-icon-btn" aria-label="Notifications">
                        <Bell size={20} />
                    </button>
                    <button className="profil-icon-btn" aria-label="Panier">
                        <ShoppingCart size={20} />
                    </button>
                    <button className="profil-avatar-btn" aria-label="Mon compte">
                        <User size={18} />
                    </button>
                </div>

                {isConnecte ? (
                    <>
                        <span className="hero-title">Bonjou, {utilisateur?.prenom}</span>
                        <button className="nav-btn" onClick={handleDeconnexion}>Dekonekte</button>
                    </>
                ) : (
                    <button className="nav-btn" onClick={() => navigate("/auth")}>Konekte</button>
                )}
            </nav>
        </>
    );

   
}

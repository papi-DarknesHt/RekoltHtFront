import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import logo from "../assets/Images/Asset5.svg";         

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
        <nav className="nav">
            {/* Logo cliquable */}
            <div className="nav-logo"><img style={{ width: "50%" }} src={logo} alt="Logo" /></div>

            {/* Liens de navigation */}
            <ul className="nav-links">
                <li><a href="#">Akey</a></li>
                <li><a href="#">Gid</a></li>
                <li><a href="#">Ed</a></li>
            </ul>

            {isConnecte ? (
                <>
                    <span className="hero-title">Bonjou, {utilisateur?.prenom}</span>
                    <button className="nav-btn" onClick={handleDeconnexion}>Dekonekte</button>
                </>
            ) : (
                <button className="nav-btn" onClick={() => navigate("/auth")}>Konekte</button>
            )}
        </nav>
    );
}
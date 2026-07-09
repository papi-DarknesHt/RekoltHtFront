import { Navigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";

export default function RoutePrivee({ children }) {
    const isConnecte = useAuthStore((s) => s.isConnected);

    // redirige vers /auth si non connecté
    if (!isConnecte) return <Navigate to="/auth" replace />;

    return children;
}
import { Navigate } from "react-router-dom";
import { AuthentificationApi } from "../api/auth.js";

export default function RoutePrivee({ children }) {
    const isConnecte = AuthentificationApi((s) => s.isConnecte);

    // redirige vers /auth si non connecté
    if (!isConnecte) return <Navigate to="/auth" replace />;

    return children;
}
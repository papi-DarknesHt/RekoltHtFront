import { Navigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useProfilStore } from "../Profil/ProfilStore.js";

// rolesAutorises (optionnel) : liste de rôles ("admin"/"vendeur"/"acheteur")
// admis sur cette route — ex. <RoutePrivee rolesAutorises={["admin"]}>. Sans
// ce garde, un compte connecté mais du mauvais rôle pouvait quand même
// atteindre une page qui ne le concerne pas simplement en connaissant son URL
// (ex: un acheteur sur /admin/dashboard ou /produits/tableau-de-bord) —
// demande explicite. Défense en profondeur : chaque endpoint backend
// correspondant vérifie déjà le rôle de son côté (voir ex. dashboardAdmin,
// creerProduit, Registration/views.py et Produits/views/produitsViews.py) —
// ce garde-ci évite seulement d'afficher une page cassée/vide côté client,
// il ne remplace jamais le contrôle serveur.
export default function RoutePrivee({ children, rolesAutorises }) {
    const isConnecte = useAuthStore((s) => s.isConnected);
    const profil = useProfilStore((s) => s.profil);

    // redirige vers /auth si non connecté
    if (!isConnecte) return <Navigate to="/auth" replace />;

    // profil pas encore chargé (juste après inscription, avant le premier
    // afficherProfil() de NavBar.jsx) : ne bloque pas sur cette base fragile,
    // le contrôle serveur reste de toute façon la vraie barrière de sécurité
    if (rolesAutorises && profil && !rolesAutorises.includes(profil.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}
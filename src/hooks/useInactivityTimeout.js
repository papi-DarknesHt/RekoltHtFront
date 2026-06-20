import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../Registration/AuthentificationStore";

// Durée d'inactivité avant déconnexion automatique : 30 minutes
const INACTIVITY_MS = 30 * 60 * 1000;

// Événements considérés comme une activité utilisateur
const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart", "pointerdown"];

/**
 * Hook global de déconnexion automatique par inactivité.
 * À utiliser une seule fois dans AppContent (App.jsx) pour couvrir tout le site.
 *
 * Comportement :
 *  - Ne s'active que si l'utilisateur est connecté (isConnected === true)
 *  - Chaque interaction avec la page réinitialise le minuteur de 30 minutes
 *  - Après 30 minutes sans activité : déconnexion + redirection vers "/"
 *  - Nettoie les listeners et le timer si l'utilisateur se déconnecte manuellement
 */
export function useInactivityTimeout() {
  const isConnected = useAuthStore((s) => s.isConnected);
  const deconnexion = useAuthStore((s) => s.deconnexion);
  const navigate    = useNavigate();
  const timerRef    = useRef(null);

  useEffect(() => {
    // Si l'utilisateur n'est pas connecté, on n'installe pas le minuteur
    if (!isConnected) return;

    const reset = () => {
      // Annule le minuteur précédent avant d'en démarrer un nouveau
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        // Délai écoulé sans activité : on déconnecte et on redirige
        await deconnexion().catch(() => {});
        navigate("/");
      }, INACTIVITY_MS);
    };

    // Installe les écouteurs sur chaque type d'événement d'activité
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    // Démarre le minuteur immédiatement à la connexion
    reset();

    // Nettoyage : retire les écouteurs et annule le timer à la déconnexion
    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isConnected]); // Se réexécute uniquement si l'état de connexion change
}

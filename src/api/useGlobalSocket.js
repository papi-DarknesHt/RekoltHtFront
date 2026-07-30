import { useGlobalStore } from "./globalStore.js";
import { useAuthStore } from "../Registration/AuthentificationStore";
import { useEffect } from "react";

// dérivé de VITE_API_URL (même base que src/api/client.js) plutôt que codé en
// dur sur localhost:8000 — sinon la reconnexion temps réel ne fonctionnerait
// jamais en production (ex: rekolthtbackend.onrender.com, https donc wss)
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://rekolthtbackend.onrender.com";
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws/global/";

export function useGlobalSocket() {
  const dispatch     = useGlobalStore((s) => s.dispatch);
  const setConnected = useGlobalStore((s) => s.setConnected);
  // dépendance volontaire : rejoint/quitte le groupe WebSocket personnel
  // "user_<id>" (voir Api/consumers.py) dès que l'état de connexion change,
  // sans attendre un rechargement de page — nécessaire pour la messagerie
  // (Messagerie/signals.py::broadcast_message cible ce groupe précis)
  const isConnected = useAuthStore((s) => s.isConnected);

  useEffect(() => {
    // variables locales à CETTE exécution de l'effet (pas un useRef partagé) :
    // évite qu'un socket fantôme d'un montage précédent (HMR, remount) ne
    // continue à recevoir des évènements après le nettoyage de l'effet.
    // Bug corrigé ici : l'ancien code programmait toujours une reconnexion
    // (setTimeout) dans onclose, y compris lors d'une fermeture volontaire
    // (démontage) — sans annulation au nettoyage, chaque remount/rechargement
    // à chaud finissait par empiler une connexion WebSocket supplémentaire,
    // toutes reliées au même dispatch partagé : un seul évènement diffusé par
    // le backend était alors traité une fois PAR connexion fantôme encore
    // ouverte, faisant sauter les compteurs du dashboard admin de plusieurs
    // unités (constaté : +7) au lieu d'une seule à chaque produit ajouté.
    let arrete = false;
    let socket = null;
    let relanceTimer = null;

    function connect() {
      if (arrete) return;
      const token = localStorage.getItem("token");
      const url = WS_BASE_URL + (token ? `?token=${encodeURIComponent(token)}` : "");
      socket = new WebSocket(url);

      socket.onopen = () => setConnected(true);

      socket.onclose = () => {
        setConnected(false);
        if (!arrete) {
          relanceTimer = setTimeout(connect, 3000);
        }
      };

      socket.onmessage = (event) => {
        try {
          dispatch(JSON.parse(event.data));
        } catch (e) {
          console.error("Invalid WS message", event.data, "error", e);
        }
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      arrete = true;
      if (relanceTimer) clearTimeout(relanceTimer);
      if (socket) {
        socket.onclose = null; // la fermeture volontaire ci-dessous ne doit pas re-déclencher une reconnexion
        socket.close();
      }
    };
  }, [isConnected]);
}

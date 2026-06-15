import { useState, useEffect } from "react";
import { useGlobalStore } from "./api/globalStore.js";
import { api } from "./api/client";

function TestPage() {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const connected         = useGlobalStore((s) => s.connected);

  useEffect(() => {
    api.get("/test/")
      .then(setData)
      .catch(setError);
    // mise à jour toutes les 3 secondes
    const interval = setInterval(() => {
      api.get("/test/").then(setData).catch(setError);
    }, 3000);
    return () => clearInterval(interval); // nettoyage
  }, []);

  return (
    <div>
      <p>WebSocket : {connected ? "connecté" : "déconnecté"}</p>
      <input type="textet" placeholder="Test input" />
      {error && <p>Erreur : {error.message}</p>}

      {data && (
        <div>
          <p>Message : {data.message}</p>
          <p>Statut  : {data.status}</p>
        </div>
      )}
    </div>
  );
}

export default TestPage;
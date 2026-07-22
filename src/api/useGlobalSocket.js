// import useWebSocket from "react-use-websocket";
import { useGlobalStore } from "./globalStore.js";
import { useEffect, useRef } from "react";

// dérivé de VITE_API_URL (même base que src/api/client.js) plutôt que codé en
// dur sur localhost:8000 — sinon la reconnexion temps réel ne fonctionnerait
// jamais en production (ex: rekolthtbackend.onrender.com, https donc wss)
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://rekolthtbackend.onrender.com";
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws/global/";

export function useGlobalSocket() {
  const dispatch     = useGlobalStore((s) => s.dispatch);
  const setConnected = useGlobalStore((s) => s.setConnected);
  const wsRef        = useRef(null);
   useEffect(() => {
   if (wsRef.current) return;
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen    = ()      => setConnected(true);
      ws.onclose   = ()      => {
        setConnected(false);
        setTimeout(connect, 3000);  // reconnexion automatique
      };
      ws.onmessage = (event) =>{
        try{
          dispatch(JSON.parse(event.data));
        }catch(e){
          console.error("Invalid WS message", event.data,"error",e);
        }
      } 
      ws.onerror   = ()      => ws.close();
    }
    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);


  // return useWebSocket(WS_URL, {
  //   onOpen:    ()      => setConnected(true),
  //   onClose:   ()      => setConnected(false),
  //   // onMessage: (event) => dispatch(JSON.parse(event.data)),
  //   onMessage: (event) => {
  //     try {
  //       dispatch(JSON.parse(event.data));
  //     } catch (e) {
  //       console.error("Invalid WS message:", event.data,"error:", e);
  //     }
  //   },
  //   shouldReconnect: () => true,
  //
  //   reconnectInterval: 3000,
  // });

}
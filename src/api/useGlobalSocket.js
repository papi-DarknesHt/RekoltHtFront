// import useWebSocket from "react-use-websocket";
import { useGlobalStore } from "./globalStore.js";
import { useEffect, useRef } from "react";
const WS_URL = "ws://127.0.0.1:8000/ws/global/";

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
      ws.onmessage = (event) => dispatch(JSON.parse(event.data));
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
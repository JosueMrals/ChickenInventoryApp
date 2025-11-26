import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { SessionManager } from "../utils/SessionManager";

export default function useSessionTimeout(onSessionExpired) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      // App pasó a background o inactive → guardar hora
      if (nextState.match(/inactive|background/)) {
        await SessionManager.updateActivity();
      }

      // App vuelve a foreground
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        const expired = await SessionManager.hasSessionExpired();

        if (expired) {
          await SessionManager.clear();
          onSessionExpired(); // Cerrar sesión y reenviar al login
        }reportsService.js
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);
}

import { registerSW } from "virtual:pwa-register";

export default function initializeServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.unregister())
      .catch(() => {
        // Development still works when registration access is unavailable.
      });
    return;
  }

  registerSW({ immediate: true });
}

import { registerSW } from "virtual:pwa-register";

export default function initializeServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistration()
      .then(function removeStaleWorker(registration) {
        return registration?.unregister();
      })
      .catch(function ignoreUnavailableRegistration() {
        // Development still works when browser policy prevents registration access.
      });
    return;
  }

  registerSW({ immediate: true });
}

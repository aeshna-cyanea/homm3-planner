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

  const register = () => registerSW({ immediate: true });
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => {
          if ("caches" in window) {
            return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
          }

          return null;
        })
        .catch(() => {
          // noop - development cleanup should never block the app
        });

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // noop - SW is an enhancement only
    });
  }, []);

  return null;
}

"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let isRefreshing = false;

    const onControllerChange = () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdateBanner(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setShowUpdateBanner(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA Service Worker] Falha ao registrar:", err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
    setShowUpdateBanner(false);
  };

  if (!showUpdateBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-full bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
      <span className="w-2 h-2 rounded-full bg-kitsune animate-pulse" />
      <span className="text-xs font-sans font-medium text-zinc-200">
        Nova versão disponível.
      </span>
      <button
        onClick={handleUpdate}
        className="px-3 py-1 rounded-full bg-kitsune hover:bg-kitsune/90 text-white text-xs font-sans font-bold transition-colors cursor-pointer"
      >
        Atualizar
      </button>
    </div>
  );
}

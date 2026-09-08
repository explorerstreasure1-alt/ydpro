"use client";
import { useEffect, useState } from "react";

export function PWAInstall() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    // @ts-ignore
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    // zaten standalone ise gizle
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || (!deferred && !isIOS)) return null;

  const onInstall = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[92%] max-w-sm -translate-x-1/2 animate-pop">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
        <img src="/logo.svg" alt="7DİL" className="h-10 w-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white">Telefona Yükle 📲</div>
          <div className="text-[11px] text-slate-400 truncate">
            {isIOS ? "Safari → Paylaş → Ana Ekrana Ekle" : "Uygulama olarak kaydet, offline çalış"}
          </div>
        </div>
        {!isIOS && deferred && (
          <button onClick={onInstall} className="gold-btn rounded-xl px-3 py-2 text-xs font-black shrink-0">
            Yükle
          </button>
        )}
      </div>
    </div>
  );
}

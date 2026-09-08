"use client";
import { useEffect, useState } from "react";

export function PWAInstall() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("7dil-pwa-dismissed") === "1") setDismissed(true);
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      (window as any)._deferredPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); localStorage.setItem("7dil-pwa-dismissed","1"); });
    // @ts-ignore
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    // iOS'ta veya deferred yoksa da banner gösterilsin — ikon eksik olmasın
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => { setDismissed(true); localStorage.setItem("7dil-pwa-dismissed","1"); };

  if (dismissed || installed) return null;

  const onInstall = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else {
      // Fallback: manuel yönerge göster
      alert(isIOS ? "Safari'de Paylaş → Ana Ekrana Ekle'ye dokunun" : "Chrome menü → Uygulamayı yükle / Ana ekrana ekle");
    }
  };

  return (
    <>
      {/* Kalıcı indirme butonu — mobilde her zaman görünür */}
      <button
        onClick={onInstall}
        className="fixed bottom-[88px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd52f] to-[#ffb020] text-xl shadow-[0_8px_24px_rgba(255,211,47,0.45)] active:scale-95 touch-manipulation select-none md:hidden"
        aria-label="Telefona Yükle"
        title="Telefona Yükle"
      >
        ⬇️
      </button>
      <div className="fixed bottom-[88px] left-1/2 z-30 w-[92%] max-w-sm -translate-x-1/2 animate-pop pointer-events-none hidden md:block">
        <div className="glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5 pointer-events-auto shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          <img src="/logo.svg" alt="7DİL" className="h-9 w-9 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-white leading-none">Telefona Yükle 📲</div>
            <div className="text-[11px] text-slate-400 truncate leading-none mt-0.5">
              {isIOS ? "Paylaş → Ana Ekrana Ekle" : "Uygulama olarak kaydet — 1 dokunuş"}
            </div>
          </div>
          <button onClick={dismiss} className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white active:scale-95 touch-manipulation" aria-label="Kapat">✕</button>
          <button onClick={onInstall} className="gold-btn rounded-xl px-3 py-2 text-xs font-black shrink-0 min-h-[36px] touch-manipulation active:scale-95">
            Yükle ⬇️
          </button>
        </div>
      </div>
      {/* Mobilde her zaman görünür küçük banner — ikon eksik olmasın */}
      <div className="fixed bottom-[88px] left-1/2 z-30 w-[92%] max-w-sm -translate-x-1/2 animate-pop pointer-events-none md:hidden">
        <div className="glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5 pointer-events-auto shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          <img src="/icons/icon-192.png" alt="7DİL" className="h-9 w-9 rounded-xl shrink-0 bg-[#03111d]" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-white leading-none">7DİL'i Yükle</div>
            <div className="text-[11px] text-slate-400 leading-none mt-0.5">Ana ekrana ekle, offline çalış</div>
          </div>
          <button onClick={dismiss} className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-white/5 text-slate-400 active:scale-95" aria-label="Kapat">✕</button>
          <button onClick={onInstall} className="gold-btn rounded-xl px-3 py-2 text-xs font-black shrink-0 min-h-[40px] touch-manipulation active:scale-95">
            ⬇️ Yükle
          </button>
        </div>
      </div>
    </>
  );
}

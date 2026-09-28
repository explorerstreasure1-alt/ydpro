"use client";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import type { Tab } from "@/components/nav";
import { IMG } from "@/lib/img";
import { LevelPill } from "@/lib/ui";
import { useLangPair } from "@/lib/useLangPair";
import { PWAInstall } from "@/components/pwa-install";

export function Home({
  gotoTab,
  goLessons,
}: {
  gotoTab: (t: Tab) => void;
  goLessons: () => void;
}) {
  const store = useStore() as any;
  const { user } = store as { user: any };
  const { nativeDef, targetDef } = useLangPair();

  return (
    <>
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url('${IMG.cityBgWide}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/60 via-[#03111d]/55 to-[#03111d] pointer-events-none" />

        <div className="relative z-10 flex flex-1 flex-col px-4 pt-5">
          {/* top — parmakla rahat tıklama + indirme ikonu */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => gotoTab("profile")}
              className="glass flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold text-cyan-100 min-h-[44px] active:scale-[0.98] touch-manipulation select-none"
            >
              {user?.name || "Yolcu"} · {nativeDef.flag}→{targetDef.flag} {targetDef.name}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // @ts-ignore
                  const ev = (window as any)._deferredPrompt;
                  if (ev) ev.prompt();
                  else alert("Chrome: Menü → Uygulamayı yükle\nSafari: Paylaş → Ana Ekrana Ekle");
                }}
                className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base min-h-[44px] min-w-[44px] active:scale-95 touch-manipulation select-none bg-gradient-to-br from-[#ffd52f]/20 to-[#ffb020]/10 border-[#ffd52f]/30"
                aria-label="Telefona Yükle"
                title="Telefona Yükle"
              >
                ⬇️
              </button>
              <button onClick={() => gotoTab("profile")} className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl min-h-[44px] min-w-[44px] active:scale-95 touch-manipulation select-none" aria-label="Profil">
                👤
              </button>
            </div>
          </div>

          {/* brand */}
          <div className="mt-6 text-center">
            <h1 className="text-[2.9rem] font-black leading-none tracking-tight">
              7<span className="text-[#ffd52f]">DİL</span>
              <span className="align-top text-xl">✈️</span>
            </h1>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-200">
              Seviyeni seç, konunu seç. <span className="text-[#00bfff]">Konuşarak öğren.</span>
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
              <LevelPill lvl={user?.level || 1} name={user?.levelName || "Yeni Yolcu"} />
            </div>
          </div>

          <div className="mt-5 space-y-3 overflow-y-auto pb-40 scroll-smooth">
            {/* AI Curriculum card — geniş dokunma alanı */}
            <button
              onClick={goLessons}
              className="glass group flex w-full items-center gap-3 rounded-3xl p-4 text-left transition hover:border-cyan-300/50 active:scale-[0.99] min-h-[72px] touch-manipulation select-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-2xl ring-1 ring-cyan-300/30">
                📚
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">Seviyeler · A1 – C2</div>
                <div className="truncate text-[11px] text-slate-400">14 dil · 18 konu · Her dil çiftinde AI</div>
              </div>
              <span className="text-cyan-300 text-lg">›</span>
            </button>

            {/* Diyalog Stüdyosu — ayrı bölüm: konu+seviye, 6-10 satır, kayıtlı liste */}
            <button
              onClick={() => gotoTab("dialogue")}
              className="glass group flex w-full items-center gap-3 rounded-3xl p-4 text-left transition hover:border-[#ffd52f]/50 active:scale-[0.99] min-h-[72px] touch-manipulation select-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00bfff]/20 to-[#0080ff]/10 text-2xl ring-1 ring-cyan-300/30">
                💬
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">Diyalog Stüdyosu</div>
                <div className="truncate text-[11px] text-slate-400">Konunu yaz · 6-10 satır · Kaydet, dille filtrele</div>
              </div>
              <span className="text-cyan-300 text-lg">›</span>
            </button>
          </div>
        </div>

        <PWAInstall />
        <div className="relative z-10 mt-auto">
          <BottomNav active="home" onChange={gotoTab} />
        </div>
      </div>
    </>
  );
}

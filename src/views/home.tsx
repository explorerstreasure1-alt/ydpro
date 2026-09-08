"use client";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import type { Tab } from "@/components/nav";
import { IMG } from "@/lib/img";
import { daysMeta } from "@/lib/meta";
import { LevelPill } from "@/lib/ui";
import { LANGS } from "@/lib/levels";
import { PWAInstall } from "@/components/pwa-install";

export function Home({
  gotoTab,
  goMission,
  goLessons,
}: {
  gotoTab: (t: Tab) => void;
  goMission: (d: number) => void;
  goLessons: () => void;
}) {
  const store = useStore() as any;
  const { user, scenes } = store as { user: any; scenes: any[] };
  const nativeLang = (store.nativeLang as string) || "tr";
  const targetLang = (store.targetLang as string) || "en";
  const nativeDef = LANGS.find(l=>l.code===nativeLang) || LANGS[12];
  const targetDef = LANGS.find(l=>l.code===targetLang) || LANGS[0];
  const open = scenes.find((s) => s.status === "open");
  const doneCount = scenes.filter((s) => s.status === "done").length;
  const order = scenes.slice().sort((a, b) => a.day - b.day);

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
              7 Günde Dil Öğren. <span className="text-[#00bfff]">8. Günde Konuş.</span>
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
              <LevelPill lvl={user?.level || 1} name={user?.levelName || "Yeni Yolcu"} />
            </div>
          </div>

          <div className="mt-5 space-y-3 overflow-y-auto pb-40 scroll-smooth">
            {/* Today's mission hero */}
            <div className="glass relative overflow-hidden rounded-3xl p-0.5">
              <div className="rounded-2xl bg-gradient-to-br from-[#0b2940] to-[#092235] p-4">
                {open ? (
                  <>
                    <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-[#ffd52f]">
                      🎯 Bugünün Görevi
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="glass flex h-14 w-14 items-center justify-center rounded-2xl text-3xl">
                        {open.emoji}
                      </div>
                      <div>
                        <div className="text-lg font-black">{open.day}. Gün · {open.title}</div>
                        <div className="text-xs text-slate-300">{open.location}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-300">“{open.description}”</div>
                    <div className="mt-2 inline-flex rounded-full bg-[#ffd52f]/15 px-2.5 py-1 text-xs font-bold text-[#ffd52f]">
                      ⭐ +{open.xpReward} XP ödül
                    </div>
                    <button
                      onClick={() => goMission(open.day)}
                      className="gold-btn mt-3 w-full rounded-2xl py-4 text-base min-h-[52px] active:scale-[0.98] touch-manipulation select-none shadow-[0_0_20px_rgba(255,211,47,0.25)]"
                    >
                      GÖREVE BAŞLA →
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🏆</div>
                    <div>
                      <div className="text-lg font-black">Macera bitti — Sahne senin!</div>
                      <div className="text-xs text-slate-300">Gerçek Hayat Moduna geç ve konuş.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Curriculum card — geniş dokunma alanı */}
            <button
              onClick={goLessons}
              className="glass group flex w-full items-center gap-3 rounded-3xl p-4 text-left transition hover:border-cyan-300/50 active:scale-[0.99] min-h-[72px] touch-manipulation select-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-2xl ring-1 ring-cyan-300/30">
                📚
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">Seviyeler · A1 – C1</div>
                <div className="truncate text-[11px] text-slate-400">14 dil · 18 konu · Her dil çiftinde AI</div>
              </div>
              <span className="text-cyan-300 text-lg">›</span>
            </button>

            {/* Adventure list — 10 günlük kapsamlı A1-C1 */}
            <div className="glass rounded-3xl p-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-black">🗺️ Macera Haritası — A1 → C1</h2>
                <span className="text-[11px] text-slate-400">{doneCount}/{order.length}</span>
              </div>
              <div className="mt-1 flex gap-1">
                {["A1","A2","B1","B2","C1"].map(l=>(
                  <span key={l} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${l==="A1"?"bg-emerald-500/20 text-emerald-300":l==="A2"?"bg-cyan-500/20 text-cyan-300":l==="B1"?"bg-amber-500/20 text-amber-300":l==="B2"?"bg-violet-500/20 text-violet-300":"bg-rose-500/20 text-rose-300"}`}>{l}</span>
                ))}
                <span className="ml-auto text-[9px] text-slate-500">{order.length} sahne • 14 dil</span>
              </div>
              <div className="mt-2 space-y-2">
                {order.map((s) => {
                  const metaL = daysMeta[s.day - 1];
                  const isDone = s.status === "done";
                  const locked = s.status === "locked";
                  return (
                    <button
                      key={s.id}
                      disabled={locked}
                      onClick={() => goMission(s.day)}
                      className="glass group flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition disabled:opacity-70 min-h-[64px] active:scale-[0.99] touch-manipulation select-none disabled:pointer-events-none"
                      style={{
                        borderColor: isDone ? "rgba(22,199,132,0.4)" : isDone ? "" : "",
                      }}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${
                          isDone ? "bg-emerald-500/15" : locked ? "bg-white/5 opacity-60" : "bg-cyan-400/10"
                        }`}
                      >
                        {locked ? "🔒" : metaL?.emoji}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-bold">
                          {s.day}. Gün · {metaL?.label}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">{s.short}</div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <div className="text-[11px] font-bold text-[#ffd52f]">+{s.xpReward}</div>
                        <div className="text-[9px] text-slate-500">XP</div>
                      </div>
                      {isDone && <span className="text-emerald-400 text-lg shrink-0">✓</span>}
                      {!locked && !isDone && <span className="text-slate-400 text-lg shrink-0">›</span>}
                    </button>
                  );
                })}
              </div>
            </div>
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

"use client";
import { ReactNode, useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";

import { Splash } from "@/views/Splash";
import { Onboarding } from "@/views/Onboarding";
import { Home } from "@/views/home";
import { Mission } from "@/views/mission";
import { Memory } from "@/views/memory";
import { RealLife } from "@/views/realife";
import { Progress } from "@/views/progressview";
import { Profile } from "@/views/profile";
import { Lessons } from "@/views/lessons";

export type Tab =
  | "home"
  | "talk"
  | "memory"
  | "progress"
  | "profile";
export type Route =
  | { t: "app"; tab: Tab }
  | { t: "mission"; day: number }
  | { t: "lessons" }
  | { t: "completion" }
  | { t: "splash" }
  | { t: "onboard" };

function Shell() {
  const [route, setRoute] = useState<Route>({ t: "splash" });
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const store = useStore();

  useEffect(() => {
    const splash = setTimeout(() => {
      const done = localStorage.getItem("yzed_onboarded") === "1";
      setOnboarding(!done);
    }, 1600);
    return () => clearTimeout(splash);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (route.t === "splash" && onboarding !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoute(onboarding ? { t: "onboard" } : { t: "app", tab: "home" });
    }
  }, [onboarding, route.t]);

  const gotoTab = (tab: Tab) => setRoute({ t: "app", tab });

  function render() {
    switch (route.t) {
      case "splash":
        return <Splash />;
      case "onboard":
        return (
          <Onboarding
            onDone={() => {
              localStorage.setItem("yzed_onboarded", "1");
              setOnboarding(false);
              setRoute({ t: "app", tab: "home" });
            }}
          />
        );
      case "app":
        return <Tabbed tab={route.tab} navigate={gotoTab} openMission={(d) => setRoute({ t: "mission", day: d })} openLessons={() => setRoute({ t: "lessons" })} />;
      case "lessons":
        return <Lessons back={() => setRoute({ t: "app", tab: "home" })} />;
      case "mission":
        return (
          <Mission
            day={route.day}
            back={() => setRoute({ t: "app", tab: "home" })}
            onComplete={(d) => {
              store.reload().catch(() => {});
              if (d === 7) setRoute({ t: "completion" });
              else setRoute({ t: "app", tab: "home" });
            }}
          />
        );
      case "completion":
        return (
          <Completion
            onStart={() => gotoTab("talk")}
            onHome={() => gotoTab("home")}
            onAgain={() => setRoute({ t: "app", tab: "home" })}
          />
        );
      default:
        return <Splash />;
    }
  }

  return (
    <div className="relative min-h-dvh">
      {render()}
      {store.xpFlash > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 animate-xp text-2xl font-black text-[#ffd52f] drop-shadow-[0_0_10px_rgba(255,211,47,0.7)]">
          +{store.xpFlash} XP
        </div>
      )}
      {store.levelUp && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#03111d]/60 backdrop-blur-sm">
          <div className="glass animate-pop glow-gold mx-6 rounded-3xl px-8 py-7 text-center">
            <div className="animate-floaty text-5xl">✨</div>
            <div className="mt-2 text-xs font-black uppercase tracking-[0.3em] text-[#00bfff]">Seviye Atladın!</div>
            <div className="mt-1 text-4xl font-black text-[#ffd52f]">Seviye {store.levelUp}</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {["Yeni Yolcu", "Meraklı Turist", "Sokak Dilcisi", "Şehir Gezgini", "Konuşma Ustası", "Dünya Vatandaşı"][store.levelUp - 1] || ""}
            </div>
          </div>
        </div>
      )}
      {store.toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-pop">
          <div className="glass glow-gold whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-bold">{store.toast}</div>
        </div>
      )}
    </div>
  );
}

function Tabbed({
  tab,
  navigate,
  openMission,
  openLessons,
}: {
  tab: Tab;
  navigate: (t: Tab) => void;
  openMission: (d: number) => void;
  openLessons: () => void;
}) {
  if (tab === "home")
    return <Home gotoTab={navigate} goMission={openMission} goLessons={openLessons} />;
  if (tab === "memory")
    return <Memory goStart={(d) => openMission(d)} />;
  if (tab === "talk")
    return <RealLife back={() => navigate("home")} />;
  if (tab === "progress") return <Progress goHome={() => navigate("home")} />;
  if (tab === "profile") return <Profile goProgress={() => navigate("progress")} goHome={() => navigate("home")} />;
  return <Home gotoTab={navigate} goMission={openMission} goLessons={openLessons} />;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">{children}</div>
  );
}

export function Completion({
  onStart,
  onHome,
  onAgain,
}: {
  onStart: () => void;
  onHome: () => void;
  onAgain: () => void;
}) {
  const store = useStore();
  return (
    <Screen>
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-8">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.pexels.com/photos/15156234/pexels-photo-15156234.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=900')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] via-[#061827]/60 to-[#03111d]" />
        <div className="glass animate-pop relative z-10 flex w-full flex-col items-center rounded-3xl p-6 text-center">
          <div className="text-6xl drop-shadow-[0_0_20px_rgba(255,211,47,0.4)]">🏆</div>
          <h1 className="mt-2 text-3xl font-black text-grad">Tebrikler!</h1>
          <p className="mt-1 text-white/75">7 günlük maceranı tamamladın!</p>
          <div className="mt-4 w-full space-y-2 text-left">
            {[
              `${store.user?.wordsLearned || 347} kelime öğrendin`,
              `${store.user?.patterns || 68} konuşma kalıbı kazandın`,
              `${store.user?.missionsDone || 43} görevi tamamladın`,
              "Artık temel seviyede İngilizce konuşabiliyorsun!",
            ].map((t) => (
              <div key={t} className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16c784] text-[11px] font-black text-[#03111d]">✓</span>
                {t}
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-[#00bfff]">ARTIK SAHNE SENİN.</div>
          <button onClick={onStart} className="gold-btn mt-4 w-full rounded-2xl py-4 text-lg">
            Şimdi Gerçek Hayat Modu →
          </button>
          <button onClick={onAgain} className="ghost-btn mt-3 w-full rounded-2xl py-3 text-sm text-cyan-100">
            ↺ Macerayı tekrar oyna
          </button>
          <p className="mt-3 text-xs italic text-slate-400">“Artık Londra’ya yalnız değilsin.”</p>
          <button onClick={onHome} className="mt-2 text-xs text-slate-500 hover:text-slate-300">Ana ekrana dön</button>
        </div>
      </div>
    </Screen>
  );
}

export default function Root() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

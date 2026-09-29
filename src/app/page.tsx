"use client";
import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";

import { Splash } from "@/views/Splash";
import { LockScreen } from "@/views/lock";
import { Onboarding } from "@/views/Onboarding";
import { Home } from "@/views/home";
import { RealLife } from "@/views/realife";
import { Progress } from "@/views/progressview";
import { Profile } from "@/views/profile";
import { Lessons } from "@/views/lessons";
import { LangSettingsView } from "@/views/langSettings";
import { Dialogue } from "@/views/dialogue";

export type Tab =
  | "home"
  | "talk"
  | "dialogue"
  | "progress"
  | "profile";
export type Route =
  | { t: "app"; tab: Tab }
  | { t: "lessons" }
  | { t: "langSettings" }
  | { t: "splash" }
  | { t: "onboard" };

function Shell() {
  const [route, setRoute] = useState<Route>({ t: "splash" });
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const [locked, setLocked] = useState<boolean | null>(null);
  const store = useStore();

  // Ana giriş kilidi — sunucu çerezi sorulur, şüphede kapalı (fail-closed)
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((j) => setLocked(!j?.unlocked))
      .catch(() => setLocked(true));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("skipSplash")) {
      setOnboarding(false);
      return;
    }
    const splash = setTimeout(() => {
      const done = localStorage.getItem("yzed_onboarded") === "1";
      setOnboarding(!done);
    }, 400);
    return () => clearTimeout(splash);
  }, []);

  useEffect(() => {
    if (route.t === "splash" && onboarding !== null) {
      setRoute(onboarding ? { t: "onboard" } : { t: "app", tab: "home" });
    }
  }, [onboarding, route.t]);

  const gotoTab = (tab: Tab) => setRoute({ t: "app", tab });
  const goLangSettings = () => setRoute({ t: "langSettings" } as any);

  function render() {
    if (locked === null) return <Splash />;
    if (locked)
      return (
        <LockScreen
          onUnlock={() => {
            setLocked(false);
            import("@/lib/eleven").then((m) => m.refreshEleven().catch(() => {}));
          }}
        />
      );
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
        return <Tabbed tab={route.tab} navigate={gotoTab} openLessons={() => setRoute({ t: "lessons" })} goLangSettings={goLangSettings} />;
      case "langSettings":
        return <LangSettingsView back={() => setRoute({ t: "app", tab: "profile" })} />;
      case "lessons":
        return <Lessons back={() => setRoute({ t: "app", tab: "home" })} />;
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
  openLessons,
  goLangSettings,
}: {
  tab: Tab;
  navigate: (t: Tab) => void;
  openLessons: () => void;
  goLangSettings: () => void;
}) {
  if (tab === "home")
    return <Home gotoTab={navigate} goLessons={openLessons} />;
  if (tab === "dialogue")
    return <Dialogue back={() => navigate("home")} />;
  if (tab === "talk")
    return <RealLife back={() => navigate("home")} gotoTab={navigate} />;
  if (tab === "progress") return <Progress goHome={() => navigate("home")} gotoTab={navigate} />;
  if (tab === "profile") return <Profile goProgress={() => navigate("progress")} goHome={() => navigate("home")} goLangSettings={goLangSettings} gotoTab={navigate} />;
  return <Home gotoTab={navigate} goLessons={openLessons} />;
}

export default function Root() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

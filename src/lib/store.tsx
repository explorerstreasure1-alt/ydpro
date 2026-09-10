"use client";
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { ACHIEVEMENT_DEFS } from "@/lib/content";
import { sfx, isMuted, setMuted } from "@/lib/sfx";

export type UserState = {
  id: number;
  name: string;
  language: string;
  xp: number;
  level: number;
  levelName: string;
  levelMin: number;
  nextMin: number;
  streak: number;
  goal: string;
  dailyMinutes: string;
  wordsLearned: number;
  patterns: number;
  missionsDone: number;
  sentences: number;
  talkMinutes: number;
  pronunciation: number;
};

export type SceneState = {
  id: number;
  day: number;
  title: string;
  emoji: string;
  short: string;
  location: string;
  description: string;
  xpReward: number;
  status: "locked" | "open" | "done";
  plays: number;
};

type State = {
  user: UserState | null;
  scenes: SceneState[];
  unlockedAchievements: string[];
  todayMission?: SceneState;
  loaded: boolean;
  reload: () => Promise<void>;
  post: (body: any) => Promise<any>;
  addXpFlash: (n: number) => void;
  xpFlash: number;
  toast: string | null;
  setToast: (t: string | null) => void;
  levelUp: number | null;
  muted: boolean;
  toggleMute: () => void;
  nativeLang: string;
  targetLang: string;
  setNativeLang: (code: string) => void;
  setTargetLang: (code: string) => void;
};

const Ctx = createContext<State | null>(null);

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  return r.json();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State["user"]>(null);
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const [unlockedAchievements, setUnlocked] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [xpFlash, setXpFlash] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [nativeLang, setNativeLangState] = useState<string>(() => {
    try { return localStorage.getItem("yzed_native") || "tr"; } catch { return "tr"; }
  });
  const [targetLang, setTargetLangState] = useState<string>(() => {
    try { return localStorage.getItem("yzed_target") || "en"; } catch { return "en"; }
  });
  const timer = useRef<any>(null);
  const toastTimer = useRef<any>(null);
  const lastLevel = useRef<number>(0);
  const lastUnlocked = useRef<Set<string>>(new Set());
  const init = useRef(false);

  // Demo modda (DB yok) sunucu XP biriktirmez — istemcide localStorage'ta biriktir ki
  // seviye ilerlemesi (A1→A2→B1...) çalışsın. DB modunda sunucu gerçeği söyler, bonus 0.
  const getDemoBonus = useCallback(() => {
    try { return Number(localStorage.getItem("yzed_demo_xp") || 0) || 0; } catch { return 0; }
  }, []);

  const reload = useCallback(async () => {
    const data = await fetchJSON("/api/state");
    if (data?.demo && data.user) {
      data.user = { ...data.user, xp: (data.user.xp || 0) + getDemoBonus() };
    }
    setState(data.user);
    setScenes(data.scenes);

    const keys = data.unlockedAchievements || [];
    setUnlocked(keys);

    if (init.current) {
      // new achievements
      const fresh = keys.filter((k: string) => !lastUnlocked.current.has(k));
      if (fresh.length) {
        const first = (ACHIEVEMENT_DEFS as any)[fresh[0]];
        if (first) {
          sfx.achievement();
          setToast(`🏅 Rozet: ${first.title}`);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 2600);
        }
      }
      // level up
      if (lastLevel.current && data.user.level > lastLevel.current) {
        setLevelUp(data.user.level);
        sfx.levelup();
        setTimeout(() => setLevelUp(null), 2800);
      }
    }
    lastLevel.current = data.user.level;
    lastUnlocked.current = new Set(keys);
    init.current = true;
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addXpFlash = useCallback((n: number) => {
    setXpFlash(n);
    sfx.xp();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setXpFlash(0), 1600);
  }, []);

  const post = useCallback(async (body: any) => {
    const r = await fetchJSON("/api/action", { method: "POST", body: JSON.stringify(body) });
    // Demo cevabındaki kazancı yerel bonusa ekle (seviye ilerlesin)
    try {
      if (r?.demo && typeof r.gain === "number" && r.gain > 0) {
        const cur = Number(localStorage.getItem("yzed_demo_xp") || 0) || 0;
        localStorage.setItem("yzed_demo_xp", String(cur + r.gain));
      }
    } catch {}
    reload();
    return r;
  }, [reload]);

  const toggleMute = useCallback(() => {
    setMuted(!isMuted());
    setMutedState(isMuted());
    if (!isMuted()) sfx.click();
  }, []);

  const setNativeLang = useCallback((code: string) => {
    try { localStorage.setItem("yzed_native", code); } catch {}
    setNativeLangState(code);
  }, []);
  const setTargetLang = useCallback((code: string) => {
    try { localStorage.setItem("yzed_target", code); } catch {}
    setTargetLangState(code);
  }, []);

  const value: State = {
    user: state,
    scenes,
    unlockedAchievements,
    loaded,
    reload,
    post,
    addXpFlash,
    xpFlash,
    toast,
    setToast,
    levelUp,
    muted,
    toggleMute,
    nativeLang,
    targetLang,
    setNativeLang,
    setTargetLang,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

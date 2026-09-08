"use client";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import { LevelPill, Stat } from "@/lib/ui";
import { ACHIEVEMENT_DEFS } from "@/lib/content";

export function Progress({ goHome }: { goHome: () => void }) {
  const store = useStore();
  const u = store.user;

  if (!u) return <div className="p-10 text-center text-slate-400">Yükleniyor...</div>;

  const progressPct = Math.min(100, ((u.xp - u.levelMin) / (u.nextMin - u.levelMin || 1)) * 100);

  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-grad">📊 İlerleme</h2>
              <p className="text-xs text-slate-400">Oyunlaştırılmış seviye ve istatistiklerin</p>
            </div>
            <div className="glass rounded-2xl px-3 py-2 text-center">
              <LevelPill lvl={u.level} name={u.levelName} />
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ffd52f] to-[#ffb020] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{u.xp} XP</span>
            <span>🔥 {u.streak} gün seri</span>
            <span>{u.nextMin} XP</span>
          </div>
        </div>

        {/* stat cards */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat emoji="🧠" value={u.wordsLearned} label="Kelime" />
          <Stat emoji="💬" value={u.patterns || u.sentences * 0} label="Ses Bilgisi" />
          <Stat emoji="🎯" value={u.missionsDone} label="Görev" />
          <Stat emoji="📝" value={u.sentences} label="Cümle" />
          <Stat emoji="⏱️" value={`${u.talkMinutes} dk`} label="Konuşma" />
          <Stat emoji="🎙️" value={`%${u.pronunciation}`} label="Telaffuz" />
        </div>

        <div className="glass mt-3 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-grad">🏅 Başarı Rozetleri</h3>
          <div className="mt-3 grid grid-cols-5 gap-3">
            {Object.entries(ACHIEVEMENT_DEFS).map(([key, a]) => {
              const got = store.unlockedAchievements.includes(key);
              return (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                      got
                        ? "glass glow-cyan ring-1 ring-cyan-300/40"
                        : "border border-white/5 bg-white/5 opacity-40 grayscale"
                    }`}
                  >
                    {a.icon}
                  </div>
                  <span className="text-center text-[9px] leading-tight text-slate-400">{a.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={goHome} className="ghost-btn mt-4 w-full rounded-2xl py-3 text-sm text-cyan-100">
          ‹ Ana ekrana dön
        </button>
      </div>
      <BottomNav active="progress" onChange={() => {}} />
    </>
  );
}

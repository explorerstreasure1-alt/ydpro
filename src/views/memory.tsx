"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import { DAYS } from "@/lib/content";

export function Memory({ goStart }: { goStart: (d: number) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const store = useStore();
  const doneDays = store.scenes.filter((s) => s.status === "done").map((s) => s.day);
  if (active !== null) return <Deck dayIndex={active} onBack={() => setActive(null)} />;

  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
        <div className="glass p-4">
          <h2 className="text-xl font-black text-grad">🧠 Görsel Hafıza</h2>
          <p className="text-xs text-slate-400">Tamamladığın günlerin kelime kartları — hikâyeyle hatırla.</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {DAYS.map((d, i) => {
            const done = doneDays.includes(d.day);
            return (
              <button
                key={d.day}
                disabled={!done}
                onClick={() => setActive(i)}
                className="glass flex w-full items-center gap-3 rounded-2xl p-3 transition disabled:opacity-60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-2xl ring-1 ring-cyan-300/20">
                  {done ? d.emoji : "🔒"}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-bold">{d.day}. Gün · {d.title}</div>
                  <div className="text-[11px] text-slate-400">{d.vocabulary.length} kelime kartı</div>
                </div>
                {done && <span className="text-cyan-300">▶</span>}
              </button>
            );
          })}
        </div>
        <div className="glass mt-4 rounded-2xl p-3 text-center text-xs text-slate-300">
          💡 Her kelime, sahnede görsel bir hikâyeye bağlanır.
        </div>
      </div>
      <BottomNav active="memory" onChange={() => {}} />
    </>
  );
}

function Deck({ dayIndex, onBack }: { dayIndex: number; onBack: () => void }) {
  const day = DAYS[dayIndex];
  const vocab = day.vocabulary;
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"card" | "test" | "ok">("card");
  const store = useStore();
  const w = vocab[Math.min(i, vocab.length - 1)];
  const done = i >= vocab.length;

  const distractors = () => {
    const others = DAYS.flatMap((d) => d.vocabulary).filter((v) => v.word !== w.word).map((v) => v.translation);
    const uniq = Array.from(new Set(others)).slice(0, 3);
    return uniq;
  };

  async function finish() {
    await store.post({ type: "learn-words", gainedXp: 10 * vocab.length, words: vocab.length });
    store.addXpFlash(10 * vocab.length);
    onBack();
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
        <div className="glass flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center">
          <div className="text-6xl">🧠</div>
          <h3 className="mt-2 text-2xl font-black text-grad">Destesi Bitti!</h3>
          <p className="mt-1 text-sm text-slate-300">{day.emoji} {day.title} kelime kartlarını pekiştirdin.</p>
          <button onClick={finish} className="gold-btn mt-6 w-full rounded-2xl py-4 text-base">Tamamla ✓</button>
          <button onClick={onBack} className="ghost-btn mt-3 w-full rounded-2xl py-3 text-sm">Ana listeye dön</button>
        </div>
      </div>
    );
  }

  const options = phase === "test" ? [
    { text: w.translation, emoji: w.emoji, ok: true },
    ...distractors().map((t, k) => ({ text: t, emoji: ["🍎", "🍌", "☕", "🚗", "📚"][k % 5], ok: false })),
  ] : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="glass h-10 w-10 rounded-full">←</button>
        <span className="text-sm font-black text-[#ffd52f]">🧠 {day.title} · Hafıza</span>
        <span className="text-xs text-slate-400">{Math.min(i + 1, vocab.length)}/{vocab.length}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ffd52f] to-[#00bfff]" style={{ width: `${((i) / vocab.length) * 100}%` }} />
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {phase === "card" && (
          <div className="glass flex flex-1 flex-col items-center rounded-3xl p-5 text-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-7xl ring-1 ring-cyan-300/30">
              {w.emoji}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.3em] text-slate-400">Görsel bağlantı · {w.visual}</div>
            <h2 className="mt-1 text-4xl font-black tracking-tight text-white">{w.word.toUpperCase()}</h2>
            <div className="mt-1 text-sm text-cyan-300">{w.pronunciation}</div>
            <div className="text-base font-semibold text-slate-200">({w.translation})</div>
            {/* yellow memory band */}
            <div className="mt-4 w-full rounded-2xl bg-[#ffd52f]/15 px-3 py-2.5 ring-1 ring-[#ffd52f]/40">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#ffd52f]">Hafıza hikâyesi</div>
              <p className="mt-0.5 text-xs text-white">{w.story}</p>
            </div>
            <button onClick={() => setPhase("test")} className="gold-btn mt-5 w-full rounded-2xl py-3.5 text-base">Devam Et →</button>
          </div>
        )}

        {phase === "test" && (
          <div className="glass flex flex-1 flex-col items-center justify-center rounded-3xl p-5">
            <p className="text-center text-sm text-white">“{w.word}” <span className="text-slate-400">ne demek?</span></p>
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              {options.map((o) => (
                <button
                  key={o.text}
                  onClick={async () => {
                    if (o.ok) {
                      setPhase("ok");
                      store.post({ type: "learn-words", gainedXp: 10, words: 0 });
                      store.addXpFlash(10);
                    } else {
                      setPhase("card");
                    }
                  }}
                  className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-5 hover:border-cyan-300/60"
                >
                  <span className="text-3xl">{o.emoji}</span>
                  <span className="text-sm font-semibold capitalize">{o.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "ok" && (
          <div className="glass animate-pop flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center">
            <div className="text-5xl">🎯</div>
            <div className="mt-2 text-2xl font-black text-[#16c784]">Doğru! +10 XP</div>
            <button onClick={() => { setI(i + 1); setPhase("card"); }} className="gold-btn mt-8 w-full rounded-2xl py-3.5">
              {i + 1 >= vocab.length ? "Bitir ⭐" : "Sıradaki Kart →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

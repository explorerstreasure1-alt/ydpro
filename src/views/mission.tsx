"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { DAYS } from "@/lib/content";
import { cefrForXp, LANGS } from "@/lib/levels";
import { sfx } from "@/lib/sfx";
import { dayBg, npcPortrait, NPC_FALLBACK } from "@/lib/img";

type StepDone = "idle" | "correct" | "almost" | "wrong";

type RStep = {
  prompt: string;
  answer: string;
  turkish?: string;
  chips?: string[];
  options?: { text: string; isCorrect: boolean }[];
  xp: number;
  speakerName?: string;
  speakerRole?: string;
  speakerEmoji?: string;
};

function staticSteps(day: number): RStep[] {
  const c = DAYS[day - 1];
  return c.dialog.map((d) => ({
    prompt: d.prompt,
    answer: d.fallback || d.line || d.prompt,
    turkish: (d as any).turkish || "",
    chips: d.chips,
    options: d.options,
    xp: d.xp,
    speakerName: (d as any).speaker || c.npcName,
    speakerRole: (d as any).speakerRole || c.npcRole,
    speakerEmoji: (d as any).speakerEmoji || c.npcEmoji,
  }));
}

function aiPersonaForDay(day: number) {
  const c = DAYS[day - 1];
  return { name: c.npcName, role: c.npcRole, emoji: c.npcEmoji, dayTitle: `${c.title} - ${c.location}` };
}

export function Mission({
  day,
  back,
  onComplete,
}: {
  day: number;
  back: () => void;
  onComplete: (d: number) => void;
}) {
  const store = useStore();
  const content = DAYS[day - 1];
  const [aiSteps, setAiSteps] = useState<RStep[] | null>(null);
  const [persona, setPersona] = useState(() => aiPersonaForDay(day));
  const [aiLoading, setAiLoading] = useState(true);
  const staticBase = staticSteps(day);
  const steps = aiSteps || staticBase;

  // HER DİLDE HER DİL — hedef dilde sahne, ana dilde çeviri
  const cefr = cefrForXp(store.user?.xp || 0);
  const nativeLang = (store as any).nativeLang as string || "tr";
  const targetLang = (store as any).targetLang as string || "en";
  const targetTts = LANGS.find(l=>l.code===targetLang)?.tts || "en-GB";
  const nativeDef = LANGS.find(l=>l.code===nativeLang);
  const targetDef = LANGS.find(l=>l.code===targetLang);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAiLoading(true);
        const r = await fetch(`/api/scene/${day}?level=${cefr.level}&target=${targetLang}&native=${nativeLang}`).then(x => x.json());
        if (cancelled) return;
        if (r?.aiSteps && Array.isArray(r.aiSteps) && r.aiSteps.length) {
          const mapped: RStep[] = r.aiSteps.map((s: any) => ({
            prompt: s.prompt,
            answer: s.answer,
            turkish: s.turkish || "",
            chips: s.chips || [],
            xp: 20,
            speakerName: s.speakerName || s.speaker || r.npcName,
            speakerRole: s.speakerRole || r.npcRole,
            speakerEmoji: s.speakerEmoji || r.npcEmoji,
          }));
          // çoklu karakter desteği: her adım farklı konuşmacı olabilir
          if (r.personaScene?.steps?.[0]?.speaker) {
            // personaScene already has per-step speakers
          }
          setAiSteps(mapped);
        } else if (staticBase[0]?.speakerName) {
          // static already has per-step speakers
        }
        if (r?.npcName) setPersona({ name: r.npcName, role: r.npcRole, emoji: r.npcEmoji, dayTitle: `${r.scene?.title || content.title} - ${r.scene?.location || content.location}` });
      } catch {}
      finally { if (!cancelled) setAiLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [day, content.title, content.location, cefr.level, nativeLang, targetLang]);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<StepDone>("idle");
  const [msg, setMsg] = useState("");
  const [typed, setTyped] = useState("");
  const [useTyped, setUseTyped] = useState(false);
  const [learning, setLearning] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState<number[]>([]);
  const [sentenceTr, setSentenceTr] = useState<string | null>(null);
  const [userTr, setUserTr] = useState<string | null>(null);
  const [micState, setMicState] = useState<"idle" | "denied" | "error">("idle");
  const rec = useRef<any>(null);
  const started = useRef(false);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  const micSupport =
    typeof window !== "undefined" &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  const idx = Math.min(step, steps.length - 1);
  const cur = steps[idx];
  const isMap = !!content.map && !!cur?.prompt?.includes("clothing");
  // sahneye göre o anki konuşmacı: polis ise polis, anne ise anne, garson/sevgili dönüşümlü
  const curPersona = {
    name: cur?.speakerName || persona.name,
    role: cur?.speakerRole || persona.role,
    emoji: cur?.speakerEmoji || persona.emoji,
    dayTitle: persona.dayTitle,
  };
  const completed = solved.length >= steps.length;

  const speak = (text: string, lang = targetTts) => {
    try {
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.96;
      synth.speak(u);
    } catch {}
  };

  // NPC speaks prompt on step change — kişiliğin sesiyle, hedef dilde
  useEffect(() => {
    if (cur && status === "idle" && !aiLoading) speak(cur.prompt, targetTts);
    // eslint-disable-next-line
  }, [step, aiLoading, cur?.prompt, targetTts]);

  useEffect(() => {
    return () => {
      try {
        rec.current?.abort?.();
      } catch {}
    };
  }, []);

  // completion (only once, brief pause to show final success)
  useEffect(() => {
    if (completed && !learning && !started.current) {
      started.current = true;
      (async () => {
        await store.post({ type: "complete-scene", day });
        await store.post({ type: "unlock-achievement", input: "first_mission" });
        if (day === 1) await store.post({ type: "unlock-achievement", input: "first_talk" });
        const dayBadge: Record<number, string> = { 3: "restaurant_master", 4: "shopping_fan", 5: "road_finder", 7: "world_citizen" };
        if (dayBadge[day]) await store.post({ type: "unlock-achievement", input: dayBadge[day] });
        if (store.user && store.user.streak >= 7) await store.post({ type: "unlock-achievement", input: "seven_streak" });
        sfx.correct();
        setTimeout(() => setLearning(true), 1500);
      })();
    }
  }, [completed, day, store, learning]);

  function solve(i: number) {
    setSolved((p) => (p.includes(i) ? p : [...p, i]));
  }

  async function translate(text: string): Promise<string | null> {
    try {
      const native = (store as any).nativeLang as string || "tr";
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: native }),
      }).then((x) => x.json());
      return r.tr || null;
    } catch {
      return null;
    }
  }

  async function evalText(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    const native = (store as any).nativeLang as string || "tr";
    // Persona ile değerlendir — AI o anki karaktere bürünür: memur→memur, anne→anne, sevgili→sevgili, patron→patron, ana dile göre feedback
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "answer-free-text", answerText: text, ideal: cur.answer, persona: curPersona, nativeLang: native, native }),
    }).then((r) => r.json());
    setLoading(false);
    const r = res.res;
    translate(text).then((t) => t && setUserTr(t));
    const personaReply: string = r.personaReply || "";
    if (r.correct) {
      sfx.correct();
      await store.post({ type: "answer-free-text-correct", gainedXp: cur.xp });
      store.addXpFlash(cur.xp);
      setStatus("correct");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Mükemmel! Doğru söyledin. +${cur.xp} XP`);
      solve(idx);
      speak(personaReply || cur.answer);
    } else if (r.almost) {
      sfx.wrong();
      setStatus("almost");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Yaklaştın! Doğrusu: “${cur.answer}” — bir daha dene.`);
      speak(r.personaReply || cur.answer);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Hayır öyle değil, şöyle diyeceksin: “${cur.answer}” — dinle, tekrar et.`);
      speak(r.personaReply || cur.answer);
    }
    if (r.personaReply) setUserTr(null);
  }

  function skip() {
    // Safe path: never let the learner get stuck — listen to the correct form, then continue
    sfx.tap();
    store.post({ type: "learn-words", gainedXp: 5 });
    store.addXpFlash(5);
    setStatus("correct");
    setMsg(`Doğrusunu dinledin ✓  +5 XP`);
    speak(cur.answer);
    solve(idx);
    setTimeout(next, 1400);
  }

  function record() {
    const win: any = window;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setUseTyped(true);
      setMicState("error");
      return;
    }
    const r = new SR();
    r.lang = targetTts;
    r.interimResults = false;
    r.maxAlternatives = 1;
    setSpeaking(true);
    r.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript.trim();
      setTyped(text);
      evalText(text);
    };
    r.onerror = (e: any) => {
      setSpeaking(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setMicState("denied");
        setUseTyped(true);
      } else {
        setMicState("error");
      }
    };
    r.onend = () => setSpeaking(false);
    rec.current = r;
    try {
      r.start();
    } catch {
      setSpeaking(false);
      setMicState("error");
    }
  }

  function handleAnswer() {
    if (useTyped) evalText(typed);
    else record();
  }

  function choose(opt: { text: string; isCorrect: boolean }) {
    if (opt.isCorrect) {
      sfx.correct();
      store.post({ type: "choice", correct: true, gainedXp: cur.xp });
      store.addXpFlash(cur.xp);
      setStatus("correct");
      setMsg(`Mükemmel! +${cur.xp} XP`);
      speak(opt.text);
      solve(idx);
      translate(opt.text).then((t) => t && setUserTr(t));
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(`Doğru cevap en doğal olandır: “${cur.answer}”`);
      speak(cur.answer);
    }
  }

  function next() {
    setStatus("idle");
    setMsg("");
    setTyped("");
    setUserTr(null);
    setSentenceTr(null);
    setUseTyped(!micSupport);
    setMicState("idle");
    setStep((s) => s + 1);
  }

  if (learning) {
    return <Review day={day} content={content} onFinish={() => onComplete(day)} onSpeak={(t) => speak(t)} />;
  }

  const correct = status === "correct";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${dayBg(day)}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/85 via-[#061827]/30 to-[#03111d]" />

      {/* top bar — her dilde her dil, bayrakla */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={back} className="glass flex h-10 w-10 items-center justify-center rounded-full text-xl">←</button>
        <div className="text-center">
          <div className="text-sm font-black text-white">{day}. Gün — {content.title} {targetDef?.flag} {nativeDef?.flag}→{targetDef?.flag}</div>
          <div className="text-[10px] font-bold text-slate-400">{targetDef?.spoken} • {cefr.level} • {curPersona.emoji} {curPersona.name}</div>
        </div>
        <button onClick={() => { if (synth) synth.cancel(); }} className="glass flex h-10 w-10 items-center justify-center rounded-full text-base">⏸</button>
      </div>

      {/* mission */}
      <div className="relative z-10 px-4 pt-2 text-center text-[13px]">
        <span className="font-black text-[#ffd52f]">Görev:</span>{" "}
        <span className="font-semibold text-white">{content.mission}</span>
      </div>

      {/* stage */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3">
        {/* NPC — AI o anki kişiliğe bürünür: her adımda değişebilir (sevgili→garson) */}
        <div className="relative">
          <img
            src={npcPortrait(curPersona.role)}
            alt={curPersona.name}
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = NPC_FALLBACK; }}
            className="h-40 w-36 rounded-2xl object-cover object-top shadow-[0_10px_30px_rgba(3,17,29,0.6)] ring-1 ring-white/10 animate-floaty"
          />
          <div className="glass absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-200 flex items-center gap-1">
            <span>{curPersona.emoji}</span> {curPersona.name} {aiSteps ? "• AI" : ""} {steps.length > 3 && curPersona.name !== persona.name ? "↔" : ""}
          </div>
        </div>
        {aiLoading && <div className="text-[11px] text-cyan-200 animate-pulse">🧠 {persona.role} hazırlanıyor...</div>}
        {!aiLoading && curPersona.role !== persona.role && <div className="text-[10px] text-[#ffd52f] animate-pulse">↔ Şimdi {curPersona.emoji} {curPersona.name} ({curPersona.role}) konuşuyor</div>}

        {/* speech bubble */}
        {!correct && (
          <div className="relative -mt-1 max-w-sm rounded-2xl bg-white px-4 py-2.5 text-left text-slate-900 shadow-xl">
            <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 bg-white" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-slate-400">{curPersona.role} • {curPersona.emoji}</span>
              <p className="text-sm font-semibold leading-snug">{cur.prompt}</p>
            </div>
            {cur.turkish && <p className="mt-1 text-[11px] text-slate-500">🇹 {cur.turkish}</p>}
            <button onClick={() => speak(cur.prompt)} className="mt-1 text-[10px] font-bold text-slate-500">🔊 Tekrar dinle</button>
          </div>
        )}

        {/* banners */}
        {correct && (
          <div className="animate-pop w-full max-w-sm rounded-2xl bg-gradient-to-r from-[#16c784] to-[#0fa96f] px-4 py-3 text-sm font-bold text-white shadow-lg">
            {isMap ? "🗺️ " : "⭐ "} {msg}
          </div>
        )}
        {status === "almost" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/30">💡 {msg}</div>}
        {status === "wrong" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/10">🎯 {msg}</div>}

        {/* interactive */}
        {!correct && (
          <div className="w-full max-w-sm">
            {isMap && <MiniMap target={content.map!.target} />}

            {cur.options ? (
              <div className="space-y-2">
                {cur.options.map((o) => (
                  <button
                    key={o.text}
                    onClick={() => choose(o)}
                    disabled={status === "almost"}
                    className="ghost-btn flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0e3048] text-sm">🎙</span>
                    <span className="text-sm font-semibold text-white">{o.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button
                  onClick={handleAnswer}
                  disabled={speaking || loading}
                  className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/40 bg-[#0b2940]/90 px-3 py-3 transition hover:border-cyan-300/70"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xl ${speaking ? "animate-glowpulse" : "glow-cyan"}`}>🎙</span>
                  <span className="flex-1 text-left text-base font-semibold text-white">
                    {speaking ? "Dinliyorum..." : typed || cur.answer}
                  </span>
                </button>

                {micState === "denied" && <div className="mt-1.5 text-center text-[11px] text-[#ffb0a0]">Mikrofona izin veremedin. Yazarak cevapla 👇</div>}
                {micState === "error" && <div className="mt-1.5 text-center text-[11px] text-slate-400">Mikrofon hazır değil. Yazarak cevap ver 👇</div>}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setUseTyped(!useTyped)}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold ${useTyped ? "gold-btn" : "ghost-btn text-slate-200"}`}
                  >
                    {useTyped ? "✍️ Yazılı mod" : "🎤 Sesli mod"}
                  </button>
                  <button onClick={() => speak(cur.answer)} className="ghost-btn rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">🔊</button>
                  <button onClick={() => translate(cur.answer).then((t) => t && setSentenceTr(t))} className="ghost-btn rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">🔁</button>
                </div>

                {sentenceTr && <div className="mt-1.5 text-center text-xs text-cyan-200">🇹 {sentenceTr}</div>}

                {useTyped && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && evalText(typed)}
                      placeholder="Cevabını İngilizce yaz..."
                      className="glass flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <button onClick={() => evalText(typed)} disabled={loading} className="gold-btn rounded-xl px-4 text-sm disabled:opacity-50">
                      {loading ? "..." : "Gönder"}
                    </button>
                  </div>
                )}

                {userTr && (
                  <div className="mt-1.5 text-center text-xs text-slate-300">
                    🇹 Söylediğin: <span className="text-cyan-200">{userTr}</span>
                  </div>
                )}
              </>
            )}

            {/* safe path after a miss: hear the correct form and continue */}
            {(status === "wrong" || status === "almost") && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => speak(cur.answer)} className="ghost-btn flex-1 rounded-xl py-2.5 text-xs font-semibold text-cyan-100">🔊 Doğrusunu dinle</button>
                <button onClick={skip} className="rounded-xl border border-[#ffd52f]/50 bg-[#ffd52f]/10 py-2.5 text-xs font-bold text-[#ffd52f]">→ Dinle ve devam et</button>
              </div>
            )}
          </div>
        )}

        {/* chips */}
        {cur.chips && cur.chips.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">Yeni kelimeler — dokun, hızlı ekle:</span>
              <span className="text-[10px] text-slate-500">Hızlı pratik</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cur.chips.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setTyped((p) => (p ? p + " " + c : c));
                    setUseTyped(true);
                    sfx.tap();
                  }}
                  className="rounded-full border border-cyan-300/30 bg-[#0b2940]/90 px-2.5 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-400/20 hover:border-cyan-300/60 transition active:scale-95"
                  title="Dokun, cümleye ekle — hızlı pratik"
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* continue */}
        {correct && (
          <button onClick={next} className="gold-btn w-full max-w-sm rounded-2xl py-3.5 text-base">
            {idx === steps.length - 1 ? "Kelime Dünyasına Geç →" : "Devam →"}
          </button>
        )}
      </div>
    </div>
  );
}

function MiniMap({ target }: { target: string }) {
  return (
    <div className="mb-2 overflow-hidden rounded-2xl ring-1 ring-cyan-300/30">
      <svg viewBox="0 0 300 130" className="h-auto w-full bg-[#dfe9ee]">
        <rect width="300" height="130" fill="#e6efe9" />
        {[
          [8, 8, 70, 40], [90, 8, 70, 40], [172, 8, 120, 40],
          [8, 58, 70, 40], [90, 58, 70, 40], [172, 58, 55, 40],
          [238, 58, 54, 40], [8, 108, 300, 14],
        ].map((b, i) => (
          <rect key={i} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="#c9d8e0" stroke="#b3c6cf" />
        ))}
        <line x1="0" y1="50" x2="300" y2="50" stroke="#fff" strokeWidth="6" />
        <line x1="85" y1="0" x2="85" y2="130" stroke="#fff" strokeWidth="6" />
        <line x1="167" y1="0" x2="167" y2="130" stroke="#fff" strokeWidth="6" />
        <line x1="234" y1="0" x2="234" y2="130" stroke="#fff" strokeWidth="6" />
        <line x1="0" y1="100" x2="300" y2="100" stroke="#fff" strokeWidth="6" />
        <path d="M 30 120 L 30 100 L 120 100 L 120 30 L 150 30" fill="none" stroke="#00bfff" strokeWidth="4" strokeDasharray="7 5" strokeLinecap="round" />
        <circle cx="30" cy="120" r="6" fill="#16c784" stroke="#fff" strokeWidth="2" />
        <g transform="translate(150,30)">
          <circle cx="0" cy="-4" r="9" fill="#ef4444" stroke="#fff" strokeWidth="2" />
          <text x="0" y="-1" fontSize="9" textAnchor="middle" fill="#fff">🛍</text>
        </g>
        <rect x="160" y="18" width="86" height="16" rx="4" fill="#fff" stroke="#c9d8e0" />
        <text x="203" y="29" fontSize="9" textAnchor="middle" fill="#334" fontWeight="bold">Clothing Store · 200 m</text>
      </svg>
      <div className="bg-[#0b2940] px-3 py-2 text-center text-[11px] text-slate-300">{target}</div>
    </div>
  );
}

function Review({
  day,
  content,
  onFinish,
  onSpeak,
}: {
  day: number;
  content: any;
  onFinish: () => void;
  onSpeak: (t: string) => void;
}) {
  const [i, setI] = useState(0);
  const store = useStore();
  const vocab = content.vocabulary;
  const w = vocab[Math.min(i, vocab.length - 1)];
  const done = i >= vocab.length;

  async function finish() {
    await store.post({ type: "learn-words", gainedXp: 10 * vocab.length, words: vocab.length });
    store.addXpFlash(10 * vocab.length);
    await store.reload();
    onFinish();
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <div className="absolute inset-0 bg-[#061827]" />
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center justify-between">
          <button onClick={onFinish} className="glass h-10 w-10 rounded-full">←</button>
          <span className="text-sm font-black text-[#ffd52f]">🧠 Görsel Hafıza</span>
          <span className="text-xs text-slate-400">{Math.min(i + 1, vocab.length)}/{vocab.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffd52f] to-[#00bfff] transition-all" style={{ width: `${Math.min(100, (i / vocab.length) * 100)}%` }} />
        </div>

        {!done ? (
          <div className="glass mt-5 flex flex-1 flex-col items-center justify-center rounded-3xl p-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-6xl ring-1 ring-cyan-300/30">{w.emoji}</div>
            <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">Görsel · {w.visual}</div>
            <h2 className="mt-1 text-4xl font-black tracking-tight text-white">{w.word.toUpperCase()}</h2>
            <div className="mt-1 text-sm text-cyan-300">{w.pronunciation}</div>
            <div className="text-base font-semibold text-slate-200">{w.translation}</div>
            <div className="glass mt-4 w-full rounded-2xl p-3 text-left">
              <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">Hafıza hikâyesi</div>
              <p className="mt-1 text-xs text-slate-300">{w.story}</p>
              <p className="mt-1 text-xs italic text-slate-400">Örnek: “{w.example}”</p>
            </div>
            <div className="mt-4 flex w-full gap-2">
              <button onClick={() => onSpeak(w.word + ". " + w.example)} className="ghost-btn flex-1 rounded-2xl py-3 text-sm">🔊 Dinle</button>
              <button onClick={() => setI(i + 1)} className="gold-btn flex-1 rounded-2xl py-3 text-sm">Devam Et →</button>
            </div>
          </div>
        ) : (
          <div className="glass animate-pop mt-5 flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center">
            <div className="text-6xl">✨</div>
            <h3 className="mt-2 text-2xl font-black text-grad">Gün Tamamlandı!</h3>
            <p className="mt-1 text-sm text-slate-300">{content.emoji} {day}. Gün başarıyla bitti.</p>
            <div className="glass mt-4 rounded-2xl px-5 py-3 text-base font-black text-[#ffd52f]">+{content.xpReward} XP 🎉</div>
            {day === 7 && <div className="mt-3 text-sm font-black uppercase tracking-widest text-[#00bfff]">ARTIK SAHNE SENİN.</div>}
            <button onClick={finish} className="gold-btn mt-6 w-full rounded-2xl py-4 text-base">
              {day === 7 ? "Büyük Macerayı Bitir 🏆" : "Devam Et →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Mission;

"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { LANGS, CEFR, TOPICS } from "@/lib/levels";
import { sfx } from "@/lib/sfx";
import { speakText } from "@/lib/tts";
import { useLangPair } from "@/lib/useLangPair";
import { NPC_FALLBACK, LANG_PHOTO, TOPIC_PHOTO } from "@/lib/img";
import { IMG } from "@/lib/img";

interface Step {
  prompt: string;
  answer: string;
  tr: string;
  chips: string[];
}

type Phase = "select" | "loading" | "play" | "done";

export function Lessons({ back }: { back: () => void }) {
  const store = useStore();
  const { nativeLang: storeNative, targetLang: storeTarget, setNativeLang: setStoreNative, setTargetLang: setStoreTarget } = useLangPair();
  const [lang, setLang] = useState(storeTarget);
  const [native, setNative] = useState(storeNative);
  const [level, setLevel] = useState("A1");
  const [topic, setTopic] = useState("daily");
  // sync with global pair — eslint-disable for intentional sync
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ setLang(storeTarget); }, [storeTarget]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ setNative(storeNative); }, [storeNative]);
  const [phase, setPhase] = useState<Phase>("select");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [npc, setNpc] = useState({ name: "Rehber", emoji: "🗣️" });
  const [err, setErr] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "correct" | "almost" | "wrong">("idle");
  const [msg, setMsg] = useState("");
  const [typed, setTyped] = useState("");
  const [useTyped, setUseTyped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState<number[]>([]);
  const [userTr, setUserTr] = useState<string | null>(null);
  const rec = useRef<any>(null);
  const started = useRef(false);

  const langDef = LANGS.find((l) => l.code === lang)!;
  const topicDef = TOPICS.find((t) => t.key === topic)!;
  // cefrDef used in UI below via CEFR.find
  const tts = langDef.tts;

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const micSupport =
    typeof window !== "undefined" &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  const idx = Math.min(step, (steps?.length ?? 1) - 1);
  const cur: Step | undefined = steps ? steps[idx] : undefined;
  const completed = solved.length >= (steps?.length ?? 0);

  const speak = (text: string, lang2 = tts) => speakText(text, lang2);

  useEffect(() => {
    if (cur && phase === "play" && status === "idle") speakText(cur.prompt, tts);
    // eslint-disable-next-line
  }, [step, phase]);

  useEffect(() => {
    return () => {
      try {
        rec.current?.abort?.();
      } catch {}
    };
  }, []);

  // completion
  useEffect(() => {
    if (completed && phase === "play" && !started.current) {
      started.current = true;
      (async () => {
        await store.post({ type: "learn-words", gainedXp: 20, words: steps?.length || 0 });
        store.addXpFlash(20);
        setTimeout(() => setPhase("done"), 1500);
      })();
    }
  }, [completed, phase, steps, store]);

  async function start() {
    if (native === lang) { setErr("Ana dil ile hedef dil aynı olamaz."); return; }
    setPhase("loading");
    setErr(null);
    setSteps(null);
    setStep(0);
    setSolved([]);
    started.current = false;
    setStatus("idle");
    setMsg("");
    setTyped("");
    setUserTr(null);
    setUseTyped(!micSupport);
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, native, level, topic: topicDef.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.steps) {
        setPhase("select");
        setErr("Ders oluşturulamadı. Biraz sonra tekrar dene.");
        return;
      }
      setSteps(data.steps);
      setNpc({ name: data.npcName || "Rehber", emoji: data.npcEmoji || "🗣️" });
      setPhase("play");
    } catch {
      setPhase("select");
      setErr("Bağlantı hatası. Tekrar dene.");
    }
  }

  async function translate(text: string): Promise<string | null> {
    try {
      const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: native }) }).then((x) => x.json());
      return r.tr || null;
    } catch {
      return null;
    }
  }

  function solve(i: number) {
    setSolved((p) => (p.includes(i) ? p : [...p, i]));
  }

  async function evalText(text: string) {
    if (!cur || !text.trim()) return;
    setLoading(true);
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "answer-free-text", answerText: text, ideal: cur.answer, nativeLang: native, native }),
    }).then((r) => r.json());
    setLoading(false);
    const r = res.res;
    if (r.correct) {
      sfx.correct();
      await store.post({ type: "answer-free-text-correct", gainedXp: 15 });
      store.addXpFlash(15);
      setStatus("correct");
      setMsg(`Mükemmel! Doğru söyledin. +15 XP`);
      solve(idx);
    } else if (r.almost) {
      sfx.wrong();
      setStatus("almost");
      setMsg(`Yaklaştın! Telaffuzun biraz farklı. Doğrusu: “${cur.answer}”`);
      speak(cur.answer);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(`Bu sefer tutmadı 💪 Doğrusu: “${cur.answer}” — dinle, tekrar et.`);
      speak(cur.answer);
    }
    translate(text).then((t) => t && setUserTr(t));
  }

  async function record() {
    const win: any = window;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setUseTyped(true);
      return;
    }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(s=> s.getTracks().forEach(t=> t.stop())).catch(()=>{});
      }
    } catch {}
    try { rec.current?.abort?.(); } catch {}
    const r = new SR();
    r.lang = tts;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    setSpeaking(true);
    let timeout: any = setTimeout(()=>{ try{ r.stop(); }catch{}; setSpeaking(false); }, 6500);
    r.onresult = (ev: any) => {
      const isFinal = ev.results[0]?.isFinal;
      const text = (ev.results[0][0].transcript || "").trim();
      if (text) setTyped(text);
      if (isFinal && text) { clearTimeout(timeout); evalText(text); }
    };
    r.onerror = (e: any) => {
      clearTimeout(timeout);
      setSpeaking(false);
      if (e?.error === "not-allowed") setUseTyped(true);
    };
    r.onend = () => { clearTimeout(timeout); setSpeaking(false); };
    rec.current = r;
    try {
      r.start();
    } catch {
      setSpeaking(false);
    }
  }

  function handleAnswer() {
    if (useTyped) evalText(typed);
    else record();
  }

  function skip() {
    sfx.tap();
    store.post({ type: "learn-words", gainedXp: 5 });
    store.addXpFlash(5);
    speak(cur?.answer || "", tts);
    setStatus("correct");
    setMsg("Doğrusunu dinledin ✓");
    solve(idx);
    next();
  }

  function next() {
    setStatus("idle");
    setMsg("");
    setTyped("");
    setUserTr(null);
    setUseTyped(!micSupport);
    setStep((s) => s + 1);
  }

  // ---------------- SELECT ----------------
  if (phase === "select") {
    const nativeDef = LANGS.find(l=>l.code===native)!;
    const langPhoto = LANG_PHOTO[lang] || IMG.cityBgWide;
    const nativePhoto = LANG_PHOTO[native] || IMG.cityBgWide;
    const topicPhoto = TOPIC_PHOTO[topic] || IMG.cityBgWide;
    return (
      <Shell back={back} title="📚 Çok Dilli — Ana Dil → Hedef Dil">
        {err && <div className="glass mt-3 rounded-2xl px-3 py-2 text-xs text-[#ffb0a0]">{err}</div>}

        {/* Profesyonel ayar: ana dil → hedef dil, fotoğrafla, animasyon yok */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-cyan-300/30">
            <img src={nativePhoto} alt={nativeDef.name} className="h-24 w-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] via-transparent to-transparent" />
            <div className="absolute bottom-1 left-1.5 flex items-center gap-1"><span className="text-sm">{nativeDef.flag}</span><span className="text-[10px] font-black text-white drop-shadow truncate">{nativeDef.name}</span></div>
            <div className="absolute top-1 left-1.5 text-[8px] font-bold text-cyan-200 uppercase">Ana Dil</div>
          </div>
          <div className="flex items-center justify-center text-lg text-slate-500">→</div>
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-[#ffd52f]/30">
            <img src={langPhoto} alt={langDef.name} className="h-24 w-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] via-transparent to-transparent" />
            <div className="absolute bottom-1 left-1.5 flex items-center gap-1"><span className="text-sm">{langDef.flag}</span><span className="text-[10px] font-black text-white drop-shadow truncate">{langDef.name}</span><span className="text-[9px] text-[#ffd52f]">•{level}</span></div>
            <div className="absolute top-1 left-1.5 text-[8px] font-bold text-[#ffd52f] uppercase">Hedef</div>
          </div>
        </div>
        <div className="mt-1 text-center text-[10px] text-slate-400">{nativeDef.flag} {nativeDef.spoken} → {langDef.flag} {langDef.spoken} • AI her ikisinde profesyonel</div>

        <div className="glass mt-3 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-cyan-200">Ana dilim — kendi dilin</div>
          <p className="text-[10px] text-slate-500">Örn: İngiliz seçer → İngilizce, Türk seçer → Türkçe</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LANGS.map((l) => (
              <button
                key={"n"+l.code}
                onClick={() => { setNative(l.code); setStoreNative(l.code); }}
                className={`group relative overflow-hidden flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-semibold transition ${native === l.code ? "border-cyan-300/70 glow-cyan text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}
              >
                {LANG_PHOTO[l.code] && <img src={LANG_PHOTO[l.code]} alt={l.name} className="absolute inset-0 h-full w-full object-cover opacity-15 group-hover:opacity-25 transition" referrerPolicy="no-referrer" />}
                <span className="relative text-base">{l.flag}</span>
                <span className="relative truncate w-full px-0.5 text-center leading-tight">{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass mt-2 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#ffd52f]">Hedef dil — öğrenmek istediğin</div>
          <p className="text-[10px] text-slate-500">Örn: Rusça, Korece... Ana dille aynı olamaz</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { if(l.code!==native){ setLang(l.code); setStoreTarget(l.code); }}}
                disabled={l.code===native}
                className={`group relative overflow-hidden flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-semibold transition disabled:opacity-30 ${lang === l.code ? "border-[#ffd52f]/70 glow-gold text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}
              >
                {LANG_PHOTO[l.code] && <img src={LANG_PHOTO[l.code]} alt={l.name} className="absolute inset-0 h-full w-full object-cover opacity-15 group-hover:opacity-25 transition" referrerPolicy="no-referrer" />}
                <span className="relative text-base">{l.flag}</span>
                <span className="relative truncate w-full px-0.5 text-center leading-tight">{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass mt-3 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Seviye (CEFR) — A1'den C1'e kapsamlı</div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {CEFR.map((c) => (
              <button
                key={c.level}
                onClick={() => setLevel(c.level)}
                className={`flex flex-col items-center rounded-xl border py-2 px-1 ${level === c.level ? "border-[#ffd52f]/70 glow-gold bg-[#ffd52f]/10" : "border-white/10 hover:border-white/20"}`}
                title={`${c.level} ${c.title}: ${c.canDo} • ${c.words} kelime • ${c.grammar}`}
              >
                <span className={`text-sm font-black ${level === c.level ? "text-[#ffd52f]" : "text-white"}`}>{c.level}</span>
                <span className="text-[8px] text-slate-300 text-center leading-tight">{c.title}</span>
                <span className="text-[7px] text-slate-500 text-center leading-tight mt-0.5 hidden sm:block">{c.words} • {c.hours}</span>
              </button>
            ))}
          </div>
          {(() => { const sel = CEFR.find(c=>c.level===level)!; return (
            <div className="mt-2 rounded-xl bg-[#0b2940]/80 border border-cyan-300/20 px-3 py-2">
              <div className="text-xs font-black text-cyan-200">{sel.level} {sel.title} — {sel.desc}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">✅ {sel.canDo}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">📝 {sel.words} kelime • 📖 {sel.grammar} • ⏱ {sel.hours} saat</div>
            </div>
          ); })()}
        </div>

        <div className="glass mt-3 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Konular — 18 konu A1'den C1'e kapsamlı</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TOPICS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTopic(t.key)}
                className={`group relative overflow-hidden flex items-center gap-1 rounded-xl border px-2 py-1.5 text-left transition ${topic === t.key ? "border-cyan-300/70 text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}
                title={`${t.cefr} — ${t.desc}`}
              >
                {TOPIC_PHOTO[t.key] && <img src={TOPIC_PHOTO[t.key]} alt={t.name} className="absolute inset-0 h-full w-full object-cover opacity-15 group-hover:opacity-25 transition" referrerPolicy="no-referrer" />}
                <span className="relative text-sm">{t.emoji}</span>
                <span className="relative flex-1 min-w-0">
                  <span className="text-[11px] font-semibold leading-none block truncate">{t.name}</span>
                  <span className="text-[8px] text-slate-400 leading-none block truncate">{t.desc}</span>
                </span>
                <span className={`relative text-[8px] font-black px-1 py-0.5 rounded ${t.cefr==="A1"?"bg-emerald-500/20 text-emerald-300":t.cefr==="A2"?"bg-cyan-500/20 text-cyan-300":t.cefr==="B1"?"bg-amber-500/20 text-amber-300":t.cefr==="B2"?"bg-violet-500/20 text-violet-300":"bg-rose-500/20 text-rose-300"}`}>{t.cefr}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 text-center">A1: temel selamlaşma → C1: nüanslı tartışma — AI seviyene göre üretir</div>
        </div>

        <div className="glass mt-3 rounded-2xl px-3 py-2 text-[11px] text-slate-300">
          AI <b>{nativeDef.name} → {langDef.name}</b> · <b>{level}</b> · <b>{topicDef.name}</b> için anında ders üretir. Çeviriler {nativeDef.name} dilinde. Her çiftte aynı kalite — Groq <span className="font-mono text-cyan-300">openai/gpt-oss-20b</span>.
        </div>

        <button onClick={start} className="gold-btn mt-3 w-full rounded-2xl py-4 text-base">
          {nativeDef.flag}→{langDef.flag} {topicDef.emoji} Dersi Başlat → {langDef.name}
        </button>
      </Shell>
    );
  }

  // ---------------- LOADING ----------------
  if (phase === "loading") {
    return (
      <Shell back={back} title="📚 Ders">
        <div className="glass mt-10 flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center">
          <div className="animate-pulse text-4xl">🧠</div>
          <div className="mt-3 text-sm font-bold text-white">AI dersini hazırlıyor…</div>
          <div className="mt-1 text-xs text-slate-400">{langDef.name} · {level} · {topicDef.name}</div>
        </div>
      </Shell>
    );
  }

  // ---------------- DONE ----------------
  if (phase === "done") {
    return (
      <Shell back={back} title="📚 Ders">
        <div className="glass mt-6 flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center">
          <div className="text-6xl">🎉</div>
          <h3 className="mt-2 text-2xl font-black text-grad">Ders Bitti!</h3>
          <p className="mt-1 text-sm text-slate-300">{langDef.name} · {level} · {topicDef.name}</p>
          <div className="glass mt-4 rounded-2xl px-5 py-3 text-base font-black text-[#ffd52f]">+20 XP</div>
          <button onClick={start} className="gold-btn mt-6 w-full rounded-2xl py-4 text-base">🎲 Yeni Ders Üret</button>
          <button onClick={() => setPhase("select")} className="ghost-btn mt-3 w-full rounded-2xl py-3 text-sm">Konu / Seviye Değiştir</button>
        </div>
      </Shell>
    );
  }

  // ---------------- PLAY ----------------
  const correct = status === "correct";
  const playBg = LANG_PHOTO[lang] || IMG.cityBgWide;
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${playBg}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/85 via-[#061827]/35 to-[#03111d]" />

      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={() => setPhase("select")} className="glass flex h-10 w-10 items-center justify-center rounded-full text-xl">←</button>
        <div className="text-center">
          <div className="text-sm font-black text-white">{langDef.flag} {langDef.name} · {level}</div>
          <div className="text-[10px] text-slate-300">{topicDef.emoji} {topicDef.name}</div>
        </div>
        <button onClick={() => { if (synth) synth.cancel(); }} className="glass flex h-10 w-10 items-center justify-center rounded-full text-base">⏸</button>
      </div>

      <div className="relative z-10 px-4 pt-2 text-center text-[11px] font-bold text-slate-300">
        {Math.min(step + 1, steps?.length || 1)} / {steps?.length}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0e3048] to-[#0b2940] text-4xl ring-1 ring-cyan-300/30">
          {npc.emoji}
        </div>
        <div className="text-xs font-bold text-slate-300">{npc.name}</div>

        {!correct && (
          <div className="relative -mt-1 max-w-sm rounded-2xl bg-white px-4 py-2.5 text-left text-slate-900 shadow-xl">
            <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 bg-white" />
            <p className="text-base font-semibold leading-snug">{cur?.prompt}</p>
            <button onClick={() => speak(cur?.prompt || "", tts)} className="mt-1 text-[10px] font-bold text-slate-500">🔊 Tekrar dinle</button>
          </div>
        )}

        {correct && (
          <div className="animate-pop w-full max-w-sm rounded-2xl bg-gradient-to-r from-[#16c784] to-[#0fa96f] px-4 py-3 text-sm font-bold text-white shadow-lg">⭐ {msg}</div>
        )}
        {status === "almost" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/30">💡 {msg}</div>}
        {status === "wrong" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/10">🎯 {msg}</div>}

        {!correct && cur && (
          <div className="w-full max-w-sm">
            <button
              onClick={handleAnswer}
              disabled={speaking || loading}
              className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/40 bg-[#0b2940]/90 px-3 py-3 transition hover:border-cyan-300/70"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xl ${speaking ? "animate-glowpulse" : "glow-cyan"}`}>🎙</span>
              <span className="flex-1 text-left text-base font-semibold text-white">{speaking ? "Dinliyorum..." : typed || cur.answer}</span>
            </button>

            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setUseTyped(!useTyped)}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold ${useTyped ? "gold-btn" : "ghost-btn text-slate-200"}`}
              >
                {useTyped ? "✍️ Yazılı mod" : "🎤 Sesli mod"}
              </button>
              <button onClick={() => speak(cur.answer, tts)} className="ghost-btn rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">🔊</button>
            </div>

            {cur.tr && <div className="mt-1.5 text-center text-xs text-cyan-200">🇹 {cur.tr}</div>}

            {useTyped && (
              <div className="mt-2 flex gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && evalText(typed)}
                  placeholder={`Cevabını ${langDef.name} yaz...`}
                  className="glass flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button onClick={() => evalText(typed)} disabled={loading} className="gold-btn rounded-xl px-4 text-sm disabled:opacity-50">{loading ? "..." : "Gönder"}</button>
              </div>
            )}

            {userTr && <div className="mt-1.5 text-center text-xs text-slate-300">🇹 Söylediğin: <span className="text-cyan-200">{userTr}</span></div>}

            {(status === "wrong" || status === "almost") && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => speak(cur.answer, tts)} className="ghost-btn flex-1 rounded-xl py-2.5 text-xs font-semibold text-cyan-100">🔊 Doğrusunu dinle</button>
                <button onClick={skip} className="rounded-xl border border-[#ffd52f]/50 bg-[#ffd52f]/10 py-2.5 text-xs font-bold text-[#ffd52f]">→ Dinle ve devam et</button>
              </div>
            )}
          </div>
        )}

        {cur?.chips && cur.chips.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="mb-1 text-[11px] font-bold text-slate-300">Yeni kelimeler:</div>
            <div className="flex flex-wrap gap-1.5">
              {cur.chips.map((c) => (
                <span key={c} className="rounded-full border border-cyan-300/30 bg-[#0b2940]/90 px-2.5 py-1 text-xs font-medium text-cyan-100">{c}</span>
              ))}
            </div>
          </div>
        )}

        {correct && (
          <button onClick={next} className="gold-btn w-full max-w-sm rounded-2xl py-3.5 text-base">
            {idx === (steps?.length || 0) - 1 ? "Dersi Bitir →" : "Devam →"}
          </button>
        )}
      </div>
    </div>
  );
}

function Shell({ back, title, children }: { back: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
      <div className="flex items-center gap-3">
        <button onClick={back} className="glass flex h-10 w-10 items-center justify-center rounded-full text-xl">←</button>
        <h2 className="text-lg font-black text-grad">{title}</h2>
      </div>
      <div className="mt-2 flex-1">{children}</div>
    </div>
  );
}

export default Lessons;

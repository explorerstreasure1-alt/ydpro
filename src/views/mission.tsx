"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSeen, addSeen } from "@/lib/seen";
import { useStore } from "@/lib/store";
import { DAYS } from "@/lib/content";
import { cefrForXp } from "@/lib/levels";
import { useLangPair } from "@/lib/useLangPair";
import { speakText, speakMixed, speakNatural, stopNatural } from "@/lib/tts";
import { sfx } from "@/lib/sfx";
import { dayBg, npcPortrait, NPC_FALLBACK } from "@/lib/img";

type StepDone = "idle" | "correct" | "almost" | "wrong";

type RStep = {
  prompt: string;
  promptTr?: string;
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
    promptTr: (d as any).promptTr || "",
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
  const [aiVocab, setAiVocab] = useState<any[] | null>(null);
  const [persona, setPersona] = useState(() => aiPersonaForDay(day));
  const [aiLoading, setAiLoading] = useState(true);
  // staticBase her render'da yeni diziydi → effect deps'te refetch döngüsü yapıyordu. Memo ile sabitlendi.
  const staticBase = useMemo(() => staticSteps(day), [day]);
  const { nativeLang, targetLang, nativeDef, targetDef, targetTts, nativeTts } = useLangPair();
  const cefr = cefrForXp(store.user?.xp || 0);
  // TÜM seriler + TÜM diller + TÜM seviyeler: AI yoksa bile statik tabanla devam et (takılma yok)
  const steps = aiSteps || staticBase;
  const usingOfflineBase = !aiSteps;
  // Vurgulu, akıcı okuma — robot gibi tek nefeste değil
  const speak = (text: string, lang = targetTts) => speakNatural(text, lang, { level: cefr.level });
  // Her açılışta TAZE üretim + görülenleri gönder (asla tekrar yok, devamlı yeni)
  const loadScene = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      setAiLoading(true);
      setAiSteps(null);
      const seen = getSeen("scene", day, cefr.level, targetLang);
      const r = await fetch(`/api/scene/${day}?level=${cefr.level}&target=${targetLang}&native=${nativeLang}&fresh=1&seen=${encodeURIComponent(JSON.stringify(seen))}`).then(x => x.json());
      if (signal.cancelled) return;
      if (r?.vocabulary && Array.isArray(r.vocabulary) && r.vocabulary.length) {
        setAiVocab(r.vocabulary);
      }
      if (r?.aiSteps && Array.isArray(r.aiSteps) && r.aiSteps.length) {
        const mapped: RStep[] = r.aiSteps.map((s: any) => ({
          prompt: s.prompt,
          promptTr: s.promptTr || "",
          answer: s.answer,
          turkish: s.turkish || s.tr || "",
          chips: s.chips || [],
          xp: typeof s.xp === "number" ? s.xp : 20,
          speakerName: s.speakerName || s.speaker || r.npcName,
          speakerRole: s.speakerRole || r.npcRole,
          speakerEmoji: s.speakerEmoji || r.npcEmoji,
        }));
        setAiSteps(mapped);
        addSeen("scene", day, cefr.level, targetLang, mapped.map((s) => s.answer));
      }
      if (r?.npcName) setPersona({ name: r.npcName, role: r.npcRole, emoji: r.npcEmoji, dayTitle: `${r.scene?.title || content.title} - ${r.scene?.location || content.location}` });
    } catch {}
    finally { if (!signal.cancelled) setAiLoading(false); }
  }, [day, content.title, content.location, cefr.level, nativeLang, targetLang]);
  // Sahne ortasında seviye atlanırsa içeriği silme — yeni seviye bir sonraki girişte gelir
  const loadedKey = useRef("");
  const progressRef = useRef(false);
  useEffect(() => { progressRef.current = solved.length > 0 || step > 0; });
  useEffect(() => {
    const k = `${day}|${cefr.level}|${targetLang}|${nativeLang}`;
    if (loadedKey.current === k) return;
    if (loadedKey.current && progressRef.current) return;
    loadedKey.current = k;
    const signal = { cancelled: false };
    loadScene(signal);
    return () => { signal.cancelled = true; };
  }, [loadScene]);
  // "Yeni sorular": bir tur daha taze üret
  const refreshScene = useCallback(() => {
    setStep(0); setStatus("idle"); setMsg(""); setTyped(""); setUserTr(null); setSentenceTr(null);
    setSolved([]); started.current = false;
    loadScene({ cancelled: false });
  }, [loadScene]);
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
  const [engine, setEngine] = useState<"browser" | "whisper" | null>(null);
  const rec = useRef<any>(null);
  const started = useRef(false);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  const micSupport =
    typeof window !== "undefined" &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  // NPC speaks prompt — tüm hooklar early return'den ÖNCE (Rules of Hooks)
  // cur henüz tanımlı değil, o yüzden effect içinde guard ile kontrol edilecek

  useEffect(() => {
    return () => {
      try {
        rec.current?.abort?.();
      } catch {}
      stopNatural();
    };
  }, []);

  // completion (only once) — steps null ise çalışmaz (hooks öncesi, completed guard'lı)
  const _completed = steps ? solved.length >= steps.length : false;
  useEffect(() => {
    if (_completed && !learning && !started.current) {
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
  }, [_completed, day, store, learning]);

  // Her dilde her dil: hedef en değilse AI bekleniyor — Hooks SONRASI early return
  const idx = steps ? Math.min(step, steps.length - 1) : 0;
  const cur = (steps ? steps[idx] : null) as RStep | null;
  const isMap = !!content.map && !!cur?.prompt?.includes("clothing");
  const curPersona = cur ? { name: cur.speakerName || persona.name, role: cur.speakerRole || persona.role, emoji: cur.speakerEmoji || persona.emoji, dayTitle: persona.dayTitle } : persona;
  const completed = _completed;

  // NPC speaks prompt — hızlı, aktif, bekletme yok
  useEffect(() => {
    if (cur && status === "idle") speak(cur.prompt, targetTts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cur?.prompt, targetTts, status]);

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

  const evalBusy = useRef(false);
  async function evalText(text: string) {
    if (!text.trim() || !cur) return;
    // Mikrofon SR+Whisper çift final gönderebilir — ilk değerlendirme bitmeden ikinciyi yoksay
    // (yoksa doğru sonuç kötü ikinci sonuçla eziliyordu)
    if (evalBusy.current) return;
    evalBusy.current = true;
    setLoading(true);
    const native = (store as any).nativeLang as string || "tr";
    const target = (store as any).targetLang as string || "en";
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "answer-free-text", answerText: text, ideal: cur.answer, persona: curPersona, nativeLang: native, native, targetLang: target, target }),
    }).then((r) => r.json()).finally(() => { evalBusy.current = false; setLoading(false); });
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
      // 3. aşama DÜZELTME (anadil + yabancı aksan) + 4. aşama DOĞRU CEVAP (hedef dil orijinal):
      // tırnak içi hedef dille, dışı anadille okunur — her karakter kendi üslubuyla, seviyeye göre hız
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts, { level: cefr.level });
      else speakNatural(cur.answer, targetTts, { level: cefr.level });
    } else if (r.almost) {
      sfx.wrong();
      setStatus("almost");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Yaklaştın! Doğrusu: “${cur.answer}” — bir daha dene.`);
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts, { level: cefr.level });
      else speakNatural(cur.answer, targetTts, { level: cefr.level });
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Hayır öyle değil, şöyle diyeceksin: “${cur.answer}” — dinle, tekrar et.`);
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts, { level: cefr.level });
      else speakNatural(cur.answer, targetTts, { level: cefr.level });
    }
    if (r.personaReply) setUserTr(null);
  }

  function skip() {
    if (!cur) return;
    sfx.tap();
    store.post({ type: "learn-words", gainedXp: 5 });
    store.addXpFlash(5);
    setStatus("correct");
    setMsg(`Doğrusunu dinledin ✓  +5 XP`);
    speak(cur.answer, targetTts);
    solve(idx);
    setTimeout(next, 1400);
  }

  async function record() {
    try { rec.current?.abort?.(); } catch {}
    try { rec.current?.stop?.(); } catch {}
    const { startMic, isMicSupported } = await import("@/lib/mic");
    if (!isMicSupported()) { setUseTyped(true); setMicState("error"); return; }
    setSpeaking(true);
    setMicState("idle");
    const handle = await startMic({
      lang: targetTts,
      preferWhisper: true, // aksanlı konuşmada tarayıcı yanlış yazıyor — Whisper birincil
      whisperPrompt: cur?.answer, // beklenen cümle ipucu — kısa cümle isabeti artar
      onEngine: (e) => setEngine(e),
      onResult: (text, isFinal) => {
        if (text) setTyped(text);
        if (isFinal && text) evalText(text);
      },
      onError: (type) => {
        setSpeaking(false);
        if (type === "not-allowed" || type === "service-not-allowed") { setMicState("denied"); setUseTyped(true); }
        else if (type === "unsupported") { setMicState("error"); setUseTyped(true); }
        else setMicState("error");
      },
      onStart: () => { setSpeaking(true); setMicState("idle"); },
      onEnd: () => setSpeaking(false),
    });
    if (!handle) { setSpeaking(false); setMicState("error"); setUseTyped(true); return; }
    rec.current = handle as any;
  }

  function handleAnswer() {
    if (useTyped) evalText(typed);
    else record();
  }

  function choose(opt: { text: string; isCorrect: boolean }) {
    if (!cur) return;
    if (opt.isCorrect) {
      sfx.correct();
      store.post({ type: "choice", correct: true, gainedXp: cur.xp });
      store.addXpFlash(cur.xp);
      setStatus("correct");
      setMsg(`Mükemmel! +${cur.xp} XP`);
      speak(opt.text, targetTts);
      solve(idx);
      translate(opt.text).then((t) => t && setUserTr(t));
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(`Doğru cevap en doğal olandır: “${cur.answer}”`);
      speak(cur.answer, targetTts);
    }
  }

  function next() {
    evalBusy.current = false;
    setEngine(null);
    setStatus("idle");
    setMsg("");
    setTyped("");
    setUserTr(null);
    setSentenceTr(null);
    setUseTyped(!micSupport);
    setMicState("idle");
    setStep((s) => s + 1);
  }

  // Her dilde her dil: AI bekleniyor — Hooks sonrası early return (Rules of Hooks uyumlu)
  if (!steps) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${dayBg(day)}')` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/80 to-[#03111d]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-pulse text-4xl">🧠</div>
          <div className="mt-3 text-sm font-black text-white">{targetDef?.flag} {targetDef?.spoken} hazırlanıyor…</div>
          <div className="mt-1 text-xs text-slate-400">{nativeDef?.flag} {nativeDef?.spoken} → {targetDef?.flag} {targetDef?.spoken} • {cefr.level}</div>
          <div className="mt-1 text-[11px] text-slate-500">{persona.name} ({persona.role})</div>
        </div>
      </div>
    );
  }

  if (learning) {
    const vocabForReview = aiVocab || content.vocabulary;
    return <Review day={day} content={{ ...content, vocabulary: vocabForReview }} onFinish={() => onComplete(day)} onSpeak={(t, lang) => speakText(t, (lang as string) || targetTts)} />;
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
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold text-slate-400">{targetDef?.flag} {targetDef?.spoken} • {cefr.level}</span>
          <button onClick={refreshScene} disabled={aiLoading} className="rounded-full border border-cyan-300/30 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200 hover:bg-white/10 disabled:opacity-50" title="Taze sorular üret (önbelleği atla)">
            {aiLoading ? "🧠 hazırlanıyor…" : "🔄 Yeni sorular"}
          </button>
        </div>
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

        {/* speech bubble — hızlı ve aktif, insan gibi — yabancı soru + altında anadil anlamı (her dilde) */}
        {!correct && cur && (
          <div className="relative -mt-1 max-w-sm rounded-2xl bg-white px-4 py-2.5 text-left text-slate-900 shadow-xl">
            <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 bg-white" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-slate-400">{curPersona.role} • {curPersona.emoji}</span>
              <p className="text-sm font-semibold leading-snug">{cur!.prompt}</p>
            </div>
            {cur!.promptTr ? (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                <span className="flex-1">🇹 {cur!.promptTr}</span>
                <button onClick={() => speakNatural(cur!.promptTr!, targetTts, { level: cefr.level })} className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-[10px] hover:bg-slate-50" title="Anadili hedef aksanla dinle">🔊</button>
              </div>
            ) : cur!.turkish ? (
              <p className="mt-1 text-[11px] text-slate-500">🇹 {cur!.turkish}</p>
            ) : null}
            <button onClick={() => speak(cur!.prompt, targetTts)} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700">🔊 Hızlı dinle — {targetDef.spoken} orijinal</button>
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
        {(status === "wrong" || status === "almost") && typed ? (
          <div className="w-full max-w-sm rounded-xl bg-white/5 px-3 py-1.5 text-center text-[11px] text-slate-400">{engine === "whisper" ? "🤖 Whisper" : engine === "browser" ? "🌐 Tarayıcı" : "🎤"} ile duydum: <span className="font-semibold text-slate-200">“{typed}”</span> — yanlış duyduysam tekrar dene</div>
        ) : null}
        {/* 4. aşama DOĞRU CEVAP: asla anadil değil — tamamen hedef dil + orijinal okunuş */}
        {(status === "wrong" || status === "almost") && cur && (
          <div className="w-full max-w-sm rounded-2xl border border-[#ffd52f]/40 bg-[#0b2940] px-4 py-3 text-left ring-1 ring-white/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#ffd52f]">Doğru cevap • {targetDef?.spoken} orijinal</div>
            <div className="mt-1 flex items-start gap-2">
              <p className="flex-1 text-sm font-bold leading-snug text-white">“{cur.answer}”</p>
              <button onClick={() => speakNatural(cur.answer, targetTts, { level: cefr.level })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xs" title="Orijinal aksanla dinle">🔊</button>
            </div>
            <div className="mt-1 text-[11px] text-cyan-200">🔊 Orijinal okunuşla dinle + tekrar et — kelimeler tamamen {targetDef?.spoken}.</div>
            {cur.turkish ? <div className="mt-1 text-[11px] text-slate-400">🇹 Anlamı: {cur.turkish}</div> : null}
          </div>
        )}
        {usingOfflineBase && targetLang !== "en" && status === "idle" && (
          <div className="w-full max-w-sm rounded-xl bg-white/5 px-3 py-1.5 text-center text-[10px] text-slate-400">📶 Çevrimdışı taban — çevrimiçi olunca {targetDef?.spoken} sahne AI ile tazelenir • {cefr.level}</div>
        )}

        {/* interactive */}
        {!correct && (
          <div className="w-full max-w-sm">
            {isMap && <MiniMap target={content.map!.target} />}

            {cur && cur.options ? (
              <div className="space-y-2">
                {cur.options.map((o: { text: string; isCorrect: boolean }) => (
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
                  className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/40 bg-[#0b2940]/90 px-3 py-3 transition hover:border-cyan-300/70 active:scale-[0.99]"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xl ${speaking ? "animate-glowpulse" : "glow-cyan"}`}>🎙</span>
                  <span className="flex-1 text-left text-base font-semibold text-white">
                    {speaking ? "Dinliyorum..." : typed || cur!.answer}
                  </span>
                </button>
                {/* Cevabın altında anlamı — her dilde, hedef aksanla okunur */}
                {cur!.turkish && (
                  <div className="mt-1.5 flex items-center gap-1.5 justify-center text-xs font-medium text-cyan-100 bg-[#0b2940]/70 rounded-lg px-3 py-1.5 border border-cyan-300/20">
                    <span className="flex-1 text-center">🇹 Cevap: {cur!.turkish}</span>
                    <button onClick={() => speakNatural(cur!.turkish!, targetTts, { level: cefr.level })} className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] hover:bg-white/20" title="Anadili hedef aksanla dinle">🔊</button>
                  </div>
                )}

                {micState === "denied" && <div className="mt-1.5 text-center text-[11px] text-[#ffb0a0]">Mikrofona izin veremedin. Yazarak cevapla 👇</div>}
                {micState === "error" && <div className="mt-1.5 text-center text-[11px] text-slate-400">Mikrofon hazır değil. Yazarak cevap ver 👇</div>}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setUseTyped(!useTyped)}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold ${useTyped ? "gold-btn" : "ghost-btn text-slate-200"}`}
                  >
                    {useTyped ? "✍️ Yazılı mod" : "🎤 Sesli mod"}
                  </button>
                  <button onClick={() => speak(cur!.answer, targetTts)} className="ghost-btn rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">🔊</button>
                  <button onClick={() => translate(cur!.answer).then((t) => t && setSentenceTr(t))} className="ghost-btn rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">🔁</button>
                </div>

                {sentenceTr && <div className="mt-1.5 text-center text-xs text-cyan-200">🇹 {sentenceTr}</div>}

                {useTyped && (
                  <div className="mt-2 flex gap-2">
                    <input
                      id="mission-input"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && evalText(typed)}
                      placeholder={`Cevabını ${targetDef?.spoken || "İngilizce"} yaz...`}
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

            {/* Hızlı pratik retry — takılıp kalma yok */}
            {(status === "wrong" || status === "almost") && (
              <div className="mt-2 space-y-2">
                <button
                  onClick={() => { setStatus("idle"); setMsg(""); setTyped(""); setUserTr(null); sfx.tap(); if (useTyped) { setTimeout(()=>document.getElementById("mission-input")?.focus(), 100); } else record(); }}
                  className="gold-btn w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98]"
                >
                  🔄 Tekrar Dene — {targetDef?.flag} {targetDef?.spoken}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => speakNatural(cur!.answer, targetTts, { level: cefr.level })} className="ghost-btn flex-1 rounded-xl py-2.5 text-xs font-semibold text-cyan-100">🔊 Doğrusunu dinle (orijinal)</button>
                  <button onClick={skip} className="rounded-xl border border-[#ffd52f]/50 bg-[#ffd52f]/10 px-3 py-2.5 text-xs font-bold text-[#ffd52f]">→ Dinle ve devam et</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* chips — hızlı pratik */}
        {cur && cur!.chips && cur!.chips.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">Yeni kelimeler — dokun, hızlı ekle:</span>
              <span className="text-[10px] text-slate-500">Hızlı pratik</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cur!.chips.map((c: string) => (
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
  onSpeak: (t: string, lang?: string) => void;
}) {
  const [i, setI] = useState(0);
  const store = useStore() as any;
  const targetLang: string = store.targetLang || "en";
  const nativeLang: string = store.nativeLang || "tr";
  const [displayW, setDisplayW] = useState<any>(null);
  const vocab = content.vocabulary;
  const wRaw = vocab[Math.min(i, vocab.length - 1)];
  const w = displayW || wRaw;
  const done = i >= vocab.length;

  // Hafıza kartı — hedef dilde göster, orijinal telafuzla oku (her dilde)
  useEffect(() => {
    if (targetLang === "en" || !wRaw) { setDisplayW(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const targetName = (()=>{ try{ const {LANGS}=require("@/lib/levels"); return LANGS.find((l:any)=>l.code===targetLang)?.spoken||"English"; }catch{return "English";}})();
        // Kelime ve örnek cümleyi hedef dile çevir — AI ile
        const resWord = await fetch("/api/translate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: wRaw.word, lang: targetLang })}).then(r=>r.json()).catch(()=>null);
        const resEx = await fetch("/api/translate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: wRaw.example, lang: targetLang })}).then(r=>r.json()).catch(()=>null);
        if (cancelled) return;
        // translate API native'e çevirir, ama biz hedef dile çevirmek istiyoruz — lang=target
        // Eğer translate hedef dilde değilse, fallback orijinal
        const wordTr = resWord?.tr || wRaw.word;
        const exTr = resEx?.tr || wRaw.example;
        // wordTr aslında hedef dilde, ama API native'e çevirir — bu yüzden farklı endpoint gerek
        // Basit: eğer hedef en değilse, kelimeyi hedef dilde göster (orijinal İngilizceyi de küçük göster)
        if (wordTr && wordTr !== wRaw.word) {
          setDisplayW({ ...wRaw, word: wordTr, example: exTr, translation: wRaw.translation, pronunciation: wRaw.pronunciation });
        } else {
          setDisplayW(null);
        }
      } catch { if (!cancelled) setDisplayW(null); }
    })();
    return () => { cancelled = true; };
  }, [i, targetLang, wRaw]);

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
              <button onClick={() => onSpeak(w.word + ". " + w.example, displayW ? (():string=>{ try{ const {LANGS}=require("@/lib/levels"); return LANGS.find((l:any)=>l.code===targetLang)?.tts||"en-GB"; }catch{return "en-GB";}})() : "en-GB")} className="ghost-btn flex-1 rounded-2xl py-3 text-sm">🔊 Dinle — orijinal telafuz</button>
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

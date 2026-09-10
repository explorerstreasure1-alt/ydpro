"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cefrForXp } from "@/lib/levels";
import { useLangPair } from "@/lib/useLangPair";
import { speakText, speakMixed } from "@/lib/tts";
import { sfx } from "@/lib/sfx";
import { npcPortrait, NPC_FALLBACK } from "@/lib/img";
import { SceneDef } from "@/lib/scenes";

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

export function SceneMission({ scene, back, onComplete }: { scene: SceneDef; back: () => void; onComplete: () => void }) {
  const store = useStore() as any;
  const { nativeLang, targetLang, nativeDef, targetDef, targetTts, nativeTts } = useLangPair();
  const cefr = cefrForXp(store.user?.xp || 0);
  const [aiSteps, setAiSteps] = useState<RStep[] | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [persona, setPersona] = useState({ name: scene.npc.name, role: scene.npc.role, emoji: scene.npc.emoji, dayTitle: `${scene.title} — ${scene.location}` });

  // AI ile her ortam için pratik diyalog üret — çatal ver, yumurta çıkar gibi
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAiLoading(true);
        // Önce AI ile dene, olmazsa örnekleri kullan
        const res = await fetch("/api/scene/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId: scene.id, level: cefr.level, target: targetLang, native: nativeLang }),
        }).then(r => r.json()).catch(() => null);
        if (cancelled) return;
        if (res?.steps && Array.isArray(res.steps) && res.steps.length) {
          const mapped: RStep[] = res.steps.map((s: any) => ({
            prompt: s.prompt,
            promptTr: s.promptTr || "",
            answer: s.answer,
            turkish: s.turkish || s.tr || "",
            chips: s.chips || [],
            xp: s.xp || 20,
            speakerName: s.speakerName || res.npcName || scene.npc.name,
            speakerRole: s.speakerRole || res.npcRole || scene.npc.role,
            speakerEmoji: s.speakerEmoji || res.npcEmoji || scene.npc.emoji,
          }));
          setAiSteps(mapped);
          setPersona({ name: res.npcName || scene.npc.name, role: res.npcRole || scene.npc.role, emoji: res.npcEmoji || scene.npc.emoji, dayTitle: `${scene.title} — ${scene.location}` });
        } else {
          // Fallback: örnekleri kullan — hızlı pratik
          const fallback: RStep[] = scene.examples.map(ex => ({
            prompt: ex,
            promptTr: "",
            answer: ex,
            turkish: "",
            chips: ex.split(" ").slice(0, 2),
            xp: 20,
            speakerName: scene.npc.name,
            speakerRole: scene.npc.role,
            speakerEmoji: scene.npc.emoji,
          }));
          // En az 3 adım olsun
          while (fallback.length < 3) fallback.push({ ...fallback[0] });
          setAiSteps(fallback.slice(0, 3));
        }
      } catch {
        const fallback: RStep[] = scene.examples.map(ex => ({
          prompt: ex,
          promptTr: "",
          answer: ex,
          turkish: "",
          chips: ex.split(" ").slice(0, 2),
          xp: 20,
          speakerName: scene.npc.name,
          speakerRole: scene.npc.role,
          speakerEmoji: scene.npc.emoji,
        }));
        if (!cancelled) setAiSteps(fallback.slice(0, 3));
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scene.id, scene.examples, cefr.level, targetLang, nativeLang, scene.npc.name, scene.npc.role, scene.npc.emoji, scene.title, scene.location]);

  const steps = aiSteps;
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<StepDone>("idle");
  const [msg, setMsg] = useState("");
  const [typed, setTyped] = useState("");
  const [useTyped, setUseTyped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState<number[]>([]);
  const [engine, setEngine] = useState<"browser" | "whisper" | null>(null);
  const rec = useRef<any>(null);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const micSupport = typeof window !== "undefined" && (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  const speak = useCallback((text: string, lang = targetTts) => speakText(text, lang), [targetTts]);

  const idx = steps ? Math.min(step, steps.length - 1) : 0;
  const cur = (steps ? steps[idx] : null) as RStep | null;
  const curPersona = cur ? { name: cur.speakerName || persona.name, role: cur.speakerRole || persona.role, emoji: cur.speakerEmoji || persona.emoji, dayTitle: persona.dayTitle } : persona;
  const completed = steps ? solved.length >= steps.length : false;

  useEffect(() => {
    if (cur && status === "idle") speak(cur.prompt, targetTts);
  }, [step, cur, cur?.prompt, targetTts, status, speak]);

  useEffect(() => {
    return () => { try { rec.current?.abort?.(); } catch {} };
  }, []);

  useEffect(() => {
    if (completed) {
      const t = setTimeout(async () => {
        await store.post({ type: "learn-words", gainedXp: scene.xp, words: 3 });
        store.addXpFlash(scene.xp);
        onComplete();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [completed, scene.xp, store, onComplete]);

  if (!steps || !cur) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${scene.photo}')` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/80 to-[#03111d]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-pulse text-4xl">🧠</div>
          <div className="mt-3 text-sm font-black text-white">{scene.emoji} {scene.title} hazırlanıyor…</div>
          <div className="mt-1 text-xs text-slate-400">{scene.location} • {targetDef?.flag} {targetDef?.spoken} → {cefr.level}</div>
        </div>
      </div>
    );
  }

  function solve(i: number) { setSolved(p => p.includes(i) ? p : [...p, i]); }

  const evalBusy = useRef(false);
  async function evalText(text: string) {
    if (!text.trim() || !cur) return;
    if (evalBusy.current) return;
    evalBusy.current = true;
    setLoading(true);
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "answer-free-text", answerText: text, ideal: cur.answer, persona: curPersona, nativeLang, native: nativeLang, targetLang, target: targetLang }),
    }).then(r => r.json()).finally(() => { evalBusy.current = false; setLoading(false); });
    const r = res.res;
    const personaReply: string = r.personaReply || "";
    if (r.correct) {
      sfx.correct();
      await store.post({ type: "answer-free-text-correct", gainedXp: cur.xp });
      store.addXpFlash(cur.xp);
      setStatus("correct");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Mükemmel! +${cur.xp} XP`);
      solve(idx);
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts); else speakText(cur.answer, targetTts);
    } else if (r.almost) {
      sfx.wrong();
      setStatus("almost");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Yaklaştın! “${cur.answer}”`);
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts); else speakText(cur.answer, targetTts);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setMsg(personaReply ? `${curPersona.emoji} ${curPersona.name}: ${personaReply}` : `Hayır öyle değil: “${cur.answer}”`);
      if (personaReply) speakMixed(personaReply, nativeTts, targetTts); else speakText(cur.answer, targetTts);
    }
  }

  async function record() {
    try { rec.current?.abort?.(); } catch {}
    try { rec.current?.stop?.(); } catch {}
    const { startMic, isMicSupported } = await import("@/lib/mic");
    if (!isMicSupported()) { setUseTyped(true); return; }
    setSpeaking(true);
    const handle = await startMic({
      lang: targetTts,
      preferWhisper: true, // aksanlı konuşmada tarayıcı yanlış yazıyor — Whisper birincil
      whisperPrompt: cur?.answer,
      onEngine: (e) => setEngine(e),
      onResult: (text, isFinal) => { if (text) setTyped(text); if (isFinal && text) evalText(text); },
      onError: (type) => { setSpeaking(false); if (type==="not-allowed") setUseTyped(true); },
      onStart: () => { setSpeaking(true); },
      onEnd: () => setSpeaking(false),
    });
    if (!handle) { setSpeaking(false); setUseTyped(true); return; }
    rec.current = handle as any;
  }

  function next() {
    evalBusy.current = false;
    setEngine(null);
    setStatus("idle"); setMsg(""); setTyped(""); setStep(s=>s+1);
  }

  const correct = status === "correct";
  if (completed && status === "correct") {
    return (
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${scene.photo}')` }} />
        <div className="absolute inset-0 bg-[#03111d]/70" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">✨</div>
          <h3 className="mt-2 text-2xl font-black text-white">{scene.emoji} Harika!</h3>
          <p className="text-sm text-slate-200">{scene.title} tamamlandı</p>
          <div className="glass mt-4 px-5 py-3 text-[#ffd52f] font-black">+{scene.xp} XP</div>
          <button onClick={onComplete} className="gold-btn mt-6 w-full rounded-2xl py-4">Devam Et →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${scene.photo}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/80 via-[#061827]/30 to-[#03111d]" />
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={back} className="glass h-10 w-10 rounded-full">←</button>
        <div className="text-center">
          <div className="text-sm font-black text-white">{scene.emoji} {scene.title}</div>
          <div className="text-[10px] text-slate-300">{scene.location} • {targetDef.flag} {targetDef.spoken} • {cefr.level}</div>
        </div>
        <button onClick={() => synth?.cancel()} className="glass h-10 w-10 rounded-full">⏸</button>
      </div>
      <div className="relative z-10 px-4 pt-2 text-center text-xs">
        <span className="font-black text-[#ffd52f]">Sahne:</span> <span className="text-white">{scene.description}</span>
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3">
        <div className="relative">
          <img src={npcPortrait(curPersona.role)} alt={curPersona.name} onError={(e)=>(e.currentTarget as HTMLImageElement).src=NPC_FALLBACK} className="h-36 w-32 rounded-2xl object-cover object-top shadow-xl ring-1 ring-white/10" />
          <div className="glass absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-200">{curPersona.emoji} {curPersona.name}</div>
        </div>
        {!correct && (
          <div className="relative -mt-1 max-w-sm rounded-2xl bg-white px-4 py-2.5 text-left text-slate-900 shadow-xl">
            <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 bg-white" />
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-slate-400">{curPersona.role}</span>
              <p className="text-sm font-semibold">{cur.prompt}</p>
            </div>
            {cur.promptTr && <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 rounded-lg px-2 py-1"><span className="flex-1">🇹 {cur.promptTr}</span><button onClick={() => speakText(cur.promptTr!, targetTts)} className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-white border text-[10px]">🔊</button></div>}
            <button onClick={() => speakText(cur.prompt, targetTts)} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">🔊 Hızlı dinle — {targetDef.spoken} orijinal</button>
          </div>
        )}
        {correct && <div className="animate-pop w-full max-w-sm rounded-2xl bg-emerald-500 px-4 py-3 text-white font-bold">⭐ {msg}</div>}
        {status==="almost" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-cyan-200">💡 {msg}</div>}
        {status==="wrong" && <div className="w-full max-w-sm rounded-2xl bg-[#0b2940] px-4 py-3 text-slate-200">🎯 {msg}</div>}
        {(status==="wrong"||status==="almost") && typed ? (
          <div className="w-full max-w-sm rounded-xl bg-white/5 px-3 py-1.5 text-center text-[11px] text-slate-400">{engine === "whisper" ? "🤖 Whisper" : engine === "browser" ? "🌐 Tarayıcı" : "🎤"} ile duydum: <span className="font-semibold text-slate-200">“{typed}”</span> — yanlış duyduysam tekrar dene</div>
        ) : null}
        {(status==="wrong"||status==="almost") && cur && (
          <div className="w-full max-w-sm rounded-2xl border border-[#ffd52f]/40 bg-[#0b2940] px-4 py-3 text-left ring-1 ring-white/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#ffd52f]">Doğru cevap • {targetDef?.spoken} orijinal</div>
            <div className="mt-1 flex items-start gap-2">
              <p className="flex-1 text-sm font-bold leading-snug text-white">“{cur.answer}”</p>
              <button onClick={()=>speakText(cur.answer, targetTts)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xs" title="Orijinal aksanla dinle">🔊</button>
            </div>
            <div className="mt-1 text-[11px] text-cyan-200">🔊 Orijinal okunuşla dinle + tekrar et — kelimeler tamamen {targetDef?.spoken}.</div>
            {cur.turkish ? <div className="mt-1 text-[11px] text-slate-400">🇹 Anlamı: {cur.turkish}</div> : null}
          </div>
        )}
        {!correct && (
          <div className="w-full max-w-sm">
            <button onClick={()=> useTyped ? evalText(typed) : record()} disabled={speaking||loading} className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/40 bg-[#0b2940]/90 px-3 py-3">
              <span className={`h-12 w-12 rounded-full bg-[#00bfff] flex items-center justify-center text-xl ${speaking ? "animate-glowpulse":""}`}>🎙</span>
              <span className="flex-1 text-left text-white font-semibold">{speaking ? "Dinliyorum..." : typed || cur.answer}</span>
            </button>
            {cur.turkish && <div className="mt-1.5 flex items-center gap-1.5 justify-center text-xs font-medium text-cyan-100 bg-[#0b2940]/70 rounded-lg px-3 py-1.5 border border-cyan-300/20"><span className="flex-1 text-center">🇹 Cevap: {cur.turkish}</span><button onClick={() => speakText(cur.turkish!, targetTts)} className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-white/10 text-[10px]">🔊</button></div>}
            <div className="mt-2 flex gap-2">
              <button onClick={()=>setUseTyped(!useTyped)} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${useTyped?"gold-btn":"ghost-btn text-slate-200"}`}>{useTyped?"✍️ Yazılı":"🎤 Sesli"}</button>
              <button onClick={()=>speakText(cur.answer, targetTts)} className="ghost-btn px-3 py-2 text-xs">🔊</button>
            </div>
            {useTyped && (
              <div className="mt-2 flex gap-2">
                <input id="scene-input" value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>e.key==="Enter"&&evalText(typed)} placeholder={`Cevabını ${targetDef.spoken} yaz...`} className="glass flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
                <button onClick={()=>evalText(typed)} disabled={loading} className="gold-btn px-4 text-sm">{loading?"...":"Gönder"}</button>
              </div>
            )}
            {(status==="wrong"||status==="almost") && (
              <div className="mt-2 space-y-2">
                <button onClick={()=>{evalBusy.current=false; setStatus("idle"); setMsg(""); setTyped("");}} className="gold-btn w-full rounded-xl py-3 text-sm">🔄 Tekrar Dene</button>
                <div className="flex gap-2">
                  <button onClick={()=>speakText(cur.answer, targetTts)} className="ghost-btn flex-1 rounded-xl py-2.5 text-xs">🔊 Doğrusunu dinle</button>
                  <button onClick={()=>{ setStatus("correct"); setTimeout(next, 800); }} className="border border-[#ffd52f]/50 bg-[#ffd52f]/10 rounded-xl px-3 py-2.5 text-xs font-bold text-[#ffd52f]">→ Devam</button>
                </div>
              </div>
            )}
          </div>
        )}
        {cur && cur.chips && cur.chips.length >0 && (
          <div className="w-full max-w-sm">
            <div className="text-[11px] font-bold text-slate-300">Hızlı ekle:</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {cur.chips.map((c:string)=>(
                <button key={c} onClick={()=>{setTyped(p=>p? p+" "+c:c); setUseTyped(true);}} className="rounded-full border border-cyan-300/30 bg-[#0b2940]/90 px-2.5 py-1 text-xs text-cyan-100">+ {c}</button>
              ))}
            </div>
          </div>
        )}
        {correct && <button onClick={next} className="gold-btn w-full max-w-sm rounded-2xl py-3.5">Devam →</button>}
      </div>
    </div>
  );
}

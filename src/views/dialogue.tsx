"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { LANGS, CEFR, TOPICS, cefrForXp, ttsRateForLevel } from "@/lib/levels";
import { useLangPair } from "@/lib/useLangPair";
import { speakText } from "@/lib/tts";
import { sfx } from "@/lib/sfx";
import { getSeen, addSeen } from "@/lib/seen";
import type { DialogueLine } from "@/lib/ai";

interface SavedDialogue {
  id: string;
  ts: number;
  language_code: string;
  target: string;
  native: string;
  level: string;
  topic: string;
  lines: DialogueLine[];
}

const STORE_KEY = "yzed_dialogues";
const STORE_CAP = 30;

function loadSaved(): SavedDialogue[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((d) => d && Array.isArray(d.lines)) : [];
  } catch {
    return [];
  }
}

export function Dialogue({ back }: { back: () => void }) {
  const store = useStore();
  const { nativeLang, targetLang, nativeDef, targetDef, targetTts, nativeTts } = useLangPair();
  const xpLevel = cefrForXp(store.user?.xp || 0).level;
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(xpLevel);
  const [lines, setLines] = useState<DialogueLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDialogue[]>(() => {
    try {
      return loadSaved();
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<string>("all");
  const [viewId, setViewId] = useState<string | null>(null);
  // Çift yönlü seslendirme (protokol):
  // - Yabancı dil: Dinle (bir kez) veya Tekrar Modu (kapatana kadar döngü)
  // - Türkçe: sadece satırdaki ikonla, bir kez — tekrar modu yok
  const [playing, setPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState(false);
  const [playPos, setPlayPos] = useState<{ i: number; s: number } | null>(null);
  const playCtl = useRef({ stop: false });
  // Arka plan: ekran kapansa da okuma sürsün diye sessiz ses + uyanık kilidi
  const keepAlive = useRef<HTMLAudioElement | null>(null);
  const wakeRef = useRef<any>(null);

  const activeTopic = topic.trim() || "Günlük hayat";

  function stopLoop() {
    playCtl.current.stop = true;
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    try {
      keepAlive.current?.pause();
    } catch {}
    try {
      wakeRef.current?.release?.();
    } catch {}
    wakeRef.current = null;
    setPlaying(false);
    setLoopMode(false);
    setPlayPos(null);
  }

  useEffect(() => {
    return () => {
      playCtl.current.stop = true;
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      try {
        keepAlive.current?.pause();
      } catch {}
      try {
        wakeRef.current?.release?.();
      } catch {}
    };
  }, []);

  // Cümlelere böl — vurgulu okuma + cümle sonu bekleme için
  function splitSentences(text: string): string[] {
    const m = String(text || "").match(/[^.!?…؟\n]+[.!?…؟]+["'»”)\]]?|[^.!?…؟\n]+$/g);
    const parts = (m || [text]).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [String(text || "")];
  }

  // Virgül nefesleri — uzun cümleyi doğal soluklarla parçala (vurgu cümlede kalır)
  function splitPhrases(sentence: string): string[] {
    const m = String(sentence || "").match(/[^,;:—–،；：]+[,;:—–،；：]?/g);
    const parts = (m || [sentence]).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [String(sentence || "")];
  }

  // Duygu ve bağlam tonu — selam sıcak, teşekkür içten, veda yumuşak (0.8–1.3 bandı)
  function moodPitch(text: string): number {
    const x = ` ${String(text || "").toLowerCase()} `;
    if (/(olá|[^a-z]ola[^a-z]|hola|hello|\bhi\b|hey|bonjour|salut|ciao|hallo|\boi\b|selam|merhaba)/.test(x)) return 1.06;
    if (/(obrigad|gracias|merci|danke|thank|grazie|bedankt|teşekkür|sağ ol)/.test(x)) return 1.05;
    if (/(adeus|adi[óo]s|au revoir|arrivederci|tschüss|tschuss|tot ziens|görüşürüz|hoşça kal)/.test(x)) return 0.95;
    return 1.0;
  }

  // Ekranı uyanık tut (kilitlenirse bazı tarayıcılar sesi keser) + kilit ekranı bilgisi
  async function holdAwake() {
    try {
      wakeRef.current = await (navigator as any).wakeLock?.request("screen");
    } catch {}
    try {
      const nav = navigator as any;
      if (nav.mediaSession) {
        nav.mediaSession.metadata = new MediaMetadata({
          title: `7DİL • ${activeTopic}`,
          artist: `${targetDef?.spoken} • ${level} • Tekrar Modu`,
          album: "Diyalog Stüdyosu",
        });
        nav.mediaSession.setActionHandler("pause", () => stopLoop());
      }
    } catch {}
    // Sessiz döngü sesi — işletim sisteminin sayfayı arka planda yaşatmasına yardım eder
    try {
      if (!keepAlive.current) {
        keepAlive.current = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAA"
        );
        keepAlive.current.loop = true;
      }
      keepAlive.current.volume = 0;
      const p = keepAlive.current.play() as any;
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  const speakOnce = (text: string, lang: string, pitch?: number, rate?: number) =>
    new Promise<void>((res) => speakText(text, lang, { level, pitch, rate, onEnd: () => res() }));

  // Duraklamalı bekleme — sekme gizliyken bile ilerler (kısa adımlarla)
  const waitGap = (ms: number) =>
    new Promise<void>((res) => {
      const t0 = Date.now();
      const tick = () => {
        if (playCtl.current.stop || Date.now() - t0 >= ms) res();
        else setTimeout(tick, 80);
      };
      tick();
    });

  // ▶ Dinle: yabancı diyalog bir kez baştan sona — 🇹 Türkçe OTOMATİK çalmaz
  // 🔁 Tekrar Modu: yabancı diyalog kapatana kadar pürüzsüz döngü (başa sararken es verilir)
  // Dolgun stüdyo okuması: tok perde + konuşmacı ses ayrımı + geniş nefesler + cümle vurgusu
  async function playForeign(loop: boolean) {
    if (!lines || lines.length === 0 || playing) return;
    stopLoop();
    playCtl.current.stop = false;
    setPlaying(true);
    setLoopMode(loop);
    await holdAwake();
    const gapMs = level === "A1" || level === "A2" ? 750 : 550;
    const breathMs = 260;
    // Konuşmacı ses ayrımı: birinci kişi doğal, ikinci kişi daha tok — iki kişi konuşuyormuş hissi
    const voiceOf = new Map<string, number>();
    let voiceCount = 0;
    const speakerPitch = (name: string) => {
      if (!voiceOf.has(name)) voiceOf.set(name, voiceCount++);
      const idx = voiceOf.get(name) || 0;
      return idx === 0 ? 1.0 : idx === 1 ? 0.9 : 0.95;
    };
    // Sıcaklık: hızı %4 kıs (daha tok ve dolgun), perdeyi 0.97 ile yumuşat
    const warmRate = Math.max(0.8, ttsRateForLevel(level) * 0.96);
    const snapshot = lines;
    const clampPitch = (p: number) => Math.max(0.8, Math.min(1.3, p));
    do {
      for (let i = 0; i < snapshot.length; i++) {
        if (playCtl.current.stop) break;
        const sents = splitSentences(snapshot[i].target_text);
        for (let s = 0; s < sents.length; s++) {
          if (playCtl.current.stop) break;
          setPlayPos({ i, s });
          const t = sents[s];
          const base = /[?？]$/.test(t) ? 1.15 : /[!！]$/.test(t) ? 1.12 : 0.97;
          const pitch = clampPitch(base * moodPitch(t) * speakerPitch(snapshot[i].speaker));
          const phrases = splitPhrases(t);
          for (let p = 0; p < phrases.length; p++) {
            if (playCtl.current.stop) break;
            await speakOnce(phrases[p], targetTts, pitch, warmRate);
            if (!playCtl.current.stop && p < phrases.length - 1) await waitGap(breathMs);
          }
          if (!playCtl.current.stop && s < sents.length - 1) await waitGap(gapMs);
        }
        if (!playCtl.current.stop) await waitGap(350);
      }
      // Kusursuz döngü: başa sararken üst üste binmesin diye es ver (çıt-pıt yok)
      if (loop && !playCtl.current.stop) await waitGap(800);
    } while (loop && !playCtl.current.stop);
    setPlaying(false);
    setLoopMode(false);
    setPlayPos(null);
  }

  // 🇹 Türkçesini Dinle: o satırın anlamı BİR KEZ okunur — tekrar modu yok.
  // Döngü çalıyorsa önce o durdurulur (sesler üst üste binmesin).
  function playTurkish(text: string) {
    if (playing) stopLoop();
    speakText(text, nativeTts, { level });
  }

  // 🗑 Metni sil (vazgeç)
  function discard() {
    stopLoop();
    setLines(null);
    setErr(null);
  }

  async function generate() {
    if (nativeLang === targetLang) {
      setErr("Ana dil ile hedef dil aynı olamaz.");
      return;
    }
    stopLoop();
    setLoading(true);
    setErr(null);
    setLines(null);
    try {
      const seen = getSeen("dialogue", activeTopic, level, targetLang);
      const res = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetLang, native: nativeLang, level, topic: activeTopic, seen }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.lines) || data.lines.length === 0) {
        setErr("Diyalog üretilemedi. Biraz sonra tekrar dene.");
        return;
      }
      setLines(data.lines);
      addSeen("dialogue", activeTopic, level, targetLang, data.lines.map((l: DialogueLine) => l.target_text));
      sfx.correct();
    } catch {
      setErr("Bağlantı hatası. Tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!lines || lines.length === 0) return;
    const entry: SavedDialogue = {
      id: `${Date.now()}`,
      ts: Date.now(),
      language_code: targetLang,
      target: targetLang,
      native: nativeLang,
      level,
      topic: activeTopic,
      lines,
    };
    const next = [entry, ...loadSaved()].slice(0, STORE_CAP);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {}
    setSaved(next);
    sfx.xp();
    store.post({ type: "learn-words", gainedXp: 10, words: 0 });
    store.addXpFlash(10);
  }

  function remove(id: string) {
    const next = loadSaved().filter((d) => d.id !== id);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {}
    setSaved(next);
    if (viewId === id) setViewId(null);
  }

  const codes = useMemo(() => {
    const set = new Map<string, number>();
    for (const d of saved) set.set(d.language_code, (set.get(d.language_code) || 0) + 1);
    return [...set.entries()];
  }, [saved]);

  const shown = filter === "all" ? saved : saved.filter((d) => d.language_code === filter);
  const viewing = viewId ? saved.find((d) => d.id === viewId) || null : null;

  const speakLine = (text: string) => speakText(text, targetTts, { level });

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
      <div className="absolute inset-0 bg-[#061827]" />
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center justify-between">
          <button onClick={back} className="glass h-10 w-10 rounded-full">←</button>
          <div className="text-center">
            <div className="text-sm font-black text-white">💬 Diyalog Stüdyosu</div>
            <div className="text-[10px] text-slate-400">
              {nativeDef?.flag} {nativeDef?.spoken} → {targetDef?.flag} {targetDef?.spoken}
            </div>
          </div>
          <span className="w-10" />
        </div>

        {/* Üretim paneli — hedef/anadil/seviye/konu dinamik */}
        <div className="glass mt-4 rounded-3xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Konu / İlgi alanı</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="örn. Havaalanında kayıp bagaj…"
            className="glass mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TOPICS.slice(0, 8).map((t) => (
              <button
                key={t.key}
                onClick={() => setTopic(t.name)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  topic === t.name
                    ? "border-[#ffd52f]/60 bg-[#ffd52f]/15 text-[#ffd52f]"
                    : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Seviye</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CEFR.map((c) => (
              <button
                key={c.level}
                onClick={() => setLevel(c.level)}
                className={`rounded-xl px-3 py-1.5 text-xs font-black ${
                  level === c.level ? "gold-btn" : "ghost-btn text-slate-300"
                }`}
              >
                {c.level}
              </button>
            ))}
          </div>
          {err && <div className="mt-2 text-xs text-[#ffb0a0]">{err}</div>}
          <button
            onClick={generate}
            disabled={loading}
            className="gold-btn mt-3 w-full rounded-2xl py-4 text-base disabled:opacity-50"
          >
            {loading ? "🧠 Yazılıyor…" : `🤖 Groq AI ile ${targetDef?.spoken} Diyalog Oluştur`}
          </button>
          <div className="mt-1.5 text-center text-[10px] text-slate-500">
            Seviyeni seç, konuyu yaz — {targetDef?.flag} {targetDef?.spoken} metin + 🇹 çeviri gelir
          </div>
        </div>

        {/* Üretilen diyalog */}
        {lines && lines.length > 0 && (
          <div className="glass mt-4 rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-[#ffd52f]">
                {activeTopic} • {level}
              </div>
              <div className="text-[10px] text-slate-400">
                {targetDef?.flag} {targetDef?.spoken} • {lines.length} satır
              </div>
            </div>
            {/* 🎧 Çift yönlü seslendirme: yabancı Dinle/Tekrar + Türkçe tek-sefer */}
            <div className="mt-2 rounded-2xl border border-cyan-300/30 bg-[#0b2940] px-3 py-2.5">
              {!playing ? (
                <div className="flex gap-2">
                  <button onClick={() => playForeign(false)} className="gold-btn flex-1 rounded-xl py-3 text-sm font-black">
                    ▶ Dinle
                  </button>
                  <button onClick={() => playForeign(true)} className="flex-1 rounded-xl border border-[#ffd52f]/50 bg-[#ffd52f]/10 py-3 text-sm font-black text-[#ffd52f]">
                    🔁 Tekrar Modu
                  </button>
                </div>
              ) : (
                <button onClick={stopLoop} className="w-full rounded-xl border border-red-400/50 bg-red-500/15 py-3 text-sm font-black text-red-200">
                  ⏹ Durdur{loopMode ? " (tekrar modu kapanır)" : ""}
                </button>
              )}
              <div className="mt-1 text-center text-[10px] text-slate-400">
                {playing && playPos
                  ? `🔊 ${playPos.i + 1}/${lines.length} • ${targetDef?.flag} ${targetDef?.spoken} okunuyor…${loopMode ? " • bitince başa sarar 🔁" : ""}`
                  : "▶ bir kez çalar • 🔁 kapatana kadar döner • 🇹 Türkçe satırdaki ikonla, bir kez"}
              </div>
            </div>
            <div className="mt-2 space-y-2">
              {lines.map((l, i) => {
                const active = playing && playPos?.i === i;
                const sents = active || playing ? splitSentences(l.target_text) : [l.target_text];
                return (
                  <div
                    key={i}
                    className={`rounded-2xl bg-white/5 px-3 py-2 ring-1 transition ${
                      active ? "ring-[#ffd52f]/70 bg-[#ffd52f]/5" : "ring-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded-full bg-[#0e3048] px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                        {l.speaker}
                      </span>
                      <p className="flex-1 text-sm font-semibold text-white">
                        {sents.map((s, si) => (
                          <span
                            key={si}
                            className={
                              active && playPos?.s === si
                                ? "rounded bg-[#ffd52f]/25 text-[#ffd52f]"
                                : undefined
                            }
                          >
                            {active && playPos?.s === si ? "🔊 " : ""}
                            {s}{" "}
                          </span>
                        ))}
                      </p>
                      <button
                        onClick={() => speakLine(l.target_text)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00bfff] text-xs"
                        title="Orijinal aksanla dinle (bir kez)"
                      >
                        🔊
                      </button>
                    </div>
                    <div className="mt-1 flex items-start gap-1.5 pl-1">
                      <p className="flex-1 text-[11px] text-slate-400">🇹 {l.native_text}</p>
                      <button
                        onClick={() => playTurkish(l.native_text)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] hover:bg-white/20"
                        title="Türkçesini dinle (bir kez, tekrar yok)"
                      >
                        🇹🔊
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={generate} disabled={loading} className="ghost-btn flex-1 rounded-2xl py-3 text-sm disabled:opacity-50">
                🔄 Yeni varyant
              </button>
              <button onClick={save} className="gold-btn flex-1 rounded-2xl py-3 text-sm">
                💾 Kaydet +10 XP
              </button>
              <button onClick={discard} className="rounded-2xl border border-red-400/40 px-4 py-3 text-sm text-red-300" title="Metni sil, vazgeç">
                🗑
              </button>
            </div>
          </div>
        )}

        {/* Kayıtlı diyaloglar — language_code filtresi */}
        <div className="glass mt-4 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">📚 Kayıtlı Diyaloglarım ({saved.length})</h3>
          </div>
          {saved.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  filter === "all" ? "gold-btn" : "ghost-btn text-slate-300"
                }`}
              >
                Tümü ({saved.length})
              </button>
              {codes.map(([code, n]) => {
                const def = LANGS.find((l) => l.code === code);
                return (
                  <button
                    key={code}
                    onClick={() => setFilter(code)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      filter === code ? "gold-btn" : "ghost-btn text-slate-300"
                    }`}
                  >
                    {def?.flag} {def?.spoken || code} ({n})
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {shown.length === 0 && (
              <div className="text-center text-xs text-slate-500">
                {saved.length === 0 ? "Henüz kayıt yok — yukarıdan üret, kaydet." : "Bu dilde kayıt yok."}
              </div>
            )}
            {shown.map((d) => {
              const def = LANGS.find((l) => l.code === d.language_code);
              const open = viewId === d.id;
              return (
                <div key={d.id} className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                  <button onClick={() => setViewId(open ? null : d.id)} className="flex w-full items-center gap-2 text-left">
                    <span className="text-lg">{def?.flag || "🌍"}</span>
                    <span className="flex-1">
                      <span className="block text-xs font-bold text-white">{d.topic}</span>
                      <span className="block text-[10px] text-slate-400">
                        {def?.spoken} • {d.level} • {d.lines.length} satır • {new Date(d.ts).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="text-slate-400">{open ? "▾" : "▸"}</span>
                  </button>
                  {open && (
                    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
                      {(viewing?.id === d.id ? viewing.lines : d.lines).map((l, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold text-cyan-200">{l.speaker}: </span>
                          <span className="text-slate-200">{l.target_text}</span>
                          <span className="block pl-1 text-[11px] text-slate-500">🇹 {l.native_text}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            const tts = LANGS.find((x) => x.code === d.target)?.tts || targetTts;
                            speakText(d.lines.map((l) => `${l.speaker}: ${l.target_text}`).join(" "), tts, { level: d.level });
                          }}
                          className="ghost-btn flex-1 rounded-xl py-2 text-xs"
                        >
                          🔊 Dinle
                        </button>
                        <button onClick={() => remove(d.id)} className="rounded-xl border border-red-400/40 px-3 py-2 text-xs text-red-300">
                          Sil
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dialogue;

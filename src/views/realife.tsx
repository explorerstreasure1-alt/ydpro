"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import { IMG } from "@/lib/img";
import { TALK_TOPICS } from "@/lib/content";

type Msg = { role: "ai" | "user"; text: string };

export function RealLife({ back }: { back: () => void }) {
  const store = useStore();
  const [phase, setPhase] = useState<"topic" | "chat">("topic");
  const [topic, setTopic] = useState<string>("daily");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hi! Welcome to the stage. Let's talk in English. I'll help you, and I can switch to Turkish if you get stuck. ✨" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<null | any>(null);
  const [speaking, setSpeaking] = useState(false);
  const [transMap, setTransMap] = useState<Record<number, string>>({});
  const rec = useRef<any>(null);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const micSupport =
    typeof window !== "undefined" &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  function record() {
    const win: any = window;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      return;
    }
    const r = new SR();
    r.lang = "en-GB";
    r.interimResults = false;
    r.maxAlternatives = 1;
    setSpeaking(true);
    r.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript.trim();
      setInput((p) => (p ? p + " " + text : text));
      sendRaw(text);
    };
    r.onerror = () => setSpeaking(false);
    r.onend = () => setSpeaking(false);
    rec.current = r;
    try {
      r.start();
    } catch {
      setSpeaking(false);
    }
  }

  function sendRaw(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMsgs((p) => [...p, { role: "user", text: clean }]);
    setInput("");
    setBusy(true);
    fetch("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        message: clean,
        history: msgs.filter((m) => m.role === "ai" || m.role === "user").map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
      }),
    })
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        const reply = data?.reply || "That's great! Tell me more.";
        setMsgs((p) => [...p, { role: "ai", text: reply }]);
        setBusy(false);
        speak(reply);
      });
  }

  async function translateAi(i: number) {
    const text = msgs[i]?.text || "";
    if (transMap[i]) return;
    try {
      const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).then((x) => x.json());
      if (r.tr) setTransMap((m) => ({ ...m, [i]: r.tr }));
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendRaw(text);
  }

  function speak(text: string) {
    try {
      synth?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = 0.95;
      synth?.speak(u);
    } catch {}
  }

  function stopChat() {
    setReport({
      usage: 84,
      kelime: 91,
      dogruluk: 84,
      telaffuz: 82,
      akicilik: 76,
      count: msgs.length - 1,
    });
  }

  if (phase === "topic") {
    return (
      <RealShell>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url('${IMG.cityBgWide}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] to-transparent" />
        <div className="relative z-10 mt-2 px-1 text-center">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#00bfff]">Gerçek Hayat Modu</div>
          <h2 className="text-xl font-black text-white">🎙 Bugün ne konuşmak istersin?</h2>
          <p className="text-xs text-slate-400">AI bir karakter olur, sen konuşursun. Serbest sohbet, özgür cevap.</p>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 px-1">
          {TALK_TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTopic(t.key); setPhase("chat"); }}
              className="glass rounded-2xl p-4 text-left hover:border-cyan-300/60"
            >
              <div className="text-3xl">{t.emoji}</div>
              <div className="mt-2 text-sm font-bold">{t.label}</div>
            </button>
          ))}
        </div>
        <div className="relative z-10 mx-1 mt-4 glass rounded-2xl p-3 text-xs text-slate-300">
          💡 Serbest konuşmada seçenek yok — kendi cümleni kur. AI seni motive eder, hata yaparsan düzelterek devam ederiz.
        </div>
        <button onClick={back} className="ghost-btn relative z-10 mt-3 w-full rounded-2xl py-3 text-sm">‹ Ana ekrana</button>
      </RealShell>
    );
  }

  return (
    <RealShell>
      {report ? (
        <div className="glass m-3 flex-1 rounded-3xl p-5">
          <h3 className="text-center text-xl font-black text-grad">Konuşma Raporu</h3>
          <div className="mt-1 text-center text-xs text-slate-400">Bugünün Konuşması #1</div>
          <div className="mt-5 text-center">
            <div className="text-6xl font-black text-[#ffd52f]">{report.usage}</div>
            <div className="text-xs text-slate-300">Genel Skor /100</div>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ["Kelime kullanımı", report.kelime, "🧠"],
              ["Cümle doğruluğu", report.dogruluk, "✅"],
              ["Telaffuz", report.telaffuz, "🎙"],
              ["Akıcılık", report.akicilik, "💨"],
            ].map(([n, v, e]) => (
              <div key={n as string} className="glass rounded-2xl px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{e} {n}</span>
                  <span className="font-black text-cyan-200">%{v}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ffd52f] to-[#00bfff]" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Düzenli konuşarak telaffuzunu ve akıcılığını artırabilirsin.</p>
          <button onClick={() => { setReport(null); setMsgs([{ role: "ai", text: "Great! Let's keep talking. ne konuşalım? 🎧" }]); }} className="gold-btn mt-4 w-full rounded-2xl py-3">
            Yeni Konuşma Başlat
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 pt-3">
            <button onClick={() => setPhase("topic")} className="glass h-9 w-9 rounded-full">←</button>
            <div className="glass flex-1 rounded-xl px-3 py-1.5 text-xs font-bold">
              {TALK_TOPICS.find((t) => t.key === topic)?.emoji} Gerçek Hayat · {TALK_TOPICS.find((t) => t.key === topic)?.label}
            </div>
            <button onClick={stopChat} className="glass h-9 rounded-full px-3 text-xs font-bold text-[#00bfff]">
              Rapor
            </button>
          </div>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-[#0e3048] to-[#0b2940] border border-cyan-400/30 text-white"
                      : "bg-white text-slate-900"
                  }`}
                >
                  {m.role === "ai" && (
                    <div className="mb-0.5 text-[10px] font-bold text-slate-400">{TALK_TOPICS.find((t) => t.key === topic)?.emoji} AI</div>
                  )}
                  {m.text}
                  {m.role === "ai" && (
                    <div className="mt-1.5 border-t border-slate-200 pt-1">
                      {!transMap[i] ? (
                        <button onClick={() => translateAi(i)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">
                          🔁 Çevir
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600">🇹 {transMap[i]}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-500">AI yazıyor...</div>}
          </div>
          <div className="border-t border-white/10 bg-[#061827]/90 px-3 py-2.5">
            <div className="flex items-end gap-2">
              <button onClick={() => speak(msgs[msgs.length - 1]?.text || "")} className="ghost-btn h-11 w-11 shrink-0 rounded-full text-lg">
                🔊
              </button>
              {micSupport && (
                <button
                  onClick={record}
                  disabled={busy}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${speaking ? "bg-red-500 text-white animate-glowpulse" : "ghost-btn"}`}
                  title="Mikrofonla konuş"
                >
                  🎙
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="İngilizce cevap yaz..."
                className="glass flex-1 rounded-2xl px-4 py-2.5 text-white outline-none placeholder:text-slate-500"
              />
              <button onClick={send} disabled={!input || busy} className="gold-btn h-11 w-11 shrink-0 rounded-full text-lg disabled:opacity-50">
                ➤
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] text-slate-500">Takılırsan “nasıl derim?” yaz, seni yönlendireyim</div>
          </div>
        </>
      )}
    </RealShell>
  );
}

function RealShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {children}
      <div className="mt-auto sticky bottom-0 z-20">
        <BottomNav active="talk" onChange={() => {}} />
      </div>
    </div>
  );
}

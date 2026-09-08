"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { LANGS } from "@/lib/levels";
import { LANG_PHOTO } from "@/lib/img";

const GOALS = [
  { emoji: "✈️", label: "Seyahat" },
  { emoji: "💼", label: "Kariyer" },
  { emoji: "🎓", label: "Eğitim" },
  { emoji: "❤️", label: "Kişisel gelişim" },
  { emoji: "🌍", label: "Yurtdışında yaşamak" },
];
const TIMES = ["5 dakika", "10 dakika", "15 dakika", "20+ dakika"];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("Seyahat");
  const [time, setTime] = useState("10 dakika");
  const [native, setNative] = useState((store as any).nativeLang || "tr");
  const [target, setTarget] = useState((store as any).targetLang || "en");

  async function submit() {
    (store as any).setNativeLang(native);
    (store as any).setTargetLang(target);
    const targetName = LANGS.find(l=>l.code===target)?.name || "İngilizce";
    await store.post({
      type: "onboard",
      input: `${name || "Yolcu"}\n${goal}\n${time}\n${targetName}`,
    });
    onDone();
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-8">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage:
            "url('https://images.pexels.com/photos/16113701/pexels-photo-16113701.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#03111d]" />
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>7DİL · Kayıt</span>
          <span>{step + 1}/4</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-[#ffd52f] transition-all ${i <= step ? "w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-10 flex-1">
          {step === 0 && (
            <div className="animate-pop">
              <h2 className="text-2xl font-black text-grad">Aramıza hoş geldin! ✈️</h2>
              <p className="mt-1 text-sm text-slate-400">Sana nasıl seslenelim?</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="İsmin (örn. Ayşe, Mehmet...)"
                className="glass mt-5 w-full rounded-2xl px-4 py-4 text-base outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </div>
          )}
          {step === 1 && (
            <div className="animate-pop">
              <h2 className="text-2xl font-black text-grad">Neden dil öğreniyorsun?</h2>
              <p className="mt-1 text-sm text-slate-400">Görevler buna göre şekillenecek.</p>
              <div className="mt-5 space-y-2.5">
                {GOALS.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => setGoal(g.label)}
                    className={`glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                      goal === g.label ? "glow-gold border border-[#ffd52f]/60" : ""
                    }`}
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="font-semibold">{g.label}</span>
                    {goal === g.label && <span className="ml-auto text-[#ffd52f]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="animate-pop">
              <h2 className="text-2xl font-black text-grad">Dil çifti seç — profesyonel</h2>
              <p className="mt-1 text-sm text-slate-400">Ana dilin ve öğrenmek istediğin dil — AI ikisine göre ayarlanır.</p>
              <div className="mt-4">
                <div className="text-[11px] font-bold text-cyan-200 uppercase tracking-widest">Ana dilim</div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {LANGS.map(l=>(
                    <button key={"on-n"+l.code} onClick={()=>setNative(l.code)} className={`relative overflow-hidden flex flex-col items-center rounded-xl border py-2 text-[10px] font-semibold ${native===l.code?"border-cyan-300 bg-cyan-400/10 text-white":"border-white/10 text-slate-300"}`}>
                      <span className="text-sm">{l.flag}</span><span className="text-[9px]">{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[11px] font-bold text-[#ffd52f] uppercase tracking-widest">Hedef dil</div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {LANGS.map(l=>(
                    <button key={"on-t"+l.code} onClick={()=>{ if(l.code!==native) setTarget(l.code); }} disabled={l.code===native} className={`relative overflow-hidden flex flex-col items-center rounded-xl border py-2 text-[10px] font-semibold disabled:opacity-30 ${target===l.code?"border-[#ffd52f] bg-[#ffd52f]/10 text-white":"border-white/10 text-slate-300"}`}>
                      <span className="text-sm">{l.flag}</span><span className="text-[9px]">{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-center text-[11px] text-slate-400">{LANGS.find(l=>l.code===native)?.flag} {LANGS.find(l=>l.code===native)?.spoken} → {LANGS.find(l=>l.code===target)?.flag} {LANGS.find(l=>l.code===target)?.spoken}</div>
            </div>
          )}
          {step === 3 && (
            <div className="animate-pop">
              <h2 className="text-2xl font-black text-grad">Günde ne kadar zamanın var?</h2>
              <p className="mt-1 text-sm text-slate-400">Küçük ama düzenli günlük görevler oyunun anahtarı.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {TIMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={`glass rounded-2xl px-4 py-5 text-lg font-bold transition ${
                      time === t ? "border border-[#00bfff]/70 glow-cyan" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (step < 3) setStep(step + 1);
            else submit();
          }}
          className="gold-btn w-full rounded-2xl py-4 text-base"
        >
          {step < 3 ? "Devam →" : "Maceraya Başla 🎮"}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { LANGS, CEFR } from "@/lib/levels";
import { LANG_PHOTO } from "@/lib/img";
import { getAllSettings, setLangSetting, LangSetting } from "@/lib/langSettings";

export function LangSettingsView({ back }: { back: () => void }) {
  const [settings, setSettings] = useState<Record<string, LangSetting>>({});

  useEffect(() => {
    setSettings(getAllSettings());
    const h = () => setSettings(getAllSettings());
    window.addEventListener("lang-settings-changed", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("lang-settings-changed", h); window.removeEventListener("storage", h); };
  }, []);

  const update = (code: string, patch: Partial<LangSetting>) => {
    setLangSetting(code, patch);
    setSettings(getAllSettings());
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <div className="flex items-center gap-3">
        <button onClick={back} className="glass h-10 w-10 rounded-full">←</button>
        <div>
          <h2 className="text-lg font-black text-white">Diller — Ayrı Ayar</h2>
          <p className="text-[11px] text-slate-400">Her dil için ayrı seviye, hız, çeviri — hedef dil değil, tüm diller</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 pb-24">
        {LANGS.map(l => {
          const s = settings[l.code];
          if (!s) return null;
          const cefr = CEFR.find(c=>c.level===s.level) || CEFR[0];
          return (
            <div key={l.code} className={`glass rounded-2xl p-3 ${s.enabled ? "ring-1 ring-cyan-300/20" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <img src={LANG_PHOTO[l.code] || ""} alt={l.name} className="h-12 w-12 rounded-xl object-cover" referrerPolicy="no-referrer" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{l.flag}</span>
                    <span className="text-sm font-black text-white">{l.name}</span>
                    <span className="text-[10px] text-slate-500">{l.spoken}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{s.enabled ? `${s.level} • ${cefr.title} • ${s.dailyMinutes}` : "Kapalı"}</div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" checked={s.enabled} onChange={e=>update(l.code,{enabled:e.target.checked})} className="peer sr-only" />
                  <div className="peer h-6 w-11 rounded-full bg-white/10 peer-checked:bg-cyan-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>

              {s.enabled && (
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Seviye — {l.name} için ayrı</div>
                    <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                      {CEFR.map(c=>(
                        <button key={c.level} onClick={()=>update(l.code,{level:c.level})} className={`rounded-xl border py-1.5 text-[10px] font-black ${s.level===c.level ? "bg-[#ffd52f] text-[#03111d] border-[#ffd52f]" : "border-white/10 text-slate-300"}`}>{c.level}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">Okuma Hızı</div>
                      <input type="range" min={0.8} max={1.4} step={0.1} value={s.voiceRate} onChange={e=>update(l.code,{voiceRate: parseFloat(e.target.value)})} className="w-full accent-cyan-400" />
                      <div className="text-[10px] text-cyan-200">{s.voiceRate.toFixed(1)}× {s.voiceRate>1.1?"hızlı":"normal"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">Çeviri Göster</div>
                      <label className="flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={s.showTranslation} onChange={e=>update(l.code,{showTranslation:e.target.checked})} className="rounded" />
                        <span className="text-xs text-slate-300">{s.showTranslation?"Açık":"Kapalı"}</span>
                      </label>
                      <label className="flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={s.autoPlay} onChange={e=>update(l.code,{autoPlay:e.target.checked})} className="rounded" />
                        <span className="text-xs text-slate-300">Otomatik okuma</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass mt-3 rounded-2xl p-3 text-[11px] text-slate-400">
        💡 Her dilin ayarı ayrı saklanır. Hedef dil Portekizce ise Portekizce kartlar Portekizce hızında okunur, Almanca ise Almanca. Koşullar, ortamlar, telafuz hepsi bu ayara göre.
      </div>
    </div>
  );
}

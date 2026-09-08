"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import { IMG, LANG_PHOTO } from "@/lib/img";
import { LevelPill } from "@/lib/ui";
import { LANGS } from "@/lib/levels";

export function Profile({ goProgress, goHome }: { goProgress: () => void; goHome: () => void }) {
  const store = useStore();
  const u = store.user;
  const [name, setName] = useState(u?.name || "Yolcu");
  const nativeLang = (store as any).nativeLang as string;
  const targetLang = (store as any).targetLang as string;
  const setNativeLang = (store as any).setNativeLang as (c:string)=>void;
  const setTargetLang = (store as any).setTargetLang as (c:string)=>void;
  const nativeDef = LANGS.find(l=>l.code===nativeLang) || LANGS.find(l=>l.code==="tr")!;
  const targetDef = LANGS.find(l=>l.code===targetLang) || LANGS.find(l=>l.code==="en")!;

  async function save() {
    await store.post({ type: "onboard", input: `${name || "Yolcu"}\n${u?.goal || "Seyahat"}\n${u?.dailyMinutes || "10 dakika"}\n${targetDef.name}` });
    store.setToast(`Kaydedildi ✅ ${nativeDef.flag} → ${targetDef.flag}`);
    setTimeout(() => store.setToast(null), 1800);
  }

  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
        <div className="glass p-4 text-center">
          {/* avatar */}
          <div className="mx-auto h-20 w-20 overflow-hidden rounded-full ring-2 ring-cyan-300/40">
            <img src={IMG.travelerSmile} alt="avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="mt-2">
            {u && <LevelPill lvl={u.level} name={u.levelName} />}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            ⭐ {u?.xp} XP · 🔥 {u?.streak} gün seri · 🎯 {u?.missionsDone} görev
          </div>
        </div>

        <div className="glass mt-3 p-4">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">İsim</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass mt-1 w-full rounded-2xl px-3 py-2.5 text-white outline-none"
          />

          {/* Profesyonel dil çifti — ana dil → hedef dil, tüm dillere uyumlu */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-cyan-300/20">
              <img src={LANG_PHOTO[nativeLang] || IMG.cityBgWide} alt={nativeDef.name} className="h-20 w-full object-cover opacity-60" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] to-transparent" />
              <div className="absolute bottom-1 left-2 text-[10px] font-black text-white">{nativeDef.flag} {nativeDef.name}</div>
              <div className="absolute top-1 left-2 text-[9px] font-bold text-cyan-200 uppercase tracking-widest">Ana Dilim</div>
            </div>
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-[#ffd52f]/30">
              <img src={LANG_PHOTO[targetLang] || IMG.cityBgWide} alt={targetDef.name} className="h-20 w-full object-cover opacity-60" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#03111d] to-transparent" />
              <div className="absolute bottom-1 left-2 text-[10px] font-black text-white">{targetDef.flag} {targetDef.name}</div>
              <div className="absolute top-1 left-2 text-[9px] font-bold text-[#ffd52f] uppercase tracking-widest">Hedef Dil</div>
            </div>
          </div>
          <div className="mt-1 text-center text-[10px] text-slate-400">{nativeDef.flag} {nativeDef.spoken} → {targetDef.flag} {targetDef.spoken} • AI her ikisinde de aynı kalite</div>

          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-cyan-200">Ana dilim (kendi dilim)</div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {LANGS.map((l) => (
                <button key={"n"+l.code} onClick={() => setNativeLang(l.code)} className={`relative overflow-hidden flex flex-col items-center rounded-xl border py-2 text-[10px] font-semibold ${nativeLang===l.code ? "border-cyan-300/80 bg-cyan-400/10 text-white glow-cyan" : "border-white/10 text-slate-300"}`}>
                  <span className="text-sm">{l.flag}</span><span className="text-[9px] leading-tight">{l.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#ffd52f]">Öğrenmek istediğim dil</div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {LANGS.map((l) => (
                <button key={"t"+l.code} onClick={() => setTargetLang(l.code)} className={`relative overflow-hidden flex flex-col items-center rounded-xl border py-2 text-[10px] font-semibold ${targetLang===l.code ? "border-[#ffd52f]/80 bg-[#ffd52f]/10 text-white glow-gold" : "border-white/10 text-slate-300"} ${nativeLang===l.code ? "opacity-40" : ""}`} disabled={nativeLang===l.code}>
                  <span className="text-sm">{l.flag}</span><span className="text-[9px] leading-tight">{l.name}</span>
                </button>
              ))}
            </div>
            {nativeLang===targetLang && <p className="mt-1 text-[10px] text-[#ffb0a0]">Ana dil ile hedef dil aynı olamaz.</p>}
          </div>

          <p className="mt-2 text-[10px] text-slate-500">Örn: Ana dil İngilizce, hedef Rusça → tüm dersler, düzeltmeler, çeviriler İngilizce ↔ Rusça olur. Profesyonel çok dilli.</p>
          <button onClick={save} className="gold-btn mt-4 w-full rounded-2xl py-3">
            Kaydet → {nativeDef.flag} → {targetDef.flag}
          </button>
        </div>

        <div className="glass mt-3 p-4">
          <h3 className="text-sm font-black text-grad">⚙️ Ayarlar</h3>
          <button
            onClick={store.toggleMute}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <span className="text-sm font-semibold">🔊 Ses efektleri</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${store.muted ? "bg-white/10 text-slate-400" : "bg-emerald-500/20 text-emerald-300"}`}>
              {store.muted ? "Kapalı" : "Açık"}
            </span>
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {["🗣️ Yavaş konuşma", "💬 Altyazı", "🔁 Çeviri"].map((s) => (
              <span key={s} className="ghost-btn rounded-full px-3 py-1.5 text-xs text-slate-200">{s} · Açık</span>
            ))}
          </div>
          <button onClick={goProgress} className="ghost-btn mt-4 w-full rounded-2xl py-3 text-sm text-cyan-100">
            📊 İlerlememi gör
          </button>
        </div>

        <button onClick={goHome} className="mt-4 text-xs text-slate-500 hover:text-slate-300">‹ Ana ekran</button>
      </div>
      <BottomNav active="profile" onChange={() => {}} />
    </>
  );
}

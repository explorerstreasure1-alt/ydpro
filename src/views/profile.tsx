"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/nav";
import type { Tab } from "@/components/nav";
import { IMG, LANG_PHOTO } from "@/lib/img";
import { LevelPill } from "@/lib/ui";
import { LANGS } from "@/lib/levels";
import { useLangPair } from "@/lib/useLangPair";

export function Profile({ goProgress, goHome, goLangSettings, gotoTab }: { goProgress: () => void; goHome: () => void; goLangSettings: () => void; gotoTab: (t: Tab) => void }) {
  const store = useStore();
  const u = store.user;
  const [name, setName] = useState(u?.name || "Yolcu");
  const [ttsPass, setTtsPass] = useState("");
  const [ttsState, setTtsState] = useState<"unknown" | "on" | "off">("unknown");
  const [ttsErr, setTtsErr] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsDiag, setTtsDiag] = useState<{ keyPresent?: boolean; passSet?: boolean; last?: string | null }>({});
  const [vh, setVh] = useState<{ ready: boolean | null; enName: string | null; trName: string | null; platform: string }>({ ready: null, enName: null, trName: null, platform: "desktop" });
  const [vhBusy, setVhBusy] = useState(false);
  const { nativeLang, targetLang, nativeDef, targetDef, setNativeLang, setTargetLang } = useLangPair();

  async function save() {
    await store.post({ type: "onboard", input: `${name || "Yolcu"}\n${u?.goal || "Seyahat"}\n${u?.dailyMinutes || "10 dakika"}\n${targetDef.name}` });
    store.setToast(`Kaydedildi ✅ ${nativeDef.flag} → ${targetDef.flag}`);
    setTimeout(() => store.setToast(null), 1800);
  }

  useEffect(() => {
    fetch("/api/tts")
      .then((r) => r.json())
      .then((j) => {
        setTtsState(j?.unlocked ? "on" : "off");
        setTtsDiag({ keyPresent: !!j?.keyPresent, passSet: !!j?.passSet });
      })
      .catch(() => setTtsState("off"));
    import("@/lib/eleven").then((m) => setTtsDiag((d) => ({ ...d, last: m.elevenLastError() }))).catch(() => {});
    refreshVoiceHealth();
  }, []);

  async function refreshVoiceHealth() {
    setVhBusy(true);
    try {
      const { checkVoiceHealth } = await import("@/lib/voiceSetup");
      const h = await checkVoiceHealth();
      setVh({ ready: h.ready, enName: h.enName, trName: h.trName, platform: h.platform });
    } catch {
      setVh((v) => ({ ...v, ready: false }));
    } finally {
      setVhBusy(false);
    }
  }

  async function unlockStudio() {
    if (!ttsPass || ttsBusy) return;
    setTtsBusy(true);
    setTtsErr(null);
    try {
      const r = await fetch("/api/tts/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ttsPass }),
      });
      if (r.ok) {
        setTtsPass("");
        setTtsState("on");
        const { refreshEleven } = await import("@/lib/eleven");
        await refreshEleven();
        store.setToast("🎙 Stüdyo sesi açıldı");
        setTimeout(() => store.setToast(null), 2000);
      } else {
        setTtsErr("Hatalı şifre");
      }
    } catch {
      setTtsErr("Bağlantı hatası");
    } finally {
      setTtsBusy(false);
    }
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
          {/* Stüdyo sesi — şifreyle açılır, şifre koda yazılmaz, noktayla gizlenir */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">🎙 Stüdyo sesi</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${ttsState === "on" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
                {ttsState === "on" ? "Açık" : ttsState === "off" ? "Kapalı" : "..."}
              </span>
            </div>
            {ttsState !== "on" && (
              <div className="mt-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={ttsPass}
                    onChange={(e) => setTtsPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && unlockStudio()}
                    placeholder="Özel şifre"
                    autoComplete="off"
                    className="glass flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <button onClick={unlockStudio} disabled={ttsBusy || !ttsPass} className="gold-btn rounded-xl px-4 text-sm disabled:opacity-50">
                    {ttsBusy ? "..." : "Aç"}
                  </button>
                </div>
                {ttsErr && <div className="mt-1.5 text-xs font-semibold text-[#ffb0a0]">{ttsErr}</div>}
                <div className="mt-1 text-[10px] text-slate-500">Açıkken ElevenLabs stüdyo sesiyle okur, kapalıyken tarayıcı sesi.</div>
                {(ttsDiag.keyPresent === false || ttsDiag.passSet === false || ttsDiag.last) && (
                  <div className="mt-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400">
                    {ttsDiag.keyPresent === false && <div>⚠️ Anahtar yok (Vercel: ELEVENLABS_API_KEY + redeploy)</div>}
                    {ttsDiag.passSet === false && <div>⚠️ Şifre değişkeni yok (Vercel: ELEVENLABS_TTS_PASSWORD + redeploy)</div>}
                    {ttsDiag.last === "QUOTA" && <div>⚠️ Stüdyo kotası bitti — tarayıcı sesindeyiz</div>}
                    {ttsDiag.last === "LIMIT" && <div>⚠️ Hız limiti — birazdan stüdyoya dönülür</div>}
                    {(ttsDiag.last === "KEY" || ttsDiag.last === "HTTP_401") && <div>⚠️ Anahtarda ses izni yok (ElevenLabs panelinden Text-to-Speech izni aç)</div>}
                    {ttsDiag.last === "EDGE" && <div>⚠️ Stüdyo + ücretsiz ses yanıt vermedi — tarayıcı sesindeyiz</div>}
                    {ttsDiag.last && !["QUOTA", "LIMIT", "KEY", "HTTP_401"].includes(ttsDiag.last) && <div>⚠️ Son durum: {ttsDiag.last}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={goLangSettings} className="gold-btn mt-4 w-full rounded-2xl py-3 text-sm">
            🌍 Tüm Diller — Ayrı Ayarlar (14 dil)
          </button>
          {/* Ses Kurulumu — ElevenLabs'sız muazzam sesin düğmesi */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">🔊 Ses Kurulumu</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${vh.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
                {vh.ready === null ? "..." : vh.ready ? "Hazır ✓" : "Kurulum gerekli"}
              </span>
            </div>
            {(vh.enName || vh.trName) && (
              <div className="mt-1 text-[10px] text-slate-500">EN: {vh.enName || "—"} · TR: {vh.trName || "—"}</div>
            )}
            {vh.ready === false && (
              <div className="mt-2">
                {vh.platform === "android" && (
                  <>
                    <div className="text-[11px] text-slate-300">Google ses motoru + İngilizce/Türkçe ses verisi kurulu değil. Tek dokunuşla ayar sayfasına git:</div>
                    <button
                      onClick={async () => {
                        const { openVoiceSettings, detectPlatform } = await import("@/lib/voiceSetup");
                        openVoiceSettings(detectPlatform());
                      }}
                      className="gold-btn mt-2 w-full rounded-2xl py-3 text-sm"
                    >
                      ⚙️ Ses Ayarını Aç →
                    </button>
                    <div className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                      • Tercih Edilen Motor: Google Metin-Konuşma<br />
                      • Dişli → İngilizce + Türkçe ses verisini indir<br />
                      • Dönüp Tekrar Dene'ye bas
                    </div>
                  </>
                )}
                {vh.platform === "ios" && (
                  <div className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
                    Ayarlar → Erişilebilirlik → Konuşulan İçerik → Sesler → İngilizce (Siri Enhanced) + Türkçe (Emel Geliştirilmiş) indir.
                  </div>
                )}
                {vh.platform === "desktop" && (
                  <div className="mt-1.5 text-[11px] text-slate-300">Chrome kullanıyorsan Google sesleri otomatik gelir. Edge/Safari'de kalite düşük olabilir.</div>
                )}
                <button onClick={refreshVoiceHealth} disabled={vhBusy} className="ghost-btn mt-2 w-full rounded-2xl py-2.5 text-xs text-cyan-100 disabled:opacity-50">
                  {vhBusy ? "..." : "↻ Tekrar Dene"}
                </button>
              </div>
            )}
            {vh.ready === true && (
              <div className="mt-1 text-[10px] text-slate-500">Cihaz sesleri yeterli — ElevenLabs'sız muazzam okur.</div>
            )}
          </div>
          <button onClick={goProgress} className="ghost-btn mt-2 w-full rounded-2xl py-3 text-sm text-cyan-100">
            📊 İlerlememi gör
          </button>
        </div>

        <button onClick={goHome} className="mt-4 text-xs text-slate-500 hover:text-slate-300">‹ Ana ekran</button>
      </div>
      <BottomNav active="profile" onChange={gotoTab} />
    </>
  );
}

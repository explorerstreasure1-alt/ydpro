"use client";
import { useState } from "react";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pass || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/tts/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      if (r.ok) {
        setPass("");
        onUnlock();
      } else if (r.status === 503) {
        setErr("Kilit kurulmamış (sunucu ayarı eksik)");
      } else {
        setErr("Hatalı şifre");
      }
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6">
      <div className="glass w-full rounded-3xl p-6 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-2 text-[2rem] font-black leading-none tracking-tight">
          7<span className="text-[#ffd52f]">DİL</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">Devam etmek için özel şifreni gir</p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••"
          autoComplete="off"
          inputMode="numeric"
          className="glass mt-5 w-full rounded-2xl px-4 py-4 text-center text-xl tracking-[0.5em] text-white outline-none placeholder:text-slate-600 focus:border-[#ffd52f]/60"
        />
        {err && <div className="mt-2 text-xs font-semibold text-[#ffb0a0]">{err}</div>}
        <button onClick={submit} disabled={busy || !pass} className="gold-btn mt-4 w-full rounded-2xl py-4 text-base disabled:opacity-50">
          {busy ? "..." : "Aç →"}
        </button>
      </div>
    </div>
  );
}

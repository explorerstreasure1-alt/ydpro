import { ReactNode } from "react";

export function ProgressSlim({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0e3048]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#00bfff] to-[#16c784] transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function Stat({ emoji, value, label, accent }: { emoji?: string; value: ReactNode; label: string; accent?: string }) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-2 py-3 text-center">
      {emoji && <div className="mb-0.5 text-base leading-none">{emoji}</div>}
      <div className={`text-lg font-extrabold ${accent || "text-white"}`}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export function Badge({ icon, title, unlocked }: { icon: string; title?: string; unlocked?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition ${
          unlocked
            ? "glass glow-cyan"
            : "border border-white/5 bg-white/5 opacity-30 grayscale"
        }`}
      >
        {icon}
      </div>
      {title && <span className="max-w-16 text-center text-[9px] leading-tight text-slate-400">{title}</span>}
    </div>
  );
}

export function LevelPill({ lvl, name }: { lvl: number; name: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd52f]/40 bg-[#ffd52f]/10 px-3 py-1 text-xs font-bold text-[#ffd52f]">
      ⭐ Seviye {lvl} · {name}
    </div>
  );
}

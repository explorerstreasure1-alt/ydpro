"use client";
export type Tab = "home" | "talk" | "memory" | "progress" | "profile";

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; icon: string; label: string }[] = [
    { key: "home", icon: "🎮", label: "Oyun" },
    { key: "memory", icon: "🧠", label: "Hafıza" },
    { key: "talk", icon: "🎙", label: "Konuş" },
    { key: "progress", icon: "📊", label: "İlerleme" },
    { key: "profile", icon: "⚙️", label: "Ayarlar" },
  ];
  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/5 bg-[#061827]/85 px-2 pb-3 pt-2 backdrop-blur-xl">
      <div className="flex items-center justify-around">
        {items.map((it) => {
          const activeNow = active === it.key;
          return (
            <button key={it.key} onClick={() => onChange(it.key)} className="flex flex-col items-center gap-0.5 px-2 py-1">
              <span
                className={`flex h-9 w-11 items-center justify-center rounded-xl text-xl transition ${
                  activeNow ? "bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,191,255,0.4)]" : "opacity-55 grayscale"
                }`}
              >
                {it.icon}
              </span>
              <span className={`text-[9px] font-semibold ${activeNow ? "text-white" : "text-slate-500"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

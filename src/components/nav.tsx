"use client";
export type Tab = "home" | "talk" | "memory" | "dialogue" | "progress" | "profile";

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; icon: string; label: string }[] = [
    { key: "home", icon: "🎮", label: "Oyun" },
    { key: "memory", icon: "🧠", label: "Hafıza" },
    { key: "dialogue", icon: "💬", label: "Diyalog" },
    { key: "talk", icon: "🎙", label: "Konuş" },
    { key: "progress", icon: "📊", label: "İlerleme" },
    { key: "profile", icon: "⚙️", label: "Ayarlar" },
  ];
  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/5 bg-[#061827]/90 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="flex items-center justify-around">
        {items.map((it) => {
          const activeNow = active === it.key;
          return (
            <button key={it.key} onClick={() => onChange(it.key)} className="flex flex-col items-center gap-1 px-3 py-2 min-h-[56px] min-w-[56px] active:scale-95 touch-manipulation select-none">
              <span
                className={`flex h-11 w-14 items-center justify-center rounded-xl text-xl transition ${
                  activeNow ? "bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,191,255,0.4)] text-white" : "opacity-60 grayscale"
                }`}
              >
                {it.icon}
              </span>
              <span className={`text-[10px] font-semibold leading-none ${activeNow ? "text-white" : "text-slate-500"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

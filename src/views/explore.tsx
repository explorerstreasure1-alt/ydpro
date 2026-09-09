"use client";
import { useState } from "react";
import { ALL_SCENES, CATEGORIES, SceneDef } from "@/lib/scenes";
import { BottomNav, Tab } from "@/components/nav";

export function Explore({ onBack, onStartScene }: { onBack: () => void; onStartScene: (scene: SceneDef) => void }) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const filtered = activeCat ? ALL_SCENES.filter(s => s.category === activeCat) : ALL_SCENES;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="sticky top-0 z-10 bg-[#03111d]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="glass flex h-10 w-10 items-center justify-center rounded-full text-lg active:scale-95">←</button>
          <div>
            <h2 className="text-base font-black text-white">Tüm Ortamlar</h2>
            <p className="text-[11px] text-slate-400">{ALL_SCENES.length} sahne • 12 kategori • Her sahne pratik: çatal ver, yumurta çıkar</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setActiveCat(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${!activeCat ? "bg-white text-[#03111d]" : "glass text-slate-300"}`}>Tümü</button>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${activeCat===c.key ? "bg-cyan-400 text-[#03111d]" : "glass text-slate-300"}`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-4">
        {(activeCat ? CATEGORIES.filter(c=>c.key===activeCat) : CATEGORIES).map(cat => {
          const scenes = ALL_SCENES.filter(s=>s.category===cat.key);
          if (!scenes.length) return null;
          return (
            <div key={cat.key}>
              <h3 className="flex items-center gap-2 text-sm font-black text-white">
                <span className="text-base">{cat.emoji}</span> {cat.label}
                <span className="text-[10px] font-bold text-slate-500">{scenes.length} ortam</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{cat.desc}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {scenes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onStartScene(s)}
                    className="group relative overflow-hidden rounded-2xl text-left ring-1 ring-white/10 hover:ring-cyan-300/30 transition active:scale-[0.98]"
                  >
                    <img src={s.photo} alt={s.title} className="h-28 w-full object-cover group-hover:scale-[1.03] transition duration-500" referrerPolicy="no-referrer" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src="https://images.pexels.com/photos/3184183/pexels-photo-3184183.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600"; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{s.emoji}</span>
                        <span className="text-xs font-black text-white truncate drop-shadow">{s.title}</span>
                      </div>
                      <div className="text-[10px] text-white/80 truncate">{s.location}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.examples.slice(0,2).map(ex=>(
                          <span key={ex} className="text-[9px] bg-white/15 text-white px-1.5 py-0.5 rounded-full backdrop-blur">{ex}</span>
                        ))}
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 glass px-1.5 py-0.5 rounded-full text-[10px] font-bold text-cyan-200">{s.npc.emoji} {s.npc.role}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 z-20"><BottomNav active="home" onChange={()=>{}} /></div>
    </div>
  );
}

"use client";

export function Splash() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.pexels.com/photos/15156234/pexels-photo-15156234.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=900')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03111d]/70 via-[#03111d]/80 to-[#03111d]" />
      <div className="animate-floaty relative z-10 text-center flex flex-col items-center">
        <img src="/logo.svg" alt="7DİL Logo" className="h-28 w-28 rounded-3xl shadow-[0_0_40px_rgba(0,191,255,0.35)] ring-1 ring-white/10" />
        <h1 className="mt-4 text-6xl font-black tracking-tight text-white">
          7<span className="text-[#ffd52f]">DİL</span>
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
          Her Dilde Her Dil. <span className="text-[#00bfff]">A1 → C1</span>
        </p>
        <p className="mt-1 text-[10px] tracking-[0.2em] text-slate-500">18 ORTAM • 14 DİL • OFFLINE</p>
      </div>
      <div className="relative z-10 mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#ffd52f]" />
      </div>
    </div>
  );
}

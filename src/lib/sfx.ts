// Lightweight, file-free sound effects using the Web Audio API.
// Wrapped so it never throws (no-op when unavailable or muted).

let muted = typeof localStorage !== "undefined" && localStorage.getItem("yzed_muted") === "1";
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("yzed_muted", m ? "1" : "0");
  } catch {}
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as any;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.14, when = 0) {
  const c = ac();
  if (!c || muted) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {}
}

export const sfx = {
  click() {
    tone(340, 0.06, "triangle", 0.06);
  },
  correct() {
    tone(660, 0.12, "sine", 0.14);
    tone(990, 0.16, "sine", 0.12, 0.09);
  },
  wrong() {
    tone(180, 0.2, "sawtooth", 0.09);
  },
  xp() {
    tone(720, 0.09, "triangle", 0.09);
    tone(960, 0.08, "triangle", 0.07, 0.05);
  },
  levelup() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "sine", 0.15, i * 0.11));
  },
  achievement() {
    [660, 880, 1108].forEach((f, i) => tone(f, 0.18, "triangle", 0.13, i * 0.1));
  },
  tap() {
    tone(500, 0.05, "sine", 0.06);
  },
};

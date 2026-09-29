"use client";
// ElevenLabs oynatıcı — stüdyo sesi. Anahtar yoksa/başarısızsa false döner,
// arayan sessizce tarayıcı sesine düşer. Tek ses kuralı: yeni ses eskisini keser.

let audio: HTMLAudioElement | null = null;
let curRes: ((v: boolean) => void) | null = null;
let elevenOff = false; // bu oturumda ElevenLabs yok — bir daha deneme
let unlocked: boolean | null = null; // null = bilinmiyor, sunucuya sorulacak

export function stopEleven() {
  try {
    audio?.pause();
  } catch {}
  audio = null;
  try {
    curRes?.(false);
  } catch {}
  curRes = null;
}

/** Kilit durumunu tazele (şifre girildikten sonra çağrılır) */
export async function refreshEleven(): Promise<boolean> {
  unlocked = null;
  elevenOff = false;
  return checkUnlocked();
}

async function checkUnlocked(): Promise<boolean> {
  if (unlocked !== null) return unlocked;
  try {
    const r = await fetch("/api/tts");
    const j = await r.json().catch(() => ({}));
    unlocked = !!(j?.ok && j?.unlocked);
  } catch {
    unlocked = false;
  }
  return unlocked;
}

async function elevenAvailable(): Promise<boolean> {
  if (elevenOff) return false;
  return checkUnlocked();
}

export interface ElevenOpts {
  lang: string;
  /** teacher = ders/hoca sesi, native = ana dil/düzeltme sesi */
  voice?: "teacher" | "native";
  /** çağrı sırasında başka ses başladıysa çalmadan vazgeç */
  isAlive?: () => boolean;
}

/** Metni ElevenLabs ile çal. Sonuna kadar çalındıysa true, her türlü sorunda false. */
export async function elevenSpeak(text: string, opts: ElevenOpts): Promise<boolean> {
  const clean = String(text || "").trim();
  if (!clean || elevenOff) return false;
  if (opts.isAlive && !opts.isAlive()) return false;
  if (!(await elevenAvailable())) return false;
  if (opts.isAlive && !opts.isAlive()) return false;
  stopEleven();
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => {
      try {
        ctl.abort();
      } catch {}
    }, 12000);
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean.slice(0, 1000), lang: opts.lang, voice: opts.voice || "teacher" }),
      signal: ctl.signal,
    }).finally(() => clearTimeout(to));
    if (!r.ok) {
      // Anahtar yok / kota bitti / limit / yetkisiz → oturumluk normal (tarayıcı) moda dön.
      // Her seferinde denemek yok: takılma ve kota israfı olmaz, sayfa yenilenince tekrar bakılır.
      if (r.status === 503 || r.status === 401 || r.status === 402 || r.status === 429) elevenOff = true;
      if (r.status === 403) unlocked = false;
      return false;
    }
    if (opts.isAlive && !opts.isAlive()) return false;
    const blob = await r.blob();
    if (!blob || blob.size < 1000) return false;
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audio = el;
    const played = await new Promise<boolean>((res) => {
      curRes = res;
      el.onended = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        if (audio === el) audio = null;
        curRes = null;
        res(true);
      };
      el.onerror = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        if (audio === el) audio = null;
        curRes = null;
        res(false);
      };
      el.play().catch(() => {
        if (audio === el) audio = null;
        curRes = null;
        res(false);
      });
    });
    if (opts.isAlive && !opts.isAlive()) return false;
    return played;
  } catch {
    return false;
  }
}

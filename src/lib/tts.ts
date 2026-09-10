"use client";
// Merkezi TTS — tüm dillerde doğru aksan, tek yer — hızlı, aktif, insan gibi
let voicesCache: any[] = [];
if (typeof window !== "undefined") {
  try {
    const synth = window.speechSynthesis as any;
    const load = () => { try { voicesCache = synth.getVoices() || []; } catch {} };
    load();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = load;
    // mobilde sesler geç yüklenir, önden tetikle
    setTimeout(load, 100);
    setTimeout(load, 800);
  } catch {}
}

export interface SpeakOpts {
  /** CEFR seviyesi — A1-A2 yavaş, B normal, C akıcı (kullanıcı ayarı varsa o kazanır) */
  level?: string;
  /** Açık hız — verilirse seviye kuralını ezer */
  rate?: number;
  /** Okuma bitince (veya hatada) çağrılır — zincirleme oynatma için */
  onEnd?: () => void;
}

/** Seviyeye göre TTS hızı — spec Adım 3: A1-A2 yavaş, B normal akış, C tam akıcı */
export function rateForLevel(level?: string): number {
  if (!level) return 1.12;
  if (level === "A1" || level === "A2") return 0.9;
  if (level === "B1") return 1.0;
  if (level === "B2") return 1.05;
  return 1.12;
}

export function speakText(text: string, lang: string, opts?: SpeakOpts) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis as any;
  if (!synth) return;
  try {
    synth.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      // Her dil için ayrı ayar — yoksa seviye hızı
      let rate = opts?.rate ?? rateForLevel(opts?.level);
      try {
        const code = lang.split("-")[0].toLowerCase();
        const map = JSON.parse(localStorage.getItem("yzed_lang_settings") || "{}");
        const found = Object.values(map as any).find((v:any)=> v.code===code || v.tts===lang) as any;
        // LANGS'tan da bul
        if (!found) {
          const { LANGS } = require("@/lib/levels");
          const def = LANGS.find((l:any)=> l.tts===lang);
          if (def) {
            const m2 = JSON.parse(localStorage.getItem("yzed_lang_settings") || "{}");
            const s2 = m2[def.code];
            if (s2) rate = s2.voiceRate || 1.12;
          }
        } else rate = found.voiceRate || 1.12;
      } catch {}
      u.rate = rate;
      u.pitch = 1.0;
      u.volume = 1;
      const voices = voicesCache.length ? voicesCache : (synth.getVoices?.() || []);
      if (!voicesCache.length && voices.length) voicesCache = voices;
      const best =
        voices.find((v: any) => v.lang.toLowerCase() === lang.toLowerCase()) ||
        voices.find((v: any) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase())) ||
        voices.find((v: any) => v.name.toLowerCase().includes(lang.split("-")[0].toLowerCase()));
      if (best) (u as any).voice = best;
      // Zincirleme oynatma: bitince veya hatada tek sefer çöz
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        opts?.onEnd?.();
      };
      u.onend = finish;
      // @ts-ignore
      u.onerror = finish;
      synth.speak(u);
      // Güvenlik: sessizlikte takılma olmasın (uzun metin payıyla)
      const guard = Math.min(15000, 2500 + text.length * 120);
      setTimeout(finish, guard);
    }, 20);
  } catch {
    opts?.onEnd?.();
  }
}

// Telaffuz: Türkçe konuşuyorsa yabancı aksanla, orijinal telaffuzla
// Örn: 'Hayır öyle değil, şöyle diyeceksin: "Here is my passport."' → Türkçe kısım tr-TR, tırnak içi en-GB
export function speakMixed(text: string, nativeLang: string, targetLang: string, opts?: SpeakOpts) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    // Tırnak içlerini ayır: " ", “ ”, ' ', « »  → hedef dil orijinal telaffuz
    const parts: { text: string; lang: string }[] = [];
    const regex = /([“"«'‘`„»”'])([^“"«'‘`„»”']+)([“"«'‘`„»”'])/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const before = text.slice(lastIdx, m.index).trim();
      if (before) parts.push({ text: before, lang: nativeLang });
      const quoted = m[2].trim();
      if (quoted) parts.push({ text: quoted, lang: targetLang });
      lastIdx = m.index + m[0].length;
    }
    const after = text.slice(lastIdx).trim();
    if (after) parts.push({ text: after, lang: nativeLang });
    if (parts.length === 0) parts.push({ text, lang: nativeLang });
    // Tek parça ise direkt
    if (parts.length === 1) {
      speakText(parts[0].text, parts[0].lang, opts);
      return;
    }
    // Sırayla, her parça bitince diğeri — her dil kendi orijinal aksanıyla, hızlı
    const voices = voicesCache.length ? voicesCache : (synth as any).getVoices?.() || [];
    if (!voicesCache.length && voices.length) voicesCache = voices;
    const levelRate = opts?.rate ?? rateForLevel(opts?.level);
    const speakPart = (idx: number) => {
      if (idx >= parts.length) return;
      const p = parts[idx];
      const u = new SpeechSynthesisUtterance(p.text);
      u.lang = p.lang;
      u.rate = levelRate;
      u.pitch = 1.0;
      const best =
        voices.find((v: any) => v.lang.toLowerCase() === p.lang.toLowerCase()) ||
        voices.find((v: any) => v.lang.toLowerCase().startsWith(p.lang.split("-")[0].toLowerCase())) ||
        voices.find((v: any) => v.name.toLowerCase().includes(p.lang.split("-")[0].toLowerCase()));
      if (best) (u as any).voice = best;
      u.onend = () => setTimeout(()=>speakPart(idx + 1), 60);
      // @ts-ignore
      u.onerror = () => setTimeout(()=>speakPart(idx + 1), 60);
      synth.speak(u);
    };
    speakPart(0);
  } catch {}
}

export function getTtsFor(code: string, fallback = "en-GB") {
  // LANGS'tan tts bul, yoksa fallback
  try {
    const { LANGS } = require("@/lib/levels");
    return LANGS.find((l: any) => l.code === code)?.tts || fallback;
  } catch {
    return fallback;
  }
}

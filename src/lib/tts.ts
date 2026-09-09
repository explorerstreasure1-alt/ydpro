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

export function speakText(text: string, lang: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis as any;
  if (!synth) return;
  try {
    // Bekletme yok — anında, hızlı ve aktif
    synth.cancel();
    // Mobilde cancel sonrası kısa gecikme gerekir, yoksa ses kesilir
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1.12; // daha hızlı, pratik, insan gibi
      u.pitch = 1.0;
      u.volume = 1;
      const voices = voicesCache.length ? voicesCache : (synth.getVoices?.() || []);
      if (!voicesCache.length && voices.length) voicesCache = voices;
      const best =
        voices.find((v: any) => v.lang.toLowerCase() === lang.toLowerCase()) ||
        voices.find((v: any) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase())) ||
        voices.find((v: any) => v.name.toLowerCase().includes(lang.split("-")[0].toLowerCase()));
      if (best) (u as any).voice = best;
      synth.speak(u);
    }, 20);
  } catch {}
}

// Telaffuz: Türkçe konuşuyorsa yabancı aksanla, orijinal telaffuzla
// Örn: 'Hayır öyle değil, şöyle diyeceksin: "Here is my passport."' → Türkçe kısım tr-TR, tırnak içi en-GB
export function speakMixed(text: string, nativeLang: string, targetLang: string) {
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
      speakText(parts[0].text, parts[0].lang);
      return;
    }
    // Sırayla, her parça bitince diğeri — her dil kendi orijinal aksanıyla, hızlı
    const voices = voicesCache.length ? voicesCache : (synth as any).getVoices?.() || [];
    if (!voicesCache.length && voices.length) voicesCache = voices;
    const speakPart = (idx: number) => {
      if (idx >= parts.length) return;
      const p = parts[idx];
      const u = new SpeechSynthesisUtterance(p.text);
      u.lang = p.lang;
      u.rate = 1.1;
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

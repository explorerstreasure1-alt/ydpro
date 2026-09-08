"use client";
// Merkezi TTS — tüm dillerde doğru aksan, tek yer
export function speakText(text: string, lang: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95;
    const voices = (synth as any).getVoices?.() || [];
    const best =
      voices.find((v: any) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v: any) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
    if (best) (u as any).voice = best;
    synth.speak(u);
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

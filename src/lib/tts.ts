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
  /** Perde — soru/ünlem vurgusu için (varsayılan 1.0) */
  pitch?: number;
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

/**
 * Dil başına bilinen en net sesler (Apple/Windows/Android kaliteli ses adları).
 * Cihazda hangisi kuruluysa o kazanır — yoksa genel neural puanlamaya düşer.
 */
const PREFERRED_VOICES: Record<string, string[]> = {
  en: ["google us english", "aria", "jenny", "guy", "samantha", "daniel", "moira", "tessa", "google uk english"],
  tr: ["emel", "google türkçe", "google turkish"],
  de: ["katja", "conrad", "anna", "google deutsch", "hedda"],
  fr: ["amelie", "amélie", "thomas", "google français", "google francais", "hortense"],
  es: ["monica", "mónica", "jorge", "paulina", "google español", "google espanol", "sabina"],
  it: ["alice", "luca", "google italiano", "elsa", "isabella"],
  pt: ["joana", "luciana", "google português", "google portugues", "ines", "inês"],
  ru: ["milena", "yuri", "google русский", "google russkiy", "katya"],
  nl: ["xander", "ellen", "google nederlands", "frank"],
  pl: ["zosia", "paulina", "google polski"],
  zh: ["tingting", "xiaoxiao", "yunxi", "meijia", "yaoyao", "google 普通话", "google putonghua"],
  ja: ["kyoko", "otoya", "haruka", "nanami", "google 日本語", "google nihongo"],
  ko: ["yuna", "sunhi", "injoon", "google 한국어"],
  ar: ["maged", "tarik", "laila", "hoda", "salim", "google العربية"],
};

/**
 * En doğal sesi seç — önce dile özel en net ses, sonra Neural/Natural/Premium
 * motorlar (robotik tonlardan uzak). Puanlama: dil + bilinen ses + motor kalitesi.
 */
export function pickBestVoice(voices: any[], lang: string): any | null {
  if (!voices || voices.length === 0) return null;
  const code = lang.split("-")[0].toLowerCase();
  const full = lang.toLowerCase();
  const preferred = PREFERRED_VOICES[code] || [];
  let best: any = null;
  let bestScore = -1;
  for (const v of voices) {
    const vl = String(v.lang || "").toLowerCase();
    const nm = String(v.name || "").toLowerCase();
    let s = 0;
    if (vl === full) s += 4;
    else if (vl.startsWith(code)) s += 2;
    else if (nm.includes(code)) s += 1;
    else continue; // başka dilin sesi asla
    if (preferred.some((p) => nm.includes(p))) s += 5;
    if (/neural|natural|premium|enhanced|high quality/.test(nm)) s += 3;
    if (/google/.test(nm)) s += 2;
    if (/microsoft|apple|samsung/.test(nm)) s += 1;
    if (/compact|legacy|basic|robot|espeak|festival/.test(nm)) s -= 3;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
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
      u.pitch = opts?.pitch ?? 1.0;
      u.volume = 1;
      const voices = voicesCache.length ? voicesCache : (synth.getVoices?.() || []);
      if (!voicesCache.length && voices.length) voicesCache = voices;
      // Neural/doğal ses öncelikli seçim (robotik tonlardan uzak)
      const best = pickBestVoice(voices, lang);
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
      const best = pickBestVoice(voices, p.lang);
      if (best) (u as any).voice = best;
      u.onend = () => setTimeout(()=>speakPart(idx + 1), 60);
      // @ts-ignore
      u.onerror = () => setTimeout(()=>speakPart(idx + 1), 60);
      synth.speak(u);
    };
    speakPart(0);
  } catch {}
}

/** Cümlelere böl — vurgulu okuma için (CJK/Arapça noktalama dahil) */
export function splitSentences(text: string): string[] {
  const m = String(text || "").match(/[^.!?…؟\n。！？]+[.!?…؟。！？]+["'»”)\]]?|[^.!?…؟\n。！？]+$/g);
  const parts = (m || [text]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [String(text || "")];
}

/** Virgül nefesleri — uzun cümleyi doğal soluklarla parçala */
export function splitPhrases(sentence: string): string[] {
  const m = String(sentence || "").match(/[^,;:—–،；：、]+[,;:—–،；：、]?/g);
  const parts = (m || [sentence]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [String(sentence || "")];
}

let naturalToken = 0;

/** Vurgulu okumayı durdur (yeni okuma otomatik durdurur, bu ek güvenlik/temizlik için) */
export function stopNatural() {
  naturalToken++;
  try {
    (window.speechSynthesis as any)?.cancel();
  } catch {}
}

export interface NaturalOpts extends SpeakOpts {
  /** Cümle sonu bekleme (ms) — verilmezse seviyeye göre */
  gapMs?: number;
  /** Virgül nefesi (ms) */
  breathMs?: number;
  /** Bitişte çağrılır */
  onDone?: () => void;
}

/**
 * Vurgulu, akıcı, insansı okuma — robot gibi tek nefeste değil:
 * cümle cümle + virgül nefesleri, soru/ünlem perdesi, cümle sonu bekleme,
 * dile özel en net ses. Yeni çağrı öncekini keser (üst üste binme yok).
 */
export function speakNatural(text: string, lang: string, opts?: NaturalOpts) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis as any;
  if (!synth || !text) return;
  const my = ++naturalToken;
  try {
    synth.cancel();
  } catch {}
  const rate = opts?.rate ?? rateForLevel(opts?.level);
  const gapMs = opts?.gapMs ?? (opts?.level === "A1" || opts?.level === "A2" ? 600 : 400);
  const breathMs = opts?.breathMs ?? 200;
  const voices = voicesCache.length ? voicesCache : synth.getVoices?.() || [];
  if (!voicesCache.length && voices.length) voicesCache = voices;
  const voice = pickBestVoice(voices, lang);

  const speakOne = (t: string, pitch: number) =>
    new Promise<void>((res) => {
      if (my !== naturalToken) return res();
      try {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = lang;
        u.rate = rate;
        u.pitch = pitch;
        u.volume = 1;
        if (voice) (u as any).voice = voice;
        let done = false;
        const fin = () => {
          if (done) return;
          done = true;
          res();
        };
        u.onend = fin;
        // @ts-ignore
        u.onerror = fin;
        synth.speak(u);
        setTimeout(fin, Math.min(12000, 2000 + t.length * 120));
      } catch {
        res();
      }
    });

  const wait = (ms: number) =>
    new Promise<void>((res) => {
      const t0 = Date.now();
      const tick = () => {
        if (my !== naturalToken || Date.now() - t0 >= ms) res();
        else setTimeout(tick, 80);
      };
      tick();
    });

  (async () => {
    const sents = splitSentences(text);
    for (let s = 0; s < sents.length; s++) {
      if (my !== naturalToken) return;
      const t = sents[s];
      const pitch = /[?？]$/.test(t) ? 1.15 : /[!！]$/.test(t) ? 1.1 : 1.0;
      const phrases = splitPhrases(t);
      for (let p = 0; p < phrases.length; p++) {
        if (my !== naturalToken) return;
        await speakOne(phrases[p], pitch);
        if (my !== naturalToken) return;
        if (p < phrases.length - 1) await wait(breathMs);
      }
      if (s < sents.length - 1) await wait(gapMs);
    }
    if (my === naturalToken) opts?.onDone?.();
    if (my === naturalToken) opts?.onEnd?.();
  })();
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

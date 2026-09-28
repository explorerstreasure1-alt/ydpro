"use client";
import { LANGS } from "@/lib/levels";
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

/** Tekil konuşma nesli — her yeni ses çağrısı sayacı artırır, eski zincirler susar */
let speechGen = 0;

/**
 * Ses listesi hazır olana kadar bekle — liste gelmeden konuşulursa tarayıcı
 * VARSAYILAN robot sesi kullanır (sorunun başlıca sebebi bu).
 */
let voicesReady: Promise<void> | null = null;
export function ensureVoices(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  try {
    const synth = window.speechSynthesis as any;
    if (!synth?.getVoices) return Promise.resolve();
    const have = () => {
      try {
        const v = synth.getVoices() || [];
        if (v.length) { voicesCache = v; return true; }
      } catch {}
      return false;
    };
    if (have()) return Promise.resolve();
    if (!voicesReady) {
      voicesReady = new Promise((res) => {
        let done = false;
        const fin = () => {
          if (done) return;
          done = true;
          have();
          voicesReady = null;
          res();
        };
        try { synth.onvoiceschanged = () => { have(); fin(); }; } catch {}
        setTimeout(fin, 1000); // liste hiç gelmezse 1sn'de vazgeç, robotsa da konuş
      });
    }
    return voicesReady;
  } catch {
    return Promise.resolve();
  }
}

/** Teşhis: hangi ses seçildi, konsola yaz (şikayette sese bakılır) */
function noteVoice(lang: string, best: any) {
  try {
    // eslint-disable-next-line no-console
    console.debug(`[tts] ${lang} → ${best ? `${best.name} (${best.lang})` : "tarayıcı varsayılanı"}`);
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
  en: ["google us english", "google uk english female", "google uk english male", "aria", "jenny", "guy", "christopher", "natasha", "libby", "ryan", "sonia", "olivia", "amelia", "george", "samantha", "zira", "david", "mark", "daniel", "moira", "tessa", "karen", "susan", "kate", "serena", "fiona", "alex", "oliver", "thomas", "aaron", "zoe", "evie", "martha", "louisa"],
  tr: ["emel", "ahmet", "google türkçe", "google turkish"],
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
 * Olgun/yetişkin tınısı — genç ince ses değil, ders anlatan hoca hissi.
 * Çocuk/küçük sesler ayrıca cezalı (aşağıda).
 */
const MATURE_VOICES: Record<string, string[]> = {
  en: ["daniel", "david", "mark", "christopher", "oliver", "thomas", "george", "aaron", "fred", "samantha", "karen", "susan", "kate", "serena", "fiona", "moira", "tessa", "zira", "natasha", "sonia", "libby", "ryan", "martha", "louisa", "google uk english male"],
  tr: ["ahmet", "emel"],
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
  const mature = MATURE_VOICES[code] || [];
  let best: any = null;
  let bestScore = -1;
  for (const v of voices) {
    const vl = String(v.lang || "").toLowerCase();
    const nm = String(v.name || "").toLowerCase();
    let s = 0;
    if (vl === full) s += 2;
    else if (vl.startsWith(code)) s += 2;
    else if (nm.includes(code)) s += 1;
    else continue; // başka dilin sesi asla
    // Bilinen kaliteli ses her şeyden önce — robotik "tam eşleşme" locale tuzağına düşme
    if (preferred.some((p) => nm.includes(p))) s += 6;
    // Olgun ses bonusu — ders anlatan yetişkin tınısı genç ince sesten önce
    if (mature.some((p) => nm.includes(p))) s += 3;
    if (/neural|natural|premium|enhanced|high quality|online/.test(nm)) s += 3;
    if (/google/.test(nm)) s += 2;
    if (/microsoft|apple/.test(nm)) s += 1;
    // Çocuk/genç sesler derse olmaz
    if (/kid|child|junior|teen|young|baby/.test(nm)) s -= 4;
    if (/neural|natural|premium|enhanced|high quality|online/.test(nm)) s += 3;
    if (/google/.test(nm)) s += 2;
    if (/microsoft|apple/.test(nm)) s += 1;
    // Eski robotik motorlar — özellikle Windows SAPI "Desktop" sesleri (Hazel Desktop vb.), Pico, eSpeak
    if (/compact|legacy|basic|robot|espeak|festival|desktop|pico/.test(nm)) s -= 5;
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
  text = cleanForSpeech(text);
  if (!text) { opts?.onEnd?.(); return; }
  // Tekil konuşma nesli — bu çağrıdan sonra başlayan her ses öncekileri öldürür
  const my = ++speechGen;
  try {
    synth.cancel();
    setTimeout(async () => {
      if (my !== speechGen) return;
      await ensureVoices(); // liste hazır değilse varsayılan robot ses KULLANILMASIN
      if (my !== speechGen) return;
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
          const def = LANGS.find((l) => l.tts === lang);
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
      noteVoice(lang, best);
      // Zincirleme oynatma: bitince veya hatada tek sefer çöz (bayatsa sus)
      let done = false;
      const finish = () => {
        if (done || my !== speechGen) return;
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

/** Konuşmadan önce metni temizle — emoji, markdown, link okunmasın (robot hissinin yarısı bu) */
export function cleanForSpeech(text: string): string {
  return String(text || "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[*_~#>|]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Telaffuz: Türkçe konuşuyorsa yabancı aksanla, orijinal telaffuzla
// Örn: 'Hayır öyle değil, şöyle diyeceksin: "Here is my passport."' → Türkçe kısım tr-TR, tırnak içi en-US
export function speakMixed(text: string, nativeLang: string, targetLang: string, opts?: SpeakOpts) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const my = ++speechGen;
  try {
    synth.cancel();
    text = cleanForSpeech(text);
    if (!text) return;
    // Tırnak içlerini ayır — SADECE çift tırnak grubu dil değiştirir: " ", “ ”, « », „ ”.
    // Kesme işareti (don't, I'm, l'amour) TIRNAK DEĞİLDİR: tek tırnaklar akışta kalır,
    // yoksa İngilizce kısaltmalar paramparça olup yanlış aksanla okunur.
    const parts: { text: string; lang: string }[] = [];
    const regex = /([“”"«»„])([^“”"«»„]+)([“”"«»„])/g;
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
    // Liste hazır olunca başla — yoksa varsayılan robot ses araya girer
    void ensureVoices().then(() => {
      if (my !== speechGen) return;
      try {
        startMixedQueue(parts);
      } catch {}
    });
  } catch {}

  function startMixedQueue(parts: { text: string; lang: string }[]) {
    // İnsan gibi: her parçayı cümle + virgül nefeslerine böl, soru/ünlem perdesi ver.
    // Tek nefeste robot okuma yerine soluklu akış — her dil kendi orijinal aksanıyla.
    const voices = voicesCache.length ? voicesCache : (synth as any).getVoices?.() || [];
    if (!voicesCache.length && voices.length) voicesCache = voices;
    const levelRate = opts?.rate ?? rateForLevel(opts?.level);
    // Ortak prozodi kuyruğu: vurgu + duraklama + cümle melodisi
    const queue = buildSpeechQueue(parts, levelRate, 400, 200);
    const speakNext = (idx: number) => {
      if (my !== speechGen || idx >= queue.length) return;
      const q = queue[idx];
      const u = new SpeechSynthesisUtterance(q.t);
      u.lang = q.lang;
      u.rate = q.rate;
      u.pitch = q.pitch;
      u.volume = 1;
      const best = pickBestVoice(voices, q.lang);
      if (best) (u as any).voice = best;
      if (idx === 0) noteVoice(q.lang, best);
      let done = false;
      const next = () => {
        if (done) return;
        done = true;
        if (my !== speechGen) return;
        if (q.gapAfter > 0) setTimeout(() => speakNext(idx + 1), q.gapAfter);
        else speakNext(idx + 1);
      };
      u.onend = next;
      // @ts-ignore
      u.onerror = next;
      synth.speak(u);
      setTimeout(next, Math.min(12000, 2000 + q.t.length * 120));
    };
    speakNext(0);
  }
}

/** Cümlelere böl — vurgulu okuma için (CJK/Arapça noktalama dahil) */
export function splitSentences(text: string): string[] {
  const m = String(text || "").match(/[^.!?…؟\n。！？]+[.!?…؟。！？]+["'»”)\]]?|[^.!?…؟\n。！？]+$/g);
  const parts = (m || [text]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [String(text || "")];
}

/** Virgül nefesleri — uzun cümleyi doğal soluklarla parçala */
export function splitPhrases(sentence: string): string[] {
  const m = String(sentence || "").match(/[^,;:—–،؛：、]+[,;:—–،；：、]?/g);
  const parts = (m || [sentence]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [String(sentence || "")];
}

export interface QueueItem {
  t: string;
  lang: string;
  pitch: number;
  rate: number;
  gapAfter: number; // bu parçadan sonra beklenecek soluk (ms)
}

const clampPitch = (p: number) => Math.min(1.25, Math.max(0.85, p));

/** Ayıraca göre soluk: virgül kısa, noktalı virgül/iki nokta orta, tire nefesli */
function pauseForDelimiter(fragment: string, commaGap: number): number {
  const end = fragment.slice(-1);
  if (end === ";" || end === ":" || end === "；" || end === "：") return 350;
  if (end === "—" || end === "–") return 300;
  if (end === "、") return 250;
  return commaGap; // , ، ve diğerleri
}

/** Vurgu tetikleyiciler: BÜYÜK HARFli kelime, sayı, ünlem/soru işareti */
function hasEmphasis(fragment: string): boolean {
  return /[A-ZÇĞİÖŞÜÂÎÛ]{3,}/.test(fragment) || /\d/.test(fragment) || /[!！?？]/.test(fragment);
}

/**
 * Prozodi kuyruğu — düz okuma YOK:
 * - her cümleye hafif perde eğrisi (paragraf melodisi, monotonluk kırılır)
 * - soruda yükselen, ünlemde coşkulu, biten cümlede alçalan perde
 * - vurgulu parça (büyük harf/sayı/ünlem) biraz tiz + biraz yavaş
 * - noktalama cinsine göre soluk (virgül < noktalı virgül < üç nokta)
 */
export function buildSpeechQueue(
  segments: { text: string; lang: string }[],
  baseRate: number,
  sentenceGap: number,
  commaGap: number,
): QueueItem[] {
  const queue: QueueItem[] = [];
  let sIdx = 0;
  for (const seg of segments) {
    const sents = splitSentences(seg.text);
    for (let s = 0; s < sents.length; s++) {
      const sent = sents[s];
      const isQuestion = /[?？]$/.test(sent);
      const isExclaim = /[!！]$/.test(sent);
      const isEllipsis = /[…]$/.test(sent);
      // Paragraf melodisi: cümleler arası minik dalga, tekdüzelik kırılır
      const melody = 1 + 0.02 * Math.sin(sIdx * 1.7);
      const phrases = splitPhrases(sent);
      for (let p = 0; p < phrases.length; p++) {
        const lastInSent = p === phrases.length - 1;
        const lastOverall = s === sents.length - 1 && lastInSent;
        let pitch = melody;
        if (isQuestion) pitch = lastInSent ? 1.15 : melody + 0.03; // sona doğru yüksel
        else if (isExclaim) pitch = lastInSent ? 1.1 : melody + 0.02;
        else if (lastInSent) pitch = melody - 0.03; // biten cümle alçalır (nokta hissi)
        let rateMul = 1;
        if (hasEmphasis(phrases[p])) {
          pitch += 0.07; // vurgu kelimesi tizleşir
          rateMul = 0.96; // ve biraz yavaşlar (üzerinde durulur)
        }
        queue.push({
          t: phrases[p],
          lang: seg.lang,
          pitch: clampPitch(pitch),
          rate: Math.min(1.3, Math.max(0.7, baseRate * rateMul)),
          gapAfter: lastOverall
            ? 0
            : !lastInSent
              ? pauseForDelimiter(phrases[p], commaGap)
              : isEllipsis
                ? 800 // "düşünme" duraklaması
                : sentenceGap,
        });
      }
      sIdx++;
    }
  }
  return queue;
}

/** Okumayı durdur — bekleyen tüm ses zincirleri susar (yeni okuma otomatik durdurur zaten) */
export function stopNatural() {
  speechGen++;
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
  text = cleanForSpeech(text);
  if (!text) return;
  const my = ++speechGen;
  try {
    synth.cancel();
  } catch {}
  const rate = opts?.rate ?? rateForLevel(opts?.level);
  const gapMs = opts?.gapMs ?? (opts?.level === "A1" || opts?.level === "A2" ? 600 : 400);
  const breathMs = opts?.breathMs ?? 200;
  let voice: any = null;

  const speakOne = (q: QueueItem) =>
    new Promise<void>((res) => {
      if (my !== speechGen) return res();
      try {
        const u = new SpeechSynthesisUtterance(q.t);
        u.lang = q.lang;
        u.rate = q.rate;
        u.pitch = q.pitch;
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
        setTimeout(fin, Math.min(12000, 2000 + q.t.length * 120));
      } catch {
        res();
      }
    });

  const wait = (ms: number) =>
    new Promise<void>((res) => {
      const t0 = Date.now();
      const tick = () => {
        if (my !== speechGen || Date.now() - t0 >= ms) res();
        else setTimeout(tick, 80);
      };
      tick();
    });

  (async () => {
    await ensureVoices(); // liste hazır değilse varsayılan robot ses KULLANILMASIN
    if (my !== speechGen) return;
    const voices = voicesCache.length ? voicesCache : synth.getVoices?.() || [];
    if (!voicesCache.length && voices.length) voicesCache = voices;
    voice = pickBestVoice(voices, lang);
    noteVoice(lang, voice);
    // Ortak prozodi kuyruğu: vurgu + duraklama + cümle melodisi
    const queue = buildSpeechQueue([{ text, lang }], rate, gapMs, breathMs);
    for (let i = 0; i < queue.length; i++) {
      if (my !== speechGen) return;
      await speakOne(queue[i]);
      if (my !== speechGen) return;
      if (queue[i].gapAfter > 0) await wait(queue[i].gapAfter);
    }
    if (my === speechGen) opts?.onDone?.();
    if (my === speechGen) opts?.onEnd?.();
  })();
}

export function getTtsFor(code: string, fallback = "en-US") {
  // LANGS'tan tts bul, yoksa fallback
  try {
    return LANGS.find((l) => l.code === code)?.tts || fallback;
  } catch {
    return fallback;
  }
}

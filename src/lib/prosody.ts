// Saf prozodi — istemci/sunucu ortak. "use client" YOK: Edge SSML rotası da kullanır.
// Tarayıcı ses listesi/çalar burada DEĞİL (bkz. lib/tts.ts).

/** Seviyeye göre TTS hızı — spec Adım 3: A1-A2 yavaş, B normal akış, C tam akıcı */
export function rateForLevel(level?: string): number {
  if (!level) return 1.12;
  if (level === "A1" || level === "A2") return 0.9;
  if (level === "B1") return 1.0;
  if (level === "B2") return 1.05;
  return 1.12;
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

/** Cümlelere böl — vurgulu okuma için (CJK/Arapça noktalama dahil) */
export function splitSentences(text: string): string[] {
  const m = String(text || "").match(/[^.!?…؟\n。！？]+[.!?…؟。！？]+["'»”)\]]?|[^.!?…؟\n。！？]+$/g);
  const parts = (m || [text]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [String(text || "")];
}

/** Virgül nefesleri — uzun cümleyi doğal soluklarla parçala */
export function splitPhrases(sentence: string): string[] {
  const m = String(sentence || "").match(/[^,;:—–،؛：、]+[,;:—–،؛：、]?/g);
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
export function hasEmphasis(fragment: string): boolean {
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

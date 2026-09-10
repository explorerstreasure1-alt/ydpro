"use client";
// Görülen cevaplar — her ortam/sahne/seviye/dil için ayrı hatırlanır,
// sunucuya gönderilir, AI aynısını tekrar üretmez. Kişi başı cihazda saklanır.

const PREFIX = "yzed_seen:v1:";
const CAP = 15;

function key(kind: string, id: string, level: string, lang: string): string {
  return `${PREFIX}${kind}:${id}:${level}:${lang}`;
}

function read(keyStr: string): string[] {
  try {
    const raw = localStorage.getItem(keyStr);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, CAP) : [];
  } catch {
    return [];
  }
}

/** Daha önce gösterilen cevaplar (tekrara düşmemek için sunucuya gönderilir) */
export function getSeen(kind: string, id: string | number, level: string, lang: string): string[] {
  try {
    return read(key(kind, String(id), level, lang));
  } catch {
    return [];
  }
}

/** Yeni gösterilen cevapları kaydet (en fazla CAP adet tutulur) */
export function addSeen(kind: string, id: string | number, level: string, lang: string, answers: (string | undefined | null)[]): void {
  try {
    const k = key(kind, String(id), level, lang);
    const prev = read(k);
    const fresh = (answers || [])
      .map((a) => String(a || "").trim().slice(0, 120))
      .filter((a) => a.length > 1 && !prev.includes(a));
    if (fresh.length === 0) return;
    localStorage.setItem(k, JSON.stringify([...fresh, ...prev].slice(0, CAP)));
  } catch {}
}

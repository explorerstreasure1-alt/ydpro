// Yedek ders havuzu — AI üretim başarısız olursa curated pack'ten servis edilir.
// Dosyalar scripts/curate-lessons.ts ile üretilir (src/lib/curated/<dil>.json).
// Sunucu tarafı (fs okur — istemciye sızmaz).
import fs from "node:fs";
import path from "node:path";

export interface CuratedLesson {
  npcName: string;
  npcEmoji: string;
  steps: { prompt: string; promptTr: string; answer: string; tr: string; reading: string; chips: string[] }[];
  curated: true;
}

const mem = new Map<string, any[]>();

function loadPack(langCode: string): any[] {
  const hit = mem.get(langCode);
  if (hit) return hit;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "src", "lib", "curated", `${langCode}.json`), "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      mem.set(langCode, arr);
      return arr;
    }
  } catch {}
  return [];
}

/** Görülen cevaplarla en az çakışan hazır dersi seç */
export function curatedLesson(
  langCode: string,
  level: string,
  topicKey: string,
  seen: string[] = [],
): CuratedLesson | null {
  const arr = loadPack(langCode);
  const cands = arr.filter((e: any) => e.level === level && e.topicKey === topicKey);
  if (!cands.length) return null;
  const seenSet = new Set(seen.map((s) => String(s || "").toLowerCase().trim()));
  const scored = cands.map((c: any) => ({
    c,
    hits: (c.steps || []).filter((s: any) => seenSet.has(String(s.answer || "").toLowerCase().trim())).length,
  }));
  scored.sort((a, b) => a.hits - b.hits);
  const best = scored[0].hits;
  const top = scored.filter((x) => x.hits === best);
  const pick = top[Math.floor(Math.random() * top.length)].c;
  return { npcName: pick.npcName || "Rehber", npcEmoji: pick.npcEmoji || "🗣️", steps: pick.steps, curated: true as const };
}

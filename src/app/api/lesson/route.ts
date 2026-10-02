import { NextRequest } from "next/server";
import { generateLesson } from "@/lib/ai";
import { LANGS } from "@/lib/levels";

export const dynamic = "force-dynamic";

// POST { lang, level, topic, native } -> { steps, npcName, npcEmoji } | { error }
// native = ana dil (kendi dilin), lang = hedef dil (öğrenmek istediğin) — tüm dillere uyumlu
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const langCode = String(body.lang || body.target || "en");
  const nativeCode = String(body.native || body.nativeLang || "tr");
  const level = String(body.level || "A1");
  const topic = String(body.topic || "Günlük hayat");
  const topicKey = String(body.topicKey || "");
  const fresh = body.fresh === true || body.fresh === 1 || body.fresh === "1";
  const seen = Array.isArray(body.seen) ? body.seen.filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 120)).slice(0, 25) : [];
  const lang = LANGS.find((l) => l.code === langCode);
  const native = LANGS.find((l) => l.code === nativeCode);
  const langName = lang?.spoken || "English";
  const nativeName = native?.spoken || "Turkish";

  const lesson = await generateLesson(langName, level, topic, nativeName, fresh, seen, topicKey);
  if (!lesson) {
    // Önce yedek paket (anlamlı+okunuşlu hazır ders), o da yoksa çevrimdışı taban
    const { curatedLesson } = await import("@/lib/curated");
    const pack = curatedLesson(langCode, level, topicKey, seen);
    if (pack) return Response.json(pack);
    const { offlineLessonSteps } = await import("@/lib/ai");
    return Response.json({
      npcName: "Rehber",
      npcEmoji: "🗣️",
      steps: offlineLessonSteps(topic, level, seen.length),
      offline: true,
    });
  }
  return Response.json(lesson);
}

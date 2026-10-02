import { NextRequest } from "next/server";
import { buildSpeechQueue, cleanForSpeech, hasEmphasis, rateForLevel } from "@/lib/prosody";
import { buildSsml, pickEdgeVoice, synthesizeSsml, type SsmlSegment } from "@/lib/edgeTts";

export const dynamic = "force-dynamic";

// Edge sinirsel ses — anahtarsız, ücretsiz, SSML yönetmen komutlu.
// Zincir: ElevenLabs (kilitli) → Edge → tarayıcı. Kilit middleware'de (yd_app).

const edgeCache = new Map<string, Buffer>();
const CACHE_CAP = 50;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = String(body.text || "").trim().slice(0, 1000);
  if (!raw) return Response.json({ error: "empty" }, { status: 400 });
  const lang = String(body.lang || "en-US");
  const kind = body.voice === "native" ? "native" : "teacher";
  const level = typeof body.level === "string" ? body.level : undefined;
  const text = cleanForSpeech(raw);
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  // Dile göre ses (listeden dinamik — ezber ID yok)
  let voice: string;
  try {
    voice = await pickEdgeVoice(lang, kind as "teacher" | "native");
  } catch (e: any) {
    return Response.json({ error: "no voice", detail: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }

  const ck = `${voice}:${level || ""}:${text}`;
  const hit = edgeCache.get(ck);
  if (hit) {
    return new Response(new Uint8Array(hit), {
      headers: { "Content-Type": "audio/mpeg", "X-Cache": "hit", "X-Voice": voice },
    });
  }

  // Prozodi kuyruğu → SSML (vurgu/duraklama/melodi yönetmen komutuna dönüşür)
  const baseRate = rateForLevel(level);
  const queue = buildSpeechQueue([{ text, lang }], baseRate, level === "A1" || level === "A2" ? 600 : 400, 200);
  const segments: SsmlSegment[] = queue.map((q) => ({
    text: q.t,
    voice,
    lang,
    ratePct: (q.rate - 1) * 100,
    pitchPct: (q.pitch - 1) * 100,
    emphasis: hasEmphasis(q.t),
    breakMs: q.gapAfter,
  }));
  const ssml = buildSsml(segments, lang);
  try {
    const audio = await synthesizeSsml(ssml);
    if (!audio || audio.length < 1000) return Response.json({ error: "empty audio" }, { status: 502 });
    edgeCache.set(ck, audio);
    if (edgeCache.size > CACHE_CAP) {
      const first = edgeCache.keys().next().value;
      if (first) edgeCache.delete(first);
    }
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "X-Voice": voice },
    });
  } catch (e: any) {
    return Response.json({ error: "edge failed", detail: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}

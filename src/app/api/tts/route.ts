import { NextRequest } from "next/server";
import { isAppUnlocked } from "@/lib/authLock";

export const dynamic = "force-dynamic";

// ElevenLabs — stüdyo kalitesi sinirsel ses. Anahtar Vercel env'den gelir:
// ELEVENLABS_API_KEY (zorunlu), ELEVENLABS_VOICE_ID (genel), ELEVENLABS_VOICE_<DIL> (örn. TR)
// Anahtar yoksa 503 — istemci sessizce tarayıcı sesine düşer.

// Bilinen kararlı sesler (çok dilli modelde her dili okur):
// teacher = olgun erkek (ders), native = kadın (ana dil/düzeltme)
const DEFAULT_VOICES = {
  teacher: "pNInz6obpgDQGcFmaJgB", // Adam — tok, olgun erkek
  native: "EXAVITQu4vr4xnSDxMaL", // Bella — doğal kadın
};

// Küçük bellek önbelleği — aynı cümle tekrar istenirse API kotası yenmez
const audioCache = new Map<string, Buffer>();
const CACHE_CAP = 50;

export async function GET(req: NextRequest) {
  const keyPresent = !!process.env.ELEVENLABS_API_KEY;
  const passSet = !!process.env.ELEVENLABS_TTS_PASSWORD;
  const unlocked = await isAppUnlocked(req.cookies.get("yd_app")?.value);
  return Response.json({ ok: keyPresent, keyPresent, passSet, unlocked });
}

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY || "";
  if (!key) return Response.json({ error: "no key" }, { status: 503 });
  if (!(await isAppUnlocked(req.cookies.get("yd_app")?.value)))
    return Response.json({ error: "locked" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 1000);
  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  const langCode = String(body.lang || "en").split("-")[0].toUpperCase();
  const kind = body.voice === "native" ? "native" : "teacher";
  const voiceId =
    process.env[`ELEVENLABS_VOICE_${langCode}`] ||
    process.env.ELEVENLABS_VOICE_ID ||
    (kind === "native" ? DEFAULT_VOICES.native : DEFAULT_VOICES.teacher);

  const ck = `${voiceId}:${text}`;
  const hit = audioCache.get(ck);
  if (hit) {
    return new Response(new Uint8Array(hit), {
      headers: { "Content-Type": "audio/mpeg", "X-Cache": "hit" },
    });
  }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      // Kota/auth/limit hatalarını OLDUĞU GİBİ ilet — istemci oturumluk normal moda döner
      if (r.status === 401 || r.status === 402 || r.status === 429) {
        return Response.json({ error: `eleven ${r.status}`, detail: msg.slice(0, 200) }, { status: r.status });
      }
      return Response.json({ error: `eleven ${r.status}`, detail: msg.slice(0, 200) }, { status: 502 });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) return Response.json({ error: "empty audio" }, { status: 502 });
    audioCache.set(ck, buf);
    if (audioCache.size > CACHE_CAP) {
      const first = audioCache.keys().next().value;
      if (first) audioCache.delete(first);
    }
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e: any) {
    return Response.json({ error: e?.message || "tts failed" }, { status: 500 });
  }
}

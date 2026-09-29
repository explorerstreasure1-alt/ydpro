import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { appCookieHeader } from "@/lib/authLock";

export const dynamic = "force-dynamic";

// Şifre doğrulama — tek kapı (uygulama kilidi + stüdyo sesi).
// Şifre SADECE ELEVENLABS_TTS_PASSWORD env'inde, buraya/koda yazılmaz.
// İmza yardımcısı: @/lib/authLock (isAppUnlocked oradan alınır).
export async function POST(req: NextRequest) {
  const pass = process.env.ELEVENLABS_TTS_PASSWORD || "";
  if (!pass) return Response.json({ error: "not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const candidate = String(body.password || "");
  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(pass);
    const ok = candidate.length > 0 && a.length === b.length && timingSafeEqual(a, b);
    if (!ok) return Response.json({ error: "wrong password" }, { status: 403 });
  } catch {
    return Response.json({ error: "wrong password" }, { status: 403 });
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": await appCookieHeader() } },
  );
}

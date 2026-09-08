import { NextRequest } from "next/server";
import { translateTo, translateToTurkish } from "@/lib/ai";
import { LANGS } from "@/lib/levels";

export const dynamic = "force-dynamic";

// POST { text, lang? } -> { tr: string | null } — lang = ana dil kodu (native), yoksa Turkish
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "");
  const nativeCode = String(body.lang || body.native || "tr");
  const native = LANGS.find((l) => l.code === nativeCode);
  const nativeName = native?.spoken || "Turkish";
  const tr = nativeName === "Turkish" ? await translateToTurkish(text) : await translateTo(text, nativeName);
  return Response.json({ tr });
}

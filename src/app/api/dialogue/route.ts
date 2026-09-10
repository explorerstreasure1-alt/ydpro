import { NextRequest } from "next/server";
import { generateDialogue } from "@/lib/ai";
import { LANGS } from "@/lib/levels";

export const dynamic = "force-dynamic";

// POST { target, native, level, topic, seen? } -> { lines, target, native, level } | { error }
// Diyalog Stüdyosu — her dil çifti + her seviye + özgür konu (spec Adım 1-2)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const targetCode = String(body.target || body.lang || "en");
  const nativeCode = String(body.native || body.nativeLang || "tr");
  const level = String(body.level || "A1");
  const topic = String(body.topic || "").trim().slice(0, 80) || "Günlük hayat";
  const seen = Array.isArray(body.seen)
    ? body.seen.filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 120)).slice(0, 15)
    : [];
  if (targetCode === nativeCode) {
    return Response.json({ error: "same language" }, { status: 400 });
  }
  const targetName = LANGS.find((l) => l.code === targetCode)?.spoken || "English";
  const nativeName = LANGS.find((l) => l.code === nativeCode)?.spoken || "Turkish";

  const dlg = await generateDialogue(targetName, nativeName, level, topic, seen);
  if (!dlg) {
    return Response.json({ error: "generate failed" }, { status: 502 });
  }
  return Response.json({ ...dlg, target: targetCode, native: nativeCode, level, topic });
}

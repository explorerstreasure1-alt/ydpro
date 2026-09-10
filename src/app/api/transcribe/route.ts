import { NextRequest } from "next/server";
import Groq from "groq-sdk";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const lang = String(form.get("lang") || "en");
    // Beklenen cümle ipucu (öğrenilen cevap) — kısa öğrenci cümlelerinde isabeti artırır
    const hint = String(form.get("prompt") || "").trim().slice(0, 200);
    const langCode = lang.split("-")[0].toLowerCase();
    if (!file) return Response.json({ error: "no file" }, { status: 400 });

    const groqKey = process.env.GROQ_API_KEY || "";
    if (!groqKey) {
      // Fallback: no key, return empty to let browser handle
      return Response.json({ text: "", lang, fallback: true });
    }

    const groq = new Groq({ apiKey: groqKey });
    // Groq Whisper large-v3 — çok dilli, aksanlı konuşmada daha doğru
    const arrayBuffer = await file.arrayBuffer();
    const mime = file.type || "audio/webm";
    const ext = mime.includes("mp4") ? "audio.mp4" : mime.includes("ogg") ? "audio.ogg" : "audio.webm";
    // Whisper dil kodu: pt-PT→pt, zh-CN→zh, ja-JP→ja; boş/garip kodda auto-detect (language yok)
    const safeLang = /^[a-z]{2}$/.test(langCode) ? langCode : "";
    // @ts-ignore — groq-sdk expects File/Blob
    const transcription = await groq.audio.transcriptions.create({
      file: new File([arrayBuffer], ext, { type: mime }),
      model: "whisper-large-v3",
      ...(safeLang ? { language: safeLang } : {}),
      ...(hint ? { prompt: hint } : {}),
      response_format: "json",
      temperature: 0,
    } as any);

    const text = (transcription as any).text || "";
    return Response.json({ text: String(text).trim(), lang });
  } catch (e: any) {
    return Response.json({ error: e?.message || "transcribe failed", text: "" }, { status: 500 });
  }
}

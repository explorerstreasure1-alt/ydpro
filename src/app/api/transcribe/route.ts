import { NextRequest } from "next/server";
import Groq from "groq-sdk";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const lang = String(form.get("lang") || "en");
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
    // @ts-ignore — groq-sdk expects File/Blob
    const transcription = await groq.audio.transcriptions.create({
      file: new File([arrayBuffer], "audio.webm", { type: file.type || "audio/webm" }),
      model: "whisper-large-v3",
      language: langCode,
      response_format: "json",
    } as any);

    const text = (transcription as any).text || "";
    return Response.json({ text: String(text).trim(), lang });
  } catch (e: any) {
    return Response.json({ error: e?.message || "transcribe failed", text: "" }, { status: 500 });
  }
}

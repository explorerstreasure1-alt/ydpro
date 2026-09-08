import { AI_ORCHESTRATOR, aiHealth, generateFullScene } from "@/lib/ai";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/ai — orchestrator status (tüm yapıdan AI sorumlu)
export async function GET() {
  const health = await aiHealth();
  return Response.json({
    orchestrator: "AI is responsible for ALL content",
    enabled: AI_ORCHESTRATOR.enabled,
    model: AI_ORCHESTRATOR.model,
    fallbackModel: AI_ORCHESTRATOR.fallbackModel,
    key: AI_ORCHESTRATOR.keyMasked,
    health,
    capabilities: ["evaluateAnswer", "freeTalkReply", "generateDialog", "generateFullScene", "generateLesson", "translateToTurkish"],
  });
}

// POST /api/ai { day, theme, level } -> AI generates fresh dialog for a day
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const day = Number(body.day || 1);
  const theme = String(body.theme || body.topic || "Havaalanı - Airport");
  const level = String(body.level || "A1");
  const steps = await generateFullScene(day, theme, level);
  if (!steps) return Response.json({ error: "AI generation failed, fallback to static" }, { status: 502 });
  return Response.json({ day, theme, level, steps, orchestrator: AI_ORCHESTRATOR.model });
}

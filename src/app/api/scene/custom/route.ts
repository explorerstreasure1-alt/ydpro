import { NextRequest } from "next/server";
import { ALL_SCENES } from "@/lib/scenes";
import { generatePersonaScene } from "@/lib/ai";
import { LANGS } from "@/lib/levels";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sceneId = String(body.sceneId || "");
    const level = String(body.level || "A1");
    const targetCode = String(body.target || "en");
    const nativeCode = String(body.native || "tr");
    const scene = ALL_SCENES.find(s => s.id === sceneId);
    if (!scene) return Response.json({ error: "scene not found" }, { status: 404 });
    const targetName = LANGS.find(l => l.code === targetCode)?.spoken || "English";
    const nativeName = LANGS.find(l => l.code === nativeCode)?.spoken || "Turkish";
    // AI ile hızlı pratik diyalog üret
    const personaScene = await generatePersonaScene(0, {
      title: scene.title,
      location: scene.location,
      description: scene.description,
      npcName: scene.npc.name,
      npcRole: scene.npc.role,
      npcEmoji: scene.npc.emoji,
      secondaryNpc: scene.secondaryNpc,
      dialog: scene.examples.map(ex => ({ prompt: ex, fallback: ex, xp: 20, chips: ex.split(" ").slice(0,2) })),
    } as any, level, targetName, nativeName);
    if (personaScene?.steps) {
      return Response.json({ steps: personaScene.steps, npcName: personaScene.npcName, npcRole: personaScene.npcRole, npcEmoji: personaScene.npcEmoji });
    }
    // Fallback: örnekleri direkt döndür
    return Response.json({
      steps: scene.examples.map(ex => ({ prompt: ex, promptTr: "", answer: ex, turkish: "", chips: ex.split(" ").slice(0,2) })),
      npcName: scene.npc.name,
      npcRole: scene.npc.role,
      npcEmoji: scene.npc.emoji,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "error" }, { status: 500 });
  }
}

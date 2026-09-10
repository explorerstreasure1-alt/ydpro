import { db, hasDb } from "@/db";
import { asc, eq, and } from "drizzle-orm";
import {
  scenes as scenesT,
  answerOptions,
  vocabulary as vocabT,
  userScenes,
} from "@/db/schema";
import { DAYS } from "@/lib/content";
import { getPrimaryUser } from "@/lib/data";
import { generatePersonaScene } from "@/lib/ai";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const raw = DAYS[Number(day) - 1];
  if (!raw) return Response.json({ error: "no scene" }, { status: 404 });
  const url = new URL(req.url);
  const level = url.searchParams.get("level") || "A1";
  const targetCode = url.searchParams.get("target") || url.searchParams.get("lang") || "en";
  const nativeCode = url.searchParams.get("native") || "tr";
  const fresh = url.searchParams.get("fresh") === "1";
  // Daha önce gösterilen cevaplar — AI aynısını tekrar üretmesin (asla tekrar yok)
  let seen: string[] = [];
  try {
    const parsed = JSON.parse(url.searchParams.get("seen") || "[]");
    if (Array.isArray(parsed)) seen = parsed.filter((x) => typeof x === "string").map((x) => String(x).slice(0, 120)).slice(0, 15);
  } catch {}
  const { LANGS } = await import("@/lib/levels");
  const targetName = LANGS.find(l=>l.code===targetCode)?.spoken || "English";
  const nativeName = LANGS.find(l=>l.code===nativeCode)?.spoken || "Turkish";

  // FIX: demo mode — HER DİLDE HER DİL AI persona + kelime kartları otomatik
  if (!hasDb || !db) {
    const { generateVocabulary } = await import("@/lib/ai");
    let vocab: any = raw.vocabulary.map((v, i) => ({ ...v, id: i + 1, learned: false }));
    // Hedef dil İngilizce değilse kelimeleri AI ile hedef dilde üret
    if (targetCode !== "en") {
      try {
        const aiVocab = await generateVocabulary(raw.title, targetName, nativeName, level);
        if (aiVocab && aiVocab.length) {
          vocab = aiVocab.map((v, i) => ({ ...v, id: i + 1, learned: false }));
        }
      } catch {}
    }
    let personaScene: any = null;
    let aiSteps: any = null;
    try {
      personaScene = await generatePersonaScene(Number(day), raw as any, level, targetName, nativeName, fresh, seen);
      if (personaScene?.steps) {
        const { translateTo } = await import("@/lib/ai");
        for (const s of personaScene.steps as any[]) {
          if (!s.promptTr || !String(s.promptTr).trim()) {
            try { s.promptTr = await translateTo(s.prompt, nativeName) || ""; } catch { s.promptTr = ""; }
          }
          if (!s.turkish || !String(s.turkish).trim()) {
            try { s.turkish = await translateTo(s.answer, nativeName) || ""; } catch { s.turkish = ""; }
          }
        }
        aiSteps = personaScene.steps;
      }
    } catch {}
    // Offline / AI yoksa: TÜM seriler + TÜM seviyeler için takılmayan taban adımlar
    if (!aiSteps) {
      try {
        const { offlineSceneSteps } = await import("@/lib/ai");
        const steps = offlineSceneSteps(raw as any, level, targetName);
        // Anadil çevirileri eksikse AI çeviriyle tamamla (varsa), yoksa boş bırak
        try {
          const { translateTo } = await import("@/lib/ai");
          for (const s of steps as any[]) {
            if (!s.promptTr) {
              try { s.promptTr = await translateTo(s.prompt, nativeName) || ""; } catch { s.promptTr = ""; }
            }
            if (!s.turkish) {
              try { s.turkish = await translateTo(s.answer, nativeName) || ""; } catch { s.turkish = ""; }
            }
          }
        } catch {}
        aiSteps = steps;
        personaScene = { npcName: raw.npcName, npcRole: raw.npcRole, npcEmoji: raw.npcEmoji, steps, offline: true };
      } catch {}
    }
    return Response.json({
      scene: raw,
      status: Number(day) <= 2 ? "open" : "locked",
      dbOptions: [],
      vocabulary: vocab,
      npcLine: raw.dialog[0].line,
      npcName: personaScene?.npcName || raw.npcName,
      npcRole: personaScene?.npcRole || raw.npcRole,
      npcEmoji: personaScene?.npcEmoji || raw.npcEmoji,
      heading: `${day}. Gün — ${raw.title}`,
      aiSteps,
      personaScene,
      aiOrchestrator: true,
    });
  }

  const user = await getPrimaryUser();
  const scene = await db
    .select()
    .from(scenesT)
    .where(eq(scenesT.day, Number(day)))
    .limit(1);
  const s = scene[0];
  if (!s) return Response.json({ error: "missing scene" }, { status: 404 });

  const prog = await db
    .select()
    .from(userScenes)
    .where(and(eq(userScenes.userId, user.id), eq(userScenes.sceneId, s.id)))
    .limit(1);

  const dbVocab = await db.select().from(vocabT).where(eq(vocabT.sceneId, s.id));
  const opts = await db.select().from(answerOptions).where(eq(answerOptions.sceneId, s.id));

  const vocab = raw.vocabulary.map((v) => ({
    ...v,
    id: dbVocab.find((d) => d.word === v.word)?.id ?? -1,
    learned: false,
  }));

  // DB modunda da AI persona sahne üretimi (tüm seriler + seviyeler + diller)
  let npcName = raw.npcName;
  let npcRole = raw.npcRole;
  let npcEmoji = raw.npcEmoji;
  let aiSteps: any = null;
  let personaScene: any = null;
  try {
    const { generatePersonaScene, offlineSceneSteps } = await import("@/lib/ai");
    personaScene = await generatePersonaScene(Number(day), raw as any, level, targetName, nativeName, fresh, seen);
    if (personaScene?.steps?.length) {
      aiSteps = personaScene.steps;
      npcName = personaScene.npcName || npcName;
      npcRole = personaScene.npcRole || npcRole;
      npcEmoji = personaScene.npcEmoji || npcEmoji;
    } else {
      const steps = offlineSceneSteps(raw as any, level, targetName);
      aiSteps = steps;
      personaScene = { npcName, npcRole, npcEmoji, steps, offline: true };
    }
  } catch {}

  return Response.json({
    scene: raw, // full structured content for the dialog player
    status: prog[0]?.status ?? "locked",
    dbOptions: opts,
    vocabulary: vocab,
    npcLine: raw.dialog[0].line,
    npcName,
    npcRole,
    npcEmoji,
    heading: `${day}. Gün — ${raw.title}`,
    aiSteps,
    personaScene,
    aiOrchestrator: true,
  });
}

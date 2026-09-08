import { db, hasDb } from "@/db";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { users, userScenes, userAchievements, scenes as scenesT, achievements as achievementsT } from "@/db/schema";
import { getPrimaryUser, recomputeLocks, weeklyStreak } from "@/lib/data";
import { ensureContent } from "@/lib/seed";
import { evaluateAnswer, evaluateWithPersona } from "@/lib/ai";
import { ACHIEVEMENT_DEFS } from "@/lib/content";

export const dynamic = "force-dynamic";

interface Body {
  type: string;
  input?: string;
  ideal?: string;
  answerText?: string;
  day?: number;
  correct?: boolean;
  gainedXp?: number;
  words?: number;
  activity?: { talkMinutes?: number };
  unlock?: string;
  persona?: { name: string; role: string; emoji: string; dayTitle: string };
  nativeLang?: string;
  native?: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  await ensureContent();
  // FIX: demo mode — all actions succeed without DB (AI persona aware + native dil)
  if (!hasDb || !db) {
    if (body.type === "answer-free-text") {
      const text = body.answerText || body.input || "";
      const ideal = body.ideal || "";
      const nativeCode = body.nativeLang || body.native || "tr";
      const { LANGS } = await import("@/lib/levels");
      const nativeName = LANGS.find((l:any)=>l.code===nativeCode)?.spoken || "Turkish";
      const res = body.persona
        ? await evaluateWithPersona(text, ideal, body.persona as any, nativeName)
        : await evaluateAnswer(text, ideal);
      // ensure feedback in native language already handled via evaluateWithPersona native param
      return Response.json({ res });
    }
    return Response.json({ ok: true, gain: body.gainedXp || 20, demo: true });
  }
  const user = await getPrimaryUser();
  await weeklyStreak(user.id);

  switch (body.type) {
    case "onboard": {
      const parts = (body.input || "").split("\n");
      await db
        .update(users)
        .set({
          name: parts[0] || user.name,
          goal: parts[1] || user.goal,
          dailyMinutes: parts[2] || user.dailyMinutes,
          language: parts[3] || user.language,
        })
        .where(eq(users.id, user.id));
      return Response.json({ ok: true });
    }

    case "answer-free-text": {
      const text = body.answerText || body.input || "";
      const ideal = body.ideal || "";
      const nativeCode = (body as any).nativeLang || (body as any).native || "tr";
      const { LANGS } = await import("@/lib/levels");
      const nativeName = LANGS.find((l:any)=>l.code===nativeCode)?.spoken || "Turkish";
      const res = body.persona
        ? await evaluateWithPersona(text, ideal, body.persona as any, nativeName)
        : await evaluateAnswer(text, ideal);
      return Response.json({ res });
    }

    case "answer-free-text-correct": {
      // client already evaluated; award xp for a correct typed/speech answer
      await bumpPartial(user.id, {
        xp: body.gainedXp || 20,
        sentences: 1,
        patterns: 1,
      });
      return Response.json({ ok: true });
    }

    case "choice": {
      if (body.correct) {
        await bumpPartial(user.id, {
          xp: body.gainedXp || 20,
          sentences: 1,
          pronunciation: 88,
        });
      }
      return Response.json({ ok: true, gain: body.correct ? body.gainedXp || 20 : 0 });
    }

    case "learn-words": {
      await bumpPartial(user.id, {
        xp: body.gainedXp || 0,
        words: body.words || 0,
      });
      return Response.json({ ok: true });
    }

    case "talk-minutes": {
      await bumpPartial(user.id, {
        xp: 0,
        talkMinutes: body.activity?.talkMinutes || (body.words || 0),
      });
      return Response.json({ ok: true });
    }

    case "complete-scene": {
      const day = body.day;
      const scene = await db.select().from(scenesT).where(eq(scenesT.day, Number(day))).limit(1);
      if (!scene[0]) return Response.json({ error: "no scene" }, { status: 404 });
      const prog = await db
        .select()
        .from(userScenes)
        .where(and(eq(userScenes.userId, user.id), eq(userScenes.sceneId, scene[0].id)))
        .limit(1);
      const isNew = prog[0]?.status !== "done";
      await db
        .update(userScenes)
        .set({ status: "done", completedAt: todayIso() })
        .where(and(eq(userScenes.userId, user.id), eq(userScenes.sceneId, scene[0].id)));
      await bumpPartial(user.id, {
        xp: isNew ? scene[0].xpReward : Math.round(scene[0].xpReward * 0.2),
        missions: isNew ? 1 : 0,
        sentences: 2,
      });
      await recomputeLocks(user.id);
      return Response.json({ ok: true, gain: isNew ? scene[0].xpReward : 0, day });
    }

    case "unlock-achievement": {
      const key = body.unlock || body.input || "";
      const def = (ACHIEVEMENT_DEFS as Record<string, any>)[key];
      if (!def) return Response.json({ ok: false });
      const ach = await db.select().from(achievementsT).where(eq(achievementsT.key, key)).limit(1);
      if (ach[0]) {
        await db
          .insert(userAchievements)
          .values({ userId: user.id, achievementId: ach[0].id })
          .onConflictDoNothing();
      }
      return Response.json({ ok: true, def });
    }

    default:
      return Response.json({ ok: false });
  }
}

async function bumpPartial(
  userId: number,
  inc: Partial<{ xp: number; words: number; patterns: number; sentences: number; missions: number; talkMinutes: number; pronunciation: number }>,
) {
  if (!hasDb || !db) return; // FIX: demo mode
  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const cur = u[0];
  if (!cur) return;
  const set: any = {};
  if (inc.xp) set.xp = (cur.xp || 0) + inc.xp;
  if (inc.words) set.wordsLearned = (cur.wordsLearned || 0) + inc.words;
  if (inc.patterns) set.patterns = (cur.patterns || 0) + inc.patterns;
  if (inc.sentences) set.sentences = (cur.sentences || 0) + inc.sentences;
  if (inc.missions) set.missionsDone = (cur.missionsDone || 0) + inc.missions;
  if (inc.talkMinutes) set.talkMinutes = (cur.talkMinutes || 0) + inc.talkMinutes;
  if (inc.pronunciation)
    set.pronunciation = Math.min(100, Math.floor(((cur.pronunciation || 0) * 3 + inc.pronunciation) / 4));
  await db.update(users).set(set).where(eq(users.id, userId));
}

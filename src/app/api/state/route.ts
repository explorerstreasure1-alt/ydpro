import { db, hasDb } from "@/db";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  scenes as scenesT,
  userScenes,
  userAchievements,
  users,
  achievements as achT,
} from "@/db/schema";
import { getPrimaryUser } from "@/lib/data";
import { ensureContent } from "@/lib/seed";
import { ACHIEVEMENT_DEFS, levelForXp, DAYS } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureContent();
    const user = await getPrimaryUser();

    // FIX: demo mode — return static scenes without DB
    if (!hasDb || !db) {
      const sceneState = DAYS.map((s) => ({
        id: s.day,
        day: s.day,
        title: s.title,
        emoji: s.emoji,
        short: s.short,
        location: s.location,
        description: s.description,
        xpReward: s.xpReward,
        status: s.day === 1 ? "open" : s.day === 2 ? "open" : s.day <= 3 ? "locked" as const : "locked" as const,
        plays: 0,
      }));
      // first day done simulation for demo after day 1
      return Response.json({
        demo: true,
        user: {
          id: user.id,
          name: user.name,
          language: user.language,
          xp: user.xp,
          level: levelForXp(user.xp).level,
          levelName: levelForXp(user.xp).name,
          levelMin: levelForXp(user.xp).min,
          nextMin: nextLevel(user.xp),
          streak: user.streak,
          goal: user.goal,
          dailyMinutes: user.dailyMinutes,
          wordsLearned: user.wordsLearned,
          patterns: user.patterns,
          missionsDone: user.missionsDone,
          sentences: user.sentences,
          talkMinutes: user.talkMinutes,
          pronunciation: user.pronunciation,
        },
        scenes: sceneState,
        achievements: ACHIEVEMENT_DEFS,
        unlockedAchievements: ["first_talk"],
        todayMission: sceneState.find((s) => s.status === "open"),
      });
    }

    // DB varsa dene, bağlantı kopuksa demo fallback — profesyonel dayanıklılık
    try {
      const allScenes = await db.select().from(scenesT).orderBy(asc(scenesT.day));
      const progress = await db.select().from(userScenes).where(eq(userScenes.userId, user.id));

      const unlockedRows = await db
        .select({ key: achT.key, icon: achT.icon, title: achT.title, description: achT.description })
        .from(userAchievements)
        .innerJoin(achT, eq(achT.id, userAchievements.achievementId))
        .where(eq(userAchievements.userId, user.id));
      const unlockedAchievements = unlockedRows.map((r) => r.key);

      const sceneState = allScenes.map((s) => {
        const p = progress.find((x) => x.sceneId === s.id);
        return {
          id: s.id,
          day: s.day,
          title: s.title,
          emoji: s.emoji,
          short: s.short,
          location: s.location,
          description: s.description,
          xpReward: s.xpReward,
          status: p?.status ?? "locked",
          plays: p?.plays ?? 0,
        };
      });

      return Response.json({
        user: {
          id: user.id,
          name: user.name,
          language: user.language,
          xp: user.xp,
          level: levelForXp(user.xp).level,
          levelName: levelForXp(user.xp).name,
          levelMin: levelForXp(user.xp).min,
          nextMin: nextLevel(user.xp),
          streak: user.streak,
          goal: user.goal,
          dailyMinutes: user.dailyMinutes,
          wordsLearned: user.wordsLearned,
          patterns: user.patterns,
          missionsDone: user.missionsDone,
          sentences: user.sentences,
          talkMinutes: user.talkMinutes,
          pronunciation: user.pronunciation,
        },
        scenes: sceneState,
        achievements: ACHIEVEMENT_DEFS,
        unlockedAchievements,
        todayMission: sceneState.find((s) => s.status === "open"),
      });
    } catch (dbErr) {
      console.warn("DB unavailable, falling back to demo:", dbErr);
      // demo fallback — 10 günlük kapsamlı
      const sceneState = DAYS.map((s) => ({
        id: s.day,
        day: s.day,
        title: s.title,
        emoji: s.emoji,
        short: s.short,
        location: s.location,
        description: s.description,
        xpReward: s.xpReward,
        status: s.day <= 2 ? "open" as const : "locked" as const,
        plays: 0,
      }));
      return Response.json({
        user: {
          id: user.id,
          name: user.name,
          language: user.language,
          xp: user.xp,
          level: levelForXp(user.xp).level,
          levelName: levelForXp(user.xp).name,
          levelMin: levelForXp(user.xp).min,
          nextMin: nextLevel(user.xp),
          streak: user.streak,
          goal: user.goal,
          dailyMinutes: user.dailyMinutes,
          wordsLearned: user.wordsLearned,
          patterns: user.patterns,
          missionsDone: user.missionsDone,
          sentences: user.sentences,
          talkMinutes: user.talkMinutes,
          pronunciation: user.pronunciation,
        },
        scenes: sceneState,
        achievements: ACHIEVEMENT_DEFS,
        unlockedAchievements: ["first_talk"],
        todayMission: sceneState.find((s) => s.status === "open"),
      });
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "server" }, { status: 500 });
  }
}

function nextLevel(xp: number) {
  const l = levelForXp(xp);
  const idxOf = [0, 240, 700, 1500, 2600, 4200].indexOf(l.min);
  const bounds = [0, 240, 700, 1500, 2600, 4200, 6200];
  return bounds[idxOf + 1] ?? bounds[bounds.length - 1];
}

export async function POST(req: NextRequest) {
  // onboard
  try {
    const body = await req.json();
    if (!hasDb || !db) return Response.json({ ok: true }); // FIX: demo mode
    const user = await getPrimaryUser();
    const patch = {
      ...(body.name ? { name: body.name } : {}),
      ...(body.goal ? { goal: body.goal } : {}),
      ...(body.dailyMinutes ? { dailyMinutes: body.dailyMinutes } : {}),
      ...(body.language ? { language: body.language } : {}),
    };
    await db.update(users).set(patch).where(eq(users.id, user.id));
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message }, { status: 500 });
  }
}

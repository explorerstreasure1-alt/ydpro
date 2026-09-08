import { db, hasDb } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { users, userScenes, userWords, userAchievements, activityDays, scenes } from "@/db/schema";

// Demo mode fallback user when DATABASE_URL is not set
const DEMO_USER = {
  id: 1,
  name: "Yolcu",
  goal: "Seyahat",
  dailyMinutes: "10 dakika",
  language: "İngilizce",
  level: 1,
  xp: 120,
  streak: 3,
  lastActive: null as string | null,
  wordsLearned: 24,
  patterns: 12,
  missionsDone: 2,
  sentences: 18,
  talkMinutes: 35,
  pronunciation: 72,
  startedAt: new Date().toISOString().slice(0, 10) as any,
  createdAt: new Date() as any,
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function seedUserIfNeeded() {
  if (!hasDb || !db) return DEMO_USER as any; // FIX: demo mode — no DB
  let list = await db.select().from(users).limit(1);
  if (list.length) return list[0];
  const [u] = await db.insert(users).values({ name: "Yolcu" }).returning();
  const allScenes = await db.select().from(scenes).orderBy(asc(scenes.day));
  for (const sc of allScenes) {
    await db
      .insert(userScenes)
      .values({ userId: u.id, sceneId: sc.id, status: sc.day === 1 ? "open" : "locked" })
      .onConflictDoNothing();
  }
  return u;
}

export async function recomputeLocks(userId: number) {
  if (!hasDb || !db) return; // FIX: demo mode — no DB locks
  const allScenes = await db.select().from(scenes).orderBy(asc(scenes.day));
  const progress = await db.select().from(userScenes).where(eq(userScenes.userId, userId));
  for (const sc of allScenes) {
    const day = sc.day;
    const existing = progress.find((r) => r.sceneId === sc.id);
    const prevDayScene = allScenes.find((x) => x.day === day - 1);
    const prev = prevDayScene ? progress.find((r) => r.sceneId === prevDayScene.id) : undefined;
    let status = existing?.status ?? "locked";
    if (existing?.status === "done") status = "done"; // never lock a completed day
    else if (day === 1) status = "open";
    else if (prev?.status === "done") status = "open";
    if (!existing) {
      await db
        .insert(userScenes)
        .values({ userId, sceneId: sc.id, status })
        .onConflictDoNothing();
    } else if (existing.status !== status) {
      await db
        .update(userScenes)
        .set({ status })
        .where(and(eq(userScenes.userId, userId), eq(userScenes.sceneId, sc.id)));
    }
  }
}

export async function getPrimaryUser() {
  if (!hasDb || !db) return DEMO_USER as any; // FIX: demo mode
  await seedUserIfNeeded();
  const list = await db.select().from(users).limit(1);
  const user = list[0];
  if (!user) throw new Error("no user");
  await weeklyStreak(user.id);
  return user;
}

/** Log today's activity & roll streak. */
export async function weeklyStreak(userId: number) {
  if (!hasDb || !db) return; // FIX: demo mode
  const key = todayKey();
  const day = await db.select().from(activityDays).where(eq(activityDays.day, key)).limit(1);
  if (!day.length) {
    await db.insert(activityDays).values({ userId, day: key }).onConflictDoNothing();
    // recompute streak: count distinct days in last date range
    const seen = new Set<string>();
    const all = await db.select().from(activityDays);
    all.forEach((r) => seen.add(r.day));
    const d = new Date();
    let streak = 0;
    // count consecutive days walking back from today
    if (seen.has(key)) {
      streak = 1;
      let cur = new Date(d);
      for (let i = 1; i < 4000; i++) {
        cur = new Date(d.getTime() - i * 86400000);
        const ck = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
          cur.getDate(),
        ).padStart(2, "0")}`;
        if (seen.has(ck)) streak++;
        else break;
      }
    }
    await db.update(users).set({ streak, lastActive: key }).where(eq(users.id, userId));
  } else {
    const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    await db.update(users).set({ lastActive: key }).where(eq(users.id, userId));
    if (!u[0]?.streak) await db.update(users).set({ streak: 1 }).where(eq(users.id, userId));
  }
}

export { userWords, userAchievements, activityDays, scenes };

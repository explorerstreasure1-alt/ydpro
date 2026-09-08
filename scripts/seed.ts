import "dotenv/config";
import { db } from "../src/db";
import { scenes, vocabulary, answerOptions, achievements, users, userScenes } from "../src/db/schema";
import { DAYS, ACHIEVEMENT_DEFS } from "../src/lib/content";
import { eq } from "drizzle-orm";

// Build insert rows from content structure
async function seed() {
  console.log("Seeding 7DİL content...");

  const dayVals = DAYS.map((d) => ({
    day: d.day,
    title: d.title,
    emoji: d.emoji,
    short: d.short,
    location: d.location,
    description: d.description,
    background: d.title,
    xpReward: d.xpReward,
    mapData: d.map
      ? { prompt: d.map.prompt, target: d.map.target, options: d.map.options }
      : null,
  }));
  if (!db) { console.log("No DATABASE_URL — skipping seed (demo mode)"); process.exit(0); }
  await db.delete(scenes);
  const insertedScenes = await db.insert(scenes).values(dayVals).returning();
  console.log("scenes:", insertedScenes.length);

  for (const s of insertedScenes) {
    const day = DAYS.find((d) => d.day === s.day)!;

    // vocabulary
    await db.delete(vocabulary).where(eq(vocabulary.sceneId, s.id));
    await db.insert(vocabulary).values(
      day.vocabulary.map((v) => ({ ...v, sceneId: s.id })),
    );

    // answer options (main options + free answer prompt)
    await db.delete(answerOptions).where(eq(answerOptions.sceneId, s.id));
    const opts = day.dialog.flatMap((dlg) =>
      dlg.options
        ? [
            {
              sceneId: s.id,
              prompt: dlg.prompt,
              fallback: dlg.fallback || "",
              options: dlg.options,
              xp: dlg.xp,
              vocab: dlg.vocab || day.vocabulary.slice(0, 3).map((v) => v.word),
              chips: dlg.chips || [],
            },
          ]
        : [],
    );
    if (opts.length) await db.insert(answerOptions).values(opts);
  }

  // achievements
  await db.delete(achievements);
  await db.insert(achievements).values(
    Object.entries(ACHIEVEMENT_DEFS).map(([key, a]) => ({
      key,
      title: a.title,
      description: a.description,
      icon: a.icon,
    })),
  );

  // demo/user reset: ensure a default user exists with day 1 open
  await db.delete(userScenes);
  await db.delete(users);
  const [user] = await db
    .insert(users)
    .values({ name: "Yolcu", level: 1, xp: 0 })
    .returning();
  const allScenes = await db.select().from(scenes);
  for (const sc of allScenes) {
    await db.insert(userScenes).values({
      userId: user.id,
      sceneId: sc.id,
      status: sc.day === 1 ? "open" : sc.day <= 1 ? "open" : "locked",
    });
  }

  console.log(`Seeded. Content is ready. Default user#${user.id}.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

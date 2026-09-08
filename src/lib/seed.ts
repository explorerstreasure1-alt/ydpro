import { db, hasDb } from "@/db";
import {
  scenes as scenesT,
  vocabulary as vocabT,
  answerOptions as ansT,
  achievements as achT,
} from "@/db/schema";
import { DAYS, ACHIEVEMENT_DEFS } from "@/lib/content";

let inFlight: Promise<void> | null = null;

/**
 * Idempotently seed static content (scenes, vocabulary, answer options, achievements)
 * if the scenes table is empty. Runs at most once per process.
 */
export function ensureContent(): Promise<void> {
  if (!hasDb || !db) return Promise.resolve(); // FIX: demo mode — skip DB seeding
  if (!inFlight) inFlight = doSeed().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSeed() {
  try {
    if (!hasDb || !db) return; // FIX: demo mode
    const existing = await db.select({ id: scenesT.id }).from(scenesT).limit(1);
    if (existing.length > 0) return;

    const sceneRows = DAYS.map((d) => ({
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
    const inserted = await db.insert(scenesT).values(sceneRows).returning();

    for (const s of inserted) {
      const day = DAYS.find((d) => d.day === s.day)!;
      await db.insert(vocabT).values(day.vocabulary.map((v) => ({ ...v, sceneId: s.id })));
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
      if (opts.length) await db.insert(ansT).values(opts);
    }

    const achCount = await db.select({ id: achT.id }).from(achT).limit(1);
    if (achCount.length === 0) {
      await db
        .insert(achT)
        .values(
          Object.entries(ACHIEVEMENT_DEFS).map(([key, a]) => ({
            key,
            title: a.title,
            description: a.description,
            icon: a.icon,
          })),
        );
    }
  } catch (e) {
    console.error("ensureContent failed", e);
  }
}

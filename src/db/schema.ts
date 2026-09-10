import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  varchar,
  date,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Static content (seeded)
// ---------------------------------------------------------------------------

export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  day: integer("day").notNull(),
  title: text("title").notNull(),
  emoji: text("emoji").notNull(),
  short: text("short").notNull(), // short description on adventure screen
  location: text("location").notNull(), // e.g. Heathrow Airport
  description: text("description").notNull(), // mission description on detail screen
  background: text("background").notNull(), // immersive scene for dialog
  xpReward: integer("xp_reward").notNull().default(100),
  mapData: jsonb("map_data").$type<{
    prompt: string;
    target: string;
    options: { id: string; label: string; emoji: string; isCorrect: boolean }[];
  }>(),
});

// Vocabulary word cards attached to a scene (visual memory + mini tests)
export const vocabulary = pgTable("vocabulary", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id),
  word: text("word").notNull(),
  pronunciation: text("pronunciation").notNull(),
  translation: text("translation").notNull(),
  emoji: text("emoji").notNull(),
  visual: text("visual").notNull(), // mnemonic visual > chain
  story: text("story").notNull(), // memory story
  example: text("example").notNull(),
});

// Dialog lines + possible answers for a scene
export const dialogs = pgTable("dialogs", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id),
  speaker: text("speaker").notNull(), // npc / you
  line: text("line").notNull(),
  type: text("type").notNull(), // line | answer
  taskPrompt: text("task_prompt").notNull(),
  npcName: text("npc_name").notNull(),
  npcRole: text("npc_role").notNull(),
  npcEmoji: text("npc_emoji").notNull(),
});

// answer options for answer-type dialogs
export const answerOptions = pgTable("answer_options", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id),
  prompt: text("prompt").notNull(),
  fallback: text("fallback").notNull(), // correct/ideal wording
  options: jsonb("options")
    .$type<{ text: string; isCorrect: boolean }[]>()
    .notNull(),
  xp: integer("xp").notNull().default(20),
  vocab: jsonb("vocab").$type<string[]>().notNull().default([]),
  chips: jsonb("chips").$type<string[]>().notNull().default([]),
});

// Achievements
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  key: text("key").notNull().unique(),
});

// ---------------------------------------------------------------------------
// User state
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Yolcu"),
  goal: text("goal").notNull().default("Seyahat"),
  dailyMinutes: text("daily_minutes").notNull().default("10 dakika"),
  language: text("language").notNull().default("İngilizce"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastActive: varchar("last_active", { length: 10 }),
  wordsLearned: integer("words_learned").notNull().default(0),
  patterns: integer("patterns").notNull().default(0),
  missionsDone: integer("missions_done").notNull().default(0),
  sentences: integer("sentences").notNull().default(0),
  talkMinutes: integer("talk_minutes").notNull().default(0),
  pronunciation: integer("pronunciation").notNull().default(0),
  startedAt: date("started_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Per-scene progress (which days unlocked / completed)
export const userScenes = pgTable(
  "user_scenes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    sceneId: integer("scene_id").notNull().references(() => scenes.id),
    status: text("status").notNull().default("locked"), // locked | open | done
    bestScore: integer("best_score").notNull().default(0),
    plays: integer("plays").notNull().default(0),
    completedAt: date("completed_at"),
    lastPlayedAt: timestamp("last_played_at"),
  },
  (t) => [uniqueIndex("u_scene").on(t.userId, t.sceneId)],
);

// Gained words + learned cards
export const userWords = pgTable(
  "user_words",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    wordId: integer("word_id").notNull().references(() => vocabulary.id),
    learned: integer("learned").notNull().default(0),
  },
  (t) => [uniqueIndex("u_word").on(t.userId, t.wordId)],
);

// unlocked achievements
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    achievementId: integer("achievement_id").notNull().references(() => achievements.id),
    unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("u_ach").on(t.userId, t.achievementId)],
);

// daily streak log dates
export const activityDays = pgTable(
  "activity_days",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    day: varchar("day", { length: 10 }).notNull(),
  },
  (t) => [uniqueIndex("u_day").on(t.userId, t.day)],
);

// AI conversation log
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sceneId: integer("scene_id"),
  role: text("role").notNull(), // ai | user
  message: text("message").notNull(),
  feedback: text("feedback"),
  score: integer("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Diyalog Stüdyosu kayıtları — language_code ile dile göre filtrelenir (spec Adım 4).
// Demo modda (DB yok) istemci localStorage kullanır; DB varken bu tablo kullanılır.
export const savedDialogs = pgTable("saved_dialogs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  languageCode: varchar("language_code", { length: 8 }).notNull(), // hedef dil: pt, es, fr...
  targetLang: varchar("target_lang", { length: 8 }).notNull(),
  nativeLang: varchar("native_lang", { length: 8 }).notNull().default("tr"),
  level: varchar("level", { length: 4 }).notNull().default("A1"), // A1..C2
  topic: text("topic").notNull(),
  lines: jsonb("lines")
    .$type<{ speaker: string; target_text: string; native_text: string }[]>()
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

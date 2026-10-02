// Yedek ders paketi üretici — AI ölürse diye her (dil, seviye, konu) için
// önceden üretilmiş, aynı doğrulamadan geçmiş dersler hazırlar.
// Kullanım: npx tsx scripts/curate-lessons.ts [--lang=en,de] [--topic=travel] [--limit=5]
// Kaldığı yerden devam eder (var olan level:topic atlanır), 429'da bekler.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";
// NOT: dotenv'ten SONRA yüklenmeli (statik import yukarı taşınır, anahtar boş kalır)
let generateLesson: any;
let LANGS: any[];
let TOPICS: any[];
let CEFR: any[];

const OUT = path.resolve(__dirname, "..", "src", "lib", "curated");
const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] || "";
const onlyLangs = (opt("lang") ? opt("lang").split(",") : []).map((s) => s.trim()).filter(Boolean);
const onlyTopic = opt("topic").trim();
const limit = Number(opt("limit") || "0");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load(code: string): any[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, `${code}.json`), "utf8"));
  } catch {
    return [];
  }
}
function save(code: string, arr: any[]) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${code}.json`), JSON.stringify(arr, null, 1));
}

async function genOnce(lang: string, level: string, topicName: string, topicKey: string): Promise<any | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const lesson = await generateLesson(lang, level, topicName, "Turkish", true, [], topicKey);
      if (lesson && lesson.steps && lesson.steps.length >= 2) return lesson;
      return null; // içerik sorunu — aynı kombinasyonu hemen zorlama
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/429|rate|limit|overloaded|503/i.test(msg)) {
        const wait = 20000 * attempt;
        console.log(`  ...kota/limit, ${wait / 1000}sn bekleniyor (deneme ${attempt})`);
        await sleep(wait);
        continue;
      }
      console.log(`  ...hata: ${msg.slice(0, 120)}`);
      return null;
    }
  }
  return null;
}

async function main() {
  const langs = LANGS.filter((l) => !onlyLangs.length || onlyLangs.includes(l.code));
  const levels = CEFR.map((c) => c.level);
  let made = 0;
  let skipped = 0;
  for (const l of langs) {
    const arr = load(l.code);
    const have = new Set(arr.map((e: any) => `${e.level}:${e.topicKey}`));
    for (const lv of levels) {
      for (const t of TOPICS) {
        if (onlyTopic && t.key !== onlyTopic) continue;
        if (have.has(`${lv}:${t.key}`)) {
          skipped++;
          continue;
        }
        if (limit && made >= limit) {
          console.log(`limit (${limit}) doldu.`);
          return;
        }
        const lesson = await genOnce(l.spoken, lv, t.name, t.key);
        if (lesson) {
          arr.push({
            level: lv,
            topicKey: t.key,
            topic: t.name,
            npcName: lesson.npcName,
            npcEmoji: lesson.npcEmoji,
            steps: lesson.steps,
          });
          save(l.code, arr);
          made++;
          console.log(`+ ${l.code} ${lv} ${t.key} (yeni: ${made})`);
        } else {
          console.log(`x ${l.code} ${lv} ${t.key} BOS — sonra tekrar denenecek`);
        }
        await sleep(1500);
      }
    }
  }
  console.log(`BİTTİ. yeni=${made} atlanan-hazır=${skipped}`);
}

async function boot() {
  ({ generateLesson } = await import("../src/lib/ai"));
  ({ LANGS, TOPICS, CEFR } = await import("../src/lib/levels"));
  await main();
}
void boot();

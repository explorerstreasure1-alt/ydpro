// Server-side AI helpers. Uses GROQ when GROQ_API_KEY present, else a local
// rules-based engine so the app still works offline.

import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

// Read the key from env — Vercel/GitHub Secrets'ten gelir, yoksa offline fallback
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const client = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const MODEL = "openai/gpt-oss-20b";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

// AI Orchestrator: tüm yapıdan AI sorumlu — her içerik AI üzerinden üretilir/değerlendirilir
export const AI_ORCHESTRATOR = {
  enabled: !!GROQ_API_KEY,
  model: MODEL,
  fallbackModel: FALLBACK_MODEL,
  keyMasked: GROQ_API_KEY ? `${GROQ_API_KEY.slice(0, 7)}...${GROQ_API_KEY.slice(-4)}` : "none",
};

// Hızlı pratik — bellek cache: aynı sahne/dil/seviye tekrar instant döner
const sceneCache = new Map<string, any>();
const lessonCache = new Map<string, any>();

async function callGroq(params: any): Promise<any> {
  if (!client) throw new Error("no client");
  // Hızlı: düşük token, low reasoning zaten ayarlı — cache anahtarı
  try {
    return await client.chat.completions.create({ max_tokens: 700, ...params });
  } catch (e: any) {
    if (params.model === MODEL) {
      params.model = FALLBACK_MODEL;
      return await client.chat.completions.create({ max_tokens: 700, ...params });
    }
    throw e;
  }
}

export interface TeacherResult {
  score: number;
  correct: boolean;
  almost: boolean;
  verdict: string;
  feedback: string;
  ideal: string;
  pronunciation: number;
}

/**
 * Normalize user input: lowercase, trim punctuation, collapse whitespace.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token overlap similarity 0..1
 */
function similarity(a: string, ideal: string): number {
  const ta = norm(a).split(" ").filter(Boolean);
  const ti = norm(ideal).split(" ").filter(Boolean);
  if (ti.length === 0) return 0;
  let hits = 0;
  for (const t of ta) {
    if (ti.includes(t)) hits++;
  }
  return hits / ti.length;
}

function fallbackEvaluate(input: string, ideal: string): TeacherResult {
  const n = norm(input);
  const ni = norm(ideal);
  const sim = similarity(input, ideal);
  // simple fuzzy: allow up to ~25% (1-2 words) deviation
  const injectedScore = Math.round(sim * 100);
  const correct = sim >= 0.85;
  const almost = !correct && sim >= 0.55;

  if (correct) {
    return {
      score: injectedScore,
      correct: true,
      almost: false,
      verdict: "Mükemmel!",
      feedback: "Great job! Perfect sentence. 🎉",
      ideal,
      pronunciation: Math.min(100, 85 + Math.floor(sim * 15)),
    };
  }
  if (almost) {
    return {
      score: injectedScore,
      correct: false,
      almost: true,
      verdict: "Yaklaştın!",
      feedback: `Almost! Try: “${ideal}” — small fix and it's perfect.`,
      ideal,
      pronunciation: Math.floor(sim * 80),
    };
  }
  return {
    score: Math.max(5, injectedScore * 3),
    correct: false,
    almost: false,
    verdict: "Bir kez daha deneyelim.",
    feedback: `Not quite. The natural way is: “${ideal}”. You can also reply here in Turkish if stuck.`,
    ideal,
    pronunciation: Math.floor(sim * 50),
  };
}

export async function evaluateAnswer(
  input: string,
  ideal: string,
  targetWord?: string,
  nativeLangName: string = "Turkish",
  targetLangName: string = "English",
): Promise<TeacherResult> {
  if (!client) return fallbackEvaluate(input, ideal);

  try {
    const params: any = {
      model: MODEL,
      temperature: 0.2,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: `You are a warm, encouraging ${targetLangName} teacher for a ${nativeLangName} learner inside a language game.
The learner is supposed to say/write approximately: "${ideal}" (${targetLangName}).
Judge the learner's contribution. Return STRICT JSON only:
{"score": 0-100, "correct": bool, "almost": bool, "verdict": "one of ${nativeLangName==="Turkish"?"Mükemmel/Yaklaştın/Bir kez daha deneyelim":nativeLangName==="English"?"Perfect/Almost/Try again": "Perfect/Almost/Try again"}", "feedback": "one short, encouraging sentence in ${nativeLangName} (use quotes for the corrected sentence)", "ideal": "${ideal}", "pronunciation": 0-100}
Be forgiving: a missing tiny word like "a" or slightly different but natural wording counts as correct or almost. Do not be harsh.`,
        },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return { ...fallbackEvaluate(ideal, ideal), ...parsed, ideal };
  } catch (e) {
    console.error("GROQ eval error", e);
    return fallbackEvaluate(input, ideal);
  }
}

// --- Persona-based evaluation: AI o serinin konusuna göre kişiliğe bürünür, ana dile göre feedback ---
export async function evaluateWithPersona(
  input: string,
  ideal: string,
  persona: { name: string; role: string; emoji: string; dayTitle: string },
  nativeLangName: string = "Turkish",
): Promise<TeacherResult & { personaReply: string }> {
  if (!client) {
    const base = fallbackEvaluate(input, ideal);
    const personaReply = base.correct
      ? `${persona.emoji} ${persona.name} (${persona.role}): Harika! "${ideal}" — tam böyle söylenir.`
      : `${persona.emoji} ${persona.name} (${persona.role}): Hayır öyle değil, şöyle diyeceksin: "${ideal}" — bir daha dene!`;
    return { ...base, personaReply };
  }
  try {
    // Dil öğretmeni persona — Türkçe konuşurken yabancı aksanıyla (Örn: Bak oğlum...)
    const targetForPersona = (()=>{ try{ const m=(ideal.match(/[a-zA-ZÀ-ÿÀ-ž]+/g)||[]).join(" "); return m.length>3 ? "target" : "target"; }catch{return "target";}})();
    const params: any = {
      model: MODEL,
      temperature: 0.7,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a LANGUAGE TEACHER. Persona: "${persona.name}" (${persona.role}) in "${persona.dayTitle}". When you speak Turkish to explain rules, you speak Turkish WITH a slight foreign accent (like a native ${nativeLangName} speaker who learned Turkish later, slightly broken — e.g., "Bak oğlum, şimdi bunu bu şekilde söylemen lazım...").

Learner: ${nativeLangName} speaker, target: "${ideal}" (MUST be in target foreign language, never Turkish).
Learner said: "${input}"

STRICT RULES FOR THE FOREIGN ANSWER (the ideal you will correct to):
1. NEVER Turkish — the produced sentence MUST be entirely in the target foreign language (e.g., Portuguese "Eu me chamo João.", not Turkish words with foreign accent).
2. Provide it BOTH as written target sentence AND with original accent/phonetics guide (it will be spoken with target native accent).
3. NEVER construct foreign sentence using Turkish words + foreign accent. Words and grammar must be fully target foreign.

TASK: Judge correct/almost/wrong (forgiving on "a/the").
Then respond as TEACHER in Turkish WITH foreign accent (slightly broken, warm: "Bak oğlum, adını sorsalar şöyle diyeceksin:"), not perfect Turkish.

Rules:
- personaReply entirely in ${nativeLangName} WITH slight foreign accent, warm teacher tone "Bak oğlum..." → praise if correct, correction if wrong + ideal in quotes.
- Always include ideal foreign sentence in quotes, with original target pronunciation.
- verdict in ${nativeLangName} (e.g., Turkish "Mükemmel!/Yaklaştın!/Bir kez daha deneyelim.", English "Perfect!/Almost!/Try again.")
- personaReply: 1-2 sentences, max 20 words, in ${nativeLangName} with foreign accent, includes ideal foreign sentence in quotes.

Return STRICT JSON only:
{"score":0-100,"correct":bool,"almost":bool,"verdict":"...","feedback":"short ${nativeLangName} teacher feedback in ${nativeLangName} with foreign accent, ideal foreign sentence in quotes","ideal":"${ideal}","pronunciation":0-100,"personaReply":"teacher Turkish with foreign accent, e.g., 'Bak oğlum, şöyle diyeceksin: \\"${ideal}\\"' in ${nativeLangName} with slight foreign accent"}`,
        },
        { role: "user", content: `Learner said: "${input}" | Ideal (must be target foreign, not Turkish): "${ideal}" | Persona: ${persona.name} (${persona.role})` },
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const base = fallbackEvaluate(input, ideal);
    return {
      score: typeof parsed.score === "number" ? parsed.score : base.score,
      correct: !!parsed.correct,
      almost: !!parsed.almost,
      verdict: parsed.verdict || base.verdict,
      feedback: parsed.feedback || base.feedback,
      ideal,
      pronunciation: typeof parsed.pronunciation === "number" ? parsed.pronunciation : base.pronunciation,
      personaReply: parsed.personaReply || (parsed.correct ? `Tamam, "${ideal}" — aferin!` : `Hayır öyle değil, şöyle diyeceksin: "${ideal}"`),
    };
  } catch (e) {
    console.error("persona eval error", e);
    const base = fallbackEvaluate(input, ideal);
    return { ...base, personaReply: base.correct ? `Tamam! "${ideal}"` : `Hayır öyle değil, şöyle: "${ideal}"` };
  }
}

export interface ChosenResult {
  correct: boolean;
  verdict: string;
}

/** Human-readable free-talk reply builder — her dilde orijinal aksan */
export async function freeTalkReply(
  topic: string,
  userText: string,
  history: ChatCompletionMessageParam[],
  targetLangName: string = "English",
  nativeLangName: string = "Turkish",
): Promise<string> {
  if (!client) {
    const replies: Record<string, string> = {
      travel: `Oh nice! 🧳 Where would you like to travel to? Tell me more!`,
      food: `Yummy! 🍽️ What's your favorite dish? I love hearing about food.`,
      work: `Interesting work! 💼 What do you enjoy about your job?`,
      shopping: `Great shopping taste! 🛍️ What did you buy today?`,
      social: `That's so nice! ❤️ Tell me about your friends and hobbies.`,
      daily: `A normal day sounds nice. 🏠 What do you usually do on a free day?`,
      fun: `Sounds fun! 🎬 Do you prefer movies, music or games?`,
    };
    return replies[topic] || `Whoa, great idea! Tell me more about that. I'm learning ${targetLangName}.`;
  }

  try {
    const params: any = {
      model: MODEL,
      temperature: 0.8,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: `You are a friendly native ${targetLangName} speaker chatting with a ${nativeLangName} beginner. Topic: ${topic}.
Rules:
- Speak clear, simple, natural ${targetLangName}.
- Ask ONE short follow-up question at the end to keep the conversation going.
- If the learner seems stuck, briefly add a short ${nativeLangName} clue in parentheses.
- Keep the whole reply under 25 words.`,
        },
        ...history,
        { role: "user", content: userText },
      ],
    };
    const completion = await callGroq(params);
    const content = completion.choices[0]?.message?.content?.trim();
    return content || "That sounds great! Can you tell me a little more about it?";
  } catch (e) {
    console.error("GROQ talk error", e);
    return "That's great! Tell me more!";
  }
}

export interface AiStep {
  prompt: string;
  promptTr?: string;
  answer: string;
  turkish: string;
  chips: string[];
}

/**
 * Ask the model to generate a FRESH set of conversational NPC prompts + answers
 * (with Turkish translations) for a scenario. Returns null on any failure so the
 * caller can fall back to static content.
 */
export async function generateDialog(
  theme: string,
  sampleQ: string,
  sampleA: string,
): Promise<AiStep[] | null> {
  if (!client) return null;
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.85,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a language-game content generator for a Turkish learner learning English.
Scenario/theme: ${theme}.
Generate 3 fresh, simple, natural conversational NPC prompts (the thing the NPC says, in English) that fit this real-life scenario, plus the natural short English answer the learner should give, plus a natural Turkish translation of each answer.
Vary from the sample so it feels different each time — do NOT copy the sample.
Return STRICT JSON only:
{"steps":[{"prompt":"...","answer":"...","turkish":"...","chips":["word1","word2"]}]}
Rules: exactly 3 steps; answers under 10 words; chips = 1-3 key vocabulary words (English) for the scenario.`,
        },
        { role: "user", content: `Sample prompt: "${sampleQ}". Sample answer: "${sampleA}".` },
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      return parsed.steps.map((s: any) => ({
        prompt: String(s.prompt || sampleQ),
        answer: String(s.answer || sampleA),
        turkish: String(s.turkish || ""),
        chips: Array.isArray(s.chips) ? s.chips.map((c: any) => String(c)) : [],
      }));
    }
    return null;
  } catch {
    return null;
  }
}

// --- AI Orchestrator: HER DİLDE HER DİL — persona-aware scene generation (hızlı pratik) ---
export async function generatePersonaScene(
  day: number,
  content: { title: string; location: string; description: string; npcName: string; npcRole: string; npcEmoji: string; secondaryNpc?: {name:string; role:string; emoji:string}; dialog: any[] },
  level: string = "A1",
  targetLangName: string = "English",
  nativeLangName: string = "Turkish"
): Promise<{ npcName: string; npcRole: string; npcEmoji: string; steps: (AiStep & {speakerName?:string; speakerRole?:string; speakerEmoji?:string})[]; secondaryNpc?: any } | null> {
  const cacheKey = `scene:v6:${day}:${level}:${targetLangName}:${nativeLangName}:${content.title}`;
  if (sceneCache.has(cacheKey)) return sceneCache.get(cacheKey);
  if (!client) return null;
  try {
    const samplePrompts = content.dialog.map((d: any) => d.prompt).join(" | ");
    const hasSecondary = !!content.secondaryNpc;
    const secondaryInfo = hasSecondary ? `Secondary NPC: ${content.secondaryNpc!.name} (${content.secondaryNpc!.role}) ${content.secondaryNpc!.emoji}. For multi-character scenes (like sevgili + garson), alternate speakers per step.` : "Single NPC scene.";
    const params: any = {
      model: MODEL,
      temperature: 0.9,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a LANGUAGE TEACHER generating for Day ${day}: "${content.title}" at ${content.location}.
Primary NPC: ${content.npcName} (${content.npcRole}) ${content.npcEmoji}
${secondaryInfo}
Description: ${content.description}
ORIGINAL SAMPLE DIALOGS (for reference): ${samplePrompts}
TARGET: ${targetLangName} (foreign), NATIVE: ${nativeLangName} (Turkish). You are a teacher whose native is ${targetLangName} but you speak ${nativeLangName} with a slight foreign accent (e.g., "Bak oğlum, şimdi bunu bu şekilde söylemen lazım..." with ${targetLangName} accent).

CEFR ${level}: ${level==="A1"?"very short 2-4 words":level==="A2"?"simple 5-8 words":level==="B1"?"connected 8-14 words":level==="B2"?"fluent 12-20 words":"rich 15-25 words with idioms"} in ${targetLangName}.

STRICT RULES (asla unutma):
1. Produced sentence NEVER Turkish — MUST be entirely in ${targetLangName} (e.g., Portuguese "Eu me chamo João.", not Turkish words with foreign accent).
2. Foreign sentence BOTH written in ${targetLangName} AND with original accent/phonetics guide (it will be spoken with ${targetLangName} native accent).
3. NEVER construct foreign sentence using Turkish words + foreign accent. Words and grammar fully ${targetLangName}.

Example flow (if native Turkish & target English):
- Teacher (slight foreign-accented Turkish): "Bak oğlum, adını sorsalar şöyle diyeceksin:"
- Foreign answer (written + original accent): "Eu me chamo João." (if target Portuguese) — actually for English: "I'm afraid the meeting has been postponed..." with English accent.

Generate SÖYLE mechanism: "prompt" in ${nativeLangName} WITH ${targetLangName} accent (e.g., "Toplantının saat 14:00'e ertelendiğini ... İngilizce olarak söyle."), "promptTr" same as prompt, "answer" in ${targetLangName} original, "turkish" = ${nativeLangName} translation of answer.

Rules:
- KEEP personality but as TEACHER: "Bak oğlum..." warm, slightly broken ${nativeLangName} with ${targetLangName} accent.
- ${hasSecondary ? "For multi-character scene, ALTERNATE speakers: some steps from primary, some from secondary. Include speakerName/speakerRole/speakerEmoji per step." : "Single speaker, all steps from primary NPC."}
- Hızlı pratik, insan gibi.

Return STRICT JSON with EXAMPLE (native Turkish, target English):
{"npcName":"Öğretmen","npcRole":"Öğretmen","npcEmoji":"👩‍🏫","steps":[{"prompt":"Bak oğlum, toplantının saat 14:00'e ertelendiğini, bu yüzden ofiste olamayacağımı yabancı bir aksanla ve İngilizce olarak söyle.","promptTr":"Bak oğlum, toplantının saat 14:00'e ertelendiğini, bu yüzden ofiste olamayacağımı yabancı bir aksanla ve İngilizce olarak söyle.","answer":"I'm afraid the meeting has been postponed to 2:00 PM, so I won't be able to make it to the office in time.","turkish":"Toplantı 14:00'e ertelendi, bu yüzden ofiste olamayacağım.","chips":["meeting","postponed"]}] }
Now generate for ${targetLangName} (prompt/promptTr in ${nativeLangName} with ${targetLangName} accent, answer in ${targetLangName} original with ${targetLangName} accent, turkish in ${nativeLangName}):
{"npcName":"${content.npcName}","npcRole":"${content.npcRole}","npcEmoji":"${content.npcEmoji}","steps":[{"prompt":"...","promptTr":"...","answer":"...","turkish":"...","chips":["..."],"speakerName":"...","speakerRole":"...","speakerEmoji":"..."}]}`
        },
        { role: "user", content: `Generate fresh Day ${day} dialog, keep ${hasSecondary ? "both characters alternating" : content.npcRole + " personality"}.` }
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const out = {
        npcName: String(parsed.npcName || content.npcName),
        npcRole: String(parsed.npcRole || content.npcRole),
        npcEmoji: String(parsed.npcEmoji || content.npcEmoji),
        secondaryNpc: content.secondaryNpc,
        steps: parsed.steps.map((s: any) => ({
          prompt: String(s.prompt || ""),
          promptTr: String(s.promptTr || (s as any).prompt_tr || ""),
          answer: String(s.answer || ""),
          turkish: String(s.turkish || (s as any).tr || ""),
          chips: Array.isArray(s.chips) ? s.chips.map(String) : [],
          speakerName: String(s.speakerName || s.speaker || parsed.npcName || content.npcName),
          speakerRole: String(s.speakerRole || parsed.npcRole || content.npcRole),
          speakerEmoji: String(s.speakerEmoji || parsed.npcEmoji || content.npcEmoji),
        })),
      };
      sceneCache.set(cacheKey, out);
      return out;
    }
    return null;
  } catch { return null; }
}

// --- AI Orchestrator: generate FULL scene dynamically (tüm yapıdan AI sorumlu) ---
export async function generateFullScene(day: number, theme: string, level: string = "A1"): Promise<AiStep[] | null> {
  if (!client) return null;
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.85,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the SOLE content generator for a gamified language app. Day ${day}, theme: ${theme}, level ${level}.
Generate 3 fresh immersive dialog steps for this day. Each step: NPC prompt (English, natural, 5-12 words), ideal learner answer (English, ${level} level), Turkish translation, chips (1-3 vocab).
Return STRICT JSON: {"steps":[{"prompt":"...","answer":"...","turkish":"...","chips":["..."]}]}`
        },
        { role: "user", content: `Generate day ${day} for ${theme} at ${level}` }
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      return parsed.steps.map((s: any) => ({
        prompt: String(s.prompt || ""),
        answer: String(s.answer || ""),
        turkish: String(s.turkish || ""),
        chips: Array.isArray(s.chips) ? s.chips.map(String) : [],
      }));
    }
    return null;
  } catch { return null; }
}

export async function aiHealth(): Promise<{ok:boolean; model:string; maskedKey:string}> {
  if (!client) return {ok:false, model:MODEL, maskedKey:"none"};
  try {
    const c = await callGroq({model:MODEL, messages:[{role:"user",content:"ping"}], max_tokens:5});
    return {ok:!!c.choices?.[0], model:MODEL, maskedKey: AI_ORCHESTRATOR.keyMasked};
  } catch { return {ok:false, model:MODEL, maskedKey: AI_ORCHESTRATOR.keyMasked}; }
}

export interface LessonStep {
  prompt: string;   // NPC says this (in target language)
  promptTr?: string; // prompt's translation in native
  answer: string;   // learner target answer (in target language)
  tr: string;       // answer's translation in native
  chips: string[];  // key vocab (target language)
}

/**
 * Generate a short conversational lesson in any language + CEFR level + topic.
 * Returns null on failure so the caller can show a fallback.
 */
export async function generateLesson(
  langName: string,
  level: string,
  topicName: string,
  nativeLangName: string = "Turkish",
): Promise<{ steps: LessonStep[]; npcName: string; npcEmoji: string } | null> {
  const cacheKey = `lesson:v4:${langName}:${level}:${topicName}:${nativeLangName}`;
  if (lessonCache.has(cacheKey)) return lessonCache.get(cacheKey);
  if (!client) return null;
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.85,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a language-course generator. Create a short lesson for a ${nativeLangName} speaker learning ${langName}.
CEFR level: ${level}. Topic: ${topicName}.
Native language for translations: ${nativeLangName}.
Difficulty guide: A1 = 2-4 word simple phrases; A2 = simple everyday sentences; B1 = 2 sentences, more detail; B2 = fluent with opinion; C1 = rich, natural, nuanced.
You are a LANGUAGE TEACHER (native ${langName}, speaking ${nativeLangName} with slight ${langName} accent: "Bak oğlum, şimdi bunu bu şekilde söylemen lazım...").
Generate exactly 3 turns of the "söyle" mechanism for ${nativeLangName} speaker learning ${langName} (CEFR ${level}, topic ${topicName}).

STRICT RULES (asla unutma):
1. Produced sentence NEVER ${nativeLangName} — MUST be entirely in ${langName} (e.g., Portuguese "Eu me chamo João.", not Turkish words).
2. Foreign sentence BOTH written in ${langName} AND with original ${langName} accent/phonetics (it will be spoken with ${langName} native accent).
3. NEVER construct foreign sentence using ${nativeLangName} words + foreign accent.

Mechanism Example (native Turkish, target Portuguese):
- Teacher (slight foreign-accented Turkish): "Bak oğlum, adını sorsalar şöyle diyeceksin:"
- Foreign answer (written + original accent): "Eu me chamo João." + pronunciation guide

Generate:
- "prompt": in ${nativeLangName} WITH ${langName} accent (slightly broken, e.g., "Bak oğlum, adını sorsalar şöyle diyeceksin:" or "Toplantının saat 14:00'e ertelendiğini ... ${langName} olarak söyle."), instructing what to say in ${langName}
- "promptTr": same as prompt (already ${nativeLangName})
- "answer": in ${langName} original, ${level} level. Example if target Portuguese: "Eu me chamo João." (never Turkish words)
- "tr": natural ${nativeLangName} translation of answer
- "chips": 1-3 key vocab from answer in ${langName}
Return STRICT JSON only:
{"npcName":"...","npcEmoji":"...","steps":[{"prompt":"...","promptTr":"...","answer":"...","tr":"...","chips":["..."]}]}
Keep answers appropriate to the ${level} level. Do not add explanations.`,
        },
        { role: "user", content: `Generate the ${topicName} lesson at ${level} in ${langName}.` },
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const out = {
        npcName: String(parsed.npcName || "Rehber"),
        npcEmoji: String(parsed.npcEmoji || "🗣️"),
        steps: parsed.steps.map((s: any) => ({
          prompt: String(s.prompt || ""),
          promptTr: String(s.promptTr || (s as any).prompt_tr || ""),
          answer: String(s.answer || ""),
          tr: String(s.tr || (s as any).translation || ""),
          chips: Array.isArray(s.chips) ? s.chips.map((c: any) => String(c)) : [],
        })),
      };
      lessonCache.set(cacheKey, out);
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

// Hafıza kartı kelimeleri — hedef dilde AI otomatik üretir, her dil için
export async function generateVocabulary(sceneTitle: string, targetLangName: string, nativeLangName: string, level: string = "A1"): Promise<{ word: string; pronunciation: string; translation: string; emoji: string; visual: string; story: string; example: string }[] | null> {
  if (!client) return null;
  const cacheKey = `vocab:${sceneTitle}:${targetLangName}:${nativeLangName}:${level}`;
  // @ts-ignore
  if ((globalThis as any).__vocabCache?.has(cacheKey)) return (globalThis as any).__vocabCache.get(cacheKey);
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.7,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate 5 vocabulary cards for "${sceneTitle}" in ${targetLangName} for ${nativeLangName} speaker, CEFR ${level}.
For each word provide:
- "word": in ${targetLangName} (original)
- "pronunciation": IPA for ${targetLangName}
- "translation": in ${nativeLangName}
- "emoji": single emoji
- "visual": 3 emojis mnemonic
- "story": short memory story in ${nativeLangName} (1 sentence)
- "example": simple example sentence in ${targetLangName} (5-8 words, ${level} level)
Return STRICT JSON: {"vocab":[{"word":"...","pronunciation":"...","translation":"...","emoji":"...","visual":"...","story":"...","example":"..."}]}`
        },
        { role: "user", content: `Vocabulary for ${sceneTitle} in ${targetLangName} for ${nativeLangName} ${level}` }
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.vocab) && parsed.vocab.length > 0) {
      const out = parsed.vocab.map((v:any)=> ({
        word: String(v.word||""),
        pronunciation: String(v.pronunciation||""),
        translation: String(v.translation||""),
        emoji: String(v.emoji||"📚"),
        visual: String(v.visual||""),
        story: String(v.story||""),
        example: String(v.example||""),
      })).slice(0,5);
      // @ts-ignore
      if (!(globalThis as any).__vocabCache) (globalThis as any).__vocabCache = new Map();
      // @ts-ignore
      (globalThis as any).__vocabCache.set(cacheKey, out);
      return out;
    }
    return null;
  } catch { return null; }
}

/** Generic translate to any native language */
export async function translateTo(text: string, targetLangName: string): Promise<string | null> {
  if (!text || !client) return null;
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.1,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Translate the user sentence into natural, simple ${targetLangName}. Do not explain. Return STRICT JSON only: {"tr":"..."}`,
        },
        { role: "user", content: text },
      ],
    };
    const completion = await callGroq(params);
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return parsed.tr ? String(parsed.tr) : null;
  } catch { return null; }
}
/** Backward compat — Turkish */
export async function translateToTurkish(text: string): Promise<string | null> {
  return translateTo(text, "Turkish");
}

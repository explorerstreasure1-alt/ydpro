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
    const params: any = {
      model: MODEL,
      temperature: 0.7,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are role-playing as "${persona.name}", a "${persona.role}" in the scene "${persona.dayTitle}". Emoji: ${persona.emoji}.
The learner is a ${nativeLangName} speaker supposed to say approximately: "${ideal}" (target language).
The learner actually said: "${input}" (might be native, broken target, or silence).
Learner's native language: ${nativeLangName} — feedback and personaReply must be in ${nativeLangName} (not Turkish unless native is Turkish).

TASK: Judge if learner's attempt is correct/almost/wrong (be forgiving on tiny words like "a/the").
Then respond IN CHARACTER as ${persona.name} with personality of a ${persona.role} — NOT as a teacher.

Rules:
- Respond entirely in ${nativeLangName}.
- If POLICE: strict, official tone. Correct → praise in ${nativeLangName}. Wrong → correction in ${nativeLangName} + ideal in quotes + "try again".
- If SISTER/FRIEND/MOTHER/FAMILY: warm, affectionate in ${nativeLangName}.
- If SHOP/WAITER/HOTEL staff: polite service tone in ${nativeLangName}.
- Always include the correct sentence in quotes.
- verdict in ${nativeLangName} (Turkish: "Mükemmel!/Yaklaştın!/Bir kez daha deneyelim.", English: "Perfect!/Almost!/Try again.", German: "Perfekt!/Fast!/Nochmal!", etc.)
- Also produce personaReply: what ${persona.name} would SAY NEXT in character, in ${nativeLangName} + target mix, max 20 words, includes correction if wrong.

Return STRICT JSON only:
{"score":0-100,"correct":bool,"almost":bool,"verdict":"...","feedback":"short ${nativeLangName} teacher feedback with correct sentence in quotes","ideal":"${ideal}","pronunciation":0-100,"personaReply":"what ${persona.name} says as ${persona.role} in character in ${nativeLangName}, 1-2 sentences"}`,
        },
        { role: "user", content: `Learner said: "${input}" | Ideal: "${ideal}" | Persona: ${persona.name} (${persona.role})` },
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
  const cacheKey = `scene:v4:${day}:${level}:${targetLangName}:${nativeLangName}:${content.title}`;
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
          content: `You are the universal content generator for Day ${day}: "${content.title}" at ${content.location}.
Primary NPC: ${content.npcName} (${content.npcRole}) ${content.npcEmoji}
${secondaryInfo}
Description: ${content.description}
ORIGINAL SAMPLE DIALOGS (English, for reference): ${samplePrompts}
TARGET LANGUAGE: ${targetLangName} — ALL prompts and answers MUST be in ${targetLangName}, not English unless target is English.
NATIVE LANGUAGE: ${nativeLangName} — "turkish" field is actually the ${nativeLangName} translation of the answer.
CEFR ${level} KAPSAMLI.

CEFR Guide: A1=2-4 words ultra-simple; A2=5-8 simple; B1=8-14 with connectors; B2=12-20 fluent opinion; C1=15-25 rich idioms.
Rules:
- KEEP personality: if police → strict, anne → warm motherly, patron → professional boss, sevgili → affectionate, garson → polite — but speak ${targetLangName}.
- CEFR ${level} complexity MUST match: ${level==="A1"?"very short 2-4 words":level==="A2"?"simple 5-8 words":level==="B1"?"connected 8-14 words":level==="B2"?"fluent 12-20 words":"rich 15-25 words with idioms"} in ${targetLangName}.
- ${hasSecondary ? "For this multi-character scene, ALTERNATE speakers: some steps from primary, some from secondary. Include speakerName/speakerRole/speakerEmoji per step." : "Single speaker, all steps from primary NPC."}
- Each step: NPC prompt in ${targetLangName} (${level} level, in-character), NPC prompt's ${nativeLangName} translation ("promptTr"), ideal learner answer in ${targetLangName} (${level} level), answer's ${nativeLangName} translation ("turkish"), chips (1-3 vocab in ${targetLangName}, ${level} appropriate).
- Hızlı pratik, insan gibi: kısa, doğal, günlük hayatta anında kullanılabilir.

Return STRICT JSON with EXAMPLE (if target is Portuguese, native Turkish):
{"npcName":"Anne Ayşe","npcRole":"Anne","npcEmoji":"👩‍🍳","steps":[{"prompt":"Pode me passar o garfo?","promptTr":"Çatalı uzatır mısın?","answer":"Claro, aqui está.","turkish":"Tabii, işte.","chips":["garfo"],"speakerName":"Anne Ayşe","speakerRole":"Anne","speakerEmoji":"👩‍🍳"}]}
Now generate for ${targetLangName} (prompt/answer in ${targetLangName}, promptTr/turkish in ${nativeLangName}):
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
  const cacheKey = `lesson:v2:${langName}:${level}:${topicName}:${nativeLangName}`;
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
Generate exactly 3 conversational turns. For each turn provide:
- "prompt": what the NPC says, in ${langName} (a question or greeting).
- "promptTr": natural ${nativeLangName} translation of prompt
- "answer": the natural short answer the learner should give, in ${langName}, matched to the ${level} level.
- "tr": the natural ${nativeLangName} translation of that answer (translate into ${nativeLangName}, not Turkish unless native is Turkish).
- "chips": 1-3 key vocabulary words from the answer (in ${langName}).
Also provide a fitting native NPC name and a single emoji for the role.
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

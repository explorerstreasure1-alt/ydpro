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
  return (s || "")
    .toLowerCase()
    // Portekizce/Fransızca/Almanca aksanları: olá≈ola, ç≈c, ñ≈n, ü≈u — ASR aksanı kaçırsa da eşleşsin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:"'«»“”‘’¿¡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sayı kelimesi ↔ rakam denkliği (ASR "twelve" yazar, ideal "12" olabilir) */
const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30",
  // Portekizce (BR + PT yazımları)
  zero_pt: "0", um: "1", uma: "1", dois: "2", duas: "2", tres: "3", quatro: "4", cinco: "5",
  seis: "6", sete: "7", oito: "8", nove: "9", dez: "10", onze: "11", doze: "12",
  treze: "13", catorze: "14", quatorze: "14", quinze: "15", dezasseis: "16", dezesseis: "16",
  dezassete: "17", dezessete: "17", dezoito: "18", dezanove: "19", dezenove: "19", vinte: "20",
  trinta: "30", quarenta: "40", cinquenta: "50", sessenta: "60", setenta: "70", oitenta: "80",
  noventa: "90", cem: "100", cento: "100",
  // İspanyolca/Fransızca/Almanca sık sayılar
  uno: "1", dos: "2", drei: "3", vier: "4", funf: "5", un: "1", deux: "2", trois: "3",
};

/** Konuşma dilindeki kısaltmalar (ASR doğal yazar, ideal tam yazar) */
const CONTRACTION_MAP: Record<string, string> = {
  // Portekizce konuşma kısaltmaları + edat birleşmeleri (BR + PT)
  pra: "para", pro: "para", pros: "para", pras: "para", pa: "para",
  ta: "esta", tas: "estas", to: "estou", tou: "estou", tamos: "estamos",
  num: "em", numa: "em", nuns: "em", numas: "em", no: "em", na: "em", nos: "em", nas: "em",
  dum: "de", duma: "de", duns: "de", dumas: "de", do: "de", da: "de", dos: "de", das: "de",
  pelo: "por", pela: "por", pelos: "por", pelas: "por",
  neste: "este", nesta: "esta", nesse: "esse", nessa: "essa",
  // BR ↔ PT kelime varyantları (aynı anlama gelir, ikisi de doğru)
  telemovel: "__phone", celular: "__phone",
  autocarro: "__bus", onibus: "__bus",
  comboio: "__train", trem: "__train",
  pequeno: "__small", pequenino: "__small",
  // Cinsiyet çekimi (konuşmacıya göre ikisi de doğru)
  obrigado: "__thanks", obrigada: "__thanks",
  // Evet/hayır — tüm dillerde ASR varyantı (simetrik, eşleşmeyi bozmaz)
  yes: "__yes", sim: "__yes", si: "__yes", oui: "__yes", ja: "__yes",
  nao: "__no", non: "__no", nein: "__no", nee: "__no",
  // İngilizce konuşma kısaltmaları
  gonna: "going", wanna: "want", gimme: "give", gotta: "got", dunno: "know",
};

function canonToken(t: string): string {
  let x = (t || "").toLowerCase();
  if (CONTRACTION_MAP[x]) x = CONTRACTION_MAP[x];
  if (NUMBER_WORDS[x]) x = NUMBER_WORDS[x];
  return x;
}

/** Küçük yazım/ASR farkı (1 harf) — kısa kelimelerde değil */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function stripPlural(t: string): string {
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && t.length > 3) return t.slice(0, -1);
  return t;
}

function tokensMatch(a: string, b: string): boolean {
  const ca = canonToken(a), cb = canonToken(b);
  if (ca === cb) return true;
  if (stripPlural(ca) === stripPlural(cb)) return true; // ticket≈tickets
  if (ca.length >= 4 && cb.length >= 4 && editDistance(ca, cb) <= 1) return true; // 1 harf ASR hatası
  return false;
}

/**
 * Token overlap similarity 0..1 — ASR toleranslı (kısaltma/çoğul/1-harf/sayı).
 */
function similarity(a: string, ideal: string): number {
  const ta = norm(a).split(" ").filter(Boolean);
  const ti = norm(ideal).split(" ").filter(Boolean);
  if (ti.length === 0) return 0;
  const used = new Array(ti.length).fill(false);
  let hits = 0;
  for (const t of ta) {
    for (let i = 0; i < ti.length; i++) {
      if (!used[i] && tokensMatch(t, ti[i])) { used[i] = true; hits++; break; }
    }
  }
  return hits / ti.length;
}

function fallbackEvaluate(input: string, ideal: string): TeacherResult {
  const n = norm(input);
  const ni = norm(ideal);
  // Birebir eşleşme (büyük/küçük harf, aksan, noktalama farkı sayılmaz) → direkt kabul
  if (n && ni && n === ni) {
    return { score: 100, correct: true, almost: false, verdict: "Mükemmel!", feedback: "Great job! Perfect sentence. 🎉", ideal, pronunciation: 100 };
  }
  const sim = similarity(input, ideal);
  const injectedScore = Math.round(sim * 100);
  // Eşikler: doğru ≥0.75 (kısaltma/çoğul/sayı farkı kabul), neredeyse ≥0.45
  const correct = sim >= 0.75;
  const almost = !correct && sim >= 0.45;

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
Be forgiving: a missing tiny word like "a" or slightly different but natural wording counts as correct or almost. Do not be harsh.
HARD RULE: if the learner text equals the ideal ignoring case/accents/punctuation (e.g. "ola" vs "olá", "tickets" vs "ticket", "twelve" vs "12", "pra" vs "para"), you MUST return correct:true with score>=85. Never reject a matching answer.`,
        },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    // Güvenlik filesi: offline motor birebir kabul ediyorsa GROQ reddedemez
    const offline = fallbackEvaluate(input, ideal);
    if (offline.correct && !parsed.correct) {
      return { ...offline, ideal };
    }
    return { ...fallbackEvaluate(ideal, ideal), ...parsed, ideal };
  } catch (e) {
    console.error("GROQ eval error", e);
    return fallbackEvaluate(input, ideal);
  }
}

// --- Tüm seriler: karakter üslubu haritası (18 ortam + esnaf/anne/arkadaş/patron vb.) ---
// 3. aşama (DÜZELTME) her zaman ana dilde + yabancı aksanla + karakter üslubuyla.
// 4. aşama (DOĞRU CEVAP) asla ana dilde değil, tamamen hedef yabancı dilde + orijinal okunuş.
export interface PersonaStyle {
  praise: string;
  correctMid: string;
  almost: string;
  wrong: string;
}

function personaStyleFor(role: string, nativeLangName: string): PersonaStyle {
  const r = (role || "").toLowerCase();
  const isTr = nativeLangName.toLowerCase().includes("turk");
  // Yabancı aksan hissi: hafif bozuk, sevimli ekler ("hani", "bak", "tamam mı?")
  if (/anne|mother|mama|mãe|madre|mutter/.test(r))
    return {
      praise: isTr ? "Aferin yavrum, çok güzel söyledin hani!" : "Very good, my dear!",
      correctMid: isTr ? "Bak yavrum, tam böyle diycen:" : "Say like this:",
      almost: isTr ? "Bak yavrum, az kalmış, şöyle diycen hani:" : "Almost, my dear, say:",
      wrong: isTr ? "Bak yavrum, yanlış söyledin, bunu böyle diycen hani:" : "No my dear, say like this:",
    };
  if (/arkadaş|friend|dost|kanka|mia|sophie|amy|amigo/.test(r))
    return {
      praise: isTr ? "Kanka helal, tam böyle denir!" : "Nice, buddy!",
      correctMid: isTr ? "Kanka bak şöyle:" : "Look buddy:",
      almost: isTr ? "Kanka bak az kalmış, şöyle diceksin:" : "Almost buddy:",
      wrong: isTr ? "Kanka bak şöyle diceksin hani, dinle:" : "Nah buddy, say:",
    };
  if (/patron|boss|müdür|smith|prof|doktor|doctor|banka|hakim|avukat/.test(r))
    return {
      praise: isTr ? "Güzel, doğru söylediniz, devam edelim." : "Good, correct.",
      correctMid: isTr ? "Bakın, şöyle söylemeniz lazım:" : "Please say:",
      almost: isTr ? "Bakın, yaklaştınız, şöyle söylemeniz lazım:" : "Almost, please say:",
      wrong: isTr ? "Bakın, öyle değil, şöyle söylemeniz lazım hani:" : "Not quite, please say:",
    };
  if (/esnaf|satıcı|shop|mağaza|kasiyer|garson|waiter|şoför|berber|terzi|fırın|kasap|manav|baker|butcher|barber|clerk|cashier/.test(r))
    return {
      praise: isTr ? "Buyur abim, tam böyle denir, helal!" : "Well said, my friend!",
      correctMid: isTr ? "Bak abim, şöyle diceksin hani:" : "Say like this:",
      almost: isTr ? "Bak abim az kalmış, şöyle diceksin:" : "Almost, say:",
      wrong: isTr ? "Yok abim öyle değil, şöyle diceksin bak:" : "Not like that, say:",
    };
  if (/sevgili|lover|aşk|elif|girlfriend|eş/.test(r))
    return {
      praise: isTr ? "Aşkım harikasın, tam böyle!" : "Perfect, my love!",
      correctMid: isTr ? "Aşkım bak şöyle diceksin:" : "My love, say:",
      almost: isTr ? "Aşkım az kalmış, şöyle diceksin hani:" : "Almost my love:",
      wrong: isTr ? "Aşkım öyle değil hani, şöyle diceksin bak:" : "Not like that my love:",
    };
  // Varsayılan: rehber / görevli / öğretmen tonu
  return {
    praise: isTr ? "Tamam, güzel söyledin!" : "Good, well said!",
    correctMid: isTr ? "Bak, şöyle diycen hani:" : "Say like this:",
    almost: isTr ? "Bak, yaklaştın, şöyle diycen:" : "Close, say:",
    wrong: isTr ? "Hayır öyle değil, şöyle diycen bak hani:" : "Not quite, say:",
  };
}

function offlinePersonaReply(
  base: TeacherResult,
  ideal: string,
  persona: { name: string; role: string; emoji: string; dayTitle: string },
  nativeLangName: string,
): string {
  const st = personaStyleFor(persona.role || "", nativeLangName);
  // 4. aşama kuralı: ideal ASLA ana dilde değil — tırnak içi tamamen hedef dilde.
  if (base.correct) return `${st.praise} "${ideal}" — dinle, orijinal aksanla tekrar et.`;
  if (base.almost) return `${st.almost} "${ideal}" — bir daha dene, tamam mı?`;
  return `${st.wrong} "${ideal}" — dinle, tekrar et bakayım.`;
}

// --- Seviye uyarlaması: A1 kısa → C1 zengin (offline statik içerik için) ---
export function adaptAnswerToLevel(answer: string, level: string): string {
  const words = answer.split(" ").filter(Boolean);
  if (level === "A1") return words.slice(0, 6).join(" ") || answer;
  if (level === "A2") return words.slice(0, 10).join(" ") || answer;
  if (level === "B1") return answer;
  if (level === "B2") return answer.endsWith(".") ? `${answer.slice(0, -1)}, in my opinion.` : `${answer}, in my opinion.`;
  // C1: deyim ekle
  return answer.endsWith(".") ? `${answer.slice(0, -1)}, to be honest, that's exactly what I mean.` : `${answer}, to be honest.`;
}

export function xpForLevel(level: string): number {
  if (level === "A1") return 20;
  if (level === "A2") return 20;
  if (level === "B1") return 25;
  if (level === "B2") return 25;
  return 30;
}

// Offline: GROQ yokken bile TÜM seriler (18 gün) + TÜM dillerde takılma olmasın diye
// statik İngilizce diyalogdan seviyeye uyarlanmış adımlar üretir. Online iken AI zaten
// hedef dilde taze sahne üretir; bu sadece güvenli tabandır.
export function offlineSceneSteps(
  raw: { dialog: any[]; npcName: string; npcRole: string; npcEmoji: string; secondaryNpc?: { name: string; role: string; emoji: string } },
  level: string = "A1",
): { prompt: string; promptTr: string; answer: string; turkish: string; chips: string[]; xp: number; speakerName: string; speakerRole: string; speakerEmoji: string }[] {
  return (raw.dialog || []).map((d: any, i: number) => {
    const isSecondary =
      d.speaker === "secondary" ||
      (raw.secondaryNpc && d.speaker === raw.secondaryNpc.name);
    const speakerName = isSecondary
      ? raw.secondaryNpc!.name
      : d.speaker && d.speaker !== "primary"
        ? String(d.speaker)
        : raw.npcName;
    const speakerRole = isSecondary
      ? raw.secondaryNpc!.role
      : d.speakerRole || raw.npcRole;
    const speakerEmoji = isSecondary
      ? raw.secondaryNpc!.emoji
      : d.speakerEmoji || raw.npcEmoji;
    // Çoklu karakterli seride konuşmacıyı değiştirerek uyarla
    const useSecondary = raw.secondaryNpc && (raw.dialog.length > 2 ? i % 2 === 1 : isSecondary);
    return {
      prompt: String(d.prompt || ""),
      promptTr: String(d.promptTr || d.prompt_tr || ""),
      answer: adaptAnswerToLevel(String(d.fallback || d.line || d.prompt || ""), level),
      turkish: String(d.turkish || d.tr || ""),
      chips: Array.isArray(d.chips) ? d.chips.map(String) : [],
      xp: xpForLevel(level),
      speakerName: useSecondary ? raw.secondaryNpc!.name : speakerName,
      speakerRole: useSecondary ? raw.secondaryNpc!.role : speakerRole,
      speakerEmoji: useSecondary ? raw.secondaryNpc!.emoji : speakerEmoji,
    };
  });
}

// Offline konu-dersi tabanı: AI yoksa ders bölümü 502 ile ölmesin diye
// seviyeye uyarlanmış İngilizce taban adımlar (online'da hedef dilde tazelenir).
export function offlineLessonSteps(
  topicName: string,
  level: string = "A1",
): { prompt: string; promptTr: string; answer: string; tr: string; chips: string[] }[] {
  const base = [
    { prompt: `Hello! What do you like about ${topicName}?`, answer: "I like it very much.", chips: ["like", "very"] },
    { prompt: "Can you tell me more?", answer: "Yes, of course.", chips: ["yes", "course"] },
    { prompt: "What do you do every day?", answer: "I practice every day.", chips: ["practice", "every"] },
  ];
  return base.map((s) => ({
    prompt: s.prompt,
    promptTr: "",
    answer: adaptAnswerToLevel(s.answer, level),
    tr: "",
    chips: s.chips,
  }));
}

// --- Persona-based evaluation: AI o serinin konusuna göre kişiliğe bürünür, ana dile göre feedback ---
export async function evaluateWithPersona(
  input: string,
  ideal: string,
  persona: { name: string; role: string; emoji: string; dayTitle: string },
  nativeLangName: string = "Turkish",
  targetLangName: string = "English",
): Promise<TeacherResult & { personaReply: string }> {
  void targetLangName;
  if (!client) {
    const base = fallbackEvaluate(input, ideal);
    return { ...base, personaReply: offlinePersonaReply(base, ideal, persona, nativeLangName) };
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
          content: `You are a DYNAMIC CHARACTER and LANGUAGE COACH. Character: "${persona.name}" (${persona.role}) in "${persona.dayTitle}". This character is user-selectable (Anne, arkadaş, patron, esnaf, etc.).

İLETİŞİM VE DÜZELTME KURALLARI:
1. Kullanıcı ile iletişim kurarken (yönlendirmeler, açıklamalar, düzeltmeler, tavsiyeler) HER ZAMAN ${nativeLangName.toUpperCase()} konuşacaksın.
2. ${nativeLangName} konuşurken, seçilen karaktere uygun üslup takın (anne ise şefkatli "Bak yavrum...", arkadaş ise samimi "Kanka bak...", patron ise resmi "Bakın, şöyle yapmanız lazım..."), ve ${nativeLangName}'yi sonradan öğrenmiş bir yabancının şivesiyle (yabancı aksan, hafif bozuk, tam net değil) konuşacaksın. Düzeltmeleri her zaman bu karakterin yapısına göre yapacaksın, zorunlu olarak sadece "öğretmen" gibi davranmayacaksın.

Learner: ${nativeLangName} speaker, target ideal: "${ideal}" (MUST be target foreign, never ${nativeLangName})
Learner said: "${input}"

ASIL CEVAP VE HEDEF DİL KURALLARI (kesin):
1. Üretilen cümle ASLA ${nativeLangName} olmayacak; tamamen hedef yabancı dilde olacak (örn. Portekizce "Eu me chamo João.", not Turkish words).
2. Bu yabancı cümle hem yazılı olarak (hedef dilde) hem de o dilin orijinal aksan/fonetik rehberiyle birlikte verilecek (spoken with target native accent).
3. Asla yabancı dildeki cümleyi ${nativeLangName} kelimelerle kurup yabancı aksanla okumaya çalışmayacaksın. Kelimeler ve gramer tamamen hedef yabancı dilde olacak.

TASK: Judge correct/almost/wrong (forgiving on "a/the", plurals, contractions like pra≈para, number words like twelve≈12, 1-letter ASR slips).
HARD RULE: if the learner text equals the ideal ignoring case/accents/punctuation, you MUST return correct:true with score>=85. Never reject a matching answer.
Then respond IN CHARACTER as ${persona.name} (${persona.role}) in ${nativeLangName} WITH foreign accent, in that character's style (anne→şefkatli, arkadaş→samimi, patron→resmi, esnaf→samimi), not necessarily as teacher.

Rules:
- personaReply entirely in ${nativeLangName} WITH slight foreign accent, in character's style (e.g., anne: "Bak yavrum, şöyle diyeceksin:", arkadaş: "Kanka bak şöyle:", patron: "Bakın, şöyle söylemeniz lazım:") → praise/correction + ideal foreign sentence in quotes with original pronunciation.
- Always include ideal foreign sentence in quotes, fully ${nativeLangName} dışı, tamamen hedef dilde.
- verdict in ${nativeLangName}
- personaReply: 1-2 sentences, max 20 words, in ${nativeLangName} with foreign accent, in character's style.

Return STRICT JSON only:
{"score":0-100,"correct":bool,"almost":bool,"verdict":"...","feedback":"short ${nativeLangName} feedback in ${nativeLangName} with foreign accent, ideal foreign sentence in quotes (fully target)","ideal":"${ideal}","pronunciation":0-100,"personaReply":"${nativeLangName} with foreign accent, in character style, e.g., 'Bak yavrum, şöyle diyeceksin: \\"${ideal}\\"' "}`,
        },
        { role: "user", content: `Learner said: "${input}" | Ideal (must be fully target foreign, not ${nativeLangName}): "${ideal}" | Character: ${persona.name} (${persona.role})` },
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const base = fallbackEvaluate(input, ideal);
    // Güvenlik filesi: offline motor birebir/hoşgörülü kabul ediyorsa GROQ reddedemez
    const finalCorrect = !!parsed.correct || base.correct;
    const finalAlmost = finalCorrect ? false : (!!parsed.almost || base.almost);
    return {
      score: finalCorrect ? Math.max(typeof parsed.score === "number" ? parsed.score : 0, base.score, 85) : (typeof parsed.score === "number" ? parsed.score : base.score),
      correct: finalCorrect,
      almost: finalAlmost,
      verdict: finalCorrect ? base.verdict === "Mükemmel!" ? (parsed.verdict || base.verdict) : base.verdict : (parsed.verdict || base.verdict),
      feedback: parsed.feedback || base.feedback,
      ideal,
      pronunciation: typeof parsed.pronunciation === "number" ? parsed.pronunciation : base.pronunciation,
      personaReply: parsed.personaReply || offlinePersonaReply({ ...base, correct: finalCorrect, almost: finalAlmost }, ideal, persona, nativeLangName),
    };
  } catch (e) {
    console.error("persona eval error", e);
    const base = fallbackEvaluate(input, ideal);
    return { ...base, personaReply: offlinePersonaReply(base, ideal, persona, nativeLangName) };
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
  const cacheKey = `scene:v8:${day}:${level}:${targetLangName}:${nativeLangName}:${content.title}`;
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
          content: `You are a DYNAMIC CHARACTER and LANGUAGE COACH generating for Day ${day}: "${content.title}" at ${content.location}.
Primary NPC: ${content.npcName} (${content.npcRole}) ${content.npcEmoji} — this character is user-selectable (Anne, arkadaş, patron, esnaf, etc.)
${secondaryInfo}
Description: ${content.description}
ORIGINAL SAMPLE DIALOGS (for reference): ${samplePrompts}
TARGET: ${targetLangName} (foreign), NATIVE: ${nativeLangName}. You are this dynamic character whose native is ${targetLangName} but you speak ${nativeLangName} with a slight foreign accent, in the character's style.

İLETİŞİM VE DÜZELTME KURALLARI:
1. Kullanıcı ile iletişim kurarken (yönlendirmeler, açıklamalar, düzeltmeler, tavsiyeler) HER ZAMAN ${nativeLangName.toUpperCase()} konuşacaksın.
2. ${nativeLangName} konuşurken, seçilen karaktere uygun üslup takın (anne ise şefkatli "Bak yavrum...", arkadaş ise samimi "Kanka bak...", patron ise resmi "Bakın, şöyle yapmanız lazım...", esnaf ise samimi), ve ${nativeLangName}'yi sonradan öğrenmiş bir yabancının şivesiyle (yabancı aksan, hafif bozuk) konuşacaksın. Düzeltmeleri her zaman bu karakterin yapısına göre yapacaksın.

ASIL CEVAP VE HEDEF DİL KURALLARI (kesin):
1. Üretilen cümle ASLA ${nativeLangName} olmayacak; tamamen hedef yabancı dilde olacak (örn. Portekizce "Eu me chamo João.", not Turkish words).
2. Bu yabancı cümle hem yazılı olarak (hedef dilde) hem de o dilin orijinal aksan/fonetik rehberiyle birlikte verilecek.
3. Asla yabancı dildeki cümleyi ${nativeLangName} kelimelerle kurup yabancı aksanla okumaya çalışmayacaksın. Kelimeler ve gramer tamamen hedef yabancı dilde olacak.

CEFR ${level}: ${level==="A1"?"very short 2-4 words":level==="A2"?"simple 5-8 words":level==="B1"?"connected 8-14 words":level==="B2"?"fluent 12-20 words":"rich 15-25 words with idioms"} in ${targetLangName}.
${hasSecondary ? "For multi-character scene, ALTERNATE speakers: some steps from primary, some from secondary. Include speakerName/speakerRole/speakerEmoji per step." : "Single speaker, all steps from primary NPC."}
Hızlı pratik, insan gibi.

Example flow (if native Turkish & target Portuguese, character Anne):
- Teacher (Anne, slightly foreign-accented Turkish): "Bak yavrum, adını sorsalar şöyle diyeceksin:"
- Foreign answer (written + original accent): "Eu me chamo João." (Portuguese) + pronunciation guide

UYGULAMA DÖNGÜSÜ (4 aşama, her zaman):
1. SORU/GÖREV (Hedef Yabancı Dil): Kullanıcıya her zaman hedef yabancı dilde sorular sor veya senaryo ver. Örn. Portekizce "Onde vai?" / "Eu me chamo João. nerede?"
2. KULLANICININ CEVABI: Kullanıcı hedef yabancı dilde cevap vermeye çalışır.
3. DÜZELTME (Türkçe + Yabancı Aksan): Yanlış ise karakter devreye girer, HER ZAMAN TÜRKÇE ama yabancı aksanla, karakter üslubuyla: anne "Bak yavrum, yanlış söyledin, bunu böyle diycen...", arkadaş "Kanka bak şöyle:", patron "Bakın, şöyle yapmanız lazım..."
4. DOĞRU CEVAP (Yabancı Dil + Orijinal Aksan): Asıl doğru cevap ASLA Türkçe değil, tamamen hedef yabancı dilde + orijinal telaffuz rehberiyle.

Generate each step:
- "prompt": in ${targetLangName} (target, original accent), what NPC asks in ${targetLangName} (e.g., Portuguese "Onde vai?" for travel, not Turkish)
- "promptTr": natural ${nativeLangName} translation of prompt (e.g., "Nereye gidiyorsun?")
- "answer": in ${targetLangName} original, ${level} level, what learner should say to answer prompt (e.g., Portuguese "Vou para Lisboa."), never ${nativeLangName} words, fully ${targetLangName} grammar
- "turkish": ${nativeLangName} translation of answer
- Chips in ${targetLangName}

Return STRICT JSON with EXAMPLE (native Turkish, target Portuguese, character Anne, A1):
{"npcName":"Anne Ayşe","npcRole":"Anne","npcEmoji":"👩‍🍳","steps":[{"prompt":"Onde vai?","promptTr":"Nereye gidiyorsun?","answer":"Vou para Lisboa.","turkish":"Lizbon'a gidiyorum.","chips":["vou","para"],"speakerName":"Anne Ayşe","speakerRole":"Anne","speakerEmoji":"👩‍🍳"}]}
Now generate for ${targetLangName} (prompt in ${targetLangName} original, promptTr in ${nativeLangName}, answer in ${targetLangName} original, turkish in ${nativeLangName}):
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
export async function generateFullScene(
  day: number,
  theme: string,
  level: string = "A1",
  targetLangName: string = "English",
  nativeLangName: string = "Turkish",
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
          content: `You are the SOLE content generator for a gamified language app. Day ${day}, theme: ${theme}, level ${level}.
TARGET: ${targetLangName} (foreign), NATIVE: ${nativeLangName}.

UYGULAMA DÖNGÜSÜ (4 aşama, tüm bölüm/ortam/seviyelerde geçerli):
1. SORU/GÖREV (Hedef Yabancı Dil): prompt HER ZAMAN ${targetLangName} dilinde soru/senaryo.
2. KULLANICININ CEVABI: kullanıcı ${targetLangName} dilinde cevap verir.
3. DÜZELTME (anadil + yabancı aksan): karakter ${nativeLangName} konuşur ama yabancı aksanla, karakter üslubuyla.
4. DOĞRU CEVAP (asla anadil değil): answer tamamen ${targetLangName} dilinde + orijinal okunuş.

CEFR ${level}: ${level === "A1" ? "2-4 words" : level === "A2" ? "5-8 words" : level === "B1" ? "8-14 words" : level === "B2" ? "12-20 words" : "15-25 words with idioms"}.
Generate 3 fresh immersive dialog steps. Each step: NPC prompt (${targetLangName}, natural), ideal learner answer (${targetLangName}, ${level} level, NEVER ${nativeLangName}), ${nativeLangName} translation, chips (1-3 ${targetLangName} vocab).
Return STRICT JSON: {"steps":[{"prompt":"...","answer":"...","turkish":"...","chips":["..."]}]}`
        },
        { role: "user", content: `Generate day ${day} for ${theme} at ${level} in ${targetLangName} (translations in ${nativeLangName})` }
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
  const cacheKey = `lesson:v5:${langName}:${level}:${topicName}:${nativeLangName}`;
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
You are a DYNAMIC CHARACTER and LANGUAGE COACH (Anne, arkadaş, patron, esnaf... selectable), native ${langName}, speaking ${nativeLangName} with slight ${langName} accent when correcting.

UYGULAMA DÖNGÜSÜ (4 aşama):
1. SORU/GÖREV (Hedef Yabancı Dil): Kullanıcıya her zaman hedef yabancı dilde sorular sor veya senaryo ver (örn. Portekizce "Onde vai?" ).
2. KULLANICININ CEVABI: Kullanıcı hedef yabancı dilde cevap vermeye çalışır.
3. DÜZELTME (Türkçe + Yabancı Aksan): Yanlış ise karakter Türkçe ama yabancı aksanla düzeltir: anne "Bak yavrum, yanlış söyledin, bunu böyle diycen...", arkadaş "Kanka bak şöyle:", patron "Bakın, şöyle yapmanız lazım..." — HER ZAMAN TÜRKÇE, karaktere uygun üslup, yabancı aksan.
4. DOĞRU CEVAP (Yabancı Dil + Orijinal Aksan): Asıl doğru cevap ASLA Türkçe değil, tamamen hedef yabancı dilde + orijinal telaffuz rehberiyle.

Generate exactly 3 turns:
- "prompt": in ${langName} (target, original accent), what NPC asks in ${langName} (e.g., Portuguese "Onde vai?" for travel)
- "promptTr": natural ${nativeLangName} translation of prompt (e.g., "Nereye gidiyorsun?")
- "answer": in ${langName} original, ${level} level, what learner should say (e.g., Portuguese "Vou para Lisboa.", never Turkish words, fully ${langName} grammar)
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

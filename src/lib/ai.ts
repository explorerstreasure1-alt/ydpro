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
const dialogueCache = new Map<string, any>();

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
    // Latin aksanları: olá≈ola, ç≈c, ñ≈n, ü≈u — ASR aksanı kaçırsa da eşleşsin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Almanca ß, Arapça yazım birliği (elif/teh-merbuta/hareke) — salt imla, anlam değişmez
    .replace(/ß/g, "ss")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    // NFD, أإآؤئ'yi parçalar (elif + hemze) — hemze artıkları da temizlenir
    .replace(/[\u064b-\u0656\u0670]/g, "")
    // Noktalama — Latin + CJK (Çince/Japonca ASR 。、！？ ile yazar)
    .replace(/[.,!?;:"'«»“”‘’¿¡…—–·•・、。！？，：；（）「」『』【】〜～〈〉《》“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sayı kelimesi ↔ rakam denkliği (ASR "twelve" yazar, ideal "12" olabilir) — 14 dil.
 *  Diller arası aynı yazım varsa tek anahtar yeter (değer aynıysa çakışma yok). */
const NUMBER_WORDS: Record<string, string> = {
  // İngilizce + ortak Latin (zero/fr/it, six/fr, etc. — değer aynı)
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100",
  // Portekizce (BR + PT yazımları)
  um: "1", uma: "1", dois: "2", duas: "2", tres: "3", quatro: "4", cinco: "5",
  sete: "7", oito: "8", nove: "9", dez: "10", onze: "11", doze: "12",
  treze: "13", catorze: "14", quatorze: "14", quinze: "15", dezasseis: "16", dezesseis: "16",
  dezassete: "17", dezessete: "17", dezoito: "18", dezanove: "19", dezenove: "19", vinte: "20",
  trinta: "30", quarenta: "40", cinquenta: "50", sessenta: "60", setenta: "70", oitenta: "80",
  noventa: "90", cem: "100", cento: "100",
  // İspanyolca (dos: rakam — kısaltma eşlemesi CMAP'te ayrıca durur, sayı kontrolü önce gelir)
  cero: "0", uno: "1", dos: "2", siete: "7", ocho: "8", diez: "10", once: "11", doce: "12",
  trece: "13", catorce: "14", dieciseis: "16", diecisiete: "17", dieciocho: "18",
  diecinueve: "19", veinte: "20", treinta: "30", cuarenta: "40", cincuenta: "50",
  sesenta: "60", ochenta: "80", cien: "100", ciento: "100",
  // Fransızca
  un: "1", une: "1", deux: "2", trois: "3", quatre: "4", cinq: "5",
  sept: "7", huit: "8", neuf: "9", dix: "10", douze: "12",
  seize: "16", dixsept: "17", dixhuit: "18", dixneuf: "19",
  vingt: "20", trente: "30", quarante: "40", cinquante: "50", soixante: "60", cent: "100",
  // Almanca
  null: "0", eins: "1", eine: "1", zwei: "2", drei: "3", vier: "4", funf: "5", sechs: "6",
  sieben: "7", acht: "8", neun: "9", zehn: "10", elf: "11", zwolf: "12", dreizehn: "13",
  vierzehn: "14", funfzehn: "15", sechzehn: "16", siebzehn: "17", achtzehn: "18", neunzehn: "19",
  zwanzig: "20", dreissig: "30", vierzig: "40", funfzig: "50", sechzig: "60", siebzig: "70",
  achtzig: "80", neunzig: "90", hundert: "100",
  // İtalyanca
  due: "2", tre: "3", sei: "6", sette: "7", otto: "8", dieci: "10", undici: "11",
  dodici: "12", tredici: "13", quattordici: "14", quindici: "15", sedici: "16",
  diciassette: "17", diciotto: "18", diciannove: "19", venti: "20", trenta: "30",
  sessanta: "60", settanta: "70", ottanta: "80", novanta: "90",
  // Felemenkçe
  nul: "0", een: "1", twee: "2", vijf: "5", zes: "6", zeven: "7",
  negen: "9", tien: "10", twaalf: "12", dertien: "13", veertien: "14",
  vijftien: "15", zestien: "16", zeventien: "17", achttien: "18", negentien: "19",
  twintig: "20", dertig: "30", veertig: "40", vijftig: "50", zestig: "60", zeventig: "70",
  tachtig: "80", negentig: "90", honderd: "100",
  // Rusça
  ноль: "0", один: "1", одна: "1", два: "2", две: "2", три: "3", четыре: "4", пять: "5",
  шесть: "6", семь: "7", восемь: "8", девять: "9", десять: "10", одиннадцать: "11",
  двенадцать: "12", тринадцать: "13", четырнадцать: "14", пятнадцать: "15", шестнадцать: "16",
  семнадцать: "17", восемнадцать: "18", девятнадцать: "19", двадцать: "20", тридцать: "30",
  сорок: "40", пятьдесят: "50", сто: "100",
  // Türkçe (norm sonrası: ı korunur, ş→s, ö→o, ü→u, ğ→g, ç→c)
  sıfır: "0", bir: "1", iki: "2", uc: "3", dort: "4", bes: "5", altı: "6", yedi: "7",
  sekiz: "8", dokuz: "9", on: "10", yirmi: "20", otuz: "30", kırk: "40", elli: "50",
  altmıs: "60", yetmis: "70", seksen: "80", doksan: "90", yuz: "100",
  // Lehçe (norm sonrası: ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, źż→z)
  jeden: "1", dwa: "2", trzy: "3", cztery: "4", piec: "5", szesc: "6",
  siedem: "7", osiem: "8", dziewiec: "9", dziesiec: "10", jedenascie: "11", dwanascie: "12",
  trzynascie: "13", czternascie: "14", pietnascie: "15", szesnascie: "16",
  siedemnascie: "17", osiemnascie: "18", dziewietnascie: "19", dwadziescia: "20",
  trzydziesci: "30", czterdziesci: "40", piecdziesiat: "50",
  // Çince (basitleştirilmiş — Japonca kanji ile ortak, değer aynı)
  一: "1", 二: "2", 两: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8",
  九: "9", 十: "10",
  // Japonca (yaygın okunuşlar — kanji yukarıda ortak)
  〇: "0", 零: "0", ゼロ: "0", れい: "0",
  いち: "1", に: "2", さん: "3", し: "4", よん: "4", ご: "5", ろく: "6", なな: "7",
  しち: "7", はち: "8", きゅう: "9", く: "9", じゅう: "10",
  // Arapça (harf + doğu rakamları)
  صفر: "0", واحد: "1", اثنان: "2", اثنين: "2", ثلاثة: "3", أربعة: "4", خمسة: "5",
  ستة: "6", سبعة: "7", ثمانية: "8", تسعة: "9", عشرة: "10",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  // Korece (Sino + yerli 1-10)
  일: "1", 이: "2", 삼: "3", 사: "4", 오: "5", 육: "6", 칠: "7", 팔: "8", 구: "9", 십: "10",
  하나: "1", 둘: "2", 셋: "3", 넷: "4", 다섯: "5", 여섯: "6", 일곱: "7", 여덟: "8", 아홉: "9", 열: "10",
};

/** Konuşma dilindeki kısaltmalar (ASR doğal yazar, ideal tam yazar) */
const CONTRACTION_MAP: Record<string, string> = {
  // Portekizce konuşma kısaltmaları + edat birleşmeleri (BR + PT)
  pra: "para", pro: "para", pros: "para", pras: "para", pa: "para",
  ta: "esta", tas: "estas", to: "estou", tou: "estou", tamos: "estamos",
  num: "em", numa: "em", nuns: "em", numas: "em", no: "em", na: "em", nos: "em", nas: "em",
  dum: "de", duma: "de", duns: "de", dumas: "de", do: "de", da: "de", dos: "de",
  // NOT: PT "das" Alman artikeli "das" ile çakışır — Alman tarafı __art'ta durur,
  // PT tarafı ALT_MAP (de↔__art) üzerinden kabul edilir.
  pelo: "por", pela: "por", pelos: "por", pelas: "por",
  neste: "este", nesta: "esta", nesse: "esse", nessa: "essa",
  // BR ↔ PT kelime varyantları (aynı anlama gelir, ikisi de doğru)
  telemovel: "__phone", celular: "__phone",
  autocarro: "__bus", onibus: "__bus",
  comboio: "__train", trem: "__train",
  // Cinsiyet çekimi (konuşmacıya göre ikisi de doğru)
  obrigado: "__thanks", obrigada: "__thanks",
  buena: "bueno", mucha: "mucho", toda: "todo", esta: "este", esa: "ese",
  bonita: "bonito", pequena: "pequeno", une: "un", una: "uno", un: "uno", eine: "ein",
  // Artikel/cinsiyet karışıklığı yeni başlayan için engel olmasın (doğrusu kararda gösterilir)
  a: "__art", an: "__art", the: "__art",
  der: "__art", die: "__art", das: "__art", dem: "__art", den: "__art",
  einen: "__art", einem: "__art", einer: "__art",
  el: "__art", la: "__art", lo: "__art", il: "__art", i: "__art", gli: "__art", le: "__art",
  // Evet/hayır — tüm dillerde ASR varyantı (simetrik, eşleşmeyi bozmaz)
  yes: "__yes", sim: "__yes", si: "__yes", oui: "__yes", ja: "__yes",
  nao: "__no", non: "__no", nein: "__no", nee: "__no",
  // İspanyolca/Fransızca/İtalyanca/Almanca edat birleşmeleri
  // (del hem ES "de" hem IT "di" yerine geçer — ALT_MAP'te çift yönlü, aşağıda)
  al: "a",
  au: "a", aux: "a", du: "de", des: "de",
  dello: "di", della: "di", dei: "di", degli: "di", allo: "a", alla: "a", ai: "a",
  agli: "a", dal: "da", dallo: "da", dalla: "da",
  zum: "zu", zur: "zu", beim: "bei", vom: "von",
  // İngilizce konuşma kısaltmaları
  gonna: "going", wanna: "want", gimme: "give", gotta: "got", dunno: "know",
};

/** Birden çok forma uyanlar — iki yönlü kabul */
const ALT_MAP: Record<string, string[]> = {
  del: ["de", "di"], // ES del≈de, IT del≈di
  de: ["__art"], // PT das/FR de/ES de artikelle de kabul (das Alman __art'ında)
  di: ["de"], // IT di≈de
  da: ["de"], // IT dal/dallo/dalla (≈da) ≈ de
};

function canonToken(t: string): string {
  let x = (t || "").toLowerCase();
  if (CONTRACTION_MAP[x]) x = CONTRACTION_MAP[x];
  if (NUMBER_WORDS[x]) x = NUMBER_WORDS[x];
  return x;
}

/** Fransızca/İtalyanca/İspanyolca dişil çekim kökü: grande→grand, petite→petit, bonne→bon */
function femBase(t: string): string {
  if (!/^[a-z]+$/.test(t) || t.length <= 4) return t;
  let x = t;
  if (x.endsWith("e")) x = x.slice(0, -1);
  x = x.replace(/(bb|cc|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)$/, (m) => m[0]);
  return x;
}

/** Slav çekim eki toleransı: Moskvu≈Moskve (Rusça), domu≈dom (Lehçe) */
function slavicStem(t: string): string {
  if (/[\u0400-\u04ff]/.test(t)) {
    const ends = ["ого", "его", "ому", "ему", "ыми", "ими", "ах", "ях", "ов", "ев", "ей", "ой", "ом", "ем", "ам", "ям", "а", "я", "у", "ю", "о", "е", "и", "ы", "ь"];
    for (const e of ends) {
      if (t.length >= 5 && t.endsWith(e) && t.length - e.length >= 4) return t.slice(0, -e.length);
    }
    return t;
  }
  if (t.length >= 5) {
    const ends = ["owie", "ami", "ach", "ow", "om", "em", "am", "ie"];
    for (const e of ends) {
      if (t.endsWith(e) && t.length - e.length >= 4) return t.slice(0, -e.length);
    }
  }
  if (t.length >= 4) {
    for (const e of ["u", "a", "i", "y", "o"]) {
      if (t.endsWith(e) && t.length - e.length >= 3) return t.slice(0, -e.length);
    }
  }
  return t;
}

/** Türkçe ek toleransı: evde≈evden≈evim≈ev (kök ≥2 harf korunur) */
function turkishStem(t: string): string {
  const ends = [
    "lerden", "lardan", "lerde", "larda", "leri", "ları", "ler", "lar",
    "nın", "nin", "nun", "nün", "den", "dan", "ten", "tan",
    "de", "da", "te", "ta", "in", "ın", "un", "ün",
    "im", "ım", "um", "üm", "sin", "sın", "sun", "sün",
    "iz", "ız", "uz", "üz", "si", "sı", "su", "sü",
    "yi", "yı", "yu", "yü", "ye", "ya",
    "i", "ı", "u", "ü", "e", "a",
  ];
  if (t.length >= 4) {
    for (const e of ends) {
      if (t.endsWith(e) && t.length - e.length >= 2) return t.slice(0, -e.length);
    }
  }
  return t;
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
  const ra = (a || "").toLowerCase(), rb = (b || "").toLowerCase();
  if (ra === rb) return true;
  // Sayı kelimesi ↔ rakam — kısaltma eşlemesinden ÖNCE ham haliyle (dos↔2, twelve↔12)
  if (NUMBER_WORDS[ra] && NUMBER_WORDS[ra] === rb) return true;
  if (NUMBER_WORDS[rb] && NUMBER_WORDS[rb] === ra) return true;
  const ca = canonToken(a), cb = canonToken(b);
  if (ca === cb) return true;
  // Çift yönlüler: ES del≈de, IT del≈di
  if (ALT_MAP[ca]?.includes(cb) || ALT_MAP[cb]?.includes(ca)) return true;
  if (stripPlural(ca) === stripPlural(cb)) return true; // ticket≈tickets
  if (femBase(ca) === femBase(cb)) return true; // grand≈grande, petit≈petite
  const sa = slavicStem(ca), sb = slavicStem(cb);
  if (sa === cb || sb === ca || sa === sb) return true; // moskvu≈moskve, domu≈dom
  const ua = turkishStem(ca), ub = turkishStem(cb);
  if (ua === cb || ub === ca || ua === ub) return true; // evde≈evden≈ev
  if (ca.length >= 4 && cb.length >= 4 && editDistance(ca, cb) <= 1) return true; // 1 harf ASR hatası
  return false;
}

const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff]/;

/**
 * Token overlap similarity 0..1 — ASR toleranslı (kısaltma/çoğul/çekim/1-harf/sayı).
 * Çince/Japonca boşluksuz yazılır → karakter-seviyesi benzerlik kullanılır.
 */
function similarity(a: string, ideal: string): number {
  const n = norm(a);
  const ni = norm(ideal);
  if (!ni) return 0;
  // CJK: boşluk yok, karakter çakışması (sıra duyarsız, tekrar duyarlı)
  if (CJK_RE.test(ni) || CJK_RE.test(n)) {
    const A = [...n.replace(/\s+/g, "")];
    const B = [...ni.replace(/\s+/g, "")];
    if (B.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const ch of B) counts.set(ch, (counts.get(ch) || 0) + 1);
    let hits = 0;
    for (const ch of A) {
      const c = counts.get(ch) || 0;
      if (c > 0) { hits++; counts.set(ch, c - 1); }
    }
    return hits / Math.max(A.length, B.length);
  }
  const ta = n.split(" ").filter(Boolean);
  const ti = ni.split(" ").filter(Boolean);
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

// --- Seviye uyarlaması: A1 kısa → C2 anadil düzeyi (offline statik içerik için) ---
export function adaptAnswerToLevel(answer: string, level: string, targetLangName: string = "English"): string {
  const words = (answer || "").split(" ").filter(Boolean);
  if (words.length === 0) return answer;
  // Seviye kelime tavanı — AI uzun saçmalarsa kısalt (tüm dillerde)
  const cap = level === "A1" ? 6 : level === "A2" ? 10 : level === "B1" ? 16 : level === "B2" ? 22 : level === "C1" ? 30 : 40;
  const trimmed = words.slice(0, cap).join(" ");
  const isEnglish = targetLangName.toLowerCase().includes("english");
  if (level === "A1" || level === "A2" || level === "B1") return trimmed || answer;
  // B2/C1 deyim eki SADECE İngilizce hedefte — başka dilde İngilizce ek saçmalık olur
  if (!isEnglish) return trimmed || answer;
  if (level === "B2") return trimmed.endsWith(".") ? `${trimmed.slice(0, -1)}, in my opinion.` : `${trimmed}, in my opinion.`;
  return trimmed.endsWith(".") ? `${trimmed.slice(0, -1)}, to be honest, that's exactly what I mean.` : `${trimmed}, to be honest.`;
}

/** AI adımlarını doğrula: boş/aynı/tekrarı ele, seviyeye kısalt. Geçersizse null (caller tabana düşer). */
export function sanitizeAiSteps<T extends { prompt: string; answer: string }>(
  steps: T[],
  level: string,
  targetLangName: string = "English",
): T[] | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const seen = new Set<string>();
  const clean: T[] = [];
  for (const s of steps) {
    const prompt = String(s?.prompt || "").trim();
    const answer = String(s?.answer || "").trim();
    if (!prompt || !answer) continue;
    // Soru ile cevap aynıysa / cevap sorunun kopyasıysa ele (saçmalık filtresi)
    if (norm(prompt) === norm(answer)) continue;
    const key = norm(answer);
    if (seen.has(key)) continue; // aynı cevabın tekrarı
    seen.add(key);
    clean.push({ ...s, prompt, answer: adaptAnswerToLevel(answer, level, targetLangName) });
  }
  return clean.length >= 2 ? clean : null;
}

export function xpForLevel(level: string): number {
  if (level === "A1") return 20;
  if (level === "A2") return 20;
  if (level === "B1") return 25;
  if (level === "B2") return 25;
  if (level === "C1") return 30;
  return 35; // C2
}

// Offline: GROQ yokken bile TÜM seriler (18 gün) + TÜM dillerde takılma olmasın diye
// statik İngilizce diyalogdan seviyeye uyarlanmış adımlar üretir. Online iken AI zaten
// hedef dilde taze sahne üretir; bu sadece güvenli tabandır.
export function offlineSceneSteps(
  raw: { dialog: any[]; npcName: string; npcRole: string; npcEmoji: string; secondaryNpc?: { name: string; role: string; emoji: string } },
  level: string = "A1",
  targetLangName: string = "English",
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
      answer: adaptAnswerToLevel(String(d.fallback || d.line || d.prompt || ""), level, targetLangName),
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
 * (with native-language translations) for a scenario. Returns null on any failure
 * so the caller can fall back to static content. Fully dynamic: no hardcoded language.
 */
export async function generateDialog(
  theme: string,
  sampleQ: string,
  sampleA: string,
  targetLangName: string = "English",
  nativeLangName: string = "Turkish",
  level: string = "A1",
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
          content: `You are a language-game content generator for a ${nativeLangName} learner learning ${targetLangName}, CEFR ${level}.
Scenario/theme: ${theme}.
Generate 3 fresh, simple, natural conversational NPC prompts (the thing the NPC says, in ${targetLangName}) that fit this real-life scenario, plus the natural short ${targetLangName} answer the learner should give, plus a natural ${nativeLangName} translation of each answer.
Vary from the sample so it feels different each time — do NOT copy the sample.
Return STRICT JSON only:
{"steps":[{"prompt":"...","answer":"...","turkish":"...","chips":["word1","word2"]}]}
Rules: exactly 3 steps; answers appropriate to ${level}; chips = 1-3 key vocabulary words (${targetLangName}) for the scenario.`,
        },
        { role: "user", content: `Sample prompt: "${sampleQ}". Sample answer: "${sampleA}". Generate in ${targetLangName} (translations in ${nativeLangName}).` },
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
  nativeLangName: string = "Turkish",
  fresh: boolean = false,
  seen: string[] = [],
): Promise<{ npcName: string; npcRole: string; npcEmoji: string; steps: (AiStep & {speakerName?:string; speakerRole?:string; speakerEmoji?:string})[]; secondaryNpc?: any } | null> {
  const cacheKey = `scene:v9:${day}:${level}:${targetLangName}:${nativeLangName}:${content.title}`;
  if (!fresh && sceneCache.has(cacheKey)) return sceneCache.get(cacheKey);
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

CEFR ${level}: ${level==="A1"?"very short 2-4 words":level==="A2"?"simple 5-8 words":level==="B1"?"connected 8-14 words":level==="B2"?"fluent 12-20 words":level==="C1"?"rich 15-25 words with idioms":"native-like mastery 20-35 words with rhetoric and style"} in ${targetLangName}.
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
        { role: "user", content: `Generate fresh Day ${day} dialog, keep ${hasSecondary ? "both characters alternating" : content.npcRole + " personality"}.${fresh ? " IMPORTANT: produce a DIFFERENT variant than before — new questions, new answers, no repetition." : ""}${seen.length ? ` NEVER repeat these already-shown answers (nor close paraphrases): ${seen.map((s) => `"${String(s).slice(0, 120)}"`).join(" | ")}` : ""}` }
      ],
    };
    // Tek GROQ tökezlemede Türkçe tabana düşme — bir kez daha dene (ortamlar çalışsın)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await callGroq(params);
        const raw = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const mapped: (AiStep & { speakerName: string; speakerRole: string; speakerEmoji: string })[] = parsed.steps.map((s: any) => ({
            prompt: String(s.prompt || ""),
            promptTr: String(s.promptTr || (s as any).prompt_tr || ""),
            answer: String(s.answer || ""),
            turkish: String(s.turkish || (s as any).tr || ""),
            chips: Array.isArray(s.chips) ? s.chips.map(String) : [],
            speakerName: String(s.speakerName || s.speaker || parsed.npcName || content.npcName),
            speakerRole: String(s.speakerRole || parsed.npcRole || content.npcRole),
            speakerEmoji: String(s.speakerEmoji || parsed.npcEmoji || content.npcEmoji),
          }));
          // Saçmalık filtresi: boş/aynı/tekrar adımları ele, seviyeye kısalt
          const valid = sanitizeAiSteps(mapped, level, targetLangName);
          if (!valid) {
            console.error(`personaScene invalid steps day=${day} attempt=${attempt}`);
            continue;
          }
          const out = {
            npcName: String(parsed.npcName || content.npcName),
            npcRole: String(parsed.npcRole || content.npcRole),
            npcEmoji: String(parsed.npcEmoji || content.npcEmoji),
            secondaryNpc: content.secondaryNpc,
            steps: valid,
          };
          sceneCache.set(cacheKey, out);
          return out;
        }
        console.error(`personaScene empty steps day=${day} attempt=${attempt}`);
      } catch (e) {
        console.error(`personaScene error day=${day} attempt=${attempt}`, (e as any)?.message || e);
      }
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
  seen: string[] = [],
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

CEFR ${level}: ${level === "A1" ? "2-4 words" : level === "A2" ? "5-8 words" : level === "B1" ? "8-14 words" : level === "B2" ? "12-20 words" : level === "C1" ? "15-25 words with idioms" : "20-35 words, native-like mastery"}.
Generate 3 fresh immersive dialog steps. Each step: NPC prompt (${targetLangName}, natural), ideal learner answer (${targetLangName}, ${level} level, NEVER ${nativeLangName}), ${nativeLangName} translation, chips (1-3 ${targetLangName} vocab).
Return STRICT JSON: {"steps":[{"prompt":"...","answer":"...","turkish":"...","chips":["..."]}]}`
        },
        { role: "user", content: `Generate day ${day} for ${theme} at ${level} in ${targetLangName} (translations in ${nativeLangName}). Always a fresh variant, never repeat previous ones.${seen.length ? ` NEVER repeat these already-shown answers: ${seen.map((s) => `"${String(s).slice(0, 120)}"`).join(" | ")}` : ""}` }
      ],
    };
    const completion = await callGroq(params);
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const mapped: AiStep[] = parsed.steps.map((s: any) => ({
        prompt: String(s.prompt || ""),
        answer: String(s.answer || ""),
        turkish: String(s.turkish || ""),
        chips: Array.isArray(s.chips) ? s.chips.map(String) : [],
      }));
      return sanitizeAiSteps(mapped, level, targetLangName) || null;
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
  fresh: boolean = false,
  seen: string[] = [],
): Promise<{ steps: LessonStep[]; npcName: string; npcEmoji: string } | null> {
  const cacheKey = `lesson:v6:${langName}:${level}:${topicName}:${nativeLangName}`;
  if (!fresh && lessonCache.has(cacheKey)) return lessonCache.get(cacheKey);
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
Difficulty guide: A1 = 2-4 word simple phrases; A2 = simple everyday sentences; B1 = 2 sentences, more detail; B2 = fluent with opinion; C1 = rich, natural, nuanced; C2 = native-like mastery with style.
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
        { role: "user", content: `Generate the ${topicName} lesson at ${level} in ${langName}.${fresh ? " Make it a DIFFERENT variant than before — new questions and answers, no repetition." : ""}${seen.length ? ` NEVER repeat these already-shown answers (nor close paraphrases): ${seen.map((s) => `"${String(s).slice(0, 120)}"`).join(" | ")}` : ""}` },
      ],
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await callGroq(params);
        const raw = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const mapped: LessonStep[] = parsed.steps.map((s: any) => ({
            prompt: String(s.prompt || ""),
            promptTr: String(s.promptTr || (s as any).prompt_tr || ""),
            answer: String(s.answer || ""),
            tr: String(s.tr || (s as any).translation || ""),
            chips: Array.isArray(s.chips) ? s.chips.map((c: any) => String(c)) : [],
          }));
          const valid = sanitizeAiSteps(mapped, level, langName);
          if (!valid) {
            console.error(`lesson invalid steps topic=${topicName} attempt=${attempt}`);
            continue;
          }
          const out = {
            npcName: String(parsed.npcName || "Rehber"),
            npcEmoji: String(parsed.npcEmoji || "🗣️"),
            steps: valid,
          };
          lessonCache.set(cacheKey, out);
          return out;
        }
        console.error(`lesson empty steps topic=${topicName} attempt=${attempt}`);
      } catch (e) {
        console.error(`lesson error topic=${topicName} attempt=${attempt}`, (e as any)?.message || e);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface DialogueLine {
  speaker: string;
  target_text: string;
  native_text: string;
}

/**
 * Diyalog Stüdyosu üretimi — spec Adım 2 evrensel şablon:
 * uzman {HEDEF} eğitmeni, {SEVİYE} düzeyinde, {KONU} konulu 6-10 satırlık doğal diyalog.
 * Çıktı: speaker / target_text (hedef dil) / native_text (ana dil). Tamamen dinamik, dil sabitlenmez.
 */
export async function generateDialogue(
  targetLangName: string,
  nativeLangName: string,
  level: string,
  topic: string,
  seen: string[] = [],
): Promise<{ lines: DialogueLine[] } | null> {
  const cacheKey = `dialog:v1:${targetLangName}:${nativeLangName}:${level}:${topic}:${seen.length}`;
  if (dialogueCache.has(cacheKey)) return dialogueCache.get(cacheKey);
  if (!client) return null;
  try {
    const params: any = {
      model: MODEL,
      temperature: 0.9,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert ${targetLangName} language teacher. The learner's level is ${level} (CEFR) and native language is ${nativeLangName}. Create a natural two-person dialogue about "${topic}".
Rules:
- 6-10 lines total, alternating speakers with natural local names (e.g., Spanish: Carlos/Lucía).
- Grammar and vocabulary STRICTLY at ${level} level (${level === "A1" ? "2-4 word simple phrases" : level === "A2" ? "simple everyday sentences" : level === "B1" ? "connected 8-14 word sentences" : level === "B2" ? "fluent 12-20 word sentences" : level === "C1" ? "rich 15-25 word sentences with idioms" : "native-like 20-35 word sentences"}).
- "target_text" fully in ${targetLangName} (NEVER ${nativeLangName} words), "native_text" natural ${nativeLangName} translation.
- Everyday spoken language, no textbook stiffness, no explanations.
Return STRICT JSON only:
{"lines":[{"speaker":"...","target_text":"...","native_text":"..."}]}`,
        },
        {
          role: "user",
          content: `Topic: "${topic}" | Level ${level} | ${targetLangName} with ${nativeLangName} translations. Fresh variant, no repetition.${seen.length ? ` NEVER repeat these already-shown lines: ${seen.map((s) => `"${String(s).slice(0, 120)}"`).join(" | ")}` : ""}`,
        },
      ],
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await callGroq(params);
        const raw = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.lines) && parsed.lines.length >= 4) {
          const seenSet = new Set<string>();
          const lines: DialogueLine[] = [];
          for (const l of parsed.lines) {
            const speaker = String(l.speaker || "").trim().slice(0, 24) || "A";
            const target_text = String(l.target_text || l.targetText || "").trim();
            const native_text = String(l.native_text || l.nativeText || "").trim();
            if (!target_text || !native_text) continue;
            if (norm(target_text) === norm(native_text)) continue;
            const k = norm(target_text);
            if (seenSet.has(k)) continue;
            seenSet.add(k);
            lines.push({ speaker, target_text, native_text });
            if (lines.length >= 10) break;
          }
          if (lines.length >= 4) {
            const out = { lines };
            dialogueCache.set(cacheKey, out);
            return out;
          }
          console.error(`dialogue invalid lines topic=${topic} attempt=${attempt}`);
          continue;
        }
        console.error(`dialogue empty lines topic=${topic} attempt=${attempt}`);
      } catch (e) {
        console.error(`dialogue error topic=${topic} attempt=${attempt}`, (e as any)?.message || e);
      }
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

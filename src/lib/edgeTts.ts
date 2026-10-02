// Edge sinirsel sesler — anahtarsız, ücretsiz, SSML yönetmen komutlu.
// Protokol: speech.platform.bing.com WS + Sec-MS-GEC jetonu.
import WebSocket from "ws";
import { createHash, randomBytes, randomUUID } from "crypto";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

/** Sec-MS-GEC jetonu: SHA256(windowTicks + token), 5 dk pencereli.
 *  windowTicks 64-bit tam sayı ister — float BOZAR, BigInt literal hedefte YOK;
 *  güvenli aralıktaki sayıyı dize olarak genişletiyoruz (rounded + 7 sıfır). */
export function generateSecMsGec(skewSec = 0): string {
  const unixSec = Math.floor(Date.now() / 1000) + skewSec;
  const withEpoch = unixSec + 11644473600;
  const rounded = withEpoch - (withEpoch % 300);
  const windowsTicks = `${rounded}0000000`;
  return createHash("sha256")
    .update(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Sunucu saatiyle aradaki kayma (sn) — 403'lerde jeton penceresini tutturmak için */
async function getClockSkew(): Promise<number> {
  try {
    const r = await fetch(VOICES_URL, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } });
    const date = r.headers.get("date");
    if (!date) return 0;
    const serverSec = Math.floor(new Date(date).getTime() / 1000);
    const localSec = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(serverSec)) return 0;
    const skew = serverSec - localSec;
    return Math.abs(skew) > 5 ? skew : 0;
  } catch {
    return 0;
  }
}

export interface EdgeVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec?: string;
}

let voicesCache: { at: number; list: EdgeVoice[] } | null = null;

/** Ses listesi (24 saat önbellek) — bilinmeyen sesi denemek yok, listeden seçilir */
export async function listEdgeVoices(): Promise<EdgeVoice[]> {
  if (voicesCache && Date.now() - voicesCache.at < 24 * 3600 * 1000) return voicesCache.list;
  const r = await fetch(VOICES_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`voices ${r.status}`);
  const list = (await r.json()) as EdgeVoice[];
  voicesCache = { at: Date.now(), list };
  return list;
}

// Olgun/yetişkin tınısı öncelikli (genç ince ses arkada)
const MATURE_HINTS = [
  "christopher", "daniel", "david", "mark", "oliver", "thomas", "conrad",
  "henri", "alvaro", "diego", "dmitry", "yunjian", "keita", "duarte",
  "hamed", "injoon", "maarten", "frank", "marek", "ahmet", "emel",
  "samantha", "karen", "susan", "serena", "fiona", "moira", "natasha",
  "katja", "anna", "amelie", "monica", "alice", "joana", "milena",
  "svetlana", "xander", "ellen", "zosia", "agnieszka", "yuna", "kyoko",
  "laila", "hoda", "salim", "maged",
];

/** Dile en uygun Edge sesi: locale eşleşme → olgun ipucu → ilk Neural */
export async function pickEdgeVoice(lang: string, kind: "teacher" | "native"): Promise<string> {
  const code = lang.split("-")[0].toLowerCase();
  const list = await listEdgeVoices();
  const pool = list.filter(
    (v) => v.Locale?.toLowerCase().startsWith(code) && /neural$/i.test(v.ShortName || ""),
  );
  const usable = pool.length ? pool : list.filter((v) => /neural$/i.test(v.ShortName || ""));
  if (!usable.length) throw new Error("no neural voices");
  const scored = usable.map((v) => {
    const nm = `${v.ShortName} ${v.Name}`.toLowerCase();
    let s = 0;
    if (v.Locale?.toLowerCase() === lang.toLowerCase()) s += 2;
    if (MATURE_HINTS.some((h) => nm.includes(h))) s += 3;
    // native (düzeltme) tarafı kadın sesi tercih eder — "anne" kişiliği
    if (kind === "native" && v.Gender?.toLowerCase() === "female") s += 2;
    if (kind === "teacher" && v.Gender?.toLowerCase() === "male") s += 1;
    return { v, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].v.ShortName;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface SsmlSegment {
  text: string;
  voice: string;
  lang: string;
  ratePct: number; // -50..+50 gibi görece
  pitchPct: number;
  emphasis: boolean;
  breakMs: number; // ardından soluk
}

/** Prozodi kuyruğu → yönetmen SSML'i */
export function buildSsml(segments: SsmlSegment[], defaultLang: string): string {
  void defaultLang;
  // Zarf birebir edge-tts formatı: tek tırnak, xml:lang sabit (ses zaten voice'ta belli)
  let out = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>";
  let openVoice: string | null = null;
  const closeVoice = () => {
    if (openVoice) {
      out += "</voice>";
      openVoice = null;
    }
  };
  for (const s of segments) {
    if (s.voice !== openVoice) {
      closeVoice();
      out += `<voice name='${s.voice}'>`;
      openVoice = s.voice;
    }
    const rate = Math.max(-50, Math.min(50, Math.round(s.ratePct)));
    const pitch = Math.max(-50, Math.min(50, Math.round(s.pitchPct)));
    // NOT: <emphasis> bu uçta SSML'i geçersiz kılıyor — vurgu perde/hız farkıyla verilir (yukarıda).
    const inner = escXml(s.text);
    out += `<prosody rate='${rate}%' pitch='${pitch}%'>${inner}</prosody>`;
    // NOT: <break> bu uçta sentezi öldürüyor — duraklamayı noktalama yapar
    // (parçalar zaten virgül/noktada bölünür, sinirsel ses orada nefeslenir).
  }
  closeVoice();
  out += "</speak>";
  return out;
}

/** JS-tarzı tarih: "Tue Sep 30 2026 12:00:00 GMT+0000 (Coordinated Universal Time)" */
function jsDateString(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

/** SSML'i sese çevir → mp3 baytları */
export function synthesizeSsml(ssml: string, timeoutMs = 18000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Önce saat kaymasını düzelt (jeton 5 dk pencereli — kayık saat = 403)
    getClockSkew()
      .catch(() => 0)
      .then((skew) => {
        const reqId = randomUUID().replace(/-/g, "");
        const sec = generateSecMsGec(skew);
        // Sıra önemli: TrustedClientToken, ConnectionId, Sec-MS-GEC, Sec-MS-GEC-Version + muid çerezi
        const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${reqId}&Sec-MS-GEC=${sec}&Sec-MS-GEC-Version=1-143.0.3650.75`;
        const chunks: Buffer[] = [];
        let done = false;
        const wsHolder: { ws?: WebSocket } = {};
        const finish = (err?: any, data?: Buffer) => {
          if (done) return;
          done = true;
          try {
            wsHolder.ws?.close();
          } catch {}
          if (err) reject(err);
          else resolve(data || Buffer.alloc(0));
        };
        const timer = setTimeout(() => finish(new Error("edge timeout")), timeoutMs);
        const ws = new WebSocket(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
            Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
            Cookie: `muid=${randomBytes(16).toString("hex").toUpperCase()};`,
          },
        });
        wsHolder.ws = ws;
        ws.on("open", () => {
          // Config + SSML — X-RequestId URL'dekinden FARKLI taze id, tarih JS formatı + ekstra Z (Edge bug uyumu)
          const msgId = randomUUID().replace(/-/g, "");
          ws.send(
            `X-Timestamp:${jsDateString(new Date())}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
          );
          ws.send(`X-RequestId:${msgId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${jsDateString(new Date())}Z\r\nPath:ssml\r\n\r\n${ssml}`);
        });
        ws.on("message", (data: any, isBinary?: boolean) => {
          try {
            const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
            // İkili kareler 2 baytlık başlık-uzunluk önekiyle gelir (metin karelerde yok)
            let header = "";
            let bodyStart = 0;
            if (isBinary && buf.length >= 2) {
              const headerLen = buf.readUInt16BE(0);
              header = buf.slice(2, 2 + headerLen).toString("utf8");
              bodyStart = 2 + headerLen;
            } else {
              header = buf.toString("utf8");
              bodyStart = buf.length;
            }
            if (process.env.EDGE_DEBUG) {
              console.log("[edge]", JSON.stringify(header).slice(0, 200), `body=${buf.length - bodyStart}`);
            }
            if (/Path:turn\.end/.test(header)) {
              clearTimeout(timer);
              finish(undefined, Buffer.concat(chunks));
              return;
            }
            if (/Path:(audio|audio\.end)/.test(header)) {
              const audio = buf.slice(bodyStart);
              if (audio.length) chunks.push(audio);
            }
          } catch {}
        });
        ws.on("error", (e) => {
          clearTimeout(timer);
          finish(e);
        });
        ws.on("close", (code: number, reason: any) => {
          clearTimeout(timer);
          if (process.env.EDGE_DEBUG) {
            try {
              console.log(`[edge] close code=${code} reason=${String(reason).slice(0, 200)} chunks=${chunks.length}`);
            } catch {}
          }
          if (chunks.length) finish(undefined, Buffer.concat(chunks));
          else finish(new Error(`edge closed with no audio (code ${code})`));
        });
      });
  });
}

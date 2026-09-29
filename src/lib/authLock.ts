// Uygulama kilidi — edge (middleware) + node (route) uyumlu.
// Şifre SADECE sunucu env'inde (ELEVENLABS_TTS_PASSWORD), istemciye/koda ASLA yazılmaz.
// İmza WebCrypto HMAC (edge'de node:crypto yok).

export const APP_COOKIE = "yd_app";
const SIGNED_VALUE = "yd-app-unlocked-v1";

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ELEVENLABS_API_KEY || "dev-only-insecure";
}

async function hmacHex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function appCookieHeader(): Promise<string> {
  const parts = [
    `${APP_COOKIE}=${await hmacHex(SIGNED_VALUE)}`,
    "Path=/",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function isAppUnlocked(cookieValue: string | undefined | null): Promise<boolean> {
  try {
    if (!cookieValue) return false;
    const expected = await hmacHex(SIGNED_VALUE);
    return cookieValue.length === expected.length && cookieValue === expected;
  } catch {
    return false;
  }
}

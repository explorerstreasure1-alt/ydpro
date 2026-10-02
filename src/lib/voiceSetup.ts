"use client";
// Sıfır kodluk elmasın düğmesi — cihazın ses motorunu kullanıcıya 2 dokunuşla kurdurur.
// Web, sistem sesini KENDİ kuramaz; yapabildiği: doğru ayar sayfasına götürmek +
// kurulu sesin kalitesini denetleyip "hazır / eksik" demek.
import { ensureVoices, pickBestVoice } from "@/lib/tts";

export type Platform = "android" | "ios" | "desktop";

export function detectPlatform(): Platform {
  try {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  } catch {}
  return "desktop";
}

export interface VoiceHealth {
  ready: boolean; // Google/sinirsel İngilizce + Türkçe var mı?
  enName: string | null;
  trName: string | null;
  platform: Platform;
}

/** Kurulu sesler ElevenLabs'sız yeterli mi? */
export async function checkVoiceHealth(): Promise<VoiceHealth> {
  const platform = detectPlatform();
  try {
    await ensureVoices();
    const synth = window.speechSynthesis as any;
    const voices = synth?.getVoices?.() || [];
    const en = pickBestVoice(voices, "en-US");
    const tr = pickBestVoice(voices, "tr-TR");
    const good = (v: any) => {
      if (!v) return false;
      const nm = String(v.name || "").toLowerCase();
      if (/compact|legacy|basic|robot|espeak|festival|desktop|pico|kid|child|junior/.test(nm)) return false;
      if (/google|neural|natural|premium|enhanced|samantha|daniel|zira|emel/.test(nm)) return true;
      return true; // bilinmeyen ama robotik olmayan — idare eder
    };
    return {
      ready: good(en) && good(tr),
      enName: en?.name || null,
      trName: tr?.name || null,
      platform,
    };
  } catch {
    return { ready: false, enName: null, trName: null, platform };
  }
}

/** Ayar sayfasını aç — platforma göre en kısa yol */
export function openVoiceSettings(platform: Platform): void {
  try {
    if (platform === "android") {
      // 1) Sistem TTS sayfası (Chrome Android'de çalışır)
      const intent = "intent:#Intent;action=com.android.settings.TTS_SETTINGS;end";
      window.location.href = intent;
      // Açılmazsa 1.5 sn sonra Play Store yedeği (kullanıcı geri dönerse çift açılmayı önlemek için görünürlük kontrollü)
      setTimeout(() => {
        if (!document.hidden) {
          window.location.href = "market://details?id=com.google.android.tts";
        }
      }, 1500);
      return;
    }
    if (platform === "ios") {
      // iOS web'den ayar açmaz — aşağıdaki görsel kılavuz gösterilir
      return;
    }
    // Masaüstü: Chrome sesleri otomatik gelir, yapılacak bir şey yok
  } catch {}
}

export const IOS_GUIDE = [
  "Ayarlar → Erişilebilirlik → Konuşulan İçerik",
  "Sesler → İngilizce → Siri Sesi indir (Enhanced)",
  "Sesler → Türkçe → Emel (Geliştirilmiş) indir",
];

export const ANDROID_GUIDE = [
  "Açılan sayfada Tercih Edilen Motor: Google Metin-Konuşma",
  "Dişli simgesi → İngilizce + Türkçe ses verilerini indir",
  "Uygulamaya dönüp aşağıdaki Tekrar Dene'ye bas",
];

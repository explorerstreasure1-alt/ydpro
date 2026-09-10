export interface LangDef {
  code: string;
  name: string;
  flag: string;
  tts: string;
  spoken: string;
}

export const LANGS: LangDef[] = [
  { code: "en", name: "İngilizce", flag: "🇬🇧", tts: "en-GB", spoken: "English" },
  { code: "de", name: "Almanca", flag: "🇩🇪", tts: "de-DE", spoken: "German" },
  { code: "fr", name: "Fransızca", flag: "🇫🇷", tts: "fr-FR", spoken: "French" },
  { code: "es", name: "İspanyolca", flag: "🇪🇸", tts: "es-ES", spoken: "Spanish" },
  { code: "it", name: "İtalyanca", flag: "🇮🇹", tts: "it-IT", spoken: "Italian" },
  { code: "ru", name: "Rusça", flag: "🇷🇺", tts: "ru-RU", spoken: "Russian" },
  { code: "zh", name: "Çince", flag: "🇨🇳", tts: "zh-CN", spoken: "Chinese" },
  { code: "ja", name: "Japonca", flag: "🇯🇵", tts: "ja-JP", spoken: "Japanese" },
  { code: "pt", name: "Portekizce", flag: "🇵🇹", tts: "pt-PT", spoken: "Portuguese" },
  { code: "ar", name: "Arapça", flag: "🇸🇦", tts: "ar-SA", spoken: "Arabic" },
  { code: "ko", name: "Korece", flag: "🇰🇷", tts: "ko-KR", spoken: "Korean" },
  { code: "nl", name: "Felemenkçe", flag: "🇳🇱", tts: "nl-NL", spoken: "Dutch" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷", tts: "tr-TR", spoken: "Turkish" },
  { code: "pl", name: "Lehçe", flag: "🇵🇱", tts: "pl-PL", spoken: "Polish" },
];

export const CEFR = [
  { level: "A1", title: "Başlangıç", desc: "En temel cümleler", words: "500", grammar: "to be, a/an, this/that", hours: "0–40s", color: "emerald", canDo: "Kendini tanıt, selamlaş, sayı, basit sorular" },
  { level: "A2", title: "Temel", desc: "Günlük basit diyaloglar", words: "1.100", grammar: "past simple, there is/are, want/need", hours: "40–90s", color: "cyan", canDo: "Alışveriş, otel, restoran, yol tarifi" },
  { level: "B1", title: "Orta", desc: "Detay ekle, bağlaçlı cümle", words: "2.200", grammar: "present perfect, if/when, should", hours: "90–180s", color: "amber", canDo: "Seyahat planı, iş görüşmesi, fikir belirt" },
  { level: "B2", title: "İleri", desc: "Akıcı, görüş belirt, tartış", words: "3.500", grammar: "conditionals, passive, reported speech", hours: "180–300s", color: "violet", canDo: "Tartış, ikna et, sunum yap" },
  { level: "C1", title: "Uzman", desc: "Zengin, doğal ve nüanslı", words: "5.000+", grammar: "idioms, nuance, humor", hours: "300–500s", color: "rose", canDo: "Müzakere, şaka, kültürel nüans" },
  { level: "C2", title: "Usta", desc: "Anadil düzeyinde akıcılık", words: "8.000+", grammar: "mastery, style, rhetoric", hours: "500s+", color: "fuchsia", canDo: "Her konuda anadil gibi tartış, üslup kur" },
];

// Kullanıcı XP seviyesini CEFR'a eşle — kapsamlı (A1–C2)
export function cefrForXp(xp: number): typeof CEFR[number] {
  if (xp < 240) return CEFR[0]; // A1
  if (xp < 700) return CEFR[1]; // A2
  if (xp < 1500) return CEFR[2]; // B1
  if (xp < 2600) return CEFR[3]; // B2
  if (xp < 4200) return CEFR[4]; // C1
  return CEFR[5]; // C2
}
export function cefrForLevel(level: number): typeof CEFR[number] {
  if (level <= 1) return CEFR[0];
  if (level === 2) return CEFR[1];
  if (level === 3) return CEFR[2];
  if (level === 4) return CEFR[3];
  if (level === 5) return CEFR[4];
  return CEFR[5];
}

/** Seviyeye göre TTS hızı — A1-A2 yavaş, B normal, C akıcı (spec Adım 3) */
export function ttsRateForLevel(level: string): number {
  if (level === "A1" || level === "A2") return 0.9;
  if (level === "B1") return 1.0;
  if (level === "B2") return 1.05;
  return 1.12; // C1, C2
}

export interface TopicDef {
  key: string;
  name: string;
  emoji: string;
  cefr: string; // hangi seviyede yoğun
  desc: string;
}

export const TOPICS: TopicDef[] = [
  { key: "travel", name: "Seyahat", emoji: "✈️", cefr: "A1", desc: "Nerelisin, nereye gidiyorsun" },
  { key: "airport", name: "Havaalanı", emoji: "🛂", cefr: "A1", desc: "Pasaport, bilet, kapı sor" },
  { key: "hotel", name: "Otel", emoji: "🏨", cefr: "A1", desc: "Rezervasyon, oda, anahtar" },
  { key: "restaurant", name: "Restoran", emoji: "🍽️", cefr: "A2", desc: "Menü, sipariş, hesap" },
  { key: "shopping", name: "Alışveriş", emoji: "🛍️", cefr: "A2", desc: "Fiyat, beden, satın al" },
  { key: "work", name: "İş", emoji: "💼", cefr: "B1", desc: "Toplantı, rapor, deadline" },
  { key: "education", name: "Eğitim", emoji: "🎓", cefr: "B1", desc: "Ders, sınav, açıklama" },
  { key: "health", name: "Sağlık", emoji: "🏥", cefr: "B1", desc: "Doktor, randevu, şikayet" },
  { key: "daily", name: "Günlük hayat", emoji: "🏠", cefr: "A1", desc: "Ev, aile, rutin" },
  { key: "social", name: "Sosyal", emoji: "❤️", cefr: "A2", desc: "Tanış, hobilerden bahset" },
  { key: "transport", name: "Ulaşım", emoji: "🚆", cefr: "A2", desc: "Yol sor, bilet al" },
  { key: "money", name: "Para", emoji: "💷", cefr: "A2", desc: "Para, fiyat, ödeme" },
  { key: "weather", name: "Hava durumu", emoji: "🌦️", cefr: "B1", desc: "Hava, plan yap" },
  { key: "phone", name: "Telefon", emoji: "📞", cefr: "B2", desc: "Telefon, randevu değiştir" },
  { key: "food", name: "Yemek yapım", emoji: "🍳", cefr: "B1", desc: "Tarif, malzeme" },
  { key: "music", name: "Müzik", emoji: "🎵", cefr: "B2", desc: "Zevk, öneri, tartış" },
  { key: "sport", name: "Spor", emoji: "⚽", cefr: "B2", desc: "Maç, performans" },
  { key: "hobbies", name: "Hobiler", emoji: "🎨", cefr: "C1", desc: "Tutku, nüanslı anlat" },
];

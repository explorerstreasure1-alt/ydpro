"use client";
import { LANGS } from "@/lib/levels";

export interface LangSetting {
  code: string;
  enabled: boolean; // öğrenmek istiyor mu
  level: string; // A1-C1
  dailyMinutes: string;
  voiceRate: number; // 0.8 - 1.4
  voicePitch: number;
  autoPlay: boolean;
  showTranslation: boolean;
}

const DEFAULTS: Record<string, LangSetting> = {};
LANGS.forEach(l => {
  DEFAULTS[l.code] = {
    code: l.code,
    enabled: ["en","de","fr","es","tr"].includes(l.code), // varsayılan 5 dil açık
    level: "A1",
    dailyMinutes: "10 dakika",
    voiceRate: 1.06,
    voicePitch: 1.0,
    autoPlay: true,
    showTranslation: true,
  };
});

function loadAll(): Record<string, LangSetting> {
  try {
    const raw = localStorage.getItem("yzed_lang_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      // merge with defaults for new langs
      LANGS.forEach(l => {
        if (!parsed[l.code]) parsed[l.code] = { ...DEFAULTS[l.code] };
        else parsed[l.code] = { ...DEFAULTS[l.code], ...parsed[l.code] };
      });
      return parsed;
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveAll(map: Record<string, LangSetting>) {
  try { localStorage.setItem("yzed_lang_settings", JSON.stringify(map)); } catch {}
}

export function getLangSetting(code: string): LangSetting {
  const all = loadAll();
  return all[code] || DEFAULTS[code];
}

export function setLangSetting(code: string, patch: Partial<LangSetting>) {
  const all = loadAll();
  all[code] = { ...all[code], ...patch };
  saveAll(all);
  // event for UI
  try { window.dispatchEvent(new CustomEvent("lang-settings-changed", { detail: { code } })); } catch {}
}

export function getAllSettings(): Record<string, LangSetting> {
  return loadAll();
}

export function getEnabledLangs(): string[] {
  const all = loadAll();
  return LANGS.filter(l => all[l.code]?.enabled).map(l => l.code);
}

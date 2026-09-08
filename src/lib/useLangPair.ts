"use client";
import { useStore } from "@/lib/store";
import { LANGS } from "@/lib/levels";

export function useLangPair() {
  const store = useStore() as any;
  const nativeLang: string = store.nativeLang || "tr";
  const targetLang: string = store.targetLang || "en";
  const nativeDef = LANGS.find((l) => l.code === nativeLang) || LANGS[12];
  const targetDef = LANGS.find((l) => l.code === targetLang) || LANGS[0];
  const setNativeLang = store.setNativeLang as (c: string) => void;
  const setTargetLang = store.setTargetLang as (c: string) => void;
  const targetTts = targetDef.tts;
  const nativeTts = nativeDef.tts;
  return { nativeLang, targetLang, nativeDef, targetDef, setNativeLang, setTargetLang, targetTts, nativeTts };
}

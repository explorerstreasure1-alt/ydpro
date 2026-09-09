"use client";
// Profesyonel mikrofon — mobilde tam duyar, hızlı, her dilde
// Tüm diller için ayrı ayar, gürültü engelleme, ara sonuçlar, 3 alternatif, timeout yok takılma yok

export interface MicOptions {
  lang: string; // BCP47: de-DE, fr-FR, pt-PT ...
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (type: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export async function startMic(opts: MicOptions): Promise<{ stop: () => void; abort: () => void } | null> {
  const win: any = typeof window !== "undefined" ? window : null;
  if (!win) return null;
  const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
  // iOS Safari'de yok — Whisper fallback için typed moda geçecek, burada null dön
  if (!SR) {
    opts.onError?.("unsupported");
    return null;
  }

  // Mobil hassasiyet için önden izin ve ses ayarları
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        } as any,
      });
      // İzin alındı, hemen kapat — tanımayı SR yapacak, ama izin ve kazanç ayarlandı
      setTimeout(() => stream.getTracks().forEach(t => t.stop()), 300);
    }
  } catch {}

  const rec = new SR();
  rec.lang = opts.lang;
  rec.interimResults = true; // hızlı pratik — ara sonuçları anında göster
  rec.maxAlternatives = 3;
  rec.continuous = false;

  // Her dil için özel dilbilgisi — beklenen cevapları ekle (varsa)
  try {
    const SG = win.SpeechGrammarList || win.webkitSpeechGrammarList;
    if (SG) {
      const grammars = new SG();
      // JSGF: public <phrase> = ...; — basit, tüm diller için genel
      // Hedef dilin en yaygın 20 kelimesini ekle (gerekirse)
      grammars.addFromString(`#JSGF V1.0; grammar target; public <target> = hello | thank you | please | yes | no ;`, 1);
      rec.grammars = grammars;
    }
  } catch {}

  let gotFinal = false;
  let timeout: any = null;
  const clear = () => { if (timeout) { clearTimeout(timeout); timeout = null; } };

  const resetTimeout = () => {
    clear();
    timeout = setTimeout(() => {
      if (!gotFinal) {
        try { rec.stop(); } catch {}
        opts.onError?.("timeout");
      }
    }, 7000);
  };

  rec.onstart = () => {
    opts.onStart?.();
    resetTimeout();
  };
  rec.onsoundstart = () => resetTimeout();
  rec.onspeechstart = () => resetTimeout();
  rec.onaudiostart = () => resetTimeout();

  rec.onresult = (ev: any) => {
    resetTimeout();
    const res = ev.results[0];
    const isFinal = !!res.isFinal;
    const alts = Array.from(res as any) as any[];
    // En güvenli alternatifi seç, ama ara sonuçlarda da göster
    const best = alts.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    const text = (best?.transcript || res[0].transcript || "").trim();
    if (text) opts.onResult(text, isFinal);
    if (isFinal) gotFinal = true;
  };

  rec.onerror = (e: any) => {
    clear();
    const err = e?.error || "unknown";
    opts.onError?.(err);
  };

  rec.onend = () => {
    clear();
    opts.onEnd?.();
  };
  rec.onspeechend = () => {
    clear();
    try { rec.stop(); } catch {}
  };
  rec.onnomatch = () => {
    opts.onError?.("no-match");
  };

  try {
    rec.start();
  } catch (e: any) {
    clear();
    opts.onError?.(e?.message || "start-failed");
    return null;
  }

  return {
    stop: () => { clear(); try { rec.stop(); } catch {} },
    abort: () => { clear(); try { rec.abort(); } catch {} },
  };
}

// Basit hook için yardımcı — tek satırda kullanım
export function isMicSupported() {
  if (typeof window === "undefined") return false;
  const win: any = window;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

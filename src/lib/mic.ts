"use client";
// Profesyonel mikrofon — mobilde tam duyar, hızlı, her dilde, Whisper yedekli
// Tüm diller için ayrı ayar, gürültü engelleme, ara sonuçlar, 3 alternatif, timeout yok takılma yok

export interface MicOptions {
  lang: string; // BCP47: de-DE, fr-FR, pt-PT ...
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (type: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

let whisperSupported: boolean | null = null;

async function transcribeWithWhisper(blob: Blob, lang: string): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    fd.append("lang", lang);
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = await r.json();
    if (j?.text && String(j.text).trim().length > 1) return String(j.text).trim();
    return null;
  } catch { return null; }
}

export async function startMic(opts: MicOptions): Promise<{ stop: () => void; abort: () => void } | null> {
  const win: any = typeof window !== "undefined" ? window : null;
  if (!win) return null;
  const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
  // iOS Safari'de SR yok — direkt Whisper için null dön, caller typed'a düşer ama biz yine de MediaRecorder ile deneriz
  const hasSR = !!SR;
  if (!hasSR) {
    // Whisper için de stream gerekir, ama SR yoksa direkt hata dön, typed moda geç
    // Not: Whisper için ayrıca MediaRecorder gerekir, onu aşağıda deneriz ama SR yoksa da Whisper denenebilir
    // Şimdilik typed'a düşsün
    opts.onError?.("unsupported");
    // Whisper fallback için MediaRecorder denenecek ama SR olmadığı için burada da dene
  }

  // Mobil hassasiyet — getUserMedia ve MediaRecorder ile Whisper kaydı (yedek)
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let useWhisperFallback = false;

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        } as any,
      });
      // Whisper için kayıt — SR ile paralel
      try {
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mime } as any);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.start(100);
      } catch {}
      // SR için izin ve kazanç ayarlandı, hemen kapatma — Whisper kaydı için stream açık kalsın, SR bitince kapatacağız
      // Eski: setTimeout(() => stream.getTracks().forEach(t => t.stop()), 300);
    }
  } catch {}

  if (!hasSR) {
    // SR yoksa sadece Whisper ile dene (ör: iOS)
    if (!mediaRecorder) {
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
      opts.onError?.("unsupported");
      return null;
    }
    // Whisper modunda SR yok, direkt kayıt ve transcribe
    opts.onStart?.();
    // Whisper kaydı SR olmadan da çalışır
  }

  const rec: any = hasSR ? new SR() : null;
  if (rec) {
    rec.lang = opts.lang;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
  }

  try {
    const SG = (win as any).SpeechGrammarList || (win as any).webkitSpeechGrammarList;
    if (SG && rec) {
      const grammars = new SG();
      grammars.addFromString(`#JSGF V1.0; grammar target; public <target> = hello | thank you | please | yes | no ;`, 1);
      rec.grammars = grammars;
    }
  } catch {}

  let gotFinal = false;
  let timeout: any = null;
  let whisperDone = false;
  const clear = () => { if (timeout) { clearTimeout(timeout); timeout = null; } };
  const stopMedia = () => {
    try { mediaRecorder?.stop(); } catch {}
    try { mediaStream?.getTracks().forEach((t: any) => t.stop()); } catch {}
  };

  const doWhisperFallback = async (isFinal: boolean, srText: string) => {
    if (whisperDone) return;
    // Whisper: SR boş veya düşük güvenliyse, kayıtlı sesi Groq ile dene
    const needsWhisper = !srText || srText.trim().length < 2 || (srText.length < 4 && !isFinal);
    if (!needsWhisper || !mediaRecorder || audioChunks.length === 0) return;
    try {
      const blobType = mediaRecorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunks as any, { type: blobType });
      if (blob.size < 800) return; // çok kısa, anlamsız
      const whisperText = await transcribeWithWhisper(blob, opts.lang);
      if (whisperText && whisperText.trim().length > 1) {
        whisperDone = true;
        // Whisper daha doğruysa onu kullan
        if (!srText || whisperText.length > srText.length * 0.8) {
          opts.onResult(whisperText, true);
          gotFinal = true;
        }
      }
    } catch {}
  };

  const resetTimeout = () => {
    clear();
    timeout = setTimeout(() => {
      if (!gotFinal) {
        try { rec?.stop(); } catch {}
        try { mediaRecorder?.stop(); } catch {}
        // Whisper fallback dene
        doWhisperFallback(false, "");
      }
    }, 7000);
  };

  if (rec) {
    rec.onstart = () => { opts.onStart?.(); resetTimeout(); };
    rec.onsoundstart = () => resetTimeout();
    rec.onspeechstart = () => resetTimeout();
    rec.onaudiostart = () => resetTimeout();
    rec.onresult = (ev: any) => {
      resetTimeout();
      const res = ev.results[0];
      const isFinal = !!res.isFinal;
      const alts = Array.from(res as any) as any[];
      const best = alts.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
      const text = (best?.transcript || res[0].transcript || "").trim();
      const lowConf = (best?.confidence || 0) < 0.6;
      if (text) opts.onResult(text, isFinal);
      if (isFinal) {
        gotFinal = true;
        // Düşük güvenliyse Whisper ile teyit et
        if (lowConf && text) doWhisperFallback(true, text);
        if (mediaRecorder && mediaRecorder.state !== "inactive") { try { mediaRecorder.stop(); } catch {} }
      }
    };
    rec.onerror = (e: any) => {
      clear();
      const err = e?.error || "unknown";
      // no-speech veya network hatasında Whisper dene
      if (err === "no-speech" || err === "audio-capture" || err === "network") {
        doWhisperFallback(false, "");
      }
      opts.onError?.(err);
    };
    rec.onend = () => {
      clear();
      // SR bitti, Whisper kaydını da bitir ve dene
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try { mediaRecorder.stop(); } catch {}
        setTimeout(() => { if (!gotFinal) doWhisperFallback(true, ""); }, 400);
      }
      opts.onEnd?.();
      stopMedia();
    };
    rec.onspeechend = () => { clear(); try { rec.stop(); } catch {} };
    rec.onnomatch = () => { doWhisperFallback(false, ""); opts.onError?.("no-match"); };
  } else {
    // SR yok (iOS) — direkt Whisper
    opts.onStart?.();
    resetTimeout();
    // Whisper için mediaRecorder zaten başlatıldı, bitişi bekle
    if (mediaRecorder) {
      mediaRecorder.onstop = async () => {
        clear();
        const blobType = (mediaRecorder as any).mimeType || "audio/webm";
        const blob = new Blob(audioChunks as any, { type: blobType });
        const txt = await transcribeWithWhisper(blob, opts.lang);
        if (txt) { opts.onResult(txt, true); gotFinal = true; }
        else opts.onError?.("no-match");
        opts.onEnd?.();
        stopMedia();
      };
      // iOS için 4sn sonra otomatik durdur ve gönder
      setTimeout(() => { if (mediaRecorder && mediaRecorder.state === "recording") { try { mediaRecorder.stop(); } catch {} } }, 4000);
    }
  }

  // MediaRecorder Whisper için her durumda dinle
  if (mediaRecorder && hasSR) {
    mediaRecorder.onstop = async () => {
      if (gotFinal) { stopMedia(); return; }
      // SR final gelmediyse Whisper dene
      await doWhisperFallback(true, "");
      stopMedia();
    };
  }

  if (rec) {
    try { rec.start(); } catch (e: any) { clear(); opts.onError?.(e?.message || "start-failed"); stopMedia(); return null; }
  } else if (mediaRecorder && mediaRecorder.state === "inactive") {
    try { mediaRecorder.start(100); } catch {}
  }

  return {
    stop: () => {
      clear();
      try { rec?.stop(); } catch {}
      try { mediaRecorder?.stop(); } catch {}
      stopMedia();
    },
    abort: () => {
      clear();
      try { rec?.abort?.(); } catch {}
      try { mediaRecorder?.stop(); } catch {}
      stopMedia();
    },
  };
}

// Basit hook — SR + Whisper (MediaRecorder) varsa destek var
export function isMicSupported() {
  if (typeof window === "undefined") return false;
  const win: any = window;
  const hasSR = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  const hasMR = !!(win.MediaRecorder && navigator.mediaDevices?.getUserMedia);
  return hasSR || hasMR;
}

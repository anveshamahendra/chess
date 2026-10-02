// Lightweight sound-effect manager. Uses the Web Audio API directly rather
// than shipping audio files, so it works with zero assets. Wire real sample
// files in /public/sounds/*.mp3 later if you want a richer sound set —
// just swap playTone() calls for an <audio> element per sound name.

type SoundName = "move" | "capture" | "check" | "gameEnd" | "notify";

const STORAGE_KEY = "chess-sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

const FREQUENCIES: Record<SoundName, number[]> = {
  move: [420],
  capture: [300, 220],
  check: [660, 880],
  gameEnd: [523, 392, 261],
  notify: [500],
};

export function playSound(name: SoundName) {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;

  const freqs = FREQUENCIES[name];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    const start = ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

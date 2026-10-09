import { defineCue, SOUND_CUES } from "./cues";
import type { SoundCue, SoundOptions, Tone } from "./cues";

// One shared, gesture-created context keeps effects immediate and offline.
// Never queue an effect: a rejected/autoplay-blocked sound is simply dropped.
const MAX_VOICES = 12;
const MASTER_GAIN = 0.55;
const MIN_GAIN = 0.0001;

type Voice = {
  oscillator: OscillatorNode;
  gain: GainNode;
  priority: number;
  endsAt: number;
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.65;
let active = true;
const voices = new Set<Voice>();
const lastPlayed = new Map<SoundCue, number>();

const clampVolume = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
const audible = () => enabled && active && volume > 0;

function syncMaster() {
  if (!context || !master) return;
  try {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(audible() ? volume * MASTER_GAIN : 0, context.currentTime);
  } catch { /* a closed or interrupted context must never break a setting */ }
}

function disposeVoice(voice: Voice) {
  voices.delete(voice);
  voice.oscillator.onended = null;
  // Disconnect as well as stop: even a scheduled voice becomes silent now.
  try { voice.gain.disconnect(); } catch { /* already disconnected */ }
  try { voice.oscillator.disconnect(); } catch { /* already disconnected */ }
  try { voice.oscillator.stop(); } catch { /* already stopped */ }
}

export function stopAudio(): void {
  for (const voice of [...voices]) disposeVoice(voice);
  lastPlayed.clear();
}

export function configureAudio(settings: { enabled: boolean; volume: number }): void {
  enabled = settings.enabled;
  volume = clampVolume(settings.volume, volume);
  if (!audible()) stopAudio();
  syncMaster();
}

export function setAudioActive(nextActive: boolean): void {
  active = nextActive;
  if (!active) {
    stopAudio();
    // A return to the app never resumes sound or replays an old event.
    try { void context?.suspend().catch(() => undefined); } catch { /* audio unavailable */ }
  }
  syncMaster();
}

// Called synchronously from pointerdown/keydown (including touch on iOS).
// React effects and promise callbacks must never create/resume the context.
export function unlockAudio(): void {
  if (!audible() || typeof window === "undefined") return;
  try {
    if (!context || context.state === "closed") {
      const AudioContextConstructor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const nextContext = new AudioContextConstructor();
      const nextMaster = nextContext.createGain();
      const compressor = nextContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, nextContext.currentTime);
      compressor.knee.setValueAtTime(12, nextContext.currentTime);
      compressor.ratio.setValueAtTime(4, nextContext.currentTime);
      compressor.attack.setValueAtTime(0.006, nextContext.currentTime);
      compressor.release.setValueAtTime(0.12, nextContext.currentTime);
      nextMaster.connect(compressor);
      compressor.connect(nextContext.destination);
      context = nextContext;
      master = nextMaster;
      syncMaster();
    }
    if (context.state !== "running") void context.resume().catch(() => undefined);
  } catch {
    // Web Audio is optional. Gameplay stays responsive without it.
  }
}

function startTone(tone: Tone, priority: number, cueVolume: number) {
  if (!context || !master) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + tone.start;
  const endsAt = startsAt + tone.duration;
  const attack = Math.min(0.006, tone.duration / 4);
  oscillator.type = tone.type ?? "sine";
  oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
  if (tone.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, endsAt);
  }
  gain.gain.setValueAtTime(MIN_GAIN, startsAt);
  gain.gain.linearRampToValueAtTime(Math.max(MIN_GAIN, tone.gain * cueVolume), startsAt + attack);
  gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endsAt);
  oscillator.connect(gain);
  gain.connect(master);
  const voice: Voice = { oscillator, gain, priority, endsAt };
  voices.add(voice);
  oscillator.onended = () => disposeVoice(voice);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.01);
}

export function playSound(cue: SoundCue, options: SoundOptions = {}): void {
  if (!audible() || !context || context.state !== "running") return;
  const cueVolume = clampVolume(options.volume ?? 1, 1);
  if (cueVolume === 0) return;
  try {
    const definition = defineCue(cue, options);
    const now = performance.now();
    const previous = lastPlayed.get(cue);
    if (previous !== undefined && now - previous < definition.cooldownMs) return;

    // Prune missed onended callbacks before comparing phrase priorities.
    for (const voice of [...voices]) {
      if (voice.endsAt <= context.currentTime) disposeVoice(voice);
    }
    if ([...voices].some((voice) => voice.priority > definition.priority)) return;
    for (const voice of [...voices]) {
      if (voice.priority < definition.priority) disposeVoice(voice);
    }
    const tones = definition.tones.slice(0, MAX_VOICES);
    // A quick succession may overlap, but never grow the oscillator count.
    while (voices.size + tones.length > MAX_VOICES) {
      const oldest = voices.values().next().value as Voice | undefined;
      if (!oldest) break;
      disposeVoice(oldest);
    }
    lastPlayed.set(cue, now);
    for (const tone of tones) startTone(tone, definition.priority, cueVolume);
  } catch {
    // Some native/web views reject nodes during audio interruptions.
    stopAudio();
  }
}

const legacyCues = new Map<string, SoundCue>([
  ["countdown.mp3", "countdown"],
  ["start.wav", "start"],
  ["hitGold.wav", "golden"],
  ["pop.mp3", "found"],
  ["popMetal.wav", "miss"],
  ["punchWin.wav", "reward"],
  ["click.mp3", "tap"],
  ["gg.wav", "record"],
  ["score.wav", "finish"],
]);

export function playLegacySound(src: string, cueVolume?: number): void {
  const cue = SOUND_CUES.includes(src as SoundCue)
    ? src as SoundCue
    : legacyCues.get(src.split("/").pop() ?? "");
  if (cue) playSound(cue, { volume: cueVolume });
}

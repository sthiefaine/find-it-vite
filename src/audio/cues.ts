export const SOUND_CUES = [
  "tap",
  "countdown",
  "start",
  "found",
  "golden",
  "miss",
  "combo",
  "reward",
  "step",
  "world",
  "reveal",
  "record",
  "finish",
  "win",
  "lose",
  "draw",
  "warning",
] as const;

export type SoundCue = (typeof SOUND_CUES)[number];

export type SoundOptions = {
  intensity?: number;
  stars?: number;
  /** Applied once by the player's master gain, never to individual notes. */
  volume?: number;
};

export type Tone = {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
  endFrequency?: number;
  type?: OscillatorType;
};

export type CueDefinition = {
  tones: readonly Tone[];
  priority: number;
  cooldownMs: number;
};

const pitch = {
  F3: 174.61,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  A4: 440,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  G6: 1567.98,
} as const;

function bounded(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  gain: number,
  type: "sine" | "triangle" = "sine",
  endFrequency?: number,
): Tone {
  return { frequency, start, duration, gain, type, ...(endFrequency === undefined ? {} : { endFrequency }) };
}

function notes(frequencies: readonly number[], gap: number, duration: number, gain: number): Tone[] {
  return frequencies.map((frequency, index) => tone(frequency, index * gap, duration, gain));
}

/** Seconds and nominal gains; the player supplies soft attack/release envelopes. */
export function defineCue(cue: SoundCue, options: SoundOptions = {}): CueDefinition {
  const intensity = bounded(options.intensity, 0, 1, 0);
  const lift = 2 ** ((intensity * 3) / 12);

  switch (cue) {
    case "tap":
      return {
        tones: [tone(pitch.C5, 0, 0.07, 0.045, "sine", pitch.E5)],
        priority: 0,
        cooldownMs: 45,
      };
    case "countdown":
      return {
        tones: [tone(pitch.A4, 0, 0.11, 0.055, "triangle"), tone(pitch.A5, 0.005, 0.06, 0.018)],
        priority: 0,
        cooldownMs: 500,
      };
    case "start":
      return {
        tones: notes([pitch.C5, pitch.E5, pitch.G5], 0.08, 0.13, 0.065),
        priority: 0,
        cooldownMs: 600,
      };
    case "found":
      return {
        tones: [
          tone(pitch.E5 * lift, 0, 0.1, 0.066 + intensity * 0.028, "sine", pitch.G5 * lift),
          tone(pitch.C6 * lift, 0.055, 0.1, 0.04),
        ],
        priority: 1,
        cooldownMs: 55,
      };
    case "golden":
      return {
        tones: [
          tone(pitch.G5, 0, 0.09, 0.072, "sine", pitch.C6),
          tone(pitch.E6, 0.05, 0.1, 0.034),
          tone(pitch.C6, 0.12, 0.075, 0.023),
        ],
        priority: 1,
        cooldownMs: 55,
      };
    case "miss":
      return {
        tones: [tone(pitch.A3, 0, 0.145, 0.068, "triangle", pitch.F3)],
        priority: 1,
        cooldownMs: 180,
      };
    case "combo":
      return {
        tones: [
          tone(pitch.C5, 0, 0.2, 0.028, "triangle"),
          ...notes([pitch.G5 * lift, pitch.C6 * lift, pitch.E6 * lift], 0.07, 0.14, 0.055),
        ],
        priority: 2,
        cooldownMs: 280,
      };
    case "reward": {
      const doubleBonus = bounded(options.stars, 0, 10, 0) > 5;
      return {
        tones: [
          tone(pitch.C4, 0, 0.3, 0.025, "triangle"),
          ...notes([pitch.C5, pitch.E5, pitch.G5], 0.1, 0.18, 0.055),
          tone(pitch.E6, 0.34, 0.22, 0.035),
          ...(doubleBonus ? [tone(pitch.C6, 0.44, 0.18, 0.024), tone(pitch.G6, 0.49, 0.2, 0.022)] : []),
        ],
        priority: 3,
        cooldownMs: 1000,
      };
    }
    case "step": {
      const stars = Math.round(bounded(options.stars, 1, 3, 1));
      const starPitches = [pitch.G5, pitch.E6, pitch.G6].slice(0, stars);
      return {
        tones: [
          tone(pitch.C5, 0, 0.16, 0.055, "triangle"),
          ...starPitches.map((frequency, index) => tone(frequency, 0.11 + index * 0.14, 0.2, 0.045 - index * 0.008)),
        ],
        priority: 3,
        cooldownMs: 1000,
      };
    }
    case "world":
      return {
        tones: [
          tone(pitch.F3, 0, 0.45, 0.025, "triangle"),
          ...notes([pitch.F4, pitch.A4, pitch.C5], 0.14, 0.2, 0.055),
          tone(pitch.F5, 0.42, 0.25, 0.055),
        ],
        priority: 4,
        cooldownMs: 1400,
      };
    case "reveal":
      return {
        tones: [
          tone(pitch.F4, 0, 0.3, 0.028, "triangle"),
          ...notes([pitch.D5, pitch.A5, pitch.C6], 0.08, 0.16, 0.048),
          tone(pitch.E6, 0.26, 0.24, 0.034),
        ],
        priority: 3,
        cooldownMs: 900,
      };
    case "record":
      return {
        tones: [
          tone(pitch.C4, 0, 0.35, 0.03, "triangle"),
          tone(pitch.C5, 0, 0.16, 0.06),
          tone(pitch.G5, 0.09, 0.17, 0.06),
          tone(pitch.C6, 0.19, 0.2, 0.05),
          tone(pitch.E6, 0.31, 0.2, 0.04),
          tone(pitch.G6, 0.43, 0.22, 0.029),
        ],
        priority: 4,
        cooldownMs: 1800,
      };
    case "finish":
      return {
        tones: notes([pitch.G4, pitch.C5, pitch.E5], 0.12, 0.21, 0.055),
        priority: 3,
        cooldownMs: 1100,
      };
    case "win":
      return {
        tones: [
          tone(pitch.C4, 0, 0.35, 0.025, "triangle"),
          tone(pitch.E4, 0.12, 0.3, 0.02, "triangle"),
          ...notes([pitch.C5, pitch.E5, pitch.G5], 0.09, 0.16, 0.06),
          tone(pitch.C6, 0.3, 0.2, 0.05),
          tone(pitch.E6, 0.42, 0.2, 0.035),
          tone(pitch.C6, 0.56, 0.24, 0.045),
        ],
        priority: 4,
        cooldownMs: 1300,
      };
    case "lose":
      return {
        tones: [
          tone(pitch.A4, 0, 0.2, 0.055, "triangle"),
          tone(pitch.F4, 0.14, 0.22, 0.055, "triangle"),
          tone(pitch.D4, 0.3, 0.28, 0.045, "triangle"),
        ],
        priority: 4,
        cooldownMs: 1300,
      };
    case "draw":
      return {
        tones: [tone(pitch.D5, 0, 0.16, 0.05), tone(pitch.G4, 0.12, 0.2, 0.05), tone(pitch.C5, 0.27, 0.21, 0.05)],
        priority: 4,
        cooldownMs: 1300,
      };
    case "warning":
      return {
        tones: [
          tone(pitch.E4, 0, 0.08, 0.055, "triangle", pitch.D4),
          tone(pitch.E4, 0.16, 0.08, 0.045, "triangle", pitch.D4),
        ],
        priority: 2,
        cooldownMs: 1600,
      };
  }
}

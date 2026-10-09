import { describe, expect, it } from "vitest";
import { defineCue, SOUND_CUES, type CueDefinition } from "../cues";

const length = (definition: CueDefinition) => Math.max(...definition.tones.map((tone) => tone.start + tone.duration));

describe("sound cue vocabulary", () => {
  it("keeps each event recognisable with its own musical phrase", () => {
    const signatures = SOUND_CUES.map((cue) => JSON.stringify(defineCue(cue).tones));
    expect(new Set(signatures).size).toBe(SOUND_CUES.length);
    expect(new Set(SOUND_CUES).size).toBe(SOUND_CUES.length);
  });

  it.each(SOUND_CUES)("keeps %s soft, brief and within the player's voice budget", (cue) => {
    for (const options of [{}, { intensity: 1, stars: 3 }, { intensity: -100, stars: -100 }, { intensity: 100, stars: 100 }]) {
      const definition = defineCue(cue, options);
      expect(definition.tones.length).toBeGreaterThan(0);
      expect(definition.tones.length).toBeLessThanOrEqual(12);
      expect(length(definition)).toBeLessThan(1.3);
      expect(Number.isInteger(definition.priority)).toBe(true);
      expect(definition.priority).toBeGreaterThanOrEqual(0);
      expect(definition.priority).toBeLessThanOrEqual(4);
      expect(definition.cooldownMs).toBeGreaterThanOrEqual(35);
      expect(definition.cooldownMs).toBeLessThanOrEqual(2500);

      for (const tone of definition.tones) {
        expect(Number.isFinite(tone.frequency)).toBe(true);
        expect(tone.frequency).toBeGreaterThanOrEqual(150);
        expect(tone.frequency).toBeLessThanOrEqual(1800);
        expect(tone.start).toBeGreaterThanOrEqual(0);
        expect(tone.duration).toBeGreaterThan(0);
        expect(tone.duration).toBeLessThanOrEqual(0.45);
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(0.2);
        expect(["sine", "triangle"]).toContain(tone.type);
        if (tone.endFrequency !== undefined) {
          expect(Number.isFinite(tone.endFrequency)).toBe(true);
          expect(tone.endFrequency).toBeGreaterThanOrEqual(150);
          expect(tone.endFrequency).toBeLessThanOrEqual(1800);
        }
      }

      // Include overlapping notes: individual quiet gains alone do not bound a chord.
      for (const start of definition.tones.map((tone) => tone.start)) {
        const peakGain = definition.tones
          .filter((tone) => tone.start <= start && tone.start + tone.duration > start)
          .reduce((gain, tone) => gain + tone.gain, 0);
        expect(peakGain).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it.each(["tap", "found", "golden", "miss"] as const)("makes frequent %s feedback shorter than a quarter second", (cue) => {
    expect(length(defineCue(cue, { intensity: 1 }))).toBeLessThan(0.25);
  });

  it("lifts successful captures as intensity grows, with safe endpoints", () => {
    const ordinary = defineCue("found", { intensity: 0 });
    const intense = defineCue("found", { intensity: 1 });
    expect(intense.tones[0].frequency).toBeGreaterThan(ordinary.tones[0].frequency);
    expect(intense.tones[0].gain).toBeGreaterThan(ordinary.tones[0].gain);
    expect(ordinary.tones[0].endFrequency).toBeGreaterThan(ordinary.tones[0].frequency);
    expect(defineCue("found", { intensity: -10 })).toEqual(ordinary);
    expect(defineCue("found", { intensity: 10 })).toEqual(intense);
    expect(defineCue("found", { intensity: Number.NEGATIVE_INFINITY })).toEqual(ordinary);
    expect(defineCue("found", { intensity: Number.POSITIVE_INFINITY })).toEqual(intense);
    expect(defineCue("found", { intensity: Number.NaN })).toEqual(defineCue("found"));
  });

  it("adds one audible sparkle per earned star and bounds unexpected ratings", () => {
    const one = defineCue("step", { stars: 1 });
    const two = defineCue("step", { stars: 2 });
    const three = defineCue("step", { stars: 3 });
    expect(two.tones.length).toBe(one.tones.length + 1);
    expect(three.tones.length).toBe(two.tones.length + 1);
    expect(length(three)).toBeGreaterThan(length(two));
    expect(defineCue("step", { stars: -10 })).toEqual(one);
    expect(defineCue("step", { stars: 10 })).toEqual(three);
    expect(defineCue("step", { stars: 2.6 })).toEqual(three);
    expect(defineCue("step", { stars: Number.NaN })).toEqual(one);
  });

  it("keeps a miss descending and celebrations more important than routine input", () => {
    const miss = defineCue("miss");
    expect(miss.tones[0].endFrequency).toBeLessThan(miss.tones[0].frequency);
    expect(defineCue("combo").priority).toBeGreaterThan(defineCue("found").priority);
    expect(defineCue("record").priority).toBeGreaterThan(defineCue("combo").priority);
    expect(defineCue("record").cooldownMs).toBeGreaterThan(defineCue("found").cooldownMs);
  });

  it("lets captures interrupt the countdown and start while golden hits remain frequent feedback", () => {
    for (const cue of ["countdown", "start"] as const) {
      expect(defineCue(cue).priority).toBeLessThan(defineCue("found").priority);
      expect(defineCue(cue).priority).toBeLessThan(defineCue("miss").priority);
    }
    expect(defineCue("golden").priority).toBe(defineCue("found").priority);
    expect(defineCue("golden").cooldownMs).toBe(55);
  });

  it("gives a double bonus extra quiet sparkles while preserving the reward phrase", () => {
    const ordinary = defineCue("reward", { stars: 5 });
    const double = defineCue("reward", { stars: 10 });
    expect(double.tones.length).toBe(ordinary.tones.length + 2);
    expect(double.tones.slice(0, ordinary.tones.length)).toEqual(ordinary.tones);
    expect(length(double)).toBeGreaterThan(length(ordinary));
    expect(double.priority).toBe(ordinary.priority);
    expect(defineCue("reward", { stars: 6 })).toEqual(double);
    expect(defineCue("reward", { stars: 1000 })).toEqual(double);
    expect(defineCue("reward", { stars: Number.NaN })).toEqual(ordinary);
    expect(length(double)).toBeLessThan(1.3);
  });

  it("leaves user volume to the master gain so it is applied only once", () => {
    for (const cue of SOUND_CUES) {
      expect(defineCue(cue, { volume: 0 })).toEqual(defineCue(cue));
      expect(defineCue(cue, { volume: 1 })).toEqual(defineCue(cue));
    }
  });

  it("returns fresh notes so one scheduled phrase cannot change future feedback", () => {
    const baseline = defineCue("reward");
    const altered = defineCue("reward");
    altered.tones[0].frequency = 1;
    expect(defineCue("reward")).toEqual(baseline);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineCue } from "../cues";

class Parameter {
  value = 0;
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  cancelScheduledValues = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class Gain {
  gain = new Parameter();
  connect = vi.fn();
  disconnect = vi.fn();
}

class Oscillator {
  frequency = new Parameter();
  type = "sine";
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class Context {
  static instances: Context[] = [];
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  gains: Gain[] = [];
  oscillators: Oscillator[] = [];
  compressor = {
    threshold: new Parameter(), knee: new Parameter(), ratio: new Parameter(),
    attack: new Parameter(), release: new Parameter(), connect: vi.fn(),
  };
  createGain = vi.fn(() => {
    const gain = new Gain();
    this.gains.push(gain);
    return gain;
  });
  createOscillator = vi.fn(() => {
    const oscillator = new Oscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  });
  createDynamicsCompressor = vi.fn(() => this.compressor);
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  suspend = vi.fn(() => {
    this.state = "suspended";
    return Promise.resolve();
  });
  constructor() { Context.instances.push(this); }
}

describe("shared sound engine", () => {
  let engine: typeof import("../engine");
  let now: number;

  beforeEach(async () => {
    vi.resetModules();
    Context.instances = [];
    now = 0;
    vi.stubGlobal("window", { AudioContext: Context });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    engine = await import("../engine");
  });
  afterEach(() => {
    engine.stopAudio();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates one context on a gesture and drops every earlier effect", () => {
    engine.playSound("found");
    engine.playLegacySound("./assets/sounds/gg.wav");
    expect(Context.instances).toHaveLength(0);
    engine.unlockAudio();
    engine.unlockAudio();
    expect(Context.instances).toHaveLength(1);
    const context = Context.instances[0];
    expect(context.oscillators).toHaveLength(0);
    engine.playSound("found");
    expect(context.oscillators).toHaveLength(defineCue("found").tones.length);
    expect(context.gains[0].connect).toHaveBeenCalledWith(context.compressor);
    expect(context.compressor.connect).toHaveBeenCalledWith(context.destination);
    expect(context.gains[0].gain.value).toBeGreaterThan(0);
    expect(context.gains[0].gain.value).toBeLessThan(0.5);
  });

  it("cuts all playing and scheduled notes on mute and never replays them", () => {
    engine.unlockAudio();
    engine.playSound("record");
    const context = Context.instances[0];
    const voices = [...context.oscillators];
    engine.configureAudio({ enabled: false, volume: 0.65 });
    expect(context.gains[0].gain.value).toBe(0);
    for (const voice of voices) {
      expect(voice.disconnect).toHaveBeenCalled();
      expect(voice.stop).toHaveBeenLastCalledWith();
    }
    engine.playSound("found");
    engine.configureAudio({ enabled: true, volume: 0.65 });
    expect(context.oscillators).toEqual(voices);
    engine.playSound("tap");
    expect(context.oscillators).toHaveLength(voices.length + 1);
  });

  it("uses zero volume as immediate silence, preserving configured volume on mute", () => {
    engine.unlockAudio();
    const context = Context.instances[0];
    engine.configureAudio({ enabled: true, volume: 0.4 });
    const configuredGain = context.gains[0].gain.value;
    engine.configureAudio({ enabled: false, volume: 0.4 });
    engine.configureAudio({ enabled: true, volume: 0.4 });
    expect(context.gains[0].gain.value).toBe(configuredGain);
    engine.playSound("win");
    const count = context.oscillators.length;
    engine.configureAudio({ enabled: true, volume: 0 });
    engine.playSound("tap");
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.oscillators).toHaveLength(count);
    expect(context.oscillators.every((voice) => voice.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it("backgrounds immediately and waits for a new gesture after returning", () => {
    engine.unlockAudio();
    engine.playSound("world");
    const context = Context.instances[0];
    const count = context.oscillators.length;
    engine.setAudioActive(false);
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.gains[0].gain.value).toBe(0);
    engine.playSound("found");
    engine.setAudioActive(true);
    engine.playSound("found");
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.oscillators).toHaveLength(count);
    engine.unlockAudio();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.oscillators).toHaveLength(count);
    engine.playSound("found");
    expect(context.oscillators.length).toBeGreaterThan(count);
  });

  it("drops events while resume is pending instead of replaying an old sound", async () => {
    engine.unlockAudio();
    const context = Context.instances[0];
    context.state = "suspended";
    let completeResume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => {
      completeResume = () => { context.state = "running"; resolve(); };
    }));
    engine.unlockAudio();
    engine.playSound("record");
    completeResume();
    await Promise.resolve();
    expect(context.oscillators).toHaveLength(0);
    engine.playSound("tap");
    expect(context.oscillators).toHaveLength(1);
  });

  it("preempts taps with rewards and protects the reward from rapid lower-priority effects", () => {
    engine.unlockAudio();
    const context = Context.instances[0];
    engine.playSound("tap");
    const tap = context.oscillators[0];
    engine.playSound("reward");
    expect(tap.disconnect).toHaveBeenCalled();
    const count = context.oscillators.length;
    now += 100;
    engine.playSound("found");
    engine.playSound("tap");
    expect(context.oscillators).toHaveLength(count);
    context.currentTime = 1;
    engine.playSound("found");
    expect(context.oscillators.length).toBeGreaterThan(count);
  });

  it("deduplicates rapid repeat events and keeps simultaneous voices bounded", () => {
    engine.unlockAudio();
    const context = Context.instances[0];
    engine.playSound("found");
    engine.playSound("found");
    expect(context.oscillators).toHaveLength(2);
    for (let index = 0; index < 30; index++) {
      now += 60;
      engine.playSound("found");
      const connected = context.oscillators.filter((voice) => voice.disconnect.mock.calls.length === 0);
      expect(connected.length).toBeLessThanOrEqual(12);
    }
  });

  it("validates legacy IDs, ignores unknown sources and supports individual cue volume", () => {
    engine.unlockAudio();
    const context = Context.instances[0];
    engine.playLegacySound("unknown.wav");
    engine.playLegacySound("./assets/sounds/pop.mp3", 0);
    expect(context.oscillators).toHaveLength(0);
    engine.playLegacySound("./assets/sounds/pop.mp3", 0.5);
    expect(context.oscillators).toHaveLength(2);
    const envelope = context.gains[1].gain.linearRampToValueAtTime;
    expect(envelope.mock.calls[0][0]).toBeCloseTo(defineCue("found").tones[0].gain * 0.5);
    engine.playLegacySound("constructor");
    engine.playLegacySound("toString");
    expect(context.oscillators.every((voice) => voice.disconnect.mock.calls.length === 0)).toBe(true);
  });

  it("tolerates missing APIs and a denied audio resume without throwing", async () => {
    vi.stubGlobal("window", {});
    expect(() => engine.unlockAudio()).not.toThrow();
    vi.stubGlobal("window", { AudioContext: Context });
    engine.unlockAudio();
    const context = Context.instances[0];
    context.state = "suspended";
    context.resume.mockRejectedValue(new Error("Audio interrupted"));
    expect(() => engine.unlockAudio()).not.toThrow();
    await Promise.resolve();
    expect(() => engine.playSound("found")).not.toThrow();
    expect(context.oscillators).toHaveLength(0);
  });
});

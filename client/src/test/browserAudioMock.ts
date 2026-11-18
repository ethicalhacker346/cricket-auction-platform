import { vi } from "vitest";

/** Strict WebAudio stand-ins: envelope methods exist ONLY on AudioParam.
 * Giving these methods to GainNode would hide the original runtime crash. */
class TestAudioParam {
  value = 0;
  private validate(value: number, time: number) {
    if (!Number.isFinite(value) || !Number.isFinite(time) || time < 0) {
      throw new TypeError("Invalid audio automation value/time");
    }
  }
  setValueAtTime = vi.fn((value: number, time: number) => {
    this.validate(value, time);
    this.value = value;
    return this;
  });
  linearRampToValueAtTime = vi.fn((value: number, time: number) => {
    this.validate(value, time);
    this.value = value;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((value: number, time: number) => {
    this.validate(value, time);
    if (value <= 0) throw new RangeError("Exponential ramp must stay positive");
    this.value = value;
    return this;
  });
  setTargetAtTime = vi.fn((value: number, time: number) => {
    this.validate(value, time);
    this.value = value;
    return this;
  });
}

class TestAudioNode {
  gain = new TestAudioParam();
  frequency = new TestAudioParam();
  detune = new TestAudioParam();
  Q = new TestAudioParam();
  threshold = new TestAudioParam();
  knee = new TestAudioParam();
  ratio = new TestAudioParam();
  attack = new TestAudioParam();
  release = new TestAudioParam();
  type = "sine";
  buffer: unknown = null;
  constructor(readonly kind: string) {}
  connect = vi.fn((target: TestAudioNode | TestAudioParam) => {
    if (!target) throw new TypeError("Missing audio connection target");
    return target;
  });
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

export function createBrowserAudioMock() {
  const nodes: TestAudioNode[] = [];
  const state = { failGain: false, failReverb: false };
  const makeNode = (kind: string) => {
    const node = new TestAudioNode(kind);
    nodes.push(node);
    return node;
  };
  class TestAudioContext {
    state = "running";
    currentTime = 1;
    sampleRate = 44100;
    destination = makeNode("destination");
    resume = vi.fn(async () => { this.state = "running"; });
    close = vi.fn(async () => { this.state = "closed"; });
    createGain = vi.fn(() => {
      if (state.failGain) throw new Error("Audio device unavailable");
      return makeNode("gain");
    });
    createOscillator = vi.fn(() => makeNode("oscillator"));
    createBufferSource = vi.fn(() => makeNode("source"));
    createBiquadFilter = vi.fn(() => makeNode("filter"));
    createDynamicsCompressor = vi.fn(() => makeNode("compressor"));
    createConvolver = vi.fn(() => {
      if (state.failReverb) throw new Error("Convolver unavailable");
      return makeNode("convolver");
    });
    createBuffer = vi.fn((channels: number, length: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: (index: number) => data[index] };
    });
  }
  const contexts: TestAudioContext[] = [];
  const AudioContext = vi.fn(function () {
    const ctx = new TestAudioContext();
    contexts.push(ctx);
    return ctx;
  });
  class Utterance {
    rate = 1;
    pitch = 1;
    volume = 1;
    voice = null;
    constructor(readonly text: string) {}
  }
  const speech = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => []) };

  return {
    nodes, contexts, state, speech, AudioContext,
    sources: () => nodes.filter((node) => node.kind === "oscillator" || node.kind === "source"),
    install() {
      nodes.length = 0;
      contexts.length = 0;
      state.failGain = false;
      state.failReverb = false;
      vi.stubGlobal("AudioContext", AudioContext);
      vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
      vi.stubGlobal("speechSynthesis", speech);
    },
  };
}

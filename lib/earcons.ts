"use client";

/**
 * Earcons: a short sound for every scene event, so a child who can't see
 * the screen still knows what just happened. Synthesised with Web Audio —
 * nothing to load, nothing to fail, ~40 ms from call to sound.
 *
 * The rule: one sound per meaning, always the same. A blind child learns
 * "that's a cut, that's a bite, that's right" the way a sighted one learns
 * the shapes on screen.
 */

export type Earcon =
  | "cut"
  | "eat"
  | "putBack"
  | "add"
  | "take"
  | "move"
  | "group"
  | "correct"
  | "hint"
  | "party"
  | "listen"
  | "tick";

let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture once so mobile browsers let sound through. */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

export function setEarcons(on: boolean) {
  enabled = on;
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number };

function tone(c: AudioContext, n: Note) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = n.type ?? "sine";
  o.frequency.setValueAtTime(n.f, c.currentTime + n.t);
  const vol = n.g ?? 0.18;
  g.gain.setValueAtTime(0.0001, c.currentTime + n.t);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + n.t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n.t + n.d);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + n.t);
  o.stop(c.currentTime + n.t + n.d + 0.02);
}

function noise(c: AudioContext, t: number, d: number, vol = 0.12) {
  const len = Math.floor(c.sampleRate * d);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  src.connect(hp).connect(g).connect(c.destination);
  src.start(c.currentTime + t);
}

const SOUNDS: Record<Earcon, (c: AudioContext) => void> = {
  // a quick slice: bright, rising, short
  cut: (c) => {
    tone(c, { f: 900, t: 0, d: 0.06, type: "triangle" });
    tone(c, { f: 1400, t: 0.05, d: 0.08, type: "triangle" });
    noise(c, 0, 0.05, 0.08);
  },
  // a bite: a soft low pop
  eat: (c) => {
    tone(c, { f: 260, t: 0, d: 0.09, type: "sine", g: 0.22 });
    noise(c, 0, 0.04, 0.06);
  },
  // back on the plate: the bite in reverse
  putBack: (c) => {
    tone(c, { f: 180, t: 0, d: 0.05 });
    tone(c, { f: 320, t: 0.05, d: 0.09 });
  },
  // one more thing lands in the pile
  add: (c) => tone(c, { f: 660, t: 0, d: 0.09, type: "triangle" }),
  // one thing leaves the pile
  take: (c) => tone(c, { f: 440, t: 0, d: 0.09, type: "triangle" }),
  // the marker steps along the road
  move: (c) => {
    tone(c, { f: 520, t: 0, d: 0.05 });
    tone(c, { f: 520, t: 0.07, d: 0.05 });
  },
  // things snap into groups
  group: (c) => {
    tone(c, { f: 500, t: 0, d: 0.06 });
    tone(c, { f: 630, t: 0.06, d: 0.06 });
    tone(c, { f: 790, t: 0.12, d: 0.09 });
  },
  // right: a warm two-note chime
  correct: (c) => {
    tone(c, { f: 660, t: 0, d: 0.12 });
    tone(c, { f: 990, t: 0.1, d: 0.22, g: 0.2 });
  },
  // not yet: gentle, falling, never harsh
  hint: (c) => {
    tone(c, { f: 480, t: 0, d: 0.12 });
    tone(c, { f: 400, t: 0.12, d: 0.16 });
  },
  // finished: a little arpeggio
  party: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, t: i * 0.09, d: 0.18, g: 0.16 }));
  },
  // mic open
  listen: (c) => tone(c, { f: 880, t: 0, d: 0.08, g: 0.12 }),
  tick: (c) => tone(c, { f: 1200, t: 0, d: 0.03, g: 0.08 }),
};

export function play(name: Earcon) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  try {
    SOUNDS[name](c);
  } catch {
    /* audio is decoration; never let it break the lesson */
  }
}

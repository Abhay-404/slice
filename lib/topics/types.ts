/**
 * A topic is a script of checkpoints. Each one says something and waits for
 * the kid to DO a thing (cut, eat, move) or SAY a thing (a fraction, a
 * choice). Expected answers are computed from the scene at that moment, so
 * the script follows the child: cut into six instead of eight and the
 * fraction questions are about sixths.
 *
 * The tutor never decides if an answer is right. `expect()` does.
 */

import {
  eatenOf,
  saidFraction,
  saidNumber,
  sameValue,
  value,
  type Fraction,
  type Scene,
} from "../scene";

export type ToolName =
  | "cut"
  | "eat"
  | "putBack"
  | "second"
  | "overlay"
  | "moveTo"
  | "showHalf"
  | "add"
  | "take"
  | "group";

export type Expected =
  | { kind: "fraction"; value: Fraction; spoken: string }
  | { kind: "choice"; answer: string; accept: string[]; spoken: string }
  | { kind: "number"; value: number; spoken: string };

export type Want =
  /** Completed by a call to this tool; `check` can constrain it. */
  | { kind: "do"; tool: ToolName; check?: (s: Scene) => boolean; steer?: string }
  /** Completed by an `answer()` call that matches. */
  | { kind: "say"; expected: (s: Scene) => Expected };

export type Checkpoint = {
  id: string;
  /** What the tutor says to open this beat. */
  say: (s: Scene, name: string) => string;
  want: Want;
  /** If they're stuck — points at what to notice, never the answer. */
  hint: string;
  /** Said right after it's done, before the next beat. The naming lives here. */
  then?: (s: Scene) => string;
};

export type Topic = {
  id: string;
  grade: "K" | "1" | "2" | "3" | "4" | "5";
  n: number;
  title: string;
  /** One line under the title, in kid words. */
  blurb: string;
  ccss: string;
  scene: "pizza" | "bar" | "two" | "road" | "counters";
  /** First thing the tutor does to the scene. */
  setup:
    | { kind: "pizza" | "bar"; cuts: number }
    | { road: number; max?: number }
    | { counters: { thing: string; count: number } };
  hello: (name: string) => string;
  steps: Checkpoint[];
  /** Short challenges for review — say-only, no teaching. */
  review: Checkpoint[];
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */

export const frac = (x: Fraction): Expected => ({
  kind: "fraction",
  value: x,
  spoken: spoken(x),
});

export function spoken(x: Fraction): string {
  const d: Record<number, [string, string]> = {
    2: ["half", "halves"], 3: ["third", "thirds"], 4: ["quarter", "quarters"], 5: ["fifth", "fifths"],
    6: ["sixth", "sixths"], 7: ["seventh", "sevenths"], 8: ["eighth", "eighths"], 9: ["ninth", "ninths"],
    10: ["tenth", "tenths"], 11: ["eleventh", "elevenths"], 12: ["twelfth", "twelfths"],
  };
  const w = d[x.d];
  if (!w) return `${x.n} over ${x.d}`;
  return `${x.n} ${x.n === 1 ? w[0] : w[1]}`;
}

export const a = (s: Scene) => s.a!;
export const b = (s: Scene) => s.b!;
export const pile = (s: Scene) => s.counters!;

export const num = (n: number): Expected => ({ kind: "number", value: n, spoken: String(n) });
export const choice = (answer: string, accept: string[], spokenAs = answer): Expected => ({
  kind: "choice",
  answer,
  accept,
  spoken: spokenAs,
});

export function whoAteMore(s: Scene): Expected {
  const ea = value(eatenOf(a(s)));
  const eb = s.b ? value(eatenOf(b(s))) : 0;
  if (sameValue(eatenOf(a(s)), s.b ? eatenOf(b(s)) : { n: 0, d: 1 }))
    return { kind: "choice", answer: "same", accept: ["same", "equal", "both", "neither", "tie", "the same"], spoken: "the same" };
  if (ea > eb)
    return { kind: "choice", answer: "you", accept: ["me", "i did", "mine", "you", "first", "the first", "top", "i ate more", "i have"], spoken: "you did" };
  return { kind: "choice", answer: "sam", accept: ["sam", "friend", "second", "the second", "bottom", "sam did", "them"], spoken: "Sam did" };
}


/* ------------------------------------------------------------------ */
/* checking a spoken answer                                            */

export function matches(said: string, e: Expected): boolean {
  const t = said.toLowerCase().replace(/[^a-z0-9./ ]/g, " ").replace(/\s+/g, " ").trim();
  if (e.kind === "fraction") return saidFraction(t, e.value);
  if (e.kind === "choice") return e.accept.some((x) => t.includes(x));
  return saidNumber(said, e.value);
}

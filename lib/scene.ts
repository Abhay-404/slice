/**
 * The scene. One piece of state that every voice command mutates and that
 * the screen renders with animation. This is the whole trick: the kid says
 * "cut it into eight" and this state changes, and the pizza on screen obeys.
 *
 * Nothing here knows about topics, scripts, or the tutor. It is a toy box.
 */

export type FoodKind = "pizza" | "bar";

export type Food = {
  kind: FoodKind;
  /** Equal pieces it has been cut into. 1 = whole. */
  cuts: number;
  /** Zero-based indices of pieces that are gone. */
  eaten: number[];
  /** Pieces currently glowing because the tutor is pointing at them. */
  highlight: number[];
};

export type Road = {
  /** Ticks between 0 and `max` (e.g. 10 ticks from 0 to 1 = tenths). */
  ticks: number;
  /** The number at the far end. 1 for fractions/decimals, 20 or 100 for whole numbers. */
  max: number;
  /** Where the marker is, in ticks from 0. null = not placed. */
  pos: number | null;
  showHalf: boolean;
};

export type Fraction = { n: number; d: number };

/** A pile of objects for counting, adding, taking away and grouping. */
export type Counters = {
  /** What they are, for the picture and the voice: "apples", "stars". */
  thing: string;
  count: number;
  /** Objects per group when grouped, or null for a loose pile. */
  groupSize: number | null;
  /** Indices currently glowing. */
  highlight: number[];
};

export type Scene = {
  a: Food | null;
  b: Food | null;
  counters: Counters | null;
  /** b is slid over a so the eaten parts can be compared. */
  overlay: boolean;
  /** The big fraction shown over the scene, if any. */
  fraction: Fraction | null;
  road: Road | null;
  /** Bumped to fire a celebration. */
  party: number;
  /** A short label the tutor can put on screen ("Sam's pizza"). */
  caption: string | null;
};

export const EMPTY: Scene = {
  a: null,
  b: null,
  counters: null,
  overlay: false,
  fraction: null,
  road: null,
  party: 0,
  caption: null,
};

export const MAX_CUTS = 12;
export const MAX_COUNT = 30;

export const food = (kind: FoodKind, cuts = 1): Food => ({
  kind,
  cuts: Math.max(1, Math.min(MAX_CUTS, cuts)),
  eaten: [],
  highlight: [],
});

/* ------------------------------------------------------------------ */
/* actions — every tool the tutor has maps to exactly one of these     */

export type Action =
  | { type: "start"; kind: FoodKind; cuts?: number }
  | { type: "cut"; n: number; which?: "a" | "b" }
  | { type: "eat"; n: number; which?: "a" | "b" }
  | { type: "putBack"; n: number; which?: "a" | "b" }
  | { type: "second"; kind?: FoodKind; cuts?: number }
  | { type: "overlay"; on: boolean }
  | { type: "showFraction"; n: number; d: number }
  | { type: "hideFraction" }
  | { type: "highlight"; pieces: number[]; which?: "a" | "b" }
  | { type: "road"; ticks: number; max?: number }
  | { type: "counters"; thing: string; count: number }
  | { type: "add"; n: number }
  | { type: "take"; n: number }
  | { type: "group"; size: number | null }
  | { type: "highlightCounters"; pieces: number[] }
  | { type: "moveTo"; pos: number }
  | { type: "showHalf"; on: boolean }
  | { type: "caption"; text: string | null }
  | { type: "party" }
  | { type: "reset" };

function withFood(s: Scene, which: "a" | "b", fn: (f: Food) => Food): Scene {
  const f = s[which];
  if (!f) return s;
  return { ...s, [which]: fn(f) };
}

export function reduce(s: Scene, a: Action): Scene {
  switch (a.type) {
    case "start":
      return { ...EMPTY, a: food(a.kind, a.cuts ?? 1) };

    case "cut": {
      const n = Math.max(1, Math.min(MAX_CUTS, Math.round(a.n)));
      const which = a.which ?? "a";
      return withFood(s, which, (f) => {
        // Re-cutting keeps the *amount* eaten where the maths allows it, so
        // "cut it into eight" on a pizza with a quarter gone shows 2/8 gone.
        const eatenShare = f.eaten.length / f.cuts;
        const keep = Math.round(eatenShare * n);
        return { ...f, cuts: n, eaten: Array.from({ length: keep }, (_, k) => k), highlight: [] };
      });
    }

    case "eat": {
      const which = a.which ?? "a";
      return withFood(s, which, (f) => {
        const want = Math.max(0, Math.round(a.n));
        const left = Array.from({ length: f.cuts }, (_, k) => k).filter((k) => !f.eaten.includes(k));
        const take = left.slice(0, Math.min(want, left.length));
        return { ...f, eaten: [...f.eaten, ...take], highlight: [] };
      });
    }

    case "putBack": {
      const which = a.which ?? "a";
      return withFood(s, which, (f) => ({
        ...f,
        eaten: f.eaten.slice(0, Math.max(0, f.eaten.length - Math.round(a.n))),
        highlight: [],
      }));
    }

    case "second":
      return {
        ...s,
        b: food(a.kind ?? s.a?.kind ?? "pizza", a.cuts ?? 1),
        overlay: false,
      };

    case "overlay":
      return { ...s, overlay: a.on && !!s.a && !!s.b };

    case "showFraction":
      return { ...s, fraction: { n: Math.round(a.n), d: Math.max(1, Math.round(a.d)) } };

    case "hideFraction":
      return { ...s, fraction: null };

    case "highlight": {
      const which = a.which ?? "a";
      return withFood(s, which, (f) => ({
        ...f,
        highlight: a.pieces.filter((p) => p >= 0 && p < f.cuts),
      }));
    }

    case "road":
      return {
        ...s,
        road: { ticks: Math.max(2, Math.min(100, Math.round(a.ticks))), max: a.max ?? 1, pos: null, showHalf: false },
      };

    case "counters":
      return {
        ...EMPTY,
        counters: { thing: a.thing, count: Math.max(0, Math.min(MAX_COUNT, Math.round(a.count))), groupSize: null, highlight: [] },
      };

    case "add":
      return s.counters
        ? { ...s, counters: { ...s.counters, count: Math.min(MAX_COUNT, s.counters.count + Math.max(0, Math.round(a.n))), highlight: [] } }
        : s;

    case "take":
      return s.counters
        ? { ...s, counters: { ...s.counters, count: Math.max(0, s.counters.count - Math.max(0, Math.round(a.n))), highlight: [] } }
        : s;

    case "group":
      return s.counters ? { ...s, counters: { ...s.counters, groupSize: a.size && a.size > 0 ? Math.round(a.size) : null } } : s;

    case "highlightCounters":
      return s.counters ? { ...s, counters: { ...s.counters, highlight: a.pieces } } : s;

    case "moveTo":
      return s.road ? { ...s, road: { ...s.road, pos: Math.max(0, Math.min(s.road.ticks, Math.round(a.pos))) } } : s;

    case "showHalf":
      return s.road ? { ...s, road: { ...s.road, showHalf: a.on } } : s;

    case "caption":
      return { ...s, caption: a.text };

    case "party":
      return { ...s, party: s.party + 1 };

    case "reset":
      return EMPTY;
  }
}

/* ------------------------------------------------------------------ */
/* reading the scene — what the maths currently IS on screen           */

export const eatenOf = (f: Food): Fraction => ({ n: f.eaten.length, d: f.cuts });
export const leftOf = (f: Food): Fraction => ({ n: f.cuts - f.eaten.length, d: f.cuts });
export const value = (x: Fraction) => x.n / x.d;

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function simplify(x: Fraction): Fraction {
  if (x.n === 0) return { n: 0, d: x.d };
  const g = gcd(x.n, x.d);
  return { n: x.n / g, d: x.d / g };
}

export function sameValue(x: Fraction, y: Fraction): boolean {
  return x.n * y.d === y.n * x.d;
}

/** How a child might say a fraction. Used to accept spoken answers. */
export function spokenForms(x: Fraction): string[] {
  const ones: Record<number, string> = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
    9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
  };
  const dens: Record<number, [string, string]> = {
    2: ["half", "halves"], 3: ["third", "thirds"], 4: ["quarter", "quarters"], 5: ["fifth", "fifths"],
    6: ["sixth", "sixths"], 7: ["seventh", "sevenths"], 8: ["eighth", "eighths"], 9: ["ninth", "ninths"],
    10: ["tenth", "tenths"], 11: ["eleventh", "elevenths"], 12: ["twelfth", "twelfths"],
  };
  const forms = new Set<string>([`${x.n}/${x.d}`, `${x.n} over ${x.d}`, `${x.n} out of ${x.d}`]);
  const nw = ones[x.n];
  const dw = dens[x.d];
  if (nw && dw) {
    forms.add(`${nw} ${x.n === 1 ? dw[0] : dw[1]}`);
    forms.add(`${x.n} ${x.n === 1 ? dw[0] : dw[1]}`);
    if (x.n === 1 && x.d === 4) forms.add("a quarter");
    if (x.n === 1 && x.d === 2) forms.add("a half");
    if (x.n === 1) forms.add(`a ${dw[0]}`);
    if (x.d === 4) forms.add(`${nw} fourth${x.n === 1 ? "" : "s"}`);
  }
  const s = simplify(x);
  if (s.n !== x.n) for (const f of spokenForms(s)) forms.add(f);
  return [...forms];
}

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};

/** Every number a child said, as digits or words ("twenty three" -> 23). */
export function numbersIn(said: string): number[] {
  const t = said.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ").replace(/-/g, " ");
  const out: number[] = [];
  const toks = t.split(/\s+/).filter(Boolean);
  let acc: number | null = null;
  for (const tok of toks) {
    if (/^\d+(\.\d+)?$/.test(tok)) {
      if (acc !== null) out.push(acc);
      acc = null;
      out.push(Number(tok));
      continue;
    }
    const w = WORDS[tok];
    if (w === undefined) {
      if (acc !== null) out.push(acc);
      acc = null;
      continue;
    }
    if (w === 100 && acc !== null) acc = acc * 100;
    else if (acc !== null && acc % 10 === 0 && acc >= 20 && w < 10) acc = acc + w;
    else {
      if (acc !== null) out.push(acc);
      acc = w;
    }
  }
  if (acc !== null) out.push(acc);
  return out;
}

/** Did the child say this number? "five", "5", "I think it's five". */
export function saidNumber(said: string, n: number): boolean {
  return numbersIn(said).includes(n);
}

/** Loose match of what a child said against a fraction. */
export function saidFraction(said: string, x: Fraction): boolean {
  const t = said.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
  const forms = spokenForms(x).map((f) => f.toLowerCase());
  if (forms.some((f) => t.includes(f))) return true;
  // "three eighths" said as "3 8" or "3 out of 8"
  const nums = t.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) {
    const cand = { n: nums[0], d: nums[1] };
    if (sameValue(cand, x)) return true;
  }
  return false;
}

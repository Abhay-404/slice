"use client";

/**
 * Who the child is and what they've done. localStorage, read through
 * useSyncExternalStore so every screen agrees and nothing flashes.
 *
 * It remembers what the child actually SAID at each question — right and
 * wrong — because that is what a parent wants to see, and it's what makes
 * "one thing to practise" possible.
 */

import { useCallback, useSyncExternalStore } from "react";

export type Grade = "K" | "1" | "2" | "3" | "4" | "5";

export const GRADES: { id: Grade; label: string; age: string }[] = [
  { id: "K", label: "K", age: "5–6" },
  { id: "1", label: "1", age: "6–7" },
  { id: "2", label: "2", age: "7–8" },
  { id: "3", label: "3", age: "8–9" },
  { id: "4", label: "4", age: "9–10" },
  { id: "5", label: "5", age: "10–11" },
];

export type Answer = {
  /** The checkpoint id, so the parent page can name the question. */
  q: string;
  /** What the tutor asked. */
  asked: string;
  /** What the child said, verbatim from the transcript. */
  said: string;
  correct: boolean;
  at: string;
};

export type TopicRecord = {
  done: boolean;
  /** 0–3. Fewer hints, more stars. */
  stars: number;
  hints: number;
  /** Seconds spent, roughly. */
  seconds: number;
  playedAt: string | null;
  answers: Answer[];
  /** Best review score, 0–1. */
  reviewBest: number | null;
  reviewAt: string | null;
};

export type Profile = {
  name: string;
  grade: Grade;
  xp: number;
  streak: number;
  lastDay: string | null;
  topics: Record<string, TopicRecord>;
};

const KEY = "ttm.profile.v2";

const EMPTY: Profile = { name: "", grade: "4", xp: 0, streak: 0, lastDay: null, topics: {} };

export const EMPTY_TOPIC: TopicRecord = {
  done: false,
  stars: 0,
  hints: 0,
  seconds: 0,
  playedAt: null,
  answers: [],
  reviewBest: null,
  reviewAt: null,
};

/* ---- the store ---- */

let cache: Profile | null = null;
const listeners = new Set<() => void>();

const today = () => new Date().toISOString().slice(0, 10);

function touchStreak(p: Profile): Profile {
  const t = today();
  if (p.lastDay === t) return p;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  return { ...p, lastDay: t, streak: p.lastDay === yesterday ? p.streak + 1 : 1 };
}

function read(): Profile {
  if (cache) return cache;
  let p = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = { ...EMPTY, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {}
  p = touchStreak(p);
  cache = p;
  write(p);
  return p;
}

function write(p: Profile) {
  cache = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnap = () => EMPTY;
const yes = () => true;
const no = () => false;
const noop = () => () => {};

/* ---- the hook ---- */

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, read, serverSnap);
  const ready = useSyncExternalStore(noop, yes, no);

  const update = useCallback((fn: (p: Profile) => Profile) => write(fn(read())), []);
  const topic = useCallback(
    (id: string, fn: (t: TopicRecord) => TopicRecord) =>
      update((p) => ({ ...p, topics: { ...p.topics, [id]: fn(p.topics[id] ?? EMPTY_TOPIC) } })),
    [update],
  );

  const setIdentity = useCallback(
    (name: string, grade: Grade) => update((p) => ({ ...p, name: name.trim(), grade })),
    [update],
  );

  const recordAnswer = useCallback(
    (id: string, a: Omit<Answer, "at">) =>
      topic(id, (t) => ({ ...t, answers: [...t.answers, { ...a, at: new Date().toISOString() }].slice(-60) })),
    [topic],
  );

  const recordHint = useCallback((id: string) => topic(id, (t) => ({ ...t, hints: t.hints + 1 })), [topic]);

  const completeTopic = useCallback(
    (id: string, stars: number, seconds: number, xp: number) =>
      update((p) => {
        const t = p.topics[id] ?? EMPTY_TOPIC;
        const first = !t.done;
        return {
          ...p,
          xp: p.xp + (first ? xp : Math.floor(xp / 2)),
          topics: {
            ...p.topics,
            [id]: { ...t, done: true, stars: Math.max(t.stars, stars), seconds: t.seconds + seconds, playedAt: new Date().toISOString() },
          },
        };
      }),
    [update],
  );

  const recordReview = useCallback(
    (id: string, score: number, xp: number) =>
      update((p) => {
        const t = p.topics[id] ?? EMPTY_TOPIC;
        const better = t.reviewBest === null || score > t.reviewBest;
        return {
          ...p,
          xp: p.xp + (better ? xp : 0),
          topics: { ...p.topics, [id]: { ...t, reviewBest: better ? score : t.reviewBest, reviewAt: new Date().toISOString() } },
        };
      }),
    [update],
  );

  const reset = useCallback(() => update(() => EMPTY), [update]);

  return {
    profile,
    ready,
    onboarded: ready && profile.name.length > 0,
    setIdentity,
    recordAnswer,
    recordHint,
    completeTopic,
    recordReview,
    reset,
  };
}

"use client";

/**
 * A practice class. There's no server, so the classmates are pretend —
 * seeded once, nudged a little each day so the board moves — and the
 * child's row is real. Labelled honestly in the UI.
 */

export type Row = { name: string; xp: number; stars: number; you?: boolean };

const KEY = "ttm.class.v1";
const NAMES = ["Ava", "Leo", "Priya", "Noah", "Mia", "Arjun", "Zoe", "Sam"];

type Seed = { names: string[]; base: number[]; day: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function load(childName: string): Seed {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Seed;
  } catch {}
  // Six classmates, never the child's own name, XP spread so the child
  // starts near the bottom and can climb.
  const h = hash(childName || "x");
  const names = NAMES.filter((n) => n.toLowerCase() !== childName.toLowerCase()).slice(0, 6);
  // `>>>` — unsigned. A signed shift goes negative for some names, which
  // gave a classmate negative XP and crashed "★".repeat(-1) on the home page.
  const base = names.map((_, i) => 20 + ((h >>> (i * 4)) % 9) * 15 + i * 18);
  const seed = { names, base, day: today() };
  try {
    localStorage.setItem(KEY, JSON.stringify(seed));
  } catch {}
  return seed;
}

export function classBoard(childName: string, childXp: number, childStars: number): Row[] {
  const seed = load(childName);
  // Classmates drift upward a little per day since seeding, so the board isn't frozen.
  const days = Math.max(0, Math.floor((Date.parse(today()) - Date.parse(seed.day)) / 86400000));
  const rows: Row[] = seed.names.map((name, i) => {
    const xp = Math.max(0, seed.base[i] + days * (4 + (i % 3) * 3));
    return { name, xp, stars: Math.max(0, Math.min(15, Math.floor(xp / 28))) };
  });
  rows.push({ name: childName || "You", xp: Math.max(0, childXp), stars: Math.max(0, childStars), you: true });
  return rows.sort((a, b) => b.xp - a.xp || b.stars - a.stars);
}

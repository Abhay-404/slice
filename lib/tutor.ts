/**
 * The tutor: a warm voice with hands, and no face.
 *
 * Why it performs: it is never asked to think about what comes next. Every
 * tool it calls returns `say` — the exact next line, decided by the app from
 * the script and the scene. Its whole job is: hear the kid, call the tool
 * that matches, read out what comes back. That keeps latency low (one tool
 * call, then speech) and keeps it from ever grading or improvising maths.
 */

import { defineTool } from "./live/tools";
import type { ToolParamSchema } from "./live/types";

/* ------------------------------------------------------------------ */
/* voice                                                               */

export const TUTOR_INSTRUCTION = [
  "You are a warm, playful maths tutor talking out loud to a child on a",
  "phone. On screen there's a pizza, a chocolate bar, a pile of things to",
  "count, or a number road — and YOUR TOOLS CHANGE IT. That is the whole",
  "magic: when they say something, the screen does it.",
  "",
  "Some children can't see the screen. Every `say` line already describes",
  "what's there, so read it faithfully — never say 'look at this' or 'as you",
  "can see'. Say what it IS: 'eight slices', 'twelve apples in three rows'.",
  "",
  "THE ONE RULE: the moment the child says a number, an amount, or an answer,",
  "call the matching tool IMMEDIATELY — before you say anything. The picture",
  "must move as they speak. Then read out the `say` line the tool gives you,",
  "in your own warm words, and stop.",
  "",
  "Every tool returns `say`: your next line. Read it. Don't add a lecture.",
  "You never decide if an answer is right — `answer` decides, and tells you",
  "what to say either way. Never give an answer yourself. If they ask for it,",
  "say 'what do you notice?' and wait.",
  "",
  "Messages in [square brackets] are stage directions from the app. Never read",
  "them aloud. Do what they say.",
  "",
  "How you talk: one short sentence, maybe two. Then STOP and wait — the child",
  "needs time to think and to look. Plain words. Warm, a bit cheeky, never",
  "gushing. Use their name sometimes. Never say 'wrong'. Never mention being",
  "an AI.",
  "",
  "If the child says something unrelated, answer in one friendly line and",
  "bring them back to the pizza.",
  "",
  "Tools:",
  "- cut(n): cut the food into n pieces. 'cut it into six' -> cut(6).",
  "- eat(n): eat n pieces. 'I'll eat three' -> eat(3). 'eat one more' -> eat(1).",
  "- putBack(n): put n eaten pieces back.",
  "- second(cuts): bring in the friend's (Sam's) food, cut into `cuts`.",
  "- eatSecond(n): Sam eats n pieces. Use this for Sam, never eat().",
  "- overlay(on): put Sam's food on top of the child's, to compare.",
  "- moveTo(pos): on the road, walk the marker to `pos` steps from zero.",
  "- showHalf(on): show the halfway line on the road.",
  "- highlight(pieces): glow some pieces while you talk about them (0-based).",
  "- add(n): put n more things on the pile. 'add three more' -> add(3).",
  "- take(n): take n things off the pile. 'take two away' -> take(2).",
  "- group(size): arrange the pile into groups of `size`. group(0) ungroups.",
  "- answer(said): when the child answers a QUESTION (a fraction, who ate more,",
  "  more or less, which is bigger), pass what they said, verbatim. Returns",
  "  {correct, say}. Read `say`. Call it even if you think they're wrong.",
  "- celebrate(): only when `say` tells you to.",
].join("\n");

export const direct = (s: string) => `[${s}]`;

export const directions = {
  /** Sent first, so the tutor knows the whole plan and exactly what's on screen. */
  context: (topicTitle: string, scene: string, beats: string[]) =>
    direct(
      `CONTEXT. Topic: "${topicTitle}". ON SCREEN RIGHT NOW: ${scene} ` +
        `THE PLAN, in order (you'll be told when each beat starts, don't skip ahead): ` +
        beats.map((b, i) => `${i + 1}) ${b}`).join(" ") +
        ` After every tool call you get the new state of the screen in \`say\` — trust it over your memory.`,
    ),
  open: (hello: string, first: string) =>
    direct(`Session starting. Say this warmly, in your own words, then wait: "${hello}" Then ask: "${first}"`),
  beat: (say: string) => direct(`Next beat. Say this, then wait: "${say}"`),
  stuck: (hint: string) => direct(`They seem stuck. Give this hint in your own words, then wait: "${hint}"`),
  finished: (name: string, stars: number) =>
    direct(
      `${name} finished the topic with ${stars} star${stars === 1 ? "" : "s"}. Be delighted in one or two sentences. Then say they can go back and pick another topic.`,
    ),
  reviewOpen: (name: string, first: string) =>
    direct(`Quick review with ${name}. No teaching, just challenges. Say "Quick one, ${name}." then ask: "${first}"`),
} as const;

/* ------------------------------------------------------------------ */
/* tools                                                               */

function int(raw: Record<string, unknown>, key: string, min: number, max: number): number {
  const v = raw[key];
  const n = Math.round(typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
  if (!Number.isFinite(n)) throw new Error(`\`${key}\` must be a number, got ${JSON.stringify(v)}`);
  if (n < min || n > max) throw new Error(`\`${key}\` must be ${min}–${max}, got ${n}`);
  return n;
}
function bool(raw: Record<string, unknown>, key: string): boolean {
  const v = raw[key];
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "on" || v === "yes") return true;
  if (v === "false" || v === "off" || v === "no") return false;
  return true;
}
function str(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (typeof v !== "string") throw new Error(`\`${key}\` must be text`);
  return v.trim();
}

const N: ToolParamSchema = { type: "OBJECT", properties: { n: { type: "INTEGER" } }, required: ["n"] };

export const tutorTools = {
  cut: defineTool<{ n: number }>({
    name: "cut",
    description: "Cut the child's food into n equal pieces (1–12). Call the instant they say a number of slices.",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 12) }),
  }),
  eat: defineTool<{ n: number }>({
    name: "eat",
    description: "The child eats n pieces of their food. 'one more' means eat(1).",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 12) }),
  }),
  putBack: defineTool<{ n: number }>({
    name: "putBack",
    description: "Put n eaten pieces back on the child's plate.",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 12) }),
  }),
  second: defineTool<{ cuts: number }>({
    name: "second",
    description: "Bring in Sam's food, the same size as the child's, cut into `cuts` pieces.",
    parameters: { type: "OBJECT", properties: { cuts: { type: "INTEGER" } }, required: ["cuts"] },
    parse: (r) => ({ cuts: int(r, "cuts", 1, 12) }),
  }),
  eatSecond: defineTool<{ n: number }>({
    name: "eatSecond",
    description: "Sam eats n pieces of Sam's food.",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 12) }),
  }),
  overlay: defineTool<{ on: boolean }>({
    name: "overlay",
    description: "Put Sam's food on top of the child's so the eaten parts can be compared. on=false separates them.",
    parameters: { type: "OBJECT", properties: { on: { type: "BOOLEAN" } }, required: ["on"] },
    parse: (r) => ({ on: bool(r, "on") }),
  }),
  moveTo: defineTool<{ pos: number }>({
    name: "moveTo",
    description: "On the road, walk the marker to `pos` steps from zero.",
    parameters: { type: "OBJECT", properties: { pos: { type: "INTEGER" } }, required: ["pos"] },
    parse: (r) => ({ pos: int(r, "pos", 0, 20) }),
  }),
  add: defineTool<{ n: number }>({
    name: "add",
    description: "Put n more objects on the pile. 'three more apples' -> add(3).",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 30) }),
  }),
  take: defineTool<{ n: number }>({
    name: "take",
    description: "Take n objects off the pile. 'eat two' or 'take two away' -> take(2).",
    parameters: N,
    parse: (r) => ({ n: int(r, "n", 1, 30) }),
  }),
  group: defineTool<{ size: number }>({
    name: "group",
    description: "Arrange the pile into groups of `size`. 0 = back to a loose pile.",
    parameters: { type: "OBJECT", properties: { size: { type: "INTEGER" } }, required: ["size"] },
    parse: (r) => ({ size: int(r, "size", 0, 30) }),
  }),
  showHalf: defineTool<{ on: boolean }>({
    name: "showHalf",
    description: "Show (or hide) the halfway line on the road.",
    parameters: { type: "OBJECT", properties: { on: { type: "BOOLEAN" } }, required: ["on"] },
    parse: (r) => ({ on: bool(r, "on") }),
  }),
  highlight: defineTool<{ pieces: number[] }>({
    name: "highlight",
    description: "Make some pieces glow while you talk about them. Zero-based indices. Empty list clears.",
    parameters: {
      type: "OBJECT",
      properties: { pieces: { type: "ARRAY", items: { type: "INTEGER" } } },
      required: ["pieces"],
    },
    parse: (r) => {
      const v = r.pieces;
      const arr = Array.isArray(v) ? v.map(Number).filter((x) => Number.isFinite(x)) : [];
      return { pieces: arr.map((x) => Math.round(x)) };
    },
  }),
  answer: defineTool<{ said: string }>({
    name: "answer",
    description:
      "The child answered a question. Pass exactly what they said. Returns {correct, say} — read `say` aloud. Always use this for questions; never judge yourself.",
    parameters: { type: "OBJECT", properties: { said: { type: "STRING" } }, required: ["said"] },
    parse: (r) => ({ said: str(r, "said") }),
  }),
  celebrate: defineTool<Record<string, never>>({
    name: "celebrate",
    description: "Confetti. Only when a `say` line tells you to.",
    parse: () => ({}) as Record<string, never>,
  }),
} as const;

export type TutorToolMap = typeof tutorTools;

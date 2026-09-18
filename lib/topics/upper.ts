/**
 * Grade 3 and Grade 5. Groups and sharing, first fractions; then fractions
 * with different bottoms, fractions of a group, and hundredths.
 */
import { eatenOf, leftOf } from "../scene";
import { a, choice, frac, num, pile, spoken, type Topic } from "./types";

/* ------------------------------------------------------------------ */
/* Grade 3                                                             */

const G3a: Topic = {
  id: "3-groups",
  grade: "3",
  n: 1,
  title: "Groups of",
  blurb: "Twelve cookies. Groups of three, groups of four.",
  ccss: "3.OA.A.1",
  scene: "counters",
  setup: { counters: { thing: "cookies", count: 12 } },
  hello: (name) => `${name}, twelve cookies. Let's put them in groups.`,
  steps: [
    {
      id: "g3",
      say: () => "Put them into groups of three.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 3, steer: "Groups of three." },
      hint: "Say: group in threes.",
    },
    {
      id: "count3",
      say: () => "How many groups of three?",
      want: { kind: "say", expected: () => num(4) },
      hint: "Count the rows.",
      then: () => "Four groups of three. Four times three is twelve.",
    },
    {
      id: "g4",
      say: () => "Now groups of four.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 4, steer: "Groups of four." },
      hint: "Say: group in fours.",
    },
    {
      id: "count4",
      say: () => "How many groups of four?",
      want: { kind: "say", expected: () => num(3) },
      hint: "Count the rows.",
      then: () => "Three groups of four. Three times four is twelve too. Same cookies, different groups.",
    },
    {
      id: "g6",
      say: () => "One more — groups of six. How many groups will there be?",
      want: { kind: "say", expected: () => num(2) },
      hint: "How many sixes in twelve?",
      then: () => "Two. Two times six is twelve.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Fifteen cookies in groups of five. How many groups?",
      want: { kind: "say", expected: () => num(3) },
      hint: "How many fives in fifteen?",
    },
    {
      id: "r2",
      say: () => "Groups of three instead. How many?",
      want: { kind: "say", expected: () => num(5) },
      hint: "How many threes in fifteen?",
    },
  ],
};

const G3b: Topic = {
  id: "3-share",
  grade: "3",
  n: 2,
  title: "Sharing out",
  blurb: "Fifteen sweets, three friends. How many each?",
  ccss: "3.OA.A.2",
  scene: "counters",
  setup: { counters: { thing: "sweets", count: 15 } },
  hello: (name) => `${name}, fifteen sweets and three friends. Fair shares.`,
  steps: [
    {
      id: "each",
      say: () => "Share fifteen sweets between three friends. How many does each friend get?",
      want: { kind: "say", expected: () => num(5) },
      hint: "Deal them out one at a time — one for you, one for you, one for you…",
      then: () => "Five each.",
    },
    {
      id: "check",
      say: () => "Let's check. Group them in fives.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 5 },
      hint: "Say: group in fives.",
    },
    {
      id: "groups",
      say: () => "How many groups of five?",
      want: { kind: "say", expected: () => num(3) },
      hint: "Count the rows.",
      then: () => "Three groups. Three friends, five sweets each. Fifteen shared by three is five.",
    },
    {
      id: "take",
      say: () => "One friend goes home with their sweets. Take five off.",
      want: { kind: "do", tool: "take", check: (s) => pile(s).count === 10, steer: "Take five." },
      hint: "Say: take five.",
    },
    {
      id: "left",
      say: () => "How many sweets are left?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Fifteen take away five.",
      then: () => "Ten. Two friends, five each.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Twelve sweets, four friends. How many each?",
      want: { kind: "say", expected: () => num(3) },
      hint: "Deal them out.",
    },
    {
      id: "r2",
      say: () => "Eighteen sweets, three friends. Each?",
      want: { kind: "say", expected: () => num(6) },
      hint: "How many threes in eighteen?",
    },
  ],
};

const G3c: Topic = {
  id: "3-fractions",
  grade: "3",
  n: 3,
  title: "Your first fractions",
  blurb: "Snap a bar into three. Eat one. Name it.",
  ccss: "3.NF.A.1",
  scene: "bar",
  setup: { kind: "bar", cuts: 1 },
  hello: (name) => `${name}, a whole chocolate bar. Let's snap it and name the pieces.`,
  steps: [
    {
      id: "cut3",
      say: () => "Snap it into three equal pieces.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 3, steer: "Three pieces." },
      hint: "Say: cut it into three.",
    },
    {
      id: "eat1",
      say: () => "Eat one piece.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 1 },
      hint: "Say: eat one.",
    },
    {
      id: "third",
      say: () => "You ate one piece out of three. What fraction is that?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "One on top. Three on the bottom.",
      then: () => "One third. The bottom number is how many pieces; the top is how many you ate.",
    },
    {
      id: "eat2",
      say: () => "Eat one more.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 2 },
      hint: "Say: eat one.",
    },
    {
      id: "twothirds",
      say: () => "Now what fraction have you eaten?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Two pieces gone, out of three.",
      then: () => "Two thirds.",
    },
    {
      id: "left",
      say: () => "And how much is left?",
      want: { kind: "say", expected: (s) => frac(leftOf(a(s))) },
      hint: "One piece left, out of three.",
      then: (s) => `${spoken(leftOf(a(s)))}. Two thirds eaten and one third left makes the whole bar.`,
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Snap the bar into four and eat one. What fraction?",
      want: { kind: "say", expected: () => frac({ n: 1, d: 4 }) },
      hint: "One out of four.",
    },
    {
      id: "r2",
      say: () => "Eat two more. Now?",
      want: { kind: "say", expected: () => frac({ n: 3, d: 4 }) },
      hint: "Three out of four.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Grade 5                                                             */

const G5a: Topic = {
  id: "5-unlike",
  grade: "5",
  n: 1,
  title: "A half plus a quarter",
  blurb: "Different bottoms. Cut until they match.",
  ccss: "5.NF.A.1",
  scene: "bar",
  setup: { kind: "bar", cuts: 4 },
  hello: (name) => `${name}, a bar in quarters. We're adding a half and a quarter — and the bottoms don't match.`,
  steps: [
    {
      id: "half",
      say: () => "Eat half the bar. That's two of the four pieces.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 2, steer: "Two pieces — that's a half." },
      hint: "Say: eat two.",
    },
    {
      id: "quarter",
      say: () => "Now eat one more quarter.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 3, steer: "One more piece." },
      hint: "Say: eat one.",
    },
    {
      id: "sum",
      say: () => "A half plus a quarter. What fraction of the bar is gone?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Count the gaps. They're all quarters now.",
      then: () => "Three quarters. To add a half and a quarter, you turn the half into two quarters first.",
    },
    {
      id: "cut8",
      say: () => "Cut every piece in half again — eight pieces.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 8, steer: "Eight." },
      hint: "Say: cut into eight.",
    },
    {
      id: "eighths",
      say: () => "Same chocolate gone. How many eighths?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Count the gaps.",
      then: () => "Six eighths. Three quarters, six eighths — same amount, different bottoms.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Cut into four. Eat one quarter, then eat a half. Total?",
      want: { kind: "say", expected: () => frac({ n: 3, d: 4 }) },
      hint: "A quarter and two quarters.",
    },
    {
      id: "r2",
      say: () => "Cut into eight. How many eighths is that?",
      want: { kind: "say", expected: () => frac({ n: 6, d: 8 }) },
      hint: "Count the gaps.",
    },
  ],
};

const G5b: Topic = {
  id: "5-ofgroup",
  grade: "5",
  n: 2,
  title: "A third of twelve",
  blurb: "Fractions of a pile of things.",
  ccss: "5.NF.B.4",
  scene: "counters",
  setup: { counters: { thing: "marbles", count: 12 } },
  hello: (name) => `${name}, twelve marbles. We're going to take fractions of the pile.`,
  steps: [
    {
      id: "group3",
      say: () => "Group them into three equal groups. So groups of four.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 4, steer: "Groups of four makes three groups." },
      hint: "Say: group in fours.",
    },
    {
      id: "third",
      say: () => "Three equal groups. One group is a third of the marbles. How many is a third of twelve?",
      want: { kind: "say", expected: () => num(4) },
      hint: "Count one group.",
      then: () => "Four. A third of twelve is four.",
    },
    {
      id: "take",
      say: () => "Take a third away.",
      want: { kind: "do", tool: "take", check: (s) => pile(s).count === 8, steer: "Take four." },
      hint: "Say: take four.",
    },
    {
      id: "left",
      say: () => "How many marbles are left?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Twelve take away four.",
      then: () => "Eight.",
    },
    {
      id: "fracleft",
      say: () => "Eight out of twelve. What fraction of the marbles is that?",
      want: { kind: "say", expected: (s) => frac({ n: pile(s).count, d: 12 }) },
      hint: "Two of the three groups are still there.",
      then: () => "Eight twelfths — which is two thirds. Two groups out of three.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Twenty marbles. What's a quarter of twenty?",
      want: { kind: "say", expected: () => num(5) },
      hint: "Four equal groups.",
    },
    {
      id: "r2",
      say: () => "What's three quarters of twenty?",
      want: { kind: "say", expected: () => num(15) },
      hint: "Three of those groups.",
    },
  ],
};

const G5c: Topic = {
  id: "5-hundredths",
  grade: "5",
  n: 3,
  title: "Hundredths",
  blurb: "0.6 and 0.58 — which is bigger, and why?",
  ccss: "5.NBT.A.3",
  scene: "road",
  setup: { road: 10 },
  hello: (name) => `${name}, the road from zero to one in tenths. We're going to look between the tenths.`,
  steps: [
    {
      id: "six",
      say: () => "Walk to point six.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 6 },
      hint: "Six tenths. Six steps.",
    },
    {
      id: "compare",
      say: () => "Point six, or point five eight. Which is bigger?",
      want: {
        kind: "say",
        expected: () => choice("0.6", ["0.6", "point six", "six", "the first", "first", "0.60"], "point six"),
      },
      hint: "Line up the tenths. Six tenths against five tenths and a bit.",
      then: () => "Point six. Fifty-eight looks big, but it's five tenths and eight hundredths — still under six tenths.",
    },
    {
      id: "same",
      say: () => "Point six, or point six zero. Same, or different?",
      want: { kind: "say", expected: () => choice("same", ["same", "equal", "the same"], "the same") },
      hint: "Six tenths and zero hundredths.",
      then: () => "The same. Adding a zero on the end changes nothing.",
    },
    {
      id: "walk",
      say: () => "Walk to point three.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 3 },
      hint: "Three steps.",
    },
    {
      id: "compare2",
      say: () => "Point three, or point two nine. Bigger?",
      want: {
        kind: "say",
        expected: () => choice("0.3", ["0.3", "point three", "three", "first", "the first", "0.30"], "point three"),
      },
      hint: "Two tenths and nine hundredths is still less than three tenths.",
      then: () => "Point three. The tenths digit wins before the hundredths even get a say.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Point seven, or point six nine — bigger?",
      want: { kind: "say", expected: () => choice("0.7", ["0.7", "point seven", "seven", "first", "the first"]) },
      hint: "Compare the tenths first.",
    },
    {
      id: "r2",
      say: () => "Point four, or point four zero — same or different?",
      want: { kind: "say", expected: () => choice("same", ["same", "equal", "the same"]) },
      hint: "What does the zero add?",
    },
  ],
};

export const GRADE_3: Topic[] = [G3a, G3b, G3c];
export const GRADE_5: Topic[] = [G5a, G5b, G5c];

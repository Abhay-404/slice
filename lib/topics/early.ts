/**
 * Kindergarten, Grade 1, Grade 2. Counting, putting together, taking away,
 * tens and ones, the number road, and the first equal parts.
 *
 * Younger children: shorter scripts, one idea per topic, and the pile of
 * things is always something they'd want to count.
 */
import { a, choice, num, pile, type Topic } from "./types";

const K1: Topic = {
  id: "k-count",
  grade: "K",
  n: 1,
  title: "Counting",
  blurb: "Put apples on the table and count them.",
  ccss: "K.CC.B.5",
  scene: "counters",
  setup: { counters: { thing: "apples", count: 0 } },
  hello: (name) => `Hi ${name}! The table's empty. Let's put some apples on it.`,
  steps: [
    {
      id: "five",
      say: () => "Put five apples on the table.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 5, steer: "We want exactly five on the table." },
      hint: "Say: add five.",
    },
    {
      id: "howmany",
      say: () => "Count them for me. How many apples?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Touch each one as you count. One, two…",
      then: () => "Five apples!",
    },
    {
      id: "two-more",
      say: () => "Two more apples roll in. Add them.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 7, steer: "Two more — so add two." },
      hint: "Say: add two.",
    },
    {
      id: "now",
      say: () => "How many now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Count on from five. Six… seven…",
      then: () => "Seven. Five and two more makes seven.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Put eight apples on the table.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 8 },
      hint: "Say: add eight.",
    },
    {
      id: "r2",
      say: () => "How many are there?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Count them.",
    },
  ],
};

const K2: Topic = {
  id: "k-together",
  grade: "K",
  n: 2,
  title: "Putting together",
  blurb: "Three stars, then two more. How many?",
  ccss: "K.OA.A.1",
  scene: "counters",
  setup: { counters: { thing: "stars", count: 3 } },
  hello: (name) => `${name}, there are three stars here. Let's make more.`,
  steps: [
    {
      id: "add2",
      say: () => "Add two more stars.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 5, steer: "Two more — add two." },
      hint: "Say: add two.",
    },
    {
      id: "sum",
      say: () => "Three and two. How many stars altogether?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Count them all.",
      then: () => "Five. Three plus two is five.",
    },
    {
      id: "take1",
      say: () => "One star flies away. Take it off.",
      want: { kind: "do", tool: "take", check: (s) => pile(s).count === 4, steer: "Just one — take one." },
      hint: "Say: take one.",
    },
    {
      id: "left",
      say: () => "How many are left?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Five, take away one.",
      then: () => "Four. Five take away one is four.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "There are four stars. Add three. How many?",
      want: { kind: "say", expected: () => num(7) },
      hint: "Add three first, then count.",
    },
    {
      id: "r2",
      say: () => "Take two away. How many now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Count what's left.",
    },
  ],
};

const K3: Topic = {
  id: "k-ten",
  grade: "K",
  n: 3,
  title: "Making ten",
  blurb: "Six fish. How many more make ten?",
  ccss: "K.OA.A.4",
  scene: "counters",
  setup: { counters: { thing: "fish", count: 6 } },
  hello: (name) => `${name}, six fish in the pond. I want ten.`,
  steps: [
    {
      id: "howmany",
      say: () => "Six fish. How many more do we need to make ten?",
      want: { kind: "say", expected: () => num(4) },
      hint: "Count up from six until you get to ten. Seven, eight…",
      then: () => "Four more.",
    },
    {
      id: "add",
      say: () => "Add them in.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 10, steer: "Add four, so there are ten." },
      hint: "Say: add four.",
    },
    {
      id: "ten",
      say: () => "Ten fish! Now three swim away. Take them off.",
      want: { kind: "do", tool: "take", check: (s) => pile(s).count === 7, steer: "Take three." },
      hint: "Say: take three.",
    },
    {
      id: "left",
      say: () => "How many fish now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Ten, take away three.",
      then: () => "Seven. Ten take away three is seven.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "There are three fish. How many more make ten?",
      want: { kind: "say", expected: () => num(7) },
      hint: "Count up from three.",
    },
    {
      id: "r2",
      say: () => "Add them. Now how many?",
      want: { kind: "say", expected: () => num(10) },
      hint: "Should be ten.",
    },
  ],
};

/* ------------------------------------------------------------------ */

const G1a: Topic = {
  id: "1-add20",
  grade: "1",
  n: 1,
  title: "Adding up to twenty",
  blurb: "Eight blocks, then five more, then more.",
  ccss: "1.OA.C.6",
  scene: "counters",
  setup: { counters: { thing: "blocks", count: 8 } },
  hello: (name) => `${name}, eight blocks on the table. Let's build up to twenty.`,
  steps: [
    {
      id: "add5",
      say: () => "Add five blocks.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 13, steer: "Five more — add five." },
      hint: "Say: add five.",
    },
    {
      id: "sum1",
      say: () => "Eight and five. How many?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Count on from eight: nine, ten, eleven…",
      then: () => "Thirteen. Eight plus five is thirteen.",
    },
    {
      id: "add7",
      say: () => "Add seven more.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 20, steer: "Seven more — add seven." },
      hint: "Say: add seven.",
    },
    {
      id: "sum2",
      say: () => "Thirteen and seven. How many now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Thirteen, then count seven more.",
      then: () => "Twenty! Thirteen plus seven is twenty.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Six blocks. Add nine. How many?",
      want: { kind: "say", expected: () => num(15) },
      hint: "Add nine first.",
    },
    {
      id: "r2",
      say: () => "Add five more. Now?",
      want: { kind: "say", expected: () => num(20) },
      hint: "Fifteen and five.",
    },
  ],
};

const G1b: Topic = {
  id: "1-tens",
  grade: "1",
  n: 2,
  title: "Tens and ones",
  blurb: "Fourteen beads — how many tens, how many ones?",
  ccss: "1.NBT.B.2",
  scene: "counters",
  setup: { counters: { thing: "beads", count: 14 } },
  hello: (name) => `${name}, fourteen beads. Let's find the ten hiding inside.`,
  steps: [
    {
      id: "group",
      say: () => "Put them into groups of ten.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 10, steer: "Groups of ten." },
      hint: "Say: group them in tens.",
    },
    {
      id: "tens",
      say: () => "How many full groups of ten?",
      want: { kind: "say", expected: () => num(1) },
      hint: "Count the full rows.",
      then: () => "One ten.",
    },
    {
      id: "ones",
      say: () => "And how many beads are left over, not in a ten?",
      want: { kind: "say", expected: () => num(4) },
      hint: "Count the ones in the short row.",
      then: () => "Four ones. So fourteen is one ten and four ones.",
    },
    {
      id: "add",
      say: () => "Add six more beads.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 20, steer: "Add six." },
      hint: "Say: add six.",
    },
    {
      id: "tens2",
      say: () => "How many tens now?",
      want: { kind: "say", expected: () => num(2) },
      hint: "Count the full rows of ten.",
      then: () => "Two tens. Twenty is two tens and no ones.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Seventeen beads. Group them in tens. How many tens?",
      want: { kind: "say", expected: () => num(1) },
      hint: "Count the full rows.",
    },
    {
      id: "r2",
      say: () => "How many ones?",
      want: { kind: "say", expected: () => num(7) },
      hint: "The short row.",
    },
  ],
};

const G1c: Topic = {
  id: "1-road",
  grade: "1",
  n: 3,
  title: "The number road",
  blurb: "Walk to 7. Go 5 more. Where are you?",
  ccss: "1.OA.C.5",
  scene: "road",
  setup: { road: 20, max: 20 },
  hello: (name) => `${name}, a road from zero to twenty. Let's go for a walk.`,
  steps: [
    {
      id: "to7",
      say: () => "Walk to seven.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 7 },
      hint: "Seven steps from zero.",
    },
    {
      id: "plus5",
      say: () => "Now walk five more steps. Where do you land?",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 12, steer: "Five steps on from seven." },
      hint: "Seven, then eight, nine, ten, eleven, twelve.",
    },
    {
      id: "where",
      say: () => "What number are you on?",
      want: { kind: "say", expected: (s) => num(s.road?.pos ?? 0) },
      hint: "Read the number under the marker.",
      then: () => "Twelve. Seven plus five is twelve.",
    },
    {
      id: "back4",
      say: () => "Walk back four steps.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 8, steer: "Four steps back from twelve." },
      hint: "Eleven, ten, nine, eight.",
    },
    {
      id: "where2",
      say: () => "And now?",
      want: { kind: "say", expected: (s) => num(s.road?.pos ?? 0) },
      hint: "Read the marker.",
      then: () => "Eight. Twelve take away four is eight.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Walk to nine, then six more. Where are you?",
      want: { kind: "say", expected: () => num(15) },
      hint: "Nine plus six.",
    },
    {
      id: "r2",
      say: () => "Back eight. Now?",
      want: { kind: "say", expected: () => num(7) },
      hint: "Fifteen take away eight.",
    },
  ],
};

/* ------------------------------------------------------------------ */

const G2a: Topic = {
  id: "2-bigger",
  grade: "2",
  n: 1,
  title: "Bigger numbers",
  blurb: "Eighteen, then seven more. Tens and ones again.",
  ccss: "2.NBT.B.5",
  scene: "counters",
  setup: { counters: { thing: "coins", count: 18 } },
  hello: (name) => `${name}, eighteen coins. Let's add some and find the tens.`,
  steps: [
    {
      id: "add7",
      say: () => "Add seven coins.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 25, steer: "Add seven." },
      hint: "Say: add seven.",
    },
    {
      id: "sum",
      say: () => "Eighteen and seven. How many?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Eighteen and two makes twenty, then five more.",
      then: () => "Twenty-five.",
    },
    {
      id: "group",
      say: () => "Group them in tens.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 10 },
      hint: "Say: group in tens.",
    },
    {
      id: "tens",
      say: () => "How many tens, and how many ones? Tell me the tens first.",
      want: { kind: "say", expected: () => num(2) },
      hint: "Count the full rows.",
      then: () => "Two tens.",
    },
    {
      id: "ones",
      say: () => "And the ones?",
      want: { kind: "say", expected: () => num(5) },
      hint: "The short row.",
      then: () => "Five ones. Twenty-five is two tens and five ones.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Fourteen coins. Add nine. How many?",
      want: { kind: "say", expected: () => num(23) },
      hint: "Fourteen and six is twenty, then three more.",
    },
    {
      id: "r2",
      say: () => "How many tens in that?",
      want: { kind: "say", expected: () => num(2) },
      hint: "Twenty-three.",
    },
  ],
};

const G2b: Topic = {
  id: "2-parts",
  grade: "2",
  n: 2,
  title: "Equal parts",
  blurb: "Cut a pizza in two, in four, in three. Name the pieces.",
  ccss: "2.G.A.3",
  scene: "pizza",
  setup: { kind: "pizza", cuts: 1 },
  hello: (name) => `${name}, one whole pizza. Let's cut it into equal parts and name them.`,
  steps: [
    {
      id: "cut2",
      say: () => "Cut it into two equal pieces.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 2, steer: "Two pieces." },
      hint: "Say: cut it in two.",
    },
    {
      id: "half",
      say: () => "Two equal pieces. What's each piece called?",
      want: { kind: "say", expected: () => choice("half", ["half", "halves"], "a half") },
      hint: "When you cut something into two equal pieces, each one is a…",
      then: () => "A half. Two halves make the whole pizza.",
    },
    {
      id: "cut4",
      say: () => "Now cut it into four equal pieces.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 4, steer: "Four pieces." },
      hint: "Say: cut it into four.",
    },
    {
      id: "quarter",
      say: () => "Four equal pieces. What's each one called?",
      want: { kind: "say", expected: () => choice("quarter", ["quarter", "fourth"], "a quarter") },
      hint: "Four equal pieces — each one is a…",
      then: () => "A quarter. Four quarters make the whole.",
    },
    {
      id: "cut3",
      say: () => "Last one. Cut it into three.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 3, steer: "Three pieces." },
      hint: "Say: cut it into three.",
    },
    {
      id: "third",
      say: () => "Three equal pieces. Each one is called a…?",
      want: { kind: "say", expected: () => choice("third", ["third"], "a third") },
      hint: "Three pieces — a th…",
      then: () => "A third. Halves, quarters, thirds — the name tells you how many pieces.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Cut the pizza into four. What's each piece called?",
      want: { kind: "say", expected: () => choice("quarter", ["quarter", "fourth"]) },
      hint: "Four pieces.",
    },
    {
      id: "r2",
      say: () => "Cut it into two. And each piece?",
      want: { kind: "say", expected: () => choice("half", ["half", "halves"]) },
      hint: "Two pieces.",
    },
  ],
};

const G2c: Topic = {
  id: "2-skip",
  grade: "2",
  n: 3,
  title: "Counting in fives",
  blurb: "Five, ten, fifteen. Add them in and count.",
  ccss: "2.NBT.A.2",
  scene: "counters",
  setup: { counters: { thing: "stars", count: 0 } },
  hello: (name) => `${name}, empty table. We're going to count in fives.`,
  steps: [
    {
      id: "first5",
      say: () => "Add five stars.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 5, steer: "Add five." },
      hint: "Say: add five.",
    },
    {
      id: "second5",
      say: () => "Five. Add five more.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 10, steer: "Five more." },
      hint: "Say: add five.",
    },
    {
      id: "ten",
      say: () => "How many now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Five and five.",
      then: () => "Ten.",
    },
    {
      id: "third5",
      say: () => "Five more.",
      want: { kind: "do", tool: "add", check: (s) => pile(s).count === 15, steer: "Five more." },
      hint: "Say: add five.",
    },
    {
      id: "fifteen",
      say: () => "Five, ten… and now?",
      want: { kind: "say", expected: (s) => num(pile(s).count) },
      hint: "Ten and five.",
      then: () => "Fifteen. Five, ten, fifteen — that's counting in fives.",
    },
    {
      id: "group",
      say: () => "Group them in fives so we can see it.",
      want: { kind: "do", tool: "group", check: (s) => pile(s).groupSize === 5 },
      hint: "Say: group in fives.",
    },
    {
      id: "groups",
      say: () => "How many groups of five?",
      want: { kind: "say", expected: () => num(3) },
      hint: "Count the rows.",
      then: () => "Three groups of five is fifteen.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Add five, four times. How many?",
      want: { kind: "say", expected: () => num(20) },
      hint: "Five, ten, fifteen, twenty.",
    },
    {
      id: "r2",
      say: () => "Group in fives. How many groups?",
      want: { kind: "say", expected: () => num(4) },
      hint: "Count the rows.",
    },
  ],
};

export const GRADE_K: Topic[] = [K1, K2, K3];
export const GRADE_1: Topic[] = [G1a, G1b, G1c];
export const GRADE_2: Topic[] = [G2a, G2b, G2c];

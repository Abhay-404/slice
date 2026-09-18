/** Grade 4 — fractions, CCSS 4.NF, in the order they're taught. */
import { eatenOf, leftOf, sameValue } from "../scene";
import { a, b, frac, spoken, whoAteMore, type Topic } from "./types";

/* ------------------------------------------------------------------ */
/* 1 — Making fractions                                                */

const making: Topic = {
  id: "making",
  grade: "4",
  n: 1,
  title: "Making fractions",
  blurb: "Cut a pizza, eat some, say what you ate.",
  ccss: "4.NF.A.1",
  scene: "pizza",
  setup: { kind: "pizza", cuts: 1 },
  hello: (name) => `Hi ${name}! I've got a whole pizza here and it's all yours. Let's cut it up.`,
  steps: [
    {
      id: "cut",
      say: () => "How many slices do you want? Pick any number from two to twelve.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts >= 2 },
      hint: "Just say a number. Six? Eight? Your pizza.",
    },
    {
      id: "eat",
      say: (s) => `${a(s).cuts} slices. Go on then, you're hungry. Eat some — how many?`,
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length >= 1 && a(s).eaten.length < a(s).cuts },
      hint: "Say how many slices to eat. Leave at least one for later!",
    },
    {
      id: "ate",
      say: (s) => `You ate ${a(s).eaten.length} out of ${a(s).cuts}. What fraction of the pizza is that?`,
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "The bottom number is how many slices there were. The top is how many you ate.",
      then: (s) => `${spoken(eatenOf(a(s)))}. Top number: slices you ate. Bottom number: slices there were.`,
    },
    {
      id: "left",
      say: () => "And what fraction is still on the plate?",
      want: { kind: "say", expected: (s) => frac(leftOf(a(s))) },
      hint: "Count the slices that are still there. Same bottom number.",
      then: (s) => `${spoken(leftOf(a(s)))} left. Eaten plus left always makes the whole pizza.`,
    },
    {
      id: "recut",
      say: () => "New pizza. Cut this one into a different number of slices.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts >= 2 },
      hint: "Any number you didn't use before.",
    },
    {
      id: "one",
      say: () => "Eat exactly one slice.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 1 },
      hint: "Just one.",
    },
    {
      id: "onefrac",
      say: () => "One slice. What fraction is that?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "One on top. How many slices on the bottom?",
      then: (s) => `${spoken(eatenOf(a(s)))}. One piece out of ${a(s).cuts}.`,
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Show me three quarters. Cut the pizza and eat the right amount.",
      want: { kind: "do", tool: "eat", check: (s) => sameValue(eatenOf(a(s)), { n: 3, d: 4 }) },
      hint: "Four slices, eat three.",
    },
    {
      id: "r2",
      say: () => "Now show me two sixths.",
      want: { kind: "do", tool: "eat", check: (s) => sameValue(eatenOf(a(s)), { n: 2, d: 6 }) },
      hint: "Six slices this time.",
    },
    {
      id: "r3",
      say: () => "What fraction is left on the plate?",
      want: { kind: "say", expected: (s) => frac(leftOf(a(s))) },
      hint: "Count what's still there.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 2 — Same amount, smaller pieces                                     */

const equivalent: Topic = {
  id: "equivalent",
  grade: "4",
  n: 2,
  title: "Same amount, smaller pieces",
  blurb: "Cut the pieces smaller. The chocolate doesn't change.",
  ccss: "4.NF.A.1",
  scene: "bar",
  setup: { kind: "bar", cuts: 2 },
  hello: (name) => `${name}, here's a chocolate bar snapped into two halves. Something sneaky is about to happen.`,
  steps: [
    {
      id: "eat1",
      say: () => "Eat one of the two pieces.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 1 && a(s).cuts === 2 },
      hint: "Just one piece.",
    },
    {
      id: "half",
      say: () => "What fraction did you eat?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "One piece out of two.",
      then: () => "One half. Now watch the chocolate you ate — don't take your eyes off it.",
    },
    {
      id: "cut4",
      say: () => "Cut every piece in half. So cut the bar into four.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 4, steer: "They need to cut into exactly four." },
      hint: "Four pieces.",
    },
    {
      id: "quarters",
      say: () => "Same chocolate's gone — look, the gap didn't move. What fraction is it now?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Count the missing pieces. Count all the pieces.",
      then: () => "Two quarters. Same chocolate as one half. Different numbers, same amount.",
    },
    {
      id: "cut8",
      say: () => "Do it again. Cut every piece in half — eight pieces.",
      want: { kind: "do", tool: "cut", check: (s) => a(s).cuts === 8, steer: "They need exactly eight." },
      hint: "Eight.",
    },
    {
      id: "eighths",
      say: () => "And now?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Same trick. Count the gap, count the pieces.",
      then: () =>
        "Four eighths. One half, two quarters, four eighths — the same chocolate every single time. That's called equivalent.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Cut the bar into six and eat three. What fraction is that the same as?",
      want: { kind: "say", expected: () => frac({ n: 1, d: 2 }) },
      hint: "Three out of six. Is that half the bar?",
    },
    {
      id: "r2",
      say: () => "Cut into eight and eat two. What's that the same as?",
      want: { kind: "say", expected: () => frac({ n: 1, d: 4 }) },
      hint: "Two eighths. Is that a quarter?",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 3 — Which is bigger?                                                */

const compare: Topic = {
  id: "compare",
  grade: "4",
  n: 3,
  title: "Which is bigger?",
  blurb: "Two pizzas, cut differently. Who ate more?",
  ccss: "4.NF.A.2",
  scene: "two",
  setup: { kind: "pizza", cuts: 4 },
  hello: (name) => `${name}, you and your friend Sam both got a pizza. Same size. Let's see who ate more.`,
  steps: [
    {
      id: "you",
      say: () => "Yours is cut into four. Eat one slice.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 1 },
      hint: "One slice of yours.",
    },
    {
      id: "sam",
      say: () => "Sam's pizza is the same size, but cut into eight. Bring Sam's pizza in — cut into eight.",
      want: { kind: "do", tool: "second", check: (s) => !!s.b && b(s).cuts === 8, steer: "Second pizza, eight slices." },
      hint: "Say: Sam's pizza, eight slices.",
    },
    {
      id: "sameats",
      say: () => "Sam eats one slice too.",
      want: { kind: "do", tool: "eat", check: (s) => !!s.b && b(s).eaten.length === 1, steer: "Eat one from Sam's — the second pizza." },
      hint: "One slice from Sam's pizza.",
    },
    {
      id: "who",
      say: () => "You both ate one slice. Who ate more pizza — you, or Sam?",
      want: { kind: "say", expected: whoAteMore },
      hint: "Look at the size of each slice, not the number of them.",
    },
    {
      id: "overlay",
      say: () => "Let's check. Put Sam's pizza on top of yours.",
      want: { kind: "do", tool: "overlay", check: (s) => s.overlay },
      hint: "Say: put them on top of each other.",
      then: () =>
        "Your slice is bigger. Eight is more than four — but more slices means each slice is smaller. Your quarter beats Sam's eighth.",
    },
    {
      id: "sam2",
      say: () => "Sam's still hungry. Sam eats one more.",
      want: { kind: "do", tool: "eat", check: (s) => !!s.b && b(s).eaten.length === 2, steer: "One more from Sam's." },
      hint: "Another slice from Sam's pizza.",
    },
    {
      id: "who2",
      say: () => "Now who's eaten more?",
      want: { kind: "say", expected: whoAteMore },
      hint: "Look at the gap in each pizza.",
      then: () => "The same! Two eighths is exactly one quarter. Two little slices make one big one.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Cut yours into three and eat one. Bring in Sam's cut into six, Sam eats one. Who ate more?",
      want: { kind: "say", expected: whoAteMore },
      hint: "Whose slice is bigger?",
    },
    {
      id: "r2",
      say: () => "Sam eats one more. Now who?",
      want: { kind: "say", expected: whoAteMore },
      hint: "Look at the gaps.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 4 — Putting pieces together                                         */

const adding: Topic = {
  id: "adding",
  grade: "4",
  n: 4,
  title: "Putting pieces together",
  blurb: "Eat some, eat more. Count the slices, keep the size.",
  ccss: "4.NF.B.3",
  scene: "pizza",
  setup: { kind: "pizza", cuts: 8 },
  hello: (name) => `${name}, pizza's cut into eight. You're going to eat it in two goes.`,
  steps: [
    {
      id: "eat2",
      say: () => "First go: eat two slices.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 2 },
      hint: "Two slices.",
    },
    {
      id: "eat3",
      say: () => "Second go: eat three more.",
      want: { kind: "do", tool: "eat", check: (s) => a(s).eaten.length === 5 },
      hint: "Three more on top of the two.",
    },
    {
      id: "total",
      say: () => "Two eighths, then three eighths. How many eighths altogether?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Just count the empty spaces. They're all eighths.",
      then: () => "Five eighths. Two and three make five, and they stay eighths — the slices don't change size when you add them.",
    },
    {
      id: "back",
      say: () => "Oops, too full. Put one slice back.",
      want: { kind: "do", tool: "putBack", check: (s) => a(s).eaten.length === 4 },
      hint: "Put one back on the plate.",
    },
    {
      id: "now",
      say: () => "What fraction's eaten now?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Five take away one.",
      then: () => "Four eighths. Which is the same as a half — you ate half the pizza.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Cut into six. Eat one, then eat two more. How many sixths?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Count the gaps.",
    },
    {
      id: "r2",
      say: () => "Put two back. What's eaten now?",
      want: { kind: "say", expected: (s) => frac(eatenOf(a(s))) },
      hint: "Three take away two.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 5 — Point-something                                                 */

const decimals: Topic = {
  id: "decimals",
  grade: "4",
  n: 5,
  title: "Point-something",
  blurb: "Tenths on a road. 0.7 and 0.15 — which is bigger?",
  ccss: "4.NF.C.7",
  scene: "road",
  setup: { road: 10 },
  hello: (name) => `${name}, here's a road from zero to one. It's split into ten steps, so each step is one tenth.`,
  steps: [
    {
      id: "three",
      say: () => "Walk to three tenths.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 3 },
      hint: "Three steps from zero.",
      then: () => "Three tenths. Written as a decimal, that's zero point three. Point three.",
    },
    {
      id: "seven",
      say: () => "Now walk to point seven.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 7 },
      hint: "Point seven is seven tenths. Seven steps.",
    },
    {
      id: "half",
      say: () => "Where's halfway along the road? Show me the half.",
      want: { kind: "do", tool: "showHalf", check: (s) => !!s.road?.showHalf },
      hint: "Say: show the half.",
    },
    {
      id: "morehalf",
      say: () => "Is point seven more than a half, or less?",
      want: {
        kind: "say",
        expected: () => ({ kind: "choice", answer: "more", accept: ["more", "bigger", "past", "over", "after", "greater"], spoken: "more" }),
      },
      hint: "Look where the marker is compared to the half line.",
      then: () => "More. Five tenths is a half, and seven is past it.",
    },
    {
      id: "which",
      say: () => "Last one. Point seven, or point one five — which is bigger?",
      want: {
        kind: "say",
        expected: () => ({ kind: "choice", answer: "0.7", accept: ["0.7", "point seven", "seven", "the first", "first", "0.70"], spoken: "point seven" }),
      },
      hint: "Fifteen looks big. But how many tenths is point one five? One tenth and a bit.",
      then: () =>
        "Point seven. It's seven tenths. Point one five is only one tenth and a little more. The first number after the point is the one that matters.",
    },
  ],
  review: [
    {
      id: "r1",
      say: () => "Walk to point four.",
      want: { kind: "do", tool: "moveTo", check: (s) => s.road?.pos === 4 },
      hint: "Four steps.",
    },
    {
      id: "r2",
      say: () => "Point four, or point two five — bigger?",
      want: {
        kind: "say",
        expected: () => ({ kind: "choice", answer: "0.4", accept: ["0.4", "point four", "four", "first", "the first"], spoken: "point four" }),
      },
      hint: "Which has more tenths?",
    },
  ],
};


export const GRADE4: Topic[] = [making, equivalent, compare, adding, decimals];

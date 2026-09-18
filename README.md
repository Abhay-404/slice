# Slice

**A voice-first maths playground for K–5. The child talks; the screen does what they say.**

Built for the [Nerdy AI Hackathon](https://hackathon.nerdy.com/) — Prompt 1, K–5 Math Game.

> *"Cut it into eight."* — the pizza cuts itself into eight.
> *"Eat three."* — three slices lift off.
> *"What fraction did you eat?"* — **three eighths** — and the tutor moves on.

It works with the screen off. Every change plays a sound and is announced to a screen reader, so a blind child gets the same lesson and the same tutor.

---

## What it is

A child picks a chapter. A scene fills the screen — a pizza, a chocolate bar, a pile of apples, a number road. A tutor voice (Gemini Live) asks a question. The child answers out loud, and the scene changes as they speak. About five exchanges per chapter, three or four minutes each.

**Twenty chapters, K through 5**, in the order the ideas are taught, aligned to US Common Core:

| Grade | Chapters |
|---|---|
| K | Counting · Putting together · Making ten |
| 1 | Adding to twenty · Tens and ones · The number road |
| 2 | Bigger numbers · Equal parts · Counting in fives |
| 3 | Groups of · Sharing out · Your first fractions |
| 4 | Making fractions · Same amount, smaller pieces · Which is bigger? · Putting pieces together · Point-something |
| 5 | A half plus a quarter · A third of twelve · Hundredths |

Each chapter has a **quick review** — the same scene, challenges only, no teaching.

**For parents:** a gated page with the child's real record — every answer, verbatim, right and wrong — one concrete thing to practise, and a chat with the tutor grounded in that record. *"What did Maya get wrong?"* gets an answer that quotes her.

**A class leaderboard**, because kids like winning. (Practice classmates on this device — there's no server.)

## How it works

The interesting part is what the tutor is *not* allowed to do.

```
child speaks  →  tutor calls a tool, e.g. cut(8)   (immediately, before it says anything)
              →  the app updates the scene and checks the chapter's script
              →  the tool returns { say: "…the next line…" }
              →  the tutor reads it out
```

**The tutor never grades and never decides what comes next.** The app owns the script; every tool result carries the tutor's next line. When the child answers a question, the tutor calls `answer(said)` and reads back whatever the app decided — it is never asked to judge. That's why it responds quickly (one tool call, then speech) and why it can't be talked into agreeing that one eighth is bigger than one quarter.

**Expected answers are computed from the scene, not hardcoded.** Cut the pizza into six instead of eight and every question that follows is about sixths. The maths follows the child.

### Pieces

- `lib/scene.ts` — the scene: pizzas, bars, piles, roads. A reducer every tool and every tap goes through. Also parses what a child says: *"um, three eighths"*, *"twenty three"*, *"maybe five?"*.
- `lib/topics/` — the chapters. A script of checkpoints per chapter: what the tutor says, and what the child must *do* (a tool call) or *say* (an answer) to move on.
- `lib/tutor.ts` — the tutor's instruction and tools.
- `lib/live/` — Gemini Live over WebSocket from the browser, with ephemeral tokens minted server-side so the API key never leaves the server. Barge-in, transcripts of both sides, a jitter buffer.
- `lib/earcons.ts` — one synthesised sound per event. Nothing to load.
- `components/Playground.tsx` — the screen. Voice and touch land on the same state.
- `components/scene/` — the drawings. Slices lift off when eaten; cuts grow from the centre; piles snap into groups.
- `app/parents/` — the parent page and its chat, backed by `app/api/parent-chat`.

## Run it

```bash
npm install
cp .env.example .env.local      # add GEMINI_API_KEY
npm run dev
```

Open `http://localhost:3000`. The mic needs a secure context — `localhost` counts. On a phone, tunnel it (`npx cloudflared tunnel --url http://localhost:3000`).

Voice: `gemini-3.8-live`. Parent chat: `gemini-3.8-flash`. Both in one place: `lib/live/config.ts`.

## Prior work

Two earlier projects of mine fed into this and are cited rather than reused:

- **[LessonLoom](https://github.com/Abhay-404/lessonloom)** — a multi-agent lesson generator with adversarial review. The pedagogy here (no lecture slides; concrete → representational → abstract; the naming arrives *after* the attempt) comes from its production spec.
- **[Disha](https://github.com/Abhay-404/Disha)** — a voice-first companion for blind Windows users. The earcon vocabulary and the "describe, never point" rule for the tutor come from building that.

Everything in this repository was built during the hackathon window.

## What I'd do next

- **Let the tutor point.** `highlight()` exists; the scripts don't use it yet. "This slice" should glow.
- **Real classmates.** The leaderboard is local. A classroom code would make it real.
- **Grades 3 and 5 deeper.** They have three chapters each; Grade 4 has five.
- **Haptics on the phone** to go with the sounds.

## Licence

MIT.

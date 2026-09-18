"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SceneView from "@/components/scene/SceneView";
import VoiceOrb from "@/components/VoiceOrb";
import { play, setEarcons, unlockAudio, type Earcon } from "@/lib/earcons";
import { useLiveSession } from "@/lib/live";
import { useProfile } from "@/lib/progress";
import { EMPTY, eatenOf, reduce, type Action, type Scene } from "@/lib/scene";
import { TUTOR_INSTRUCTION, directions, tutorTools } from "@/lib/tutor";
import { matches, type Checkpoint, type ToolName, type Topic } from "@/lib/topics";

export const TOPIC_XP = 30;
export const REVIEW_XP = 15;

/**
 * The playground. A scene the kid controls by talking, and a tutor voice
 * that walks them through a script. Every tool call returns the tutor's
 * next line, decided here from the script and the scene — the tutor never
 * has to work out what comes next, and never decides whether an answer is
 * right.
 *
 * It works with the screen off. Every change to the scene plays a sound
 * and is announced to a screen reader; the tutor's lines describe what's
 * there rather than pointing at it. Touch does what voice does.
 */
export default function Playground({ topic, mode }: { topic: Topic; mode: "play" | "review" }) {
  const { profile, recordAnswer, recordHint, completeTopic, recordReview } = useProfile();
  const name = profile.name || "there";
  const steps = mode === "play" ? topic.steps : topic.review;

  /* ---- state, mirrored into refs for the socket callbacks ---- */
  const [scene, setScene] = useState<Scene>(() => initial(topic));
  const [ci, setCi] = useState(0);
  const [line, setLine] = useState<string>(() => steps[0]?.say(initial(topic), name) ?? "");
  const [hints, setHints] = useState(0);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);
  const [typed, setTyped] = useState("");
  const [announce, setAnnounce] = useState("");
  const started = useRef<number>(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const ref = useRef({ scene, ci, hints, misses, done });
  useEffect(() => {
    ref.current = { scene, ci, hints, misses, done };
  });

  useEffect(() => {
    setEarcons(true);
  }, []);

  const dispatch = useCallback((a: Action, sound?: Earcon) => {
    const next = reduce(ref.current.scene, a);
    ref.current.scene = next;
    setScene(next);
    if (sound) play(sound);
    return next;
  }, []);

  /** Tell a screen reader what's on the table now. */
  const say = useCallback((text: string) => {
    setAnnounce(""); // clear first so an identical line is re-read
    queueMicrotask(() => setAnnounce(text));
  }, []);

  /* ---- the script engine ---- */

  const advance = useCallback(
    (s: Scene, from: Checkpoint): string => {
      const next = ref.current.ci + 1;
      const then = from.then?.(s) ?? "";
      play("correct");
      if (next >= steps.length) {
        ref.current.ci = next;
        setCi(next);
        const stars = starsFor(ref.current.hints, ref.current.misses, steps.length);
        const secs = Math.round((Date.now() - started.current) / 1000);
        if (mode === "play") completeTopic(topic.id, stars, secs, TOPIC_XP);
        else recordReview(topic.id, Math.max(0, 1 - ref.current.misses / (steps.length * 2)), REVIEW_XP);
        setDone(true);
        setLine(then || "That's everything!");
        dispatch({ type: "party" }, "party");
        say(`${then} Finished, with ${stars} stars.`);
        return `${then} ${directions.finished(name, stars)}`;
      }
      ref.current.ci = next;
      setCi(next);
      const ask = steps[next].say(s, name);
      setLine(ask);
      say(`${then} ${ask}`);
      return then ? `${then}\n\n${ask}` : ask;
    },
    [steps, mode, name, topic.id, completeTopic, recordReview, dispatch, say],
  );

  const afterTool = useCallback(
    (tool: ToolName, s: Scene): { ok: true; say: string } => {
      const cp = steps[ref.current.ci];
      const desc = describe(s);
      if (!cp || ref.current.done) return { ok: true, say: "" };
      if (cp.want.kind !== "do") {
        say(`${desc} ${cp.say(s, name)}`);
        return { ok: true, say: `${desc} ${cp.say(s, name)}` };
      }
      if (cp.want.tool !== tool) {
        say(`${desc} ${cp.say(s, name)}`);
        return { ok: true, say: `${desc} ${cp.say(s, name)}` };
      }
      if (cp.want.check && !cp.want.check(s)) {
        const steer = cp.want.steer ?? cp.hint;
        say(`${desc} ${steer}`);
        return { ok: true, say: `${desc} ${steer}` };
      }
      return { ok: true, say: `${desc} ${advance(s, cp)}` };
    },
    [steps, name, advance, say],
  );

  const onAnswer = useCallback(
    (said: string): { correct: boolean; say: string } => {
      const cp = steps[ref.current.ci];
      const s = ref.current.scene;
      if (!cp || ref.current.done) return { correct: false, say: "We're all done here!" };
      if (cp.want.kind !== "say") return { correct: false, say: `First: ${cp.say(s, name)}` };
      const ok = matches(said, cp.want.expected(s));
      recordAnswer(topic.id, { q: cp.id, asked: cp.say(s, name), said, correct: ok });
      if (ok) return { correct: true, say: advance(s, cp) };
      ref.current.misses += 1;
      setMisses((m) => m + 1);
      ref.current.hints += 1;
      setHints((h) => h + 1);
      recordHint(topic.id);
      play("hint");
      setLine(cp.hint);
      say(cp.hint);
      return { correct: false, say: cp.hint };
    },
    [steps, name, topic.id, recordAnswer, recordHint, advance, say],
  );

  /* ---- the tutor ---- */
  const live = useLiveSession({
    toolSpecs: tutorTools,
    toolHandlers: {
      cut: ({ n }) => afterTool("cut", dispatch({ type: "cut", n }, "cut")),
      eat: ({ n }) => afterTool("eat", dispatch({ type: "eat", n }, "eat")),
      putBack: ({ n }) => afterTool("putBack", dispatch({ type: "putBack", n }, "putBack")),
      second: ({ cuts }) => afterTool("second", dispatch({ type: "second", cuts }, "cut")),
      eatSecond: ({ n }) => afterTool("eat", dispatch({ type: "eat", n, which: "b" }, "eat")),
      overlay: ({ on }) => afterTool("overlay", dispatch({ type: "overlay", on }, "group")),
      moveTo: ({ pos }) => afterTool("moveTo", dispatch({ type: "moveTo", pos }, "move")),
      showHalf: ({ on }) => afterTool("showHalf", dispatch({ type: "showHalf", on }, "tick")),
      add: ({ n }) => afterTool("add", dispatch({ type: "add", n }, "add")),
      take: ({ n }) => afterTool("take", dispatch({ type: "take", n }, "take")),
      group: ({ size }) => afterTool("group", dispatch({ type: "group", size: size || null }, "group")),
      highlight: ({ pieces }) => {
        dispatch(ref.current.scene.counters ? { type: "highlightCounters", pieces } : { type: "highlight", pieces });
        return { ok: true, say: "" };
      },
      answer: ({ said }) => onAnswer(said),
      celebrate: () => {
        dispatch({ type: "party" }, "party");
        return { ok: true, say: "" };
      },
    },
    systemInstruction: TUTOR_INSTRUCTION,
  });

  const opened = useRef(false);
  useEffect(() => {
    if (!live.isLive) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    play("listen");
    const s0 = ref.current.scene;
    const first = steps[ref.current.ci]?.say(s0, name) ?? "";
    // The whole plan and the exact state of the screen, before a word is said.
    live.sendText(directions.context(topic.title, describe(s0), steps.map((st) => st.say(s0, name))));
    live.sendText(mode === "play" ? directions.open(topic.hello(name), first) : directions.reviewOpen(name, first));
  }, [live.isLive, live, steps, name, mode, topic]);

  /* ---- touch fallbacks ---- */
  function run(a: Action, tool: ToolName, sound: Earcon) {
    if (done) return;
    const s = dispatch(a, sound);
    const r = afterTool(tool, s);
    if (r.say) {
      setLine(visible(r.say));
      if (live.isLive) live.sendText(directions.beat(r.say));
    }
  }
  function tap(which: "a" | "b", piece: number) {
    const f = which === "a" ? scene.a : scene.b;
    if (!f) return;
    const eaten = f.eaten.includes(piece);
    run(eaten ? { type: "putBack", n: 1, which } : { type: "eat", n: 1, which }, eaten ? "putBack" : "eat", eaten ? "putBack" : "eat");
  }
  function tapCounter() {
    run({ type: "take", n: 1 }, "take", "take");
  }
  function submitTyped() {
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    const r = onAnswer(t);
    setLine(visible(r.say));
    if (live.isLive) live.sendText(directions.beat(r.say));
  }

  const cp = steps[ci];
  const needsWords = cp?.want.kind === "say" && !done;
  const needsAction = cp?.want.kind === "do" && !done;

  // ?demo=1 — for recording: drive the scene from the console the way a
  // voice command would, and show the orb listening. Never set in real use.
  const demo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  useEffect(() => {
    if (!demo) return;
    const w = window as unknown as { __tm?: unknown };
    w.__tm = {
      run: (a: Action, tool: ToolName, sound: Earcon = "tick") => run(a, tool, sound),
      answer: (said: string) => {
        const r = onAnswer(said);
        setLine(visible(r.say));
      },
    };
    return () => {
      delete w.__tm;
    };
  });

  return (
    <main className="tm-app relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-4 pb-64">
      {/* screen reader channel: every change in the scene, and every line */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/home"
          aria-label="Back to topics"
          className="grid place-items-center rounded-full"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,.65)", color: "var(--tm-ink-soft)" }}
        >
          ✕
        </Link>
        <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={ci} aria-label="Progress">
          {steps.map((s, k) => (
            <span
              key={s.id}
              className="h-2 flex-1 rounded-full"
              style={{
                background: k < ci ? "var(--tm-monster)" : k === ci && !done ? "var(--tm-angel)" : "rgba(255,255,255,.7)",
                transition: "background 260ms",
              }}
            />
          ))}
        </div>
      </div>

      <p
        key={line}
        className="tm-bubble tm-pop tm-display mt-4"
        style={{ margin: "1rem 0 0", fontSize: "clamp(1.05rem, 4.4vw, 1.25rem)", lineHeight: 1.3, whiteSpace: "pre-line" }}
      >
        {line}
      </p>

      <div className="flex flex-1 items-center justify-center py-4" onPointerDownCapture={unlockAudio}>
        <SceneView scene={scene} onTap={tap} onTapCounter={tapCounter} />
      </div>

      {done ? (
        <div className="flex flex-col gap-2">
          <p className="tm-display m-0 text-center" style={{ fontSize: "1.1rem" }} aria-label={`${starsFor(hints, misses, steps.length)} out of 3 stars`}>
            {"★".repeat(starsFor(hints, misses, steps.length))}
            <span style={{ opacity: 0.25 }} aria-hidden>
              {"★".repeat(3 - starsFor(hints, misses, steps.length))}
            </span>
          </p>
          <Link href="/home" className="tm-press tm-press-go w-full">
            Back to topics
          </Link>
          {mode === "play" && (
            <Link href={`/review/${topic.id}`} className="tm-press w-full">
              Quick review
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="m-0 text-center" style={{ fontSize: "0.85rem", color: "var(--tm-ink-soft)" }}>
            {live.isLive || demo
              ? needsWords
                ? "Say your answer"
                : "Tell the tutor what to do"
              : needsWords
                ? "Tap the mic and say it — or type below"
                : "Tap the mic and say it — or use the buttons"}
          </p>
          {needsWords && !live.isLive && !demo && (
            <form
              className="flex w-full gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type your answer"
                aria-label="Your answer"
                className="tm-card flex-1 px-3"
                style={{ minHeight: "var(--tm-tap)", outline: "none" }}
              />
              <button type="submit" className="tm-press tm-press-gold" style={{ minHeight: "var(--tm-tap)" }}>
                Go
              </button>
            </form>
          )}
          {needsAction && !live.isLive && !demo && cp.want.kind === "do" && (
            <DoButtons tool={cp.want.tool} ticks={scene.road?.ticks ?? 0} hasPile={!!scene.counters} run={run} />
          )}
        </div>
      )}


      {!done && (
        <VoiceOrb
          who="angel"
          align="left"
          state={demo ? "listening" : live.orbState}
          level={live.micLevel}
          transcript={live.orbTranscript.map((l) => (l.who === "monster" ? { ...l, who: "angel" as const } : l))}
          errorText={live.errorText}
          onStart={() => {
            unlockAudio();
            void live.start();
          }}
          onStop={() => void live.stop()}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */

/** Strip [stage directions] — they're for the tutor, never the screen. */
const visible = (s: string) => s.replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();

function initial(topic: Topic): Scene {
  const su = topic.setup;
  if ("road" in su) return reduce(EMPTY, { type: "road", ticks: su.road, max: su.max ?? 1 });
  if ("counters" in su) return reduce(EMPTY, { type: "counters", thing: su.counters.thing, count: su.counters.count });
  return reduce(EMPTY, { type: "start", kind: su.kind, cuts: su.cuts });
}

function starsFor(hints: number, misses: number, n: number): number {
  const slips = hints + misses;
  if (slips <= 1) return 3;
  if (slips <= Math.max(2, Math.floor(n / 2))) return 2;
  return 1;
}

/** What's on the table, in words. For the screen reader and for the tutor. */
export function describe(s: Scene): string {
  if (s.counters) {
    const c = s.counters;
    if (c.count === 0) return `The table is empty.`;
    if (c.groupSize) {
      const g = Math.floor(c.count / c.groupSize), r = c.count % c.groupSize;
      return `${c.count} ${c.thing}, in ${g} group${g === 1 ? "" : "s"} of ${c.groupSize}${r ? ` and ${r} left over` : ""}.`;
    }
    return `${c.count} ${c.thing}.`;
  }
  if (s.road) {
    const r = s.road;
    const at = r.pos === null ? "The marker is at zero." : r.max === 1 ? `The marker is at ${r.pos} tenths.` : `The marker is at ${Math.round((r.pos / r.ticks) * r.max)}.`;
    return `${at}${r.showHalf ? " The halfway line is showing." : ""}`;
  }
  const one = (f: NonNullable<Scene["a"]>, who: string) => {
    const e = eatenOf(f);
    const thing = f.kind === "pizza" ? "pizza" : "bar";
    if (f.cuts === 1) return `${who} ${thing} is whole.`;
    return `${who} ${thing} is cut into ${f.cuts}. ${e.n} eaten, ${f.cuts - e.n} left.`;
  };
  const parts: string[] = [];
  if (s.a) parts.push(one(s.a, "Your"));
  if (s.b) parts.push(one(s.b, "Sam's"));
  if (s.overlay) parts.push("They're on top of each other.");
  return parts.join(" ");
}

/** Touch stand-ins for what a voice would say, only for the tool the current beat wants. */
function DoButtons({
  tool,
  ticks,
  hasPile,
  run,
}: {
  tool: ToolName;
  ticks: number;
  hasPile: boolean;
  run: (a: Action, tool: ToolName, sound: Earcon) => void;
}) {
  const btn = "tm-press tm-figure";
  const sm = { minWidth: 42, minHeight: 42, padding: 0, fontSize: "0.95rem" } as const;
  const row = (nums: number[], mk: (n: number) => Action, t: ToolName, snd: Earcon, label?: string) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {label && <span className="w-full text-center" style={{ fontSize: "0.8rem", color: "var(--tm-ink-faint)" }}>{label}</span>}
      {nums.map((n) => (
        <button key={n} type="button" onClick={() => run(mk(n), t, snd)} className={btn} style={sm} aria-label={`${label ?? tool} ${n}`}>
          {n}
        </button>
      ))}
    </div>
  );

  if (tool === "cut") return row([2, 3, 4, 5, 6, 8, 10, 12], (n) => ({ type: "cut", n }), "cut", "cut", "Cut into");
  if (tool === "second") return row([2, 3, 4, 6, 8, 12], (n) => ({ type: "second", cuts: n }), "second", "cut", "Sam's, cut into");
  if (tool === "add" && hasPile) return row([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (n) => ({ type: "add", n }), "add", "add", "Add");
  if (tool === "take" && hasPile) return row([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (n) => ({ type: "take", n }), "take", "take", "Take away");
  if (tool === "group" && hasPile) return row([2, 3, 4, 5, 6, 10], (n) => ({ type: "group", size: n }), "group", "group", "Groups of");
  if (tool === "overlay")
    return (
      <button type="button" onClick={() => run({ type: "overlay", on: true }, "overlay", "group")} className="tm-press tm-press-gold" style={{ minHeight: 44, padding: "0 16px" }}>
        Put them on top of each other
      </button>
    );
  if (tool === "moveTo" || tool === "showHalf") {
    const step = ticks > 20 ? 5 : 1;
    const nums = Array.from({ length: Math.floor(ticks / step) + 1 }, (_, i) => i * step);
    return (
      <div className="flex flex-wrap justify-center gap-1.5">
        {nums.map((i) => (
          <button key={i} type="button" onClick={() => run({ type: "moveTo", pos: i }, "moveTo", "move")} className={btn} style={sm} aria-label={`Walk to ${i}`}>
            {i}
          </button>
        ))}
        <button type="button" onClick={() => run({ type: "showHalf", on: true }, "showHalf", "tick")} className="tm-press tm-press-gold" style={{ minHeight: 42, padding: "0 12px" }} aria-label="Show the half">
          ½
        </button>
      </div>
    );
  }
  return null; // eat / putBack: tap the pieces themselves
}

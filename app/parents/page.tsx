"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EMPTY_TOPIC, useProfile, type Profile } from "@/lib/progress";
import { topicsFor, type Topic } from "@/lib/topics";

/**
 * For the grown-up. What the child did, what they actually said, where they
 * slipped, and one concrete thing to practise. Gated with a times-table
 * question — the convention in children's apps, and on-brand here.
 */
export default function Parents() {
  const { ready, profile, reset } = useProfile();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  // Varies per child, stays put per child — a gate, not a lock.
  const gate = useMemo(() => {
    const seed = profile.name.length + profile.xp;
    return { a: 6 + (seed % 4), b: 6 + ((seed * 7) % 4) };
  }, [profile.name.length, profile.xp]);

  if (!ready) return null;

  if (!open) {
    const ok = Number(typed) === gate.a * gate.b;
    return (
      <main className="tm-app mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="tm-display m-0" style={{ fontSize: "0.8rem", color: "var(--tm-ink-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          For parents
        </p>
        <h1 className="mt-2" style={{ fontSize: "1.6rem" }}>
          Quick check: what&rsquo;s {gate.a} &times; {gate.b}?
        </h1>
        <form
          className="mt-4 flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) setOpen(true);
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="tm-card tm-figure flex-1 text-center"
            style={{ minHeight: "3.2rem", fontSize: "1.4rem", outline: "none" }}
            aria-label="Answer"
          />
          <button type="submit" disabled={!ok} className="tm-press tm-press-gold" style={{ minHeight: "3.2rem" }}>
            Open
          </button>
        </form>
        <Link href="/home" className="mt-6" style={{ color: "var(--tm-ink-soft)", fontSize: "0.9rem" }}>
          Back
        </Link>
      </main>
    );
  }

  const TOPICS = topicsFor(profile.grade);
  const rows = TOPICS.map((t) => ({ t, r: profile.topics[t.id] ?? EMPTY_TOPIC }));
  const done = rows.filter((x) => x.r.done);
  const answers = rows.flatMap((x) => x.r.answers.map((a) => ({ ...a, topic: x.t })));
  const wrong = answers.filter((a) => !a.correct);
  const minutes = Math.round(rows.reduce((n, x) => n + x.r.seconds, 0) / 60);
  const accuracy = answers.length ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : null;

  // The one thing to practise: the topic with the most slips, or the next one.
  const weakest = [...rows]
    .filter((x) => x.r.done)
    .sort((p, q) => q.r.hints + q.r.answers.filter((a) => !a.correct).length - (p.r.hints + p.r.answers.filter((a) => !a.correct).length))[0];
  const next = rows.find((x) => !x.r.done);

  return (
    <main className="tm-app mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="tm-display m-0" style={{ fontSize: "0.75rem", color: "var(--tm-ink-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            For parents
          </p>
          <h1 style={{ fontSize: "1.6rem" }}>{profile.name}, Grade {profile.grade}</h1>
        </div>
        <Link href="/home" className="tm-press" style={{ minHeight: "2.6rem", padding: "0 1rem", fontSize: "0.9rem" }}>
          Done
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="Topics done" value={`${done.length} / ${TOPICS.length}`} />
        <Tile label="Answers right" value={accuracy === null ? "—" : `${accuracy}%`} />
        <Tile label="Time" value={minutes ? `${minutes} min` : "—"} />
      </div>

      <section className="tm-card mt-4 p-4" style={{ borderLeft: "5px solid var(--tm-angel)" }}>
        <p className="tm-display m-0" style={{ fontSize: "0.75rem", color: "var(--tm-angel-dark)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          One thing to practise
        </p>
        {weakest && weakest.r.hints + weakest.r.answers.filter((a) => !a.correct).length > 0 ? (
          <>
            <p className="tm-display m-0 mt-1" style={{ fontSize: "1.1rem" }}>
              {weakest.t.title}
            </p>
            <p className="m-0 mt-1" style={{ fontSize: "0.9rem", color: "var(--tm-ink-soft)" }}>
              {practiseLine(weakest.t.id)} Ask them to explain it to you over dinner — with real food.
            </p>
          </>
        ) : next ? (
          <>
            <p className="tm-display m-0 mt-1" style={{ fontSize: "1.1rem" }}>
              {next.t.title}
            </p>
            <p className="m-0 mt-1" style={{ fontSize: "0.9rem", color: "var(--tm-ink-soft)" }}>
              That&rsquo;s the next topic. Nothing to fix from the ones done so far.
            </p>
          </>
        ) : (
          <p className="m-0 mt-1" style={{ fontSize: "0.95rem" }}>
            All done with no slips. Let them try the reviews.
          </p>
        )}
      </section>

      <ParentChat profile={profile} topics={TOPICS} />

      <h2 className="mt-6" style={{ fontSize: "1.1rem" }}>
        By topic
      </h2>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {rows.map(({ t, r }) => (
          <li key={t.id} className="tm-card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="tm-display m-0" style={{ fontSize: "1rem" }}>
                {t.n}. {t.title}
              </p>
              <p className="m-0" style={{ fontSize: "0.78rem", color: "var(--tm-ink-faint)" }}>
                {t.ccss} &middot;{" "}
                {r.done
                  ? `${r.answers.filter((a) => a.correct).length}/${r.answers.length} right, ${r.hints} hint${r.hints === 1 ? "" : "s"}${r.reviewBest !== null ? `, review ${Math.round(r.reviewBest * 100)}%` : ""}`
                  : "not started"}
              </p>
            </div>
            <span className="tm-display shrink-0" style={{ color: r.done ? "var(--tm-angel-dark)" : "var(--tm-ink-faint)" }}>
              {r.done ? "★".repeat(Math.max(0, r.stars)) + "☆".repeat(Math.max(0, 3 - r.stars)) : "—"}
            </span>
          </li>
        ))}
      </ul>

      {wrong.length > 0 && (
        <>
          <h2 className="mt-6" style={{ fontSize: "1.1rem" }}>
            What they said when they slipped
          </h2>
          <p className="m-0 mt-1" style={{ fontSize: "0.85rem", color: "var(--tm-ink-soft)" }}>
            Their exact words. Useful for spotting the pattern behind a mistake.
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {wrong.slice(-8).reverse().map((a, i) => (
              <li key={i} className="tm-card p-3">
                <p className="m-0" style={{ fontSize: "0.78rem", color: "var(--tm-ink-faint)" }}>
                  {a.topic.title} &middot; {new Date(a.at).toLocaleDateString()}
                </p>
                <p className="m-0 mt-1" style={{ fontSize: "0.9rem", color: "var(--tm-ink-soft)" }}>
                  Asked: {a.asked}
                </p>
                <p className="m-0 mt-1" style={{ fontSize: "0.95rem" }}>
                  Said: &ldquo;{a.said}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-8 text-[0.8rem]" style={{ color: "var(--tm-ink-faint)" }}>
        Everything is stored on this device only. Nothing the child says is kept as audio — only the words.
      </p>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Erase all of ${profile.name}'s progress on this device?`)) reset();
        }}
        className="mt-2 self-start text-[0.8rem] underline underline-offset-2"
        style={{ color: "var(--tm-ink-faint)", minHeight: "var(--tm-tap)" }}
      >
        Start over
      </button>
    </main>
  );
}

/* ---- ask the tutor about the child ---- */

type Msg = { role: "parent" | "tutor"; text: string };

function ParentChat({ profile, topics }: { profile: Profile; topics: Topic[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const summary = useMemo(
    () => ({
      name: profile.name,
      grade: profile.grade,
      xp: profile.xp,
      streak: profile.streak,
      topics: topics.map((t) => {
        const r = profile.topics[t.id] ?? EMPTY_TOPIC;
        return {
          title: t.title,
          ccss: t.ccss,
          done: r.done,
          stars: r.stars,
          hints: r.hints,
          minutes: Math.round(r.seconds / 60),
          reviewBest: r.reviewBest,
          answers: r.answers.map((a) => ({ asked: a.asked, said: a.said, correct: a.correct })),
        };
      }),
    }),
    [profile, topics],
  );

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "parent", text }];
    setMsgs(next);
    setTyped("");
    setBusy(true);
    try {
      const res = await fetch("/api/parent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, summary }),
      });
      const data = await res.json();
      setMsgs([...next, { role: "tutor", text: res.ok ? data.text : (data.error ?? "Something went wrong.") }]);
    } catch {
      setMsgs([...next, { role: "tutor", text: "Couldn't reach the tutor. Check your connection." }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  const starters = [
    `How is ${profile.name} doing?`,
    "What should we practise this week?",
    "What did they get wrong?",
  ];

  return (
    <section className="tm-card mt-4 p-4" style={{ borderLeft: "5px solid var(--tm-piece)" }}>
      <p className="tm-display m-0" style={{ fontSize: "0.75rem", color: "var(--tm-piece-dark)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Ask the tutor
      </p>
      <p className="m-0 mt-1" style={{ fontSize: "0.88rem", color: "var(--tm-ink-soft)" }}>
        It answers from {profile.name}&rsquo;s actual record — what they did and what they said.
      </p>

      {msgs.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {starters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="rounded-full px-3 py-1.5"
              style={{ background: "var(--tm-piece-ghost)", color: "var(--tm-piece-dark)", fontSize: "0.85rem", minHeight: 36 }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {msgs.map((m, i) => (
            <p
              key={i}
              className="m-0 rounded-2xl px-3 py-2"
              style={{
                alignSelf: m.role === "parent" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                background: m.role === "parent" ? "var(--tm-piece)" : "var(--tm-piece-ghost)",
                color: m.role === "parent" ? "#fff" : "var(--tm-ink)",
                fontSize: "0.93rem",
                whiteSpace: "pre-line",
              }}
            >
              {m.text}
            </p>
          ))}
          {busy && (
            <p className="m-0 px-3" style={{ color: "var(--tm-ink-faint)", fontSize: "0.85rem" }}>
              thinking…
            </p>
          )}
          <div ref={bottom} />
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(typed);
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Ask about ${profile.name}…`}
          aria-label="Ask the tutor"
          className="tm-card flex-1 px-3"
          style={{ minHeight: "var(--tm-tap)", outline: "none", boxShadow: "none", border: "1px solid var(--tm-piece-ghost)" }}
        />
        <button type="submit" disabled={busy || !typed.trim()} className="tm-press tm-press-gold" style={{ minHeight: "var(--tm-tap)" }}>
          Ask
        </button>
      </form>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tm-card flex flex-col items-center px-2 py-3">
      <span className="tm-figure" style={{ fontSize: "1.25rem", color: "var(--tm-ink)" }}>
        {value}
      </span>
      <span style={{ fontSize: "0.65rem", color: "var(--tm-ink-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );
}

function practiseLine(id: string): string {
  switch (id) {
    case "k-count":
      return "Counting a small set out loud, touching each thing once.";
    case "k-together":
      return "Putting two small groups together and counting the total.";
    case "k-ten":
      return "How many more to make ten — count up from the number you have.";
    case "1-add20":
      return "Adding within twenty by counting on from the bigger number.";
    case "1-tens":
      return "Seeing a two-digit number as tens and ones.";
    case "1-road":
      return "Adding and taking away as steps forward and back on a number line.";
    case "2-bigger":
      return "Adding past twenty, then splitting the answer into tens and ones.";
    case "2-parts":
      return "Naming equal parts: halves, quarters, thirds.";
    case "2-skip":
      return "Counting in fives.";
    case "3-groups":
      return "Multiplication as equal groups — how many groups, how many in each.";
    case "3-share":
      return "Division as fair sharing.";
    case "3-fractions":
      return "Naming a fraction: the bottom number is the pieces, the top is how many.";
    case "5-unlike":
      return "Adding a half and a quarter by turning the half into two quarters.";
    case "5-ofgroup":
      return "A fraction of a group: split into equal groups, then count some of them.";
    case "5-hundredths":
      return "Comparing decimals by the tenths digit first.";
    case "making":
      return "Naming fractions: the bottom number is how many pieces, the top is how many you have.";
    case "equivalent":
      return "Cutting pieces smaller doesn't change the amount — a half is two quarters is four eighths.";
    case "compare":
      return "More pieces means smaller pieces. A quarter is bigger than an eighth, even though 8 is bigger than 4.";
    case "adding":
      return "Adding fractions with the same bottom number: count the pieces, keep the size.";
    case "decimals":
      return "Decimals: 0.7 is seven tenths and beats 0.15, because the first digit after the point is what matters.";
    default:
      return "";
  }
}

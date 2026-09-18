"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPTY_TOPIC, useProfile } from "@/lib/progress";
import { GRADE_THEME, topicsFor } from "@/lib/topics";
import { classBoard, type Row } from "@/lib/leaderboard";

/**
 * Home is a list of five things to do. That's it. A nine-year-old should
 * be able to look at it and know what to tap without reading anything but
 * the big words.
 *
 * Each tile carries its own review — a quick challenge after you've done
 * the topic — so "review" isn't a separate place to go and find.
 */
export default function Home() {
  const router = useRouter();
  const { ready, onboarded, profile } = useProfile();

  useEffect(() => {
    if (ready && !onboarded) router.replace("/");
  }, [ready, onboarded, router]);

  if (!ready || !onboarded) return null;

  const TOPICS = topicsFor(profile.grade);
  const done = TOPICS.filter((t) => profile.topics[t.id]?.done).length;
  const nextIdx = TOPICS.findIndex((t) => !profile.topics[t.id]?.done);
  const stars = TOPICS.reduce((n, t) => n + (profile.topics[t.id]?.stars ?? 0), 0);

  return (
    <main className="tm-app mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-12">
      <header className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: "1.7rem" }}>Hi, {profile.name}!</h1>
          <p className="m-0" style={{ color: "var(--tm-ink-soft)", fontSize: "0.9rem" }}>
            Grade {profile.grade} &middot; {GRADE_THEME[profile.grade]}
          </p>
        </div>
        <div className="tm-card flex items-center gap-3 px-3 py-2">
          <Stat label="stars" value={`${stars}`} tint="var(--tm-angel-dark)" />
          <Stat label="days" value={`${profile.streak}`} tint="var(--tm-hmm-dark)" />
          <Stat label="XP" value={`${profile.xp}`} tint="var(--tm-monster-dark)" />
        </div>
      </header>

      <p className="tm-display mt-6 mb-2" style={{ fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tm-ink-faint)" }}>
        {done === 0 ? "Start here" : done === TOPICS.length ? "All done — review any of them" : `${done} of ${TOPICS.length} done`}
      </p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {TOPICS.map((t, i) => {
          const rec = profile.topics[t.id] ?? EMPTY_TOPIC;
          const isNext = i === nextIdx;
          const locked = !rec.done && !isNext;
          return (
            <li key={t.id}>
              <div
                className="tm-card p-3"
                style={{
                  opacity: locked ? 0.55 : 1,
                  borderLeft: `5px solid ${rec.done ? "var(--tm-monster)" : isNext ? "var(--tm-angel)" : "transparent"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="tm-figure grid shrink-0 place-items-center rounded-full"
                    style={{
                      width: 46,
                      height: 46,
                      fontSize: "1.3rem",
                      background: rec.done ? "var(--tm-monster)" : isNext ? "var(--tm-angel)" : "var(--tm-piece-ghost)",
                      color: rec.done ? "#06301c" : isNext ? "#3b2500" : "var(--tm-ink-faint)",
                    }}
                  >
                    {rec.done ? "✓" : t.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="tm-display m-0" style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>
                      {t.title}
                    </p>
                    <p className="m-0" style={{ fontSize: "0.85rem", color: "var(--tm-ink-soft)" }}>
                      {t.blurb}
                    </p>
                  </div>
                  {rec.done && (
                    <span className="tm-display shrink-0" style={{ color: "var(--tm-angel-dark)", fontSize: "0.95rem" }}>
                      {"★".repeat(rec.stars)}
                    </span>
                  )}
                </div>

                {!locked && (
                  <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: rec.done ? "1fr 1fr" : "1fr" }}>
                    <Link href={`/play/${t.id}`} className={`tm-press ${rec.done ? "" : "tm-press-go"}`} style={{ minHeight: "3rem", fontSize: "1rem" }}>
                      {rec.done ? "Play again" : "Play"}
                    </Link>
                    {rec.done && (
                      <Link href={`/review/${t.id}`} className="tm-press tm-press-gold" style={{ minHeight: "3rem", fontSize: "1rem" }}>
                        {rec.reviewBest === null ? "Quick review" : `Review ${Math.round(rec.reviewBest * 100)}%`}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ClassBoard name={profile.name} xp={profile.xp} stars={stars} />

      <div className="mt-8 flex items-center justify-between px-1">
        <Link href="/parents" className="tm-display" style={{ fontSize: "0.85rem", color: "var(--tm-ink-soft)", textDecoration: "underline", textUnderlineOffset: 3 }}>
          For parents
        </Link>
        <Link href="/" className="text-[0.8rem]" style={{ color: "var(--tm-ink-faint)" }}>
          not {profile.name}?
        </Link>
      </div>
    </main>
  );
}

/* ---- the practice class ---- */

const noop = () => () => {};
const yes = () => true;
const no = () => false;

function ClassBoard({ name, xp, stars }: { name: string; xp: number; stars: number }) {
  // Only read localStorage on the client, after hydration.
  const client = useSyncExternalStore(noop, yes, no);
  const rows: Row[] = client ? classBoard(name, xp, stars) : [];
  const me = rows.findIndex((r) => r.you);
  const above = me > 0 ? rows[me - 1] : null;
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between px-1">
        <h2 style={{ fontSize: "1.15rem" }}>Your class</h2>
        <span style={{ fontSize: "0.72rem", color: "var(--tm-ink-faint)" }}>practice class on this device</span>
      </div>
      {above && (
        <p className="m-0 mt-1 px-1" style={{ fontSize: "0.85rem", color: "var(--tm-ink-soft)" }}>
          You&rsquo;re #{me + 1}. {above.xp - xp + 1} XP to pass {above.name}.
        </p>
      )}
      {me === 0 && rows.length > 1 && (
        <p className="m-0 mt-1 px-1" style={{ fontSize: "0.85rem", color: "var(--tm-monster-dark)" }}>
          You&rsquo;re top of the class!
        </p>
      )}
      <ol className="tm-card m-0 mt-2 list-none p-2">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center gap-3 rounded-2xl px-3 py-2"
            style={{
              background: r.you ? "var(--tm-angel)" : "transparent",
              color: r.you ? "#3b2500" : "var(--tm-ink)",
              transition: "background 200ms",
            }}
          >
            <span className="tm-figure w-7 text-center" style={{ fontSize: i < 3 ? "1.1rem" : "0.95rem", opacity: i < 3 ? 1 : 0.6 }}>
              {i < 3 ? medal[i] : i + 1}
            </span>
            <span className="tm-display flex-1" style={{ fontSize: "1rem" }}>
              {r.name}
              {r.you ? " (you)" : ""}
            </span>
            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{"★".repeat(Math.min(5, r.stars))}</span>
            <span className="tm-figure w-14 text-right" style={{ fontSize: "0.95rem" }}>
              {r.xp} XP
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="tm-figure" style={{ fontSize: "1.05rem", color: tint }}>
        {value}
      </span>
      <span style={{ fontSize: "0.6rem", color: "var(--tm-ink-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </span>
  );
}

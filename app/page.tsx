"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GRADES, useProfile, type Grade } from "@/lib/progress";

/**
 * The front door. Two questions, big enough for a nine-year-old's thumb,
 * and then straight in. If they've been here before, we skip it.
 */
export default function Welcome() {
  const router = useRouter();
  const { ready, onboarded, profile, setIdentity } = useProfile();
  // null = untouched, so a returning child sees their saved answer pre-filled
  // without an effect writing state.
  const [typed, setTyped] = useState<string | null>(null);
  const [picked, setPicked] = useState<Grade | null>(null);
  const name = typed ?? (ready ? profile.name : "");
  const grade = picked ?? (ready && profile.name ? profile.grade : null);

  useEffect(() => {
    if (onboarded) router.replace("/home");
  }, [onboarded, router]);

  const canGo = name.trim().length > 0 && grade !== null;

  function go() {
    if (!canGo || !grade) return;
    setIdentity(name, grade);
    router.push("/home");
  }

  if (!ready || onboarded) return null;

  return (
    <main className="tm-app mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10 pb-10">
      {/* a whole pizza, because that's what they're about to cut up */}
      <div className="tm-bob mx-auto" aria-hidden>
        <svg width="150" height="150" viewBox="0 0 200 200">
          <ellipse cx="100" cy="106" rx="100" ry="96" fill="rgba(44,33,64,.12)" />
          <circle cx="100" cy="100" r="99" fill="#fff" />
          <circle cx="100" cy="100" r="92" fill="#c97b2a" />
          <circle cx="100" cy="100" r="83" fill="#ffd166" />
          <circle cx="72" cy="80" r="11" fill="#c0392b" />
          <circle cx="126" cy="92" r="11" fill="#c0392b" />
          <circle cx="96" cy="130" r="11" fill="#c0392b" />
        </svg>
      </div>

      <h1 className="mt-2 text-center" style={{ fontSize: "clamp(1.7rem, 7vw, 2.2rem)" }}>
        Hi! What&rsquo;s your name?
      </h1>

      <input
        autoFocus
        value={name}
        onChange={(e) => setTyped(e.target.value.slice(0, 20))}
        onKeyDown={(e) => e.key === "Enter" && canGo && go()}
        placeholder="Type it here"
        aria-label="Your name"
        autoComplete="given-name"
        enterKeyHint="next"
        className="tm-card tm-display mt-4 w-full text-center"
        style={{
          fontSize: "1.5rem",
          padding: "0.85rem 1rem",
          color: "var(--tm-ink)",
          outline: "none",
          border: "2px solid transparent",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--tm-angel)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
      />

      <h2 className="mt-8 text-center" style={{ fontSize: "1.25rem" }}>
        And what grade are you in?
      </h2>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {GRADES.map((g) => {
          const on = grade === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setPicked(g.id)}
              aria-pressed={on}
              className={`tm-press ${on ? "tm-press-go" : ""}`}
              style={{ minHeight: "4.4rem", padding: "0.5rem", flexDirection: "column", gap: 0 }}
            >
              <span className="tm-figure" style={{ fontSize: "1.7rem", lineHeight: 1 }}>
                {g.label}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  opacity: 0.7,
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                }}
              >
                age {g.age}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={go}
        disabled={!canGo}
        className="tm-press tm-press-gold mt-8 w-full"
        style={{ fontSize: "1.2rem" }}
      >
        {canGo ? `Let's go, ${name.trim()}!` : "Let's go"}
      </button>
    </main>
  );
}

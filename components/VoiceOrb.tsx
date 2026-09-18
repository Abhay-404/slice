"use client";

export type OrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type TranscriptLine = {
  id: string;
  who: "child" | "angel" | "monster";
  text: string;
  partial?: boolean;
};

export type VoiceOrbProps = {
  state: OrbState;
  /** 0–1 mic level. Drives the ring while the child is being heard. */
  level?: number;
  /** Only the most recent line is shown — a caption, not a chat log. */
  transcript?: TranscriptLine[];
  errorText?: string;
  onStart: () => void;
  onStop: () => void;
  /** Extra px lifted from the bottom, for pages with their own fixed bar. */
  offset?: number;
  /** Which character is talking — changes the orb's colour. */
  who?: "angel" | "monster";
  /** Bottom-left keeps the orb off the buttons a child is using. */
  align?: "left" | "center";
};

const HINT: Record<OrbState, string> = {
  idle: "Tap to talk",
  connecting: "One second…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Talking",
  error: "Tap to try again",
};

/**
 * A circle you tap, and it starts talking. That is the whole interaction.
 *
 * The earlier version opened into a conversation panel; it made a simple
 * thing feel like an app. The transcript still appears — as a single
 * caption above the orb — because when the app mishears a nine-year-old
 * they need to see that it was the machine's mistake, not theirs. But it
 * is a caption, not a log, and it never covers the thing being taught.
 */
export default function VoiceOrb({
  state,
  level = 0,
  transcript = [],
  errorText,
  onStart,
  onStop,
  offset = 0,
  who = "angel",
  align = "center",
}: VoiceOrbProps) {
  const monster = who === "monster";
  const base = monster ? "var(--tm-monster)" : "var(--tm-angel)";
  const dark = monster ? "var(--tm-monster-dark)" : "var(--tm-angel-dark)";
  const hi = monster ? "#c9f7de" : "#ffe9b0";
  const live =
    state === "listening" || state === "speaking" || state === "thinking";
  const last = transcript[transcript.length - 1];
  const ring = 1 + Math.min(level, 1) * 0.3;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 px-4 ${
        align === "left" ? "items-start" : "items-center"
      }`}
      style={{
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 1rem + ${offset}px)`,
        paddingLeft: align === "left" ? "calc(env(safe-area-inset-left, 0px) + 1rem)" : undefined,
      }}
    >
      {(last || state === "error") && (
        <p
          className={`tm-bubble pointer-events-none m-0 max-w-sm ${align === "left" ? "text-left" : "text-center"}`}
          style={{
            fontSize: "0.98rem",
            color: state === "error" ? "var(--tm-hmm-dark)" : "var(--tm-ink)",
            opacity: last?.partial ? 0.65 : 1,
          }}
        >
          {state === "error" ? (errorText ?? "That didn't work. Tap to try again.") : last?.text}
        </p>
      )}

      <span
        className="tm-display pointer-events-none"
        style={{
          fontSize: "0.8rem",
          color: "var(--tm-ink-soft)",
          textShadow: "0 1px 0 rgba(255,255,255,.7)",
        }}
      >
        {HINT[state]}
      </span>

      <button
        type="button"
        onClick={live || state === "connecting" ? onStop : onStart}
        aria-label={live ? "Stop talking" : "Start talking"}
        aria-pressed={live}
        className="pointer-events-auto relative grid place-items-center rounded-full"
        style={{
          width: "5.25rem",
          height: "5.25rem",
          background:
            state === "error"
              ? "radial-gradient(circle at 34% 28%, #ffd9a8 0%, var(--tm-hmm) 55%, var(--tm-hmm-dark) 100%)"
              : `radial-gradient(circle at 34% 28%, ${hi} 0%, ${base} 46%, ${dark} 100%)`,
          boxShadow: `0 var(--tm-lip) 0 0 ${
            state === "error" ? "var(--tm-hmm-dark)" : dark
          }, 0 14px 26px -12px rgba(44,33,64,.6)`,
          transition: "transform 90ms var(--tm-ease-out), box-shadow 90ms var(--tm-ease-out)",
        }}
        onPointerDown={(e) => {
          e.currentTarget.style.transform = "translateY(var(--tm-lip))";
          e.currentTarget.style.boxShadow = `0 0 0 0 ${dark}`;
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        {/* Reacts to the child's actual voice, so they can see they're heard. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            border: `3px solid ${base}`,
            opacity: state === "listening" ? 0.7 : 0,
            transform: `scale(${state === "listening" ? ring : 1})`,
            transition: "transform 90ms linear, opacity 200ms linear",
          }}
        />
        <Mark state={state} />
      </button>
    </div>
  );
}

function Mark({ state }: { state: OrbState }) {
  if (state === "connecting") {
    return (
      <>
        <span
          aria-hidden
          className="block rounded-full"
          style={{
            width: 24,
            height: 24,
            border: "3px solid rgba(59,37,0,.3)",
            borderTopColor: "#3b2500",
            animation: "tm-spin .8s linear infinite",
          }}
        />
        <style>{`@keyframes tm-spin { to { transform: rotate(360deg) } }`}</style>
      </>
    );
  }

  if (state === "speaking") {
    // Three bars that breathe while the angel talks.
    return (
      <>
        <span aria-hidden className="flex items-end gap-1" style={{ height: 26 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5,
                height: 26,
                borderRadius: 3,
                background: "#3b2500",
                animation: `tm-wave .7s ease-in-out ${i * 0.14}s infinite`,
              }}
            />
          ))}
        </span>
        <style>{`@keyframes tm-wave { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }`}</style>
      </>
    );
  }

  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="#3b2500" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0"
        stroke="#3b2500"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M12 17.5V21" stroke="#3b2500" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

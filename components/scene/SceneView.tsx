"use client";

import type { Scene } from "@/lib/scene";
import { Bar, Pizza, Road } from "./Food";
import { Counters } from "./Counters";

/**
 * Renders the scene state. Purely a function of `scene` — the reducer is
 * the only thing that changes it, whether the change came from a voice
 * tool or a finger.
 */
export default function SceneView({
  scene,
  onTap,
  onTapCounter,
}: {
  scene: Scene;
  /** Touch fallback: tap a piece to toggle it eaten. */
  onTap?: (which: "a" | "b", piece: number) => void;
  /** Touch fallback on the pile: tap a thing to take it away. */
  onTapCounter?: (i: number) => void;
}) {
  const two = !!scene.a && !!scene.b;

  return (
    <div className="relative flex w-full flex-col items-center" style={{ minHeight: 320 }}>
      {scene.caption && (
        <p
          key={scene.caption}
          className="tm-display tm-pop m-0 mb-2 rounded-full px-4 py-1"
          style={{ background: "rgba(255,255,255,.7)", color: "var(--tm-ink-soft)", fontSize: "0.85rem" }}
        >
          {scene.caption}
        </p>
      )}

      {scene.counters ? (
        <Counters pile={scene.counters} onTap={onTapCounter} />
      ) : scene.road ? (
        <Road road={scene.road} width={Math.min(360, typeof window === "undefined" ? 340 : window.innerWidth - 48)} />
      ) : scene.a ? (
        <div
          className="relative flex items-center justify-center"
          style={{ width: "100%", minHeight: two && !scene.overlay ? 300 : 300 }}
        >
          {/* Yours */}
          <div
            style={{
              position: two ? "absolute" : "relative",
              left: two && !scene.overlay ? "6%" : two ? "50%" : undefined,
              transform: two ? (scene.overlay ? "translateX(-50%)" : "translateX(0)") : undefined,
              transition: "left 520ms var(--tm-ease), transform 520ms var(--tm-ease)",
              zIndex: 1,
            }}
            onClick={(e) => {
              if (!onTap || !scene.a) return;
              const piece = pieceAt(e, scene.a.cuts, scene.a.kind);
              if (piece !== null) onTap("a", piece);
            }}
          >
            {scene.a.kind === "pizza" ? (
              <Pizza food={scene.a} size={two ? 200 : 280} tone="you" />
            ) : (
              <Bar food={scene.a} width={two ? 200 : 320} tone="you" />
            )}
            {two && !scene.overlay && <Tag>You</Tag>}
          </div>

          {/* Sam's */}
          {scene.b && (
            <div
              style={{
                position: "absolute",
                right: scene.overlay ? "auto" : "6%",
                left: scene.overlay ? "50%" : "auto",
                transform: scene.overlay ? "translateX(-50%)" : "translateX(0)",
                transition: "left 520ms var(--tm-ease), right 520ms var(--tm-ease), transform 520ms var(--tm-ease)",
                zIndex: 2,
              }}
              onClick={(e) => {
                if (!onTap || !scene.b) return;
                const piece = pieceAt(e, scene.b.cuts, scene.b.kind);
                if (piece !== null) onTap("b", piece);
              }}
            >
              {scene.b.kind === "pizza" ? (
                <Pizza food={scene.b} size={200} tone="sam" ghost={scene.overlay} />
              ) : (
                <Bar food={scene.b} width={200} tone="sam" ghost={scene.overlay} />
              )}
              {!scene.overlay && <Tag>Sam</Tag>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: 280 }} />
      )}

      {/* the big fraction */}
      {scene.fraction && (
        <div
          key={`${scene.fraction.n}/${scene.fraction.d}`}
          className="tm-pop absolute"
          style={{
            top: 8,
            right: 8,
            display: "grid",
            placeItems: "center",
            background: "#fff",
            borderRadius: 22,
            padding: "0.4rem 1rem",
            boxShadow: "0 var(--tm-lip) 0 0 var(--tm-piece-dark), 0 0 28px -4px rgba(63,169,245,.7)",
          }}
        >
          <span className="tm-figure" style={{ fontSize: "1.9rem", lineHeight: 1, color: "var(--tm-piece-dark)" }}>
            {scene.fraction.n}
          </span>
          <span style={{ width: 34, height: 3, background: "var(--tm-piece-dark)", borderRadius: 2, margin: "2px 0" }} />
          <span className="tm-figure" style={{ fontSize: "1.9rem", lineHeight: 1, color: "var(--tm-piece-dark)" }}>
            {scene.fraction.d}
          </span>
        </div>
      )}

      {scene.party > 0 && <Confetti key={scene.party} />}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="tm-display absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5"
      style={{ bottom: -26, fontSize: "0.8rem", background: "#fff", color: "var(--tm-ink-soft)", boxShadow: "0 2px 0 rgba(44,33,64,.1)" }}
    >
      {children}
    </span>
  );
}

/** Which piece was tapped, from the click position. Fallback path only. */
function pieceAt(e: React.MouseEvent, cuts: number, kind: "pizza" | "bar"): number | null {
  const r = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (kind === "bar") {
    const i = Math.floor((x / r.width) * cuts);
    return i >= 0 && i < cuts ? i : null;
  }
  const cx = r.width / 2, cy = r.height / 2;
  const dx = x - cx, dy = y - cy;
  if (Math.hypot(dx, dy) > r.width / 2) return null;
  let ang = Math.atan2(dy, dx) + Math.PI / 2;
  if (ang < 0) ang += Math.PI * 2;
  const i = Math.floor((ang / (Math.PI * 2)) * cuts);
  return Math.min(cuts - 1, Math.max(0, i));
}

function Confetti() {
  const bits = Array.from({ length: 26 }, (_, i) => i);
  const colors = ["#3fa9f5", "#ffc53d", "#3fcc85", "#ff9f1c", "#c0392b", "#fff"];
  // Deterministic scatter — looks random, renders pure.
  const h = (i: number, k: number) => ((i * 2654435761 + k * 40503) >>> 0) % 1000 / 1000;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {bits.map((i) => {
        const x = 10 + h(i, 1) * 80;
        const d = 700 + h(i, 2) * 500;
        const rot = h(i, 3) * 360;
        const dx = h(i, 4) > 0.5 ? 60 : -60;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: "40%",
              width: 10,
              height: 14,
              borderRadius: 3,
              background: colors[i % colors.length],
              transform: `rotate(${rot}deg)`,
              animation: `tm-confetti ${d}ms ease-out forwards`,
              animationDelay: `${h(i, 5) * 120}ms`,
              ["--dx" as string]: `${dx}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes tm-confetti {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1 }
          100% { transform: translateY(-190px) translateX(var(--dx, 60px)) rotate(540deg) scale(.6); opacity: 0 }
        }
      `}</style>
    </div>
  );
}

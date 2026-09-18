"use client";

import type { Counters as CountersT } from "@/lib/scene";

/**
 * A pile of things to count. Loose, they flow in a grid; grouped, they
 * snap into rows with a gap between groups, so "three groups of four" is
 * something you can see and count with a finger.
 */

const ICON: Record<string, string> = {
  apples: "🍎",
  stars: "⭐",
  fish: "🐟",
  blocks: "🧱",
  beads: "🔵",
  coins: "🪙",
  cookies: "🍪",
  sweets: "🍬",
  marbles: "🟣",
};

export function Counters({ pile, onTap }: { pile: CountersT; onTap?: (i: number) => void }) {
  const icon = ICON[pile.thing] ?? "⚪";
  const n = pile.count;
  const g = pile.groupSize;
  const groups: number[][] = [];
  if (g && g > 0) {
    for (let i = 0; i < n; i += g) groups.push(Array.from({ length: Math.min(g, n - i) }, (_, k) => i + k));
  } else {
    groups.push(Array.from({ length: n }, (_, k) => k));
  }
  const perRow = g && g > 0 ? g : n <= 10 ? 5 : n <= 20 ? 6 : 8;

  return (
    <div
      role="img"
      aria-label={
        g && g > 0
          ? `${n} ${pile.thing}: ${Math.floor(n / g)} full group${Math.floor(n / g) === 1 ? "" : "s"} of ${g}${n % g ? `, and ${n % g} left over` : ""}`
          : `${n} ${pile.thing}`
      }
      className="flex w-full flex-col items-center gap-3"
      style={{ minHeight: 220, justifyContent: "center" }}
    >
      {n === 0 && (
        <div
          className="tm-display grid place-items-center rounded-3xl"
          style={{ width: 220, height: 120, background: "rgba(255,255,255,.55)", color: "var(--tm-ink-faint)", fontSize: "0.95rem" }}
        >
          empty table
        </div>
      )}
      {groups.map((items, gi) => (
        <div
          key={gi}
          className="grid gap-2 rounded-2xl p-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(perRow, Math.max(items.length, 1))}, 1fr)`,
            background: g ? "rgba(255,255,255,.6)" : "transparent",
            boxShadow: g ? "0 3px 0 rgba(44,33,64,.08)" : "none",
            animation: g ? `tm-group-in 320ms var(--tm-ease) both ${gi * 60}ms` : "none",
          }}
        >
          {items.map((i) => {
            const hot = pile.highlight.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onTap?.(i)}
                aria-label={`${pile.thing.slice(0, -1)} ${i + 1}`}
                className="grid place-items-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 28,
                  lineHeight: 1,
                  background: hot ? "#fff3c4" : "transparent",
                  boxShadow: hot ? "0 0 0 3px #ffc53d" : "none",
                  animation: `tm-item-in 260ms var(--tm-ease) both ${Math.min(i, 20) * 22}ms`,
                }}
              >
                <span aria-hidden>{icon}</span>
              </button>
            );
          })}
        </div>
      ))}
      <style>{`
        @keyframes tm-item-in { from { transform: scale(.4) translateY(10px); opacity: 0 } to { transform: scale(1) translateY(0); opacity: 1 } }
        @keyframes tm-group-in { from { transform: scale(.94); opacity: .5 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}

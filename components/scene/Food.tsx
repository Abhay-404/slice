"use client";

import type { Food as FoodT, Road as RoadT } from "@/lib/scene";

/**
 * The things on the table. Every prop change animates, because the point
 * of this whole app is that saying "cut it into eight" makes something
 * visibly happen. Nothing here holds state; the scene reducer is truth.
 */

const TAU = Math.PI * 2;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

/* ------------------------------------------------------------------ */

export function Pizza({
  food,
  size = 280,
  tone = "you",
  ghost = false,
}: {
  food: FoodT;
  size?: number;
  /** Colour family, so two pizzas read as two people's. */
  tone?: "you" | "sam";
  /** Drawn translucent, for overlaying. */
  ghost?: boolean;
}) {
  const c = 100, r = 92;
  const n = food.cuts;
  const cheese = tone === "you" ? "#ffd166" : "#ffe08a";
  const crust = tone === "you" ? "#c97b2a" : "#d99a4e";
  const pep = tone === "you" ? "#c0392b" : "#e07b6a";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${tone === "you" ? "Your" : "Sam's"} pizza, ${n} slice${n === 1 ? "" : "s"}, ${food.eaten.length} eaten`}
      style={{ overflow: "visible", opacity: ghost ? 0.62 : 1, filter: ghost ? "saturate(.8)" : "none" }}
    >
      <defs>
        <radialGradient id={`cheese-${tone}`} cx="45%" cy="40%">
          <stop offset="0%" stopColor="#fff0b3" />
          <stop offset="70%" stopColor={cheese} />
          <stop offset="100%" stopColor="#f2b84b" />
        </radialGradient>
      </defs>

      {/* plate shadow */}
      <ellipse cx={c} cy={c + 6} rx={r + 8} ry={r + 4} fill="rgba(44,33,64,.14)" />
      <circle cx={c} cy={c} r={r + 7} fill="#fff" />

      {/* slices, keyed by cut count so a re-cut re-enters from the centre */}
      <g key={`cuts-${n}`}>
        {Array.from({ length: n }, (_, i) => {
          const a0 = -Math.PI / 2 + (i / n) * TAU;
          const a1 = -Math.PI / 2 + ((i + 1) / n) * TAU;
          const mid = (a0 + a1) / 2;
          const eaten = food.eaten.includes(i);
          const hot = food.highlight.includes(i);
          const px = c + r * 0.58 * Math.cos(mid), py = c + r * 0.58 * Math.sin(mid);
          return (
            <g
              key={i}
              className="tm-slice"
              style={{
                transformOrigin: `${c}px ${c}px`,
                transform: eaten ? `translate(${Math.cos(mid) * 26}px, ${Math.sin(mid) * 26}px) scale(.55)` : "scale(1)",
                opacity: eaten ? 0 : 1,
                transition: "transform 420ms var(--tm-ease), opacity 380ms ease",
                // The entrance animation's fill-mode would pin opacity to 1 and
                // hide the "eaten" state — so an eaten slice runs no animation.
                animation: eaten ? "none" : `tm-slice-in 380ms var(--tm-ease) both ${i * 28}ms`,
              }}
            >
              <path d={n === 1 ? "" : arcPath(c, c, r, a0, a1)} fill={crust} />
              {n === 1 && <circle cx={c} cy={c} r={r} fill={crust} />}
              {n === 1 ? (
                <circle cx={c} cy={c} r={r - 9} fill={`url(#cheese-${tone})`} />
              ) : (
                <path d={arcPath(c, c, r - 9, a0 + 0.02, a1 - 0.02)} fill={`url(#cheese-${tone})`} />
              )}
              {/* pepperoni */}
              {n === 1 ? (
                <>
                  <circle cx={c - 28} cy={c - 20} r="11" fill={pep} />
                  <circle cx={c + 26} cy={c - 8} r="11" fill={pep} />
                  <circle cx={c - 4} cy={c + 30} r="11" fill={pep} />
                </>
              ) : (
                <circle cx={px} cy={py} r={n > 8 ? 6 : 9} fill={pep} />
              )}
              {hot && (
                <path
                  d={n === 1 ? "" : arcPath(c, c, r + 2, a0, a1)}
                  fill="none"
                  stroke="#ffc53d"
                  strokeWidth="5"
                  style={{ filter: "drop-shadow(0 0 6px #ffc53d)" }}
                />
              )}
            </g>
          );
        })}
      </g>

      {/* cut lines, drawn on top, growing out from the centre */}
      <g key={`lines-${n}`}>
        {n > 1 &&
          Array.from({ length: n }, (_, i) => {
            const a = -Math.PI / 2 + (i / n) * TAU;
            return (
              <line
                key={i}
                x1={c}
                y1={c}
                x2={c + (r + 4) * Math.cos(a)}
                y2={c + (r + 4) * Math.sin(a)}
                stroke="#fff"
                strokeWidth="4"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 120,
                  strokeDashoffset: 120,
                  animation: `tm-cut 360ms var(--tm-ease-out) forwards ${i * 30}ms`,
                }}
              />
            );
          })}
      </g>

      <style>{`
        @keyframes tm-slice-in { from { transform: scale(.82); opacity: .4 } to { transform: scale(1); opacity: 1 } }
        @keyframes tm-cut { to { stroke-dashoffset: 0 } }
      `}</style>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export function Bar({
  food,
  width = 320,
  tone = "you",
  ghost = false,
}: {
  food: FoodT;
  width?: number;
  tone?: "you" | "sam";
  ghost?: boolean;
}) {
  const n = food.cuts;
  const h = 84;
  const choc = tone === "you" ? "#6b3e1e" : "#8a5a36";
  const shine = tone === "you" ? "#8f5a30" : "#a9744d";

  return (
    <div
      role="img"
      aria-label={`${tone === "you" ? "Your" : "Sam's"} chocolate bar, ${n} piece${n === 1 ? "" : "s"}, ${food.eaten.length} eaten`}
      style={{
        width,
        height: h,
        display: "grid",
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        gap: 4,
        padding: 6,
        borderRadius: 16,
        background: "#f3e9dc",
        boxShadow: "0 var(--tm-lip) 0 0 #d9c8b3, 0 12px 24px -14px rgba(44,33,64,.5)",
        opacity: ghost ? 0.62 : 1,
      }}
    >
      {Array.from({ length: n }, (_, i) => {
        const eaten = food.eaten.includes(i);
        const hot = food.highlight.includes(i);
        return (
          <div
            key={`${n}-${i}`}
            style={{
              borderRadius: 8,
              background: eaten ? "transparent" : `linear-gradient(180deg, ${shine} 0%, ${choc} 55%)`,
              boxShadow: eaten ? "inset 0 2px 6px rgba(44,33,64,.12)" : `inset 0 -4px 0 rgba(0,0,0,.25)`,
              outline: hot ? "4px solid #ffc53d" : "none",
              outlineOffset: -2,
              transform: eaten ? "translateY(18px) scale(.7)" : "translateY(0) scale(1)",
              opacity: eaten ? 0 : 1,
              transition: "transform 380ms var(--tm-ease), opacity 320ms ease, background 200ms",
              animation: eaten ? "none" : `tm-piece-in 320ms var(--tm-ease) both ${i * 26}ms`,
            }}
          />
        );
      })}
      <style>{`@keyframes tm-piece-in { from { transform: scaleX(.6); opacity: .3 } to { transform: scaleX(1); opacity: 1 } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Road({ road, width = 340 }: { road: RoadT; width?: number }) {
  const pad = 24;
  const inner = width - pad * 2;
  const x = (t: number) => pad + (t / road.ticks) * inner;
  const pos = road.pos;

  return (
    <svg
      width={width}
      height={130}
      viewBox={`0 0 ${width} 130`}
      role="img"
      aria-label={`A road from 0 to ${road.max} in ${road.ticks} steps${pos === null ? "" : `, marker at ${road.max === 1 ? `${pos} of ${road.ticks}` : pos}`}`}
      style={{ overflow: "visible" }}
    >
      {/* the road */}
      <rect x={pad - 10} y={54} width={inner + 20} height={22} rx="11" fill="#5b6273" />
      <line x1={pad} y1={65} x2={pad + inner} y2={65} stroke="#f7f1e1" strokeWidth="2" strokeDasharray="8 8" />

      {/* ticks */}
      {Array.from({ length: road.ticks + 1 }, (_, i) => (
        <g key={i}>
          <line x1={x(i)} y1={80} x2={x(i)} y2={i % 5 === 0 ? 96 : 90} stroke="var(--tm-ink)" strokeWidth={i % 5 === 0 ? 3 : road.ticks > 20 ? 1 : 2} opacity={road.ticks > 20 && i % 5 !== 0 ? 0.35 : 1} />
          {(i === 0 || i === road.ticks || (road.max > 1 && i % 5 === 0)) && (
            <text x={x(i)} y={118} textAnchor="middle" className="tm-figure" fontSize={i === 0 || i === road.ticks ? 20 : 13} fill="var(--tm-ink)">
              {road.max === 1 ? (i === 0 ? "0" : "1") : Math.round((i / road.ticks) * road.max)}
            </text>
          )}
        </g>
      ))}

      {/* half line */}
      <g style={{ opacity: road.showHalf ? 1 : 0, transition: "opacity 300ms" }}>
        <line x1={x(road.ticks / 2)} y1={30} x2={x(road.ticks / 2)} y2={100} stroke="#ffc53d" strokeWidth="4" strokeDasharray="6 5" />
        <text x={x(road.ticks / 2)} y={22} textAnchor="middle" className="tm-figure" fontSize="17" fill="#c98800">½</text>
      </g>

      {/* marker */}
      <g
        style={{
          transform: `translateX(${pos === null ? x(0) : x(pos)}px)`,
          transition: "transform 520ms var(--tm-ease)",
          opacity: pos === null ? 0.35 : 1,
        }}
      >
        <circle cx={0} cy={65} r="17" fill="#3fa9f5" stroke="#fff" strokeWidth="4" style={{ filter: "drop-shadow(0 4px 6px rgba(31,127,196,.5))" }} />
        <circle cx={0} cy={65} r="6" fill="#fff" />
        {pos !== null && (
          <text x={0} y={40} textAnchor="middle" className="tm-figure" fontSize="16" fill="var(--tm-piece-dark)">
            {road.max === 1 ? `${pos}/${road.ticks}` : Math.round((pos / road.ticks) * road.max)}
          </text>
        )}
      </g>
    </svg>
  );
}

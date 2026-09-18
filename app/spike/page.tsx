"use client";

/**
 * /spike -- the go/no-go gate for the realtime voice layer.
 *
 * Deliberately ugly and dependency-free. It exists to answer one question:
 * does a child speak, hear an answer, and SEE the picture change, all in one
 * continuous loop? If this page works on a real phone, the architecture is
 * sound and the rest of the app is just design work.
 *
 * What to look for:
 *   1. Both transcripts fill in -- the child's line is the product-critical one.
 *   2. The fraction, the shaded pie and the confetti change WITHOUT a reload.
 *   3. "eos -> tool applied" stays around a second or two.
 *   4. Talking over the tutor cuts it off mid-word.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { monsterTools, useLiveSession, type MonsterToolHandlers } from "@/lib/live";
import { LIVE_CONFIG } from "@/lib/live/config";

interface ShapeState {
  numerator: number;
  denominator: number;
  shaded: number;
  highlighted: number;
  celebrations: number;
}

const INITIAL: ShapeState = {
  numerator: 0,
  denominator: 4,
  shaded: 0,
  highlighted: -1,
  celebrations: 0,
};

export default function SpikePage() {
  const [shape, setShape] = useState<ShapeState>(INITIAL);
  const [log, setLog] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [latency, setLatency] = useState<{ toolMs: number | null; speakMs: number | null }>({
    toolMs: null,
    speakMs: null,
  });

  // Marks the moment the child's transcript arrived -- the closest thing the
  // browser has to "end of utterance". Used for the latency readout.
  const eosRef = useRef<number>(0);

  const addLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 60));
  }, []);

  /**
   * The four handlers. Each is synchronous and mutates React state directly --
   * no awaits, no fetches. This is the property the whole design hangs on.
   */
  const handlers: MonsterToolHandlers = {
    highlightPart: ({ partIndex }) => {
      setShape((s) => ({ ...s, highlighted: partIndex }));
      return { ok: true, highlighted: partIndex };
    },
    shadeParts: ({ count }) => {
      setShape((s) => ({ ...s, shaded: Math.min(count, s.denominator), numerator: Math.min(count, s.denominator) }));
      return { ok: true, shaded: count };
    },
    setFraction: ({ numerator, denominator }) => {
      setShape((s) => ({ ...s, numerator, denominator, shaded: numerator, highlighted: -1 }));
      return { ok: true, fraction: `${numerator}/${denominator}` };
    },
    celebrate: () => {
      setShape((s) => ({ ...s, celebrations: s.celebrations + 1 }));
      return { ok: true };
    },
  };

  const live = useLiveSession({
    toolSpecs: monsterTools,
    toolHandlers: handlers,
    debug: true,
    onToolCall: (name, args, result) => {
      if (eosRef.current) setLatency((l) => ({ ...l, toolMs: Math.round(performance.now() - eosRef.current) }));
      addLog(`TOOL ${name}(${JSON.stringify(args)}) -> ${JSON.stringify(result)}`);
    },
    onTurnComplete: (turn) => addLog(`TURN child="${turn.user}" tutor="${turn.model}"`),
  });

  // Stamp end-of-utterance the first time the child's transcript lands. The
  // server only emits it once its VAD has decided the child stopped talking,
  // which makes it a decent browser-side proxy for end-of-speech.
  useEffect(() => {
    if (live.userTranscript && !eosRef.current) {
      eosRef.current = performance.now();
      setLatency({ toolMs: null, speakMs: null });
    }
  }, [live.userTranscript]);

  useEffect(() => {
    if (live.modelSpeaking && eosRef.current) {
      setLatency((l) => (l.speakMs === null ? { ...l, speakMs: Math.round(performance.now() - eosRef.current) } : l));
    }
  }, [live.modelSpeaking]);

  // New turn: re-arm the stopwatch.
  useEffect(() => {
    eosRef.current = 0;
  }, [live.turns.length]);

  const reset = () => {
    setShape(INITIAL);
    setLatency({ toolMs: null, speakMs: null });
    eosRef.current = 0;
  };

  const parts = Array.from({ length: shape.denominator }, (_, i) => i);

  return (
    <main style={S.page}>
      <h1 style={S.h1}>voice spike</h1>
      <p style={S.sub}>
        model <code>{LIVE_CONFIG.model}</code> &middot; in {LIVE_CONFIG.inputSampleRate / 1000}kHz &middot; out{" "}
        {LIVE_CONFIG.outputSampleRate / 1000}kHz &middot; status <b style={S.status}>{live.status}</b>
      </p>

      {live.error && (
        <div style={S.err}>
          <b>{live.error.code}</b>
          <div>{live.error.message}</div>
        </div>
      )}

      {/* ---- controls ---- */}
      <div style={S.row}>
        <button onClick={live.isLive ? live.stop : live.start} style={{ ...S.btn, ...(live.isLive ? S.btnStop : {}) }}>
          {live.isLive ? "STOP" : "START TALKING"}
        </button>
        <button onClick={live.toggleMute} disabled={!live.isLive} style={S.btn}>
          {live.muted ? "unmute" : "mute"}
        </button>
        <button onClick={reset} style={S.btn}>
          reset shape
        </button>
      </div>

      {/* ---- mic level ---- */}
      <div style={S.meterOuter}>
        <div style={{ ...S.meterInner, width: `${Math.min(100, live.micLevel * 400)}%` }} />
      </div>

      {/* ---- the thing that must visibly change ---- */}
      <section style={S.card}>
        <div style={S.fracWrap}>
          <div style={S.frac}>
            <div style={S.num}>{shape.numerator}</div>
            <div style={S.bar} />
            <div style={S.den}>{shape.denominator}</div>
          </div>

          <svg viewBox="-110 -110 220 220" style={S.pie} aria-label="fraction pie">
            {parts.map((i) => {
              const a0 = (i / shape.denominator) * Math.PI * 2 - Math.PI / 2;
              const a1 = ((i + 1) / shape.denominator) * Math.PI * 2 - Math.PI / 2;
              const large = a1 - a0 > Math.PI ? 1 : 0;
              const d =
                shape.denominator === 1
                  ? "M 0 -100 A 100 100 0 1 1 -0.01 -100 Z"
                  : `M 0 0 L ${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A 100 100 0 ${large} 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`;
              const isShaded = i < shape.shaded;
              const isHot = i === shape.highlighted;
              return (
                <path
                  key={i}
                  d={d}
                  fill={isShaded ? "#4ade80" : "#1f2937"}
                  stroke={isHot ? "#facc15" : "#0f172a"}
                  strokeWidth={isHot ? 7 : 2}
                />
              );
            })}
          </svg>

          <div style={S.stats}>
            <div>shaded: {shape.shaded}</div>
            <div>highlighted: {shape.highlighted < 0 ? "none" : shape.highlighted}</div>
            <div style={{ fontSize: 28 }}>{"*".repeat(Math.min(shape.celebrations, 12))}</div>
            <div>celebrations: {shape.celebrations}</div>
          </div>
        </div>

        <div style={S.latency}>
          child stopped speaking &rarr; tutor started: <b>{latency.speakMs ?? "-"} ms</b> &middot; &rarr; tool applied:{" "}
          <b>{latency.toolMs ?? "-"} ms</b>
        </div>
      </section>

      {/* ---- both transcripts ---- */}
      <section style={S.card}>
        <div style={S.two}>
          <div style={S.col}>
            <h2 style={S.h2}>CHILD (input transcript)</h2>
            <div style={{ ...S.tx, borderColor: "#38bdf8" }}>
              {live.turns.map((t, i) => t.user && <p key={i} style={S.past}>{t.user}</p>)}
              <p style={S.now}>{live.userTranscript || <i style={S.dim}>…</i>}</p>
            </div>
          </div>
          <div style={S.col}>
            <h2 style={S.h2}>MONSTER (output transcript)</h2>
            <div style={{ ...S.tx, borderColor: "#f472b6" }}>
              {live.turns.map((t, i) => t.model && <p key={i} style={S.past}>{t.model}</p>)}
              <p style={S.now}>{live.modelTranscript || <i style={S.dim}>…</i>}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- keyboard fallback: proves tool calls without a mic ---- */}
      <section style={S.card}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typed.trim()) return;
            eosRef.current = performance.now();
            setLatency({ toolMs: null, speakMs: null });
            live.sendText(typed);
            setTyped("");
          }}
          style={S.row}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="type instead of talking, e.g. cut it into 6 and shade 5"
            disabled={!live.isLive}
            style={S.input}
          />
          <button type="submit" disabled={!live.isLive} style={S.btn}>
            send
          </button>
        </form>
        <p style={S.hint}>
          Use this to test tool calls with no microphone. It goes down the same socket.
        </p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>EVENT LOG</h2>
        <pre style={S.log}>{log.join("\n") || "(nothing yet)"}</pre>
      </section>
    </main>
  );
}

/* Inline styles on purpose: this page must not depend on the design system,
   so it keeps working while someone else is rewriting globals.css. */
const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: "#0b1220", color: "#e2e8f0", minHeight: "100dvh", padding: 16, margin: 0 },
  h1: { fontSize: 20, margin: "0 0 4px" },
  sub: { fontSize: 12, color: "#94a3b8", margin: "0 0 12px" },
  status: { color: "#4ade80" },
  err: { background: "#450a0a", border: "1px solid #ef4444", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 },
  btn: { background: "#1e293b", color: "#e2e8f0", border: "1px solid #475569", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontFamily: "inherit", cursor: "pointer", minHeight: 44 },
  btnStop: { background: "#7f1d1d", borderColor: "#ef4444" },
  meterOuter: { height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden", marginBottom: 14 },
  meterInner: { height: "100%", background: "#38bdf8", transition: "width 60ms linear" },
  card: { background: "#111c33", border: "1px solid #1e293b", borderRadius: 10, padding: 12, marginBottom: 12 },
  fracWrap: { display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" },
  frac: { textAlign: "center", minWidth: 70 },
  num: { fontSize: 44, lineHeight: 1 },
  bar: { height: 3, background: "#e2e8f0", margin: "6px 0" },
  den: { fontSize: 44, lineHeight: 1 },
  pie: { width: 160, height: 160 },
  stats: { fontSize: 13, lineHeight: 1.7 },
  latency: { marginTop: 12, fontSize: 13, color: "#94a3b8" },
  two: { display: "flex", gap: 12, flexWrap: "wrap" },
  col: { flex: "1 1 260px", minWidth: 0 },
  h2: { fontSize: 11, letterSpacing: 1, color: "#94a3b8", margin: "0 0 6px" },
  tx: { border: "1px solid", borderRadius: 8, padding: 10, minHeight: 90, maxHeight: 200, overflowY: "auto", fontSize: 14 },
  past: { margin: "0 0 6px", color: "#64748b" },
  now: { margin: 0, color: "#e2e8f0" },
  dim: { color: "#475569" },
  input: { flex: "1 1 240px", background: "#0b1220", color: "#e2e8f0", border: "1px solid #475569", borderRadius: 8, padding: "12px", fontSize: 16, fontFamily: "inherit", minHeight: 44 },
  hint: { fontSize: 11, color: "#64748b", margin: 0 },
  log: { fontSize: 11, lineHeight: 1.5, maxHeight: 220, overflowY: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#94a3b8" },
};

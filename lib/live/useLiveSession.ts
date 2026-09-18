"use client";

/**
 * lib/live/useLiveSession.ts
 *
 * React binding for `LiveSession`.
 *
 * The important detail: tool handlers are held in a ref that is re-synced after
 * every commit, so a handler always closes over the CURRENT React state even
 * though the session and its tool registry are built exactly once. That is what
 * lets a tool call mutate state synchronously without the socket being torn
 * down and rebuilt whenever the page re-renders.
 *
 * The session is constructed in a mount effect rather than during render:
 * `LiveSession` owns an AudioContext and a WebSocket, so it must never be
 * created speculatively by a render that React might throw away.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveSession, type LiveSessionOptions } from "./session";
import { createToolRegistry } from "./tools";
import type {
  LiveError,
  LiveStatus,
  LiveTurn,
  ToolHandlers,
  ToolResult,
  ToolSpecMap,
} from "./types";

export interface UseLiveSessionArgs<M extends ToolSpecMap> extends Omit<LiveSessionOptions, "tools" | "events"> {
  toolSpecs: M;
  /** Re-created every render is fine and expected -- they are read through a ref. */
  toolHandlers: ToolHandlers<M>;
  onToolCall?: (name: string, args: Record<string, unknown>, result: unknown) => void;
  onTurnComplete?: (turn: LiveTurn) => void;
}

/** Mirrors `OrbState` in components/VoiceOrb.tsx (kept structural, not imported). */
export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

/** Mirrors `TranscriptLine` in components/VoiceOrb.tsx. */
export interface OrbTranscriptLine {
  id: string;
  who: "child" | "angel" | "monster";
  text: string;
  partial?: boolean;
}

export interface UseLiveSessionResult {
  status: LiveStatus;
  isLive: boolean;
  error: LiveError | null;
  muted: boolean;
  micLevel: number;
  modelSpeaking: boolean;
  /** Accumulating transcript for the turn in progress. */
  userTranscript: string;
  modelTranscript: string;
  /** Every completed exchange, oldest first. */
  turns: LiveTurn[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggleMute: () => void;
  sendText: (text: string) => void;

  /** Drop-in props for `<VoiceOrb />`. */
  orbState: OrbState;
  orbTranscript: OrbTranscriptLine[];
  errorText?: string;
}

export function useLiveSession<M extends ToolSpecMap>(args: UseLiveSessionArgs<M>): UseLiveSessionResult {
  const {
    toolSpecs,
    toolHandlers,
    onToolCall,
    onTurnComplete,
    systemInstruction,
    voiceName,
    tokenEndpoint,
    debug,
  } = args;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<LiveError | null>(null);
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [modelTranscript, setModelTranscript] = useState("");
  const [turns, setTurns] = useState<LiveTurn[]>([]);

  // "Latest value" refs. Written after commit, read only from socket callbacks
  // -- never during render.
  const handlersRef = useRef(toolHandlers);
  const onToolCallRef = useRef(onToolCall);
  const onTurnCompleteRef = useRef(onTurnComplete);
  const optionsRef = useRef({ toolSpecs, systemInstruction, voiceName, tokenEndpoint, debug });

  useEffect(() => {
    handlersRef.current = toolHandlers;
    onToolCallRef.current = onToolCall;
    onTurnCompleteRef.current = onTurnComplete;
  });

  // Build the session once, on mount.
  useEffect(() => {
    const { toolSpecs: specs, ...opts } = optionsRef.current;

    // Each proxied handler resolves the real handler at CALL time, so the
    // registry never goes stale even though it is created only once.
    const proxied = {} as ToolHandlers<ToolSpecMap>;
    for (const key of Object.keys(specs)) {
      proxied[key] = (a: unknown) => {
        const table = handlersRef.current as unknown as Record<string, (x: unknown) => ToolResult>;
        return table[key](a);
      };
    }

    const instance = new LiveSession({
      ...opts,
      tools: createToolRegistry(specs, proxied),
      events: {
        onStatus: (s) => {
          setStatus(s);
          if (s === "live") setError(null);
        },
        onError: (e) => setError(e),
        onMicLevel: (rms) => setMicLevel(rms),
        onModelSpeaking: (s) => setModelSpeaking(s),
        onUserTranscript: (_delta, full) => setUserTranscript(full),
        onModelTranscript: (_delta, full) => setModelTranscript(full),
        onInterrupted: () => setModelSpeaking(false),
        onTurnComplete: (turn) => {
          setTurns((prev) => [...prev, turn]);
          setUserTranscript("");
          setModelTranscript("");
          onTurnCompleteRef.current?.(turn);
        },
        onToolCall: (name, toolArgs, result) => onToolCallRef.current?.(name, toolArgs, result),
      },
    });

    setSession(instance);
    return () => {
      void instance.stop();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    await session?.start();
  }, [session]);

  const stop = useCallback(async () => {
    await session?.stop();
    setMicLevel(0);
  }, [session]);

  const toggleMute = useCallback(() => {
    setMuted(session?.toggleMute() ?? false);
  }, [session]);

  const sendText = useCallback(
    (text: string) => {
      session?.sendText(text);
    },
    [session],
  );

  // ---- VoiceOrb adapter ----------------------------------------------------
  const orbState: OrbState =
    status === "error"
      ? "error"
      : status === "minting-token" || status === "connecting" || status === "requesting-mic" || status === "reconnecting"
        ? "connecting"
        : status !== "live"
          ? "idle"
          : modelSpeaking
            ? "speaking"
            : // The child has said something and the monster has not answered yet.
              userTranscript && !modelTranscript
              ? "thinking"
              : "listening";

  const orbTranscript = useMemo<OrbTranscriptLine[]>(() => {
    const lines: OrbTranscriptLine[] = [];
    turns.forEach((t, i) => {
      if (t.user) lines.push({ id: `t${i}-c`, who: "child", text: t.user });
      if (t.model) lines.push({ id: `t${i}-m`, who: "monster", text: t.model });
    });
    if (userTranscript) lines.push({ id: "live-c", who: "child", text: userTranscript, partial: true });
    if (modelTranscript) lines.push({ id: "live-m", who: "monster", text: modelTranscript, partial: true });
    return lines;
  }, [turns, userTranscript, modelTranscript]);

  return {
    status,
    isLive: status === "live",
    error,
    muted,
    micLevel,
    modelSpeaking,
    userTranscript,
    modelTranscript,
    turns,
    start,
    stop,
    toggleMute,
    sendText,
    orbState,
    orbTranscript,
    errorText: error?.message,
  };
}

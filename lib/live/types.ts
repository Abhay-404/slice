/**
 * lib/live/types.ts
 *
 * Public types for the realtime voice layer. Deliberately free of any
 * `@google/genai` runtime import so this file can be pulled into a server
 * route, a client component, or a test harness without dragging in a bundle.
 */

// ---------------------------------------------------------------- lifecycle --

export type LiveStatus =
  | "idle"
  | "requesting-mic"
  | "minting-token"
  | "connecting"
  | "live"
  | "reconnecting"
  | "stopping"
  | "stopped"
  | "error";

export type LiveErrorCode =
  | "MISSING_API_KEY"
  | "TOKEN_ENDPOINT_FAILED"
  | "MIC_PERMISSION_DENIED"
  | "MIC_UNAVAILABLE"
  | "INSECURE_CONTEXT"
  | "AUDIO_UNSUPPORTED"
  | "CONNECT_FAILED"
  | "SOCKET_ERROR"
  | "SOCKET_CLOSED"
  | "TOOL_ERROR"
  | "UNKNOWN";

export interface LiveError {
  code: LiveErrorCode;
  /** Safe to show a developer. Not safe to show a nine year old. */
  message: string;
  /** True when retrying could plausibly work. */
  recoverable: boolean;
  cause?: unknown;
}

// ------------------------------------------------------------------- events --

export interface LiveTurn {
  user: string;
  model: string;
}

export interface LiveEvents {
  onStatus?: (status: LiveStatus) => void;
  onError?: (error: LiveError) => void;

  /**
   * The child's own speech, transcribed. Required by the product -- it is
   * rendered on screen. `full` is the accumulated text for the current turn.
   */
  onUserTranscript?: (delta: string, full: string, final: boolean) => void;

  /** What the monster said, transcribed. */
  onModelTranscript?: (delta: string, full: string, final: boolean) => void;

  /** Fired once per completed exchange. */
  onTurnComplete?: (turn: LiveTurn) => void;

  /** Fired synchronously, the instant a tool call is applied. */
  onToolCall?: (name: string, args: Record<string, unknown>, result: unknown) => void;

  /** 0..1 RMS of the mic, ~25x/sec. Drive a VU meter / orb with this. */
  onMicLevel?: (rms: number) => void;

  /** True while model audio is actually coming out of the speaker. */
  onModelSpeaking?: (speaking: boolean) => void;

  /** The model was cut off -- locally by barge-in, or by the server's VAD. */
  onInterrupted?: (source: "local-barge-in" | "server") => void;
}

// -------------------------------------------------------------------- tools --

/**
 * Minimal OpenAPI-subset schema. Mirrors `@google/genai`'s `Schema` closely
 * enough to cast at the boundary, without importing its `Type` enum.
 */
export type ToolParamType =
  | "OBJECT"
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY";

export interface ToolParamSchema {
  type: ToolParamType;
  description?: string;
  properties?: Record<string, ToolParamSchema>;
  items?: ToolParamSchema;
  required?: string[];
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

/**
 * A tool the model may call. `parse` is the trust boundary: the model can and
 * will send you `{ partIndex: "two" }`, so every spec validates its own args
 * and throws a readable error rather than letting junk into React state.
 */
export interface ToolSpec<TArgs> {
  readonly name: string;
  readonly description: string;
  readonly parameters?: ToolParamSchema;
  readonly parse: (raw: Record<string, unknown>) => TArgs;
}

/** Anything a handler may return. Sent back to the model as context. */
export type ToolResult = Record<string, unknown> | void;

/**
 * `unknown` (not `never`) is the correct constraint here: `TArgs` only ever
 * appears in a return position, so `ToolSpec<T>` is covariant in `T` and every
 * concrete spec is assignable to `ToolSpec<unknown>`.
 */
export type ToolSpecMap = Record<string, ToolSpec<unknown>>;

/** Extracts the parsed-arg type out of a spec. */
export type ArgsOf<S> = S extends ToolSpec<infer A> ? A : never;

/**
 * Handlers must be SYNCHRONOUS. That is the whole point: a tool call mutates
 * React state in the same tick it arrives, before we ack the model. Nothing
 * may await a network round trip here.
 */
export type ToolHandlers<M extends ToolSpecMap> = {
  [K in keyof M]: (args: ArgsOf<M[K]>) => ToolResult;
};

export interface ToolCallRecord {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
}

export interface ToolRegistry {
  /** Ready to hand to the Live API `tools` config. */
  declarations: Array<{
    name: string;
    description: string;
    parameters?: ToolParamSchema;
  }>;
  /** Runs the handler synchronously and returns what to send back. */
  dispatch: (call: { id?: string; name?: string; args?: Record<string, unknown> }) => ToolCallRecord;
}

// -------------------------------------------------------------------- token --

export interface LiveTokenResponse {
  /** Opaque ephemeral token, shaped like `auth_tokens/xxxxx`. Safe in a browser. */
  token: string;
  /** Model the client should connect with. Server is the source of truth. */
  model: string;
  /** ISO timestamp: after this, an already-open session stops accepting input. */
  expireTime: string;
  /** ISO timestamp: after this, the token can no longer OPEN a new session. */
  newSessionExpireTime: string;
  apiVersion: string;
}

export interface LiveTokenErrorResponse {
  error: {
    code: LiveErrorCode;
    message: string;
    hint?: string;
  };
}

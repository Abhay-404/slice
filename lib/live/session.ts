/**
 * lib/live/session.ts -- the realtime voice layer.
 *
 * ===========================================================================
 * ARCHITECTURE DECISION: ephemeral token + direct browser -> Google WebSocket
 * ===========================================================================
 *
 * THE PROBLEM
 * The Gemini Live API is a long-lived bidirectional WebSocket. Next.js App
 * Router route handlers on Vercel are request/response serverless functions:
 * they cannot accept a WebSocket upgrade and cannot hold a socket open for the
 * length of a conversation. So the obvious "proxy it through /api" design does
 * not deploy on our target platform at all.
 *
 * THE OPTIONS
 *   (a) Relay through a Next.js route handler.        Does not work on Vercel.
 *   (b) Separate always-on Node relay (Fly/Render).   Works, but it is a second
 *       service to deploy, monitor and pay for, and it doubles voice latency by
 *       putting an extra hop between the phone and Google.
 *   (c) API key in the browser.                       Forbidden. Instantly
 *       scrapeable, and the brief says the key must never reach the client.
 *   (d) Ephemeral token minted server-side, browser connects direct.  <-- CHOSEN
 *
 * WHY (d)
 * Google shipped ephemeral auth tokens for exactly this shape of app. A short
 * HTTP POST to `auth_tokens` -- which a serverless function handles perfectly
 * -- returns an opaque `auth_tokens/...` string. That string is single-use,
 * expires in minutes, and only works against the Live API. The browser then
 * opens the WebSocket straight to Google:
 *
 *     wss://generativelanguage.googleapis.com/ws/
 *       google.ai.generativelanguage.v1alpha.GenerativeService
 *       .BidiGenerateContentConstrained?access_token=auth_tokens/...
 *
 * One network hop instead of two, no second service, GEMINI_API_KEY never
 * leaves the server. Deploys on Vercel as-is.
 *
 * VERIFIED, NOT ASSUMED
 *  - Ephemeral tokens require apiVersion `v1alpha`. The public docs say
 *    v1beta; the @google/genai SDK hard-checks for v1alpha and warns
 *    otherwise, and routes token-authed sockets to a *different* RPC
 *    (`BidiGenerateContentConstrained`). The SDK is the source of truth here.
 *  - Input audio: raw little-endian PCM16 @ 16 kHz, `audio/pcm;rate=16000`.
 *  - Output audio: raw little-endian PCM16 @ 24 kHz.
 *
 * WHY THE SDK RATHER THAN A HAND-ROLLED WEBSOCKET
 * The bidi protocol has a dozen message shapes and the ephemeral-token path
 * uses a non-obvious RPC name and query parameter. Hand-rolling it means every
 * field name is an untested guess. `@google/genai` (Apache-2.0, no copyleft
 * anywhere in its dependency tree) gives us compile-time checking of the whole
 * protocol. We import it via the `browser` export condition so the Node-only
 * `ws` / `google-auth-library` / `protobufjs` deps never enter the bundle.
 *
 * KNOWN LIMITS
 *  - Tokens are `uses: 1`. Every reconnect mints a fresh one.
 *  - Live sessions get a `goAway` around the 10 minute mark. We ask for
 *    `sessionResumption` and reconnect transparently with the handle.
 *  - Ephemeral token support is flagged experimental by Google; the SDK logs a
 *    warning on every connect. That warning is expected, not a bug.
 */

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

import { LIVE_CONFIG } from "./config";
import {
  MicCapture,
  PcmPlayer,
  audioSupport,
  base64ToPcm16,
  createAudioContext,
  pcm16ToBase64,
  unlockAudioContext,
} from "./audio";
import { LiveFailure, toLiveError } from "./errors";
import type {
  LiveEvents,
  LiveStatus,
  LiveTokenErrorResponse,
  LiveTokenResponse,
  ToolRegistry,
} from "./types";

/** Shortest repeated block we are willing to treat as a replay, in characters. */
const MIN_REPEAT = 24;

/**
 * Collapses an immediately-repeated tail block: "A B B" -> "A B", allowing a
 * single space or newline between the two copies. This is the safety net for
 * the transcript replay described on `TranscriptAccumulator`.
 *
 * MIN_REPEAT keeps it away from short genuine repetitions ("one half one half").
 * A long genuine back-to-back repeat would be collapsed, which is a cosmetic
 * loss we accept in exchange for never double-printing a whole sentence.
 */
export function collapseRepeatedTail(s: string): string {
  const n = s.length;
  for (let k = Math.floor(n / 2); k >= MIN_REPEAT; k--) {
    const tail = s.slice(n - k);
    if (tail === s.slice(n - 2 * k, n - k)) return s.slice(0, n - k);
    const j = n - 2 * k - 1;
    if (j >= 0) {
      const sep = s[n - k - 1];
      if ((sep === " " || sep === "\n") && tail === s.slice(j, n - k - 1)) {
        return s.slice(0, n - k - 1);
      }
    }
  }
  return s;
}

/**
 * Accumulates streamed transcription deltas into one string per turn.
 *
 * MEASURED QUIRK (gemini-3.1-flash-live-preview, verified against the live API,
 * not documented anywhere): at the end of a turn the model REPLAYS its output
 * transcription. Naive `+=` therefore prints every sentence twice on screen.
 *
 * Two defences, because the replay is not always clean:
 *  1. Live: if a delta re-matches the transcript from position 0, we are in a
 *     replay -- swallow deltas that match text we already have, and append only
 *     genuine divergence (a revision). This catches the common case instantly,
 *     so the screen never shows the duplicate at all.
 *  2. Backstop: `value` collapses an immediately-repeated tail block. Observed
 *     runs where the replay restarted mid-phrase and so slipped past (1).
 */
class TranscriptAccumulator {
  private text = "";
  private replayCursor = -1;

  /** Returns the delta actually appended ("" if the delta was a replay). */
  push(delta: string): string {
    if (!delta) return "";

    if (this.replayCursor >= 0) {
      if (this.text.startsWith(delta, this.replayCursor)) {
        this.replayCursor += delta.length;
        return "";
      }
      // Diverged -- the model revised itself. Take the new text from here.
      this.text = this.text.slice(0, this.replayCursor) + delta;
      this.replayCursor = this.text.length;
      return delta;
    }

    if (this.text.length > delta.length && delta.length >= 4 && this.text.startsWith(delta)) {
      // The transcript is being re-sent from the beginning.
      this.replayCursor = delta.length;
      return "";
    }

    this.text += delta;
    return delta;
  }

  get value(): string {
    return collapseRepeatedTail(this.text);
  }

  reset(): void {
    this.text = "";
    this.replayCursor = -1;
  }
}

export interface LiveSessionOptions {
  /** Tools the model may call. Handlers run synchronously. */
  tools?: ToolRegistry;
  /** Overrides `LIVE_CONFIG.systemInstruction`. */
  systemInstruction?: string;
  /** Overrides `LIVE_CONFIG.voiceName`. */
  voiceName?: string;
  /** Overrides `LIVE_CONFIG.token.endpoint`. */
  tokenEndpoint?: string;
  /** Log every server message to the console. */
  debug?: boolean;
  events?: LiveEvents;
}

export class LiveSession {
  private opts: LiveSessionOptions;
  private events: LiveEvents;

  private ctx: AudioContext | null = null;
  private mic: MicCapture | null = null;
  private player: PcmPlayer | null = null;
  private session: Session | null = null;
  /**
   * Text sent between `onopen` (status -> "live") and `connect()` resolving
   * (`this.session` assigned). That window is real: React sees "live" and
   * fires an effect before the awaited handle lands. Without this queue the
   * first line of every session is silently dropped.
   */
  private pendingText: string[] = [];

  private status: LiveStatus = "idle";
  private muted = false;
  private stopping = false;

  private userTurn = new TranscriptAccumulator();
  private modelTurn = new TranscriptAccumulator();

  private resumeHandle: string | null = null;
  private reconnectAttempts = 0;

  private hotFrames = 0;
  private modelStartedSpeakingAt = 0;
  /** Server confirmed a barge-in: drop model audio until the turn boundary. */
  private suppressAudio = false;
  /** Local barge-in: drop model audio until this timestamp, then give up. */
  private localSuppressUntil = 0;

  /** Wall-clock ms of the last mic frame sent -- used for the latency probe. */
  lastSendAt = 0;
  /** Wall-clock ms when the first audio chunk of the current model turn arrived. */
  lastFirstAudioAt = 0;

  constructor(options: LiveSessionOptions = {}) {
    this.opts = options;
    this.events = options.events ?? {};
  }

  getStatus(): LiveStatus {
    return this.status;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isActive(): boolean {
    return this.status === "live" || this.status === "reconnecting";
  }

  // -------------------------------------------------------------- lifecycle --

  /**
   * MUST be called from a user gesture (click/tap). iOS Safari will leave the
   * AudioContext suspended forever otherwise, and Chrome/Android will refuse
   * getUserMedia. The AudioContext is created before the first `await` for
   * exactly this reason.
   */
  async start(): Promise<void> {
    if (this.status !== "idle" && this.status !== "stopped" && this.status !== "error") {
      return;
    }
    this.stopping = false;
    this.reconnectAttempts = 0;
    this.resumeHandle = null;

    const support = audioSupport();
    if (!support.ok) {
      this.fail(support.error!);
      return;
    }

    // --- inside the gesture, before any await ---
    try {
      this.ctx = createAudioContext();
      this.player = new PcmPlayer(this.ctx, {
        onSpeakingChange: (speaking) => {
          if (speaking) this.modelStartedSpeakingAt = performance.now();
          this.events.onModelSpeaking?.(speaking);
        },
      });
      await unlockAudioContext(this.ctx);
    } catch (err) {
      this.fail(toLiveError(err, "AUDIO_UNSUPPORTED"));
      return;
    }

    try {
      this.setStatus("requesting-mic");
      this.mic = new MicCapture(this.ctx, {
        onFrame: (pcm, rms) => this.onMicFrame(pcm, rms),
        onError: (e) => this.events.onError?.(e),
      });
      await this.mic.start();
      this.mic.setMuted(this.muted);
    } catch (err) {
      this.fail(toLiveError(err, "MIC_UNAVAILABLE"));
      await this.teardown();
      return;
    }

    try {
      await this.connect();
    } catch (err) {
      this.fail(toLiveError(err, "CONNECT_FAILED"));
      await this.teardown();
    }
  }

  async stop(): Promise<void> {
    if (this.status === "idle" || this.status === "stopped") return;
    this.stopping = true;
    this.setStatus("stopping");
    await this.teardown();
    this.setStatus("stopped");
  }

  mute(muted: boolean): void {
    this.muted = muted;
    this.mic?.setMuted(muted);
  }

  toggleMute(): boolean {
    this.mute(!this.muted);
    return this.muted;
  }

  /**
   * Type instead of speak. Invaluable for testing tool calls without a mic,
   * and for a "the room is too loud" fallback in the real app.
   */
  sendText(text: string): void {
    if (!text.trim()) return;
    if (!this.session) {
      // Socket is open but the handle hasn't resolved yet -- see pendingText.
      if (this.status === "live" || this.status === "connecting") this.pendingText.push(text);
      return;
    }
    this.deliverText(text);
  }

  private deliverText(text: string): void {
    if (!this.session) return;
    this.player?.clear();
    this.session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
    // Stage directions ([bracketed]) are the app talking to the model, not the
    // child talking -- keep them out of the child's transcript.
    if (!text.trimStart().startsWith("[")) {
      this.userTurn.push(this.userTurn.value ? " " + text : text);
      this.events.onUserTranscript?.(text, this.userTurn.value, false);
    }
  }

  // -------------------------------------------------------------- internals --

  private async connect(resume?: string): Promise<void> {
    this.setStatus(resume ? "reconnecting" : "minting-token");

    const token = await this.mintToken();

    this.setStatus("connecting");

    const ai = new GoogleGenAI({
      apiKey: token.token,
      httpOptions: { apiVersion: token.apiVersion },
    });

    const declarations = this.opts.tools?.declarations ?? [];

    this.session = await ai.live.connect({
      model: token.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.opts.systemInstruction ?? LIVE_CONFIG.systemInstruction,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.opts.voiceName ?? LIVE_CONFIG.voiceName },
          },
        },
        // Empty objects are the correct "on" value for both of these.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // The dominant term in perceived reply latency. See LIVE_CONFIG.vad.
        realtimeInputConfig: {
          automaticActivityDetection: {
            silenceDurationMs: LIVE_CONFIG.vad.silenceDurationMs,
            prefixPaddingMs: LIVE_CONFIG.vad.prefixPaddingMs,
          },
        },
        sessionResumption: resume ? { handle: resume } : {},
        ...(declarations.length
          ? {
              tools: [
                {
                  functionDeclarations: declarations.map((d) => ({
                    name: d.name,
                    description: d.description,
                    // Our ToolParamSchema is a structural subset of the SDK's
                    // Schema; the only difference is that `type` is a string
                    // literal here and a string enum there.
                    ...(d.parameters ? { parameters: d.parameters as never } : {}),
                  })),
                },
              ],
            }
          : {}),
      },
      callbacks: {
        onopen: () => {
          this.reconnectAttempts = 0;
          this.setStatus("live");
        },
        onmessage: (msg) => this.onServerMessage(msg),
        onerror: (e) => {
          this.events.onError?.({
            code: "SOCKET_ERROR",
            message: `Live socket error: ${(e as ErrorEvent)?.message ?? "unknown"}`,
            recoverable: true,
            cause: e,
          });
        },
        onclose: (e) => this.onClose(e),
      },
    });

    const queued = this.pendingText.splice(0);
    for (const text of queued) this.deliverText(text);
  }

  private async mintToken(): Promise<LiveTokenResponse> {
    const endpoint = this.opts.tokenEndpoint ?? LIVE_CONFIG.token.endpoint;

    let res: Response;
    try {
      res = await fetch(endpoint, { method: "POST", cache: "no-store" });
    } catch (err) {
      throw new LiveFailure(
        "TOKEN_ENDPOINT_FAILED",
        `Could not reach ${endpoint}. Is the dev server running?`,
        { recoverable: true, cause: err },
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new LiveFailure("TOKEN_ENDPOINT_FAILED", `${endpoint} returned ${res.status} with a non-JSON body.`, {
        recoverable: false,
      });
    }

    if (!res.ok) {
      const err = (body as LiveTokenErrorResponse).error;
      throw new LiveFailure(err?.code ?? "TOKEN_ENDPOINT_FAILED", err?.message ?? `${endpoint} returned ${res.status}.`, {
        recoverable: err?.code !== "MISSING_API_KEY",
      });
    }

    const token = body as LiveTokenResponse;
    if (!token?.token) {
      throw new LiveFailure("TOKEN_ENDPOINT_FAILED", `${endpoint} returned no token.`, { recoverable: false });
    }
    return token;
  }

  private onMicFrame(pcm: Int16Array, rms: number): void {
    this.events.onMicLevel?.(rms);

    // --- local barge-in -----------------------------------------------------
    // The server does its own VAD and will send `interrupted`, but that costs a
    // round trip. Cutting playback locally the moment we hear sustained speech
    // makes the monster feel like it is actually listening. The grace window
    // stops the model's own voice, leaking through an imperfect echo canceller,
    // from interrupting itself.
    const bi = LIVE_CONFIG.bargeIn;
    if (bi.enabled && this.player?.isSpeaking && !this.muted) {
      const elapsed = performance.now() - this.modelStartedSpeakingAt;
      if (rms >= bi.rmsThreshold && elapsed > bi.graceMs) {
        this.hotFrames++;
        if (this.hotFrames >= bi.sustainedFrames) {
          this.hotFrames = 0;
          this.player.clear();
          this.localSuppressUntil = performance.now() + bi.localSuppressMs;
          this.events.onInterrupted?.("local-barge-in");
        }
      } else if (rms < bi.rmsThreshold) {
        this.hotFrames = 0;
      }
    } else {
      this.hotFrames = 0;
    }

    if (!this.session || this.status !== "live") return;

    try {
      this.session.sendRealtimeInput({
        audio: { data: pcm16ToBase64(pcm), mimeType: LIVE_CONFIG.inputMimeType },
      });
      this.lastSendAt = performance.now();
    } catch (err) {
      // Socket closed mid-frame. `onclose` handles recovery; don't spam.
      if (this.opts.debug) console.warn("[live] send failed", err);
    }
  }

  private onServerMessage(msg: LiveServerMessage): void {
    if (this.opts.debug) console.debug("[live] <-", msg);

    if (msg.sessionResumptionUpdate?.newHandle) {
      this.resumeHandle = msg.sessionResumptionUpdate.newHandle;
    }

    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this.player?.clear();
        // MEASURED: audio chunks for the killed turn keep arriving for a beat
        // after `interrupted` -- they were already in flight. Clearing the
        // buffer once is not enough; without this flag the monster carries on
        // talking right after the child cut it off. The window closes at the
        // next `turnComplete`, which the server sends ~100 ms later.
        this.suppressAudio = true;
        this.events.onInterrupted?.("server");
      }

      // Input transcription: the child's own words. Product-critical.
      const inTx = sc.inputTranscription?.text ?? sc.interimInputTranscription?.text;
      if (inTx) {
        const applied = this.userTurn.push(inTx);
        if (applied) {
          this.events.onUserTranscript?.(applied, this.userTurn.value, Boolean(sc.inputTranscription?.finished));
        }
      }

      const outTx = sc.outputTranscription?.text;
      if (outTx) {
        const applied = this.modelTurn.push(outTx);
        if (applied) {
          this.events.onModelTranscript?.(applied, this.modelTurn.value, Boolean(sc.outputTranscription?.finished));
        }
      }

      for (const part of sc.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data && part.inlineData?.mimeType?.startsWith("audio/")) {
          if (this.suppressAudio || performance.now() < this.localSuppressUntil) continue;
          if (this.lastFirstAudioAt < this.lastSendAt) {
            this.lastFirstAudioAt = performance.now();
          }
          this.player?.enqueue(base64ToPcm16(data));
        }
      }

      if (sc.turnComplete) {
        this.suppressAudio = false;
        this.localSuppressUntil = 0;
        const turn = { user: this.userTurn.value.trim(), model: this.modelTurn.value.trim() };
        if (turn.user || turn.model) this.events.onTurnComplete?.(turn);
        if (turn.user) this.events.onUserTranscript?.("", turn.user, true);
        if (turn.model) this.events.onModelTranscript?.("", turn.model, true);
        this.userTurn.reset();
        this.modelTurn.reset();
      }
    }

    // ---- tool calls: applied synchronously, acked immediately ---------------
    if (msg.toolCall?.functionCalls?.length) {
      const registry = this.opts.tools;
      const responses = msg.toolCall.functionCalls.map((fc) => {
        if (!registry) {
          return { id: fc.id, name: fc.name, response: { error: "No tools registered on the client." } };
        }
        // dispatch() is synchronous and never throws: React state is already
        // updated by the time this line returns.
        const record = registry.dispatch({ id: fc.id, name: fc.name, args: fc.args });
        this.events.onToolCall?.(record.name, record.args, record.result);
        if (record.error) {
          this.events.onError?.({
            code: "TOOL_ERROR",
            message: `Tool "${record.name}": ${record.error}`,
            recoverable: true,
          });
        }
        return { id: fc.id, name: fc.name, response: record.result as Record<string, unknown> };
      });

      try {
        this.session?.sendToolResponse({ functionResponses: responses });
      } catch (err) {
        if (this.opts.debug) console.warn("[live] tool response failed", err);
      }
    }

    if (msg.toolCallCancellation?.ids?.length && this.opts.debug) {
      console.debug("[live] tool calls cancelled", msg.toolCallCancellation.ids);
    }

    // Server is about to hang up (~10 min cap). Get ahead of it.
    if (msg.goAway) {
      if (this.opts.debug) console.debug("[live] goAway", msg.goAway.timeLeft);
      void this.reconnect();
    }
  }

  private onClose(e: CloseEvent): void {
    this.session = null;
    if (this.stopping) return;

    this.events.onError?.({
      code: "SOCKET_CLOSED",
      message: `Live socket closed (${e?.code ?? "?"}): ${e?.reason || "no reason given"}`,
      recoverable: true,
      cause: e,
    });
    void this.reconnect();
  }

  private async reconnect(): Promise<void> {
    if (this.stopping || !LIVE_CONFIG.reconnect.enabled) return;
    if (this.status === "reconnecting") return;
    if (this.reconnectAttempts >= LIVE_CONFIG.reconnect.maxAttempts) {
      this.fail({
        code: "CONNECT_FAILED",
        message: `Gave up after ${LIVE_CONFIG.reconnect.maxAttempts} reconnect attempts. Tap start again.`,
        recoverable: true,
      });
      await this.teardown();
      return;
    }

    this.reconnectAttempts++;
    this.setStatus("reconnecting");
    this.player?.clear();

    const delay = LIVE_CONFIG.reconnect.baseDelayMs * this.reconnectAttempts;
    await new Promise((r) => setTimeout(r, delay));
    if (this.stopping) return;

    try {
      // Every reconnect mints a fresh token: tokens are single-use.
      await this.connect(this.resumeHandle ?? undefined);
    } catch (err) {
      this.events.onError?.(toLiveError(err, "CONNECT_FAILED"));
      void this.reconnect();
    }
  }

  private async teardown(): Promise<void> {
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;

    this.mic?.stop();
    this.mic = null;

    this.player?.dispose();
    this.player = null;

    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }

    this.userTurn.reset();
    this.modelTurn.reset();
    this.hotFrames = 0;
    this.suppressAudio = false;
    this.localSuppressUntil = 0;
  }

  private setStatus(next: LiveStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.events.onStatus?.(next);
  }

  private fail(error: ReturnType<typeof toLiveError>): void {
    this.setStatus("error");
    this.events.onError?.(error);
  }
}

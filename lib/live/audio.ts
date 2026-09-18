/**
 * lib/live/audio.ts
 *
 * Browser audio plumbing: one shared AudioContext, mic capture -> PCM16/16 kHz
 * frames, and jitter-buffered playback of PCM16/24 kHz frames.
 *
 * Everything here is client-only. Importing it on the server is a no-op until
 * you call something.
 */

import { LIVE_CONFIG } from "./config";
import { micWorkletUrl, MIC_WORKLET_NAME, type MicWorkletMessage } from "./worklet-source";
import type { LiveError } from "./types";
import { LiveFailure } from "./errors";

// ---------------------------------------------------------------------------
// base64 <-> PCM
// ---------------------------------------------------------------------------

/**
 * Both target platforms (ARM iOS, ARM/x86 Android) are little-endian, and
 * `Int16Array` uses platform endianness -- which is exactly the LE PCM16 the
 * API wants. If this ever runs on a big-endian host, swap to DataView here.
 */
export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(binary);
}

export function base64ToPcm16(b64: string): Int16Array {
  const binary = atob(b64);
  const n = binary.length;
  // Drop a trailing odd byte rather than throwing -- a truncated frame is
  // better than a dead session.
  const usable = n - (n % 2);
  const bytes = new Uint8Array(usable);
  for (let i = 0; i < usable; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

// ---------------------------------------------------------------------------
// AudioContext
// ---------------------------------------------------------------------------

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function audioSupport(): { ok: boolean; error?: LiveError } {
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "AUDIO_UNSUPPORTED", message: "Not in a browser.", recoverable: false } };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      error: {
        code: "INSECURE_CONTEXT",
        message:
          "getUserMedia requires HTTPS (or http://localhost). Open the site over https -- on a phone use `next dev --experimental-https` or a tunnel such as ngrok/cloudflared.",
        recoverable: false,
      },
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: { code: "MIC_UNAVAILABLE", message: "navigator.mediaDevices.getUserMedia is unavailable in this browser.", recoverable: false } };
  }
  if (!getAudioContextCtor()) {
    return { ok: false, error: { code: "AUDIO_UNSUPPORTED", message: "Web Audio (AudioContext) is unavailable in this browser.", recoverable: false } };
  }
  return { ok: true };
}

/**
 * MUST be called synchronously from inside a user gesture on iOS, before any
 * `await`. Creating the context later (e.g. after awaiting a fetch) leaves it
 * permanently suspended on Safari.
 */
export function createAudioContext(): AudioContext {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error("AudioContext unavailable");

  // Do NOT pin sampleRate. iOS honours it inconsistently and pinning it while
  // a mic is open is a known source of silence. We resample ourselves instead.
  const ctx = new Ctor({ latencyHint: "interactive" });

  // Safari 16.4+: tells iOS this is a voice-chat session so output goes to the
  // loud speaker instead of the earpiece while the mic is live.
  const nav = navigator as unknown as { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "play-and-record";
    } catch {
      /* non-fatal */
    }
  }

  return ctx;
}

/** iOS needs a real resume + a token of playback inside the gesture. */
export async function unlockAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

// ---------------------------------------------------------------------------
// Mic capture
// ---------------------------------------------------------------------------

export interface MicCaptureCallbacks {
  onFrame: (pcm: Int16Array, rms: number) => void;
  onError?: (error: LiveError) => void;
}

export class MicCapture {
  private ctx: AudioContext;
  private cb: MicCaptureCallbacks;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private muted = false;
  private started = false;

  /** Reported by the worklet once it boots. Useful for a bug report. */
  contextRate = 0;

  constructor(ctx: AudioContext, cb: MicCaptureCallbacks) {
    this.ctx = ctx;
    this.cb = cb;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Without echoCancellation the phone's own speaker feeds straight
          // back into the mic and the model interrupts itself forever.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
    } catch (err) {
      this.started = false;
      const name = (err as { name?: string })?.name;
      const denied = name === "NotAllowedError" || name === "SecurityError";
      throw new LiveFailure(
        denied ? "MIC_PERMISSION_DENIED" : "MIC_UNAVAILABLE",
        denied
          ? "Microphone permission was denied. Allow the mic in the browser's site settings and try again."
          : `Could not open the microphone (${name ?? "unknown error"}). Another app or tab may be holding it.`,
        { recoverable: true, cause: err },
      );
    }

    await this.ctx.audioWorklet.addModule(micWorkletUrl());

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, MIC_WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      processorOptions: {
        targetRate: LIVE_CONFIG.inputSampleRate,
        frameSamples: LIVE_CONFIG.micFrameSamples,
      },
    });

    this.node.port.onmessage = (event: MessageEvent<MicWorkletMessage>) => {
      const msg = event.data;
      if (msg.type === "ready") {
        this.contextRate = msg.contextRate;
        return;
      }
      if (msg.type === "frame") {
        if (this.muted) return;
        this.cb.onFrame(new Int16Array(msg.pcm), msg.rms);
      }
    };

    this.node.onprocessorerror = () => {
      this.cb.onError?.({
        code: "AUDIO_UNSUPPORTED",
        message: "The microphone AudioWorklet crashed. Reload the page.",
        recoverable: true,
      });
    };

    // numberOfOutputs: 0 -- the node is a sink, so it does NOT need connecting
    // to ctx.destination. Connecting it there would echo the mic to the speaker.
    this.source.connect(this.node);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    // Also gate at the track level so the OS mic indicator reflects reality.
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  isMuted(): boolean {
    return this.muted;
  }

  stop(): void {
    try {
      this.node?.port.postMessage({ type: "close" });
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.node?.disconnect();
    } catch {
      /* ignore */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.node = null;
    this.started = false;
  }
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

export interface PcmPlayerCallbacks {
  onSpeakingChange?: (speaking: boolean) => void;
}

/**
 * Schedules 24 kHz PCM16 chunks back-to-back on the Web Audio clock.
 *
 * The jitter buffer is the `JITTER` lead time: we never schedule a chunk to
 * start sooner than `now + jitterMs`, so a chunk that arrives a little late
 * still lands before the previous one has finished playing. Without it you get
 * a click on every network hiccup.
 *
 * Buffers are created at 24000 Hz regardless of the context's own rate; the
 * AudioBufferSourceNode resamples. This is far more reliable across iOS than
 * pinning the context to 24000.
 */
export class PcmPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private cb: PcmPlayerCallbacks;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private speaking = false;
  private readonly jitter: number;

  constructor(ctx: AudioContext, cb: PcmPlayerCallbacks = {}) {
    this.ctx = ctx;
    this.cb = cb;
    this.jitter = LIVE_CONFIG.jitterBufferMs / 1000;
    this.gain = ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(ctx.destination);
  }

  /** Seconds of audio still queued ahead of the playhead. */
  get bufferedSeconds(): number {
    return Math.max(0, this.nextStart - this.ctx.currentTime);
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  enqueue(pcm: Int16Array): void {
    if (pcm.length === 0) return;

    const buffer = this.ctx.createBuffer(1, pcm.length, LIVE_CONFIG.outputSampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i];
      channel[i] = v < 0 ? v / 0x8000 : v / 0x7fff;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);

    const now = this.ctx.currentTime;
    if (this.nextStart < now + this.jitter) {
      this.nextStart = now + this.jitter;
    }
    src.start(this.nextStart);
    this.nextStart += buffer.duration;

    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.setSpeaking(false);
    };

    this.setSpeaking(true);
  }

  /**
   * Barge-in. Ramps the gain to zero over ~15 ms before stopping the sources so
   * the cut is inaudible instead of a pop, then restores gain for the next turn.
   */
  clear(): void {
    if (this.sources.size === 0) {
      this.nextStart = 0;
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.gain.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.015);
    } catch {
      /* ignore */
    }

    for (const src of this.sources) {
      try {
        src.onended = null;
        src.stop(now + 0.02);
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStart = 0;

    try {
      g.setValueAtTime(1, now + 0.03);
    } catch {
      g.value = 1;
    }

    this.setSpeaking(false);
  }

  dispose(): void {
    this.clear();
    try {
      this.gain.disconnect();
    } catch {
      /* ignore */
    }
  }

  private setSpeaking(next: boolean): void {
    if (this.speaking === next) return;
    this.speaking = next;
    this.cb.onSpeakingChange?.(next);
  }
}

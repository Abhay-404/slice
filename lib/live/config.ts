/**
 * lib/live/config.ts
 *
 * Every tunable for the realtime voice layer lives here. Nothing else in
 * `lib/live/` should contain a magic number or a model id string literal.
 *
 * Changing the model is a ONE LINE change: `LIVE_CONFIG.model`.
 */

export const LIVE_MODELS = {
  /** Current default. Gemini 3.8 Live — stable, "default Live API model for low-latency voice agents". */
  primary: "gemini-3.8-live",
  /** Previous default, preview. Fall back here if 3.8 misbehaves with tools. */
  fallback: "gemini-3.1-flash-live-preview",
  /** Same generation with background reasoning — slower first word, better at following a script. */
  thinking: "gemini-3.8-live-extended-thinking",
} as const;

export const LIVE_CONFIG = {
  // ---------------------------------------------------------------- model --
  /** Change this one line to switch models. Server may override via GEMINI_LIVE_MODEL. */
  model: LIVE_MODELS.primary as string,

  /**
   * Ephemeral tokens are only supported on v1alpha (verified in the
   * @google/genai SDK source, not just the docs -- the public docs say v1beta,
   * the SDK hard-requires v1alpha and warns on anything else).
   */
  apiVersion: "v1alpha",

  // ---------------------------------------------------------------- audio --
  /** Live API input: raw little-endian PCM16 @ 16 kHz. Non-negotiable. */
  inputSampleRate: 16000,
  /** Live API output: raw little-endian PCM16 @ 24 kHz. Non-negotiable. */
  outputSampleRate: 24000,
  /** MIME type string the API expects on realtimeInput.audio. */
  inputMimeType: "audio/pcm;rate=16000",

  /**
   * Mic frame size handed to the network, in samples at 16 kHz.
   * 640 = 40 ms. Smaller = lower latency, more WebSocket messages + base64
   * overhead. Anything under ~20 ms starts to cost more than it saves.
   */
  micFrameSamples: 640,

  /**
   * Playback jitter buffer. We schedule each incoming chunk at least this far
   * in the future so a late packet doesn't produce a gap (= a click).
   * 120 ms is the smallest value that survived a bad 4G connection in testing;
   * drop to ~60 ms on wifi if you want to shave latency.
   */
  jitterBufferMs: 120,

  /** Prebuilt Live API voice. Others: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr. */
  voiceName: "Puck",

  // -------------------------------------------------------------------- VAD --
  /**
   * Server-side voice activity detection. This single number is the biggest
   * lever on perceived latency AND on whether the tutor talks over a child
   * who is still thinking. Every millisecond here is added to every reply.
   *
   *   300 ms -> snappy, but cuts off a child who pauses mid-sentence.
   *   500 ms -> the compromise we ship.
   *   800 ms -> patient, feels sluggish.
   *
   * Nine-year-olds pause a lot mid-thought, so do not drop this below ~400
   * without watching a real child use it.
   */
  vad: {
    silenceDurationMs: 500,
    /** Speech must persist this long before it counts as start-of-speech. */
    prefixPaddingMs: 300,
  },

  // -------------------------------------------------------------- barge-in --
  bargeIn: {
    /** Local barge-in is belt-and-braces on top of the server's own VAD. */
    enabled: true,
    /** RMS of the mic frame above which we call it speech. 0..1. */
    rmsThreshold: 0.05,
    /** Consecutive 40 ms frames over threshold before we cut playback. 3 = 120 ms. */
    sustainedFrames: 3,
    /**
     * Don't allow local barge-in for this long after the model starts talking.
     * Guards against the model's own first syllable leaking through a phone's
     * imperfect echo canceller and interrupting itself.
     */
    graceMs: 250,
    /**
     * How long a LOCAL barge-in keeps dropping incoming model audio.
     *
     * Local detection can be wrong (echo leaking past the canceller). If the
     * server's own VAD agrees, it sends `interrupted` well inside this window
     * and suppression continues to the turn boundary. If it never agrees, this
     * expires and the tutor carries on talking -- a briefly clipped word,
     * rather than a reply that silently vanishes.
     */
    localSuppressMs: 1500,
  },

  // ----------------------------------------------------------------- token --
  token: {
    endpoint: "/api/live-token",
    /** Times the token may open a session. 1 is right for normal use. */
    uses: 1,
    /** Window in which the browser must OPEN the socket. Google default is 60 s. */
    newSessionWindowSeconds: 120,
    /** How long the opened session may keep sending. Google caps this at 20 h. */
    lifetimeSeconds: 30 * 60,
  },

  // ------------------------------------------------------------- reconnect --
  reconnect: {
    /** Live sessions get a `goAway` around the 10 minute mark. Resume instead of dying. */
    enabled: true,
    maxAttempts: 3,
    baseDelayMs: 400,
  },

  // --------------------------------------------------------------- persona --
  systemInstruction: [
    "You are Mo, a friendly, slightly silly tutor who is learning fractions and is about nine years old in personality.",
    "You are talking to a real child who is about nine. The child is TEACHING YOU. You are the student, they are the teacher.",
    "",
    "Rules:",
    "- Speak in short sentences. Two sentences at a time, maximum. Then stop and let them talk.",
    "- Use simple words. No jargon. Never lecture.",
    "- Be curious and a bit wrong on purpose sometimes, so the child gets to correct you. Celebrate when they do.",
    "- Never say you are an AI or a language model. You are Mo the tutor.",
    "",
    "You have tools that change the picture on the screen you and the child are both looking at.",
    "USE THEM CONSTANTLY. Every time you talk about a shape, a number of parts, or a fraction, call the matching tool",
    "so the child SEES what you mean. Call setFraction before you describe a fraction. Call shadeParts when you count",
    "shaded pieces. Call highlightPart when you point at one piece. Call celebrate when the child gets something right.",
    "Call the tool first, then say the sentence.",
  ].join("\n"),
} as const;

export type LiveConfig = typeof LIVE_CONFIG;

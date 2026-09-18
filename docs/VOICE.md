# Realtime voice layer

Everything in `lib/live/`, plus `app/api/live-token/` and the `/spike` test page.

---

## 1. The approach, and why

**Ephemeral token minted server-side; the browser opens the WebSocket directly to Google.**

The Gemini Live API is a long-lived bidirectional WebSocket. Next.js App Router
route handlers on Vercel are request/response serverless functions — they cannot
accept a WebSocket upgrade or hold a socket open for a conversation. The obvious
"proxy it through `/api`" design does not deploy on our target platform at all.

| Option | Verdict |
|---|---|
| Relay through a Next.js route handler | Does not work on Vercel. |
| Separate always-on Node relay (Fly/Render) | Works, but a second service to deploy and pay for, and it doubles voice latency by adding a hop. |
| API key in the browser | Forbidden, and trivially scrapeable. |
| **Ephemeral token + direct browser connection** | **Chosen.** |

Google shipped ephemeral auth tokens for exactly this shape of app. `POST
/api/live-token` — a ~200 ms HTTP call a serverless function handles perfectly —
returns an opaque `auth_tokens/...` string that is single-use, expires in
minutes, and only works against the Live API. The browser then connects straight
to:

```
wss://generativelanguage.googleapis.com/ws/
  google.ai.generativelanguage.v1alpha.GenerativeService
  .BidiGenerateContentConstrained?access_token=auth_tokens/...
```

One hop instead of two, no second service, `GEMINI_API_KEY` never leaves the
server. Deploys on Vercel as-is.

### Things that are true but not in the public docs

- **Ephemeral tokens need `apiVersion: "v1alpha"`.** The published docs say
  `v1beta`. The SDK hard-checks for `v1alpha`, warns otherwise, and routes
  token-authenticated sockets to a *different* RPC name
  (`BidiGenerateContentConstrained`, not `BidiGenerateContent`).
- **The accessor is `ai.authTokens.create()`, not `ai.tokens.create()`.** Every
  docs snippet and blog post says `tokens`. In `@google/genai` 2.x the module is
  mounted at `GoogleGenAI.authTokens`. This is the one thing guaranteed to waste
  an hour if you go by the docs.
- `console.warn: "Ephemeral token support is experimental"` fires on every
  connect. Expected, not a bug.

### Why the SDK rather than a hand-rolled WebSocket

`@google/genai` is Apache-2.0 with no copyleft anywhere in its dependency tree
(checked with `license-checker`). The bidi protocol has a dozen message shapes
and the token path uses a non-obvious RPC name and query parameter; hand-rolling
means every field name is an untested guess. The SDK gives compile-time checking
of the whole protocol.

It is imported through the `browser` export condition, so the Node-only `ws`,
`google-auth-library` and `protobufjs` dependencies do **not** enter the client
bundle. Verified against the production build: zero client chunks reference any
of them.

---

## 2. Exact numbers

| Thing | Value | Where |
|---|---|---|
| Model | `gemini-3.1-flash-live-preview` | `LIVE_CONFIG.model` |
| Documented fallback | `gemini-2.5-flash-native-audio-preview-12-2025` | `LIVE_MODELS.fallback` |
| API version | `v1alpha` (required for ephemeral tokens) | `LIVE_CONFIG.apiVersion` |
| Input audio | raw **16 kHz** PCM16, little-endian, mono | `audio/pcm;rate=16000` |
| Output audio | raw **24 kHz** PCM16, little-endian, mono | `LIVE_CONFIG.outputSampleRate` |
| Mic frame | 640 samples = 40 ms | `LIVE_CONFIG.micFrameSamples` |
| Playback jitter buffer | 120 ms | `LIVE_CONFIG.jitterBufferMs` |
| Server VAD end-of-speech | 500 ms silence | `LIVE_CONFIG.vad.silenceDurationMs` |
| Voice | `Puck` | `LIVE_CONFIG.voiceName` |

**We are on 3.1, not the fallback.** It was verified working end to end against
the live API: audio in, audio out, both transcripts, and all four tool calls.

Every tunable lives in one object, `LIVE_CONFIG` in `lib/live/config.ts`.
Switching models is one line.

---

## 3. Measured latency

Measured against the live API with a real ephemeral token, streaming
**real synthesized speech** (5.5 s utterance) into the socket at realtime pace,
from a desktop on home wifi. 4 runs, `silenceDurationMs: 500`. The clock starts
at *end of utterance*.

| Milestone | Median | Range |
|---|---|---|
| Token mint (`POST /api/live-token`) | ~250 ms | 200 ms – 1.0 s (first call is slowest) |
| WebSocket open | 225 ms | 168 – 529 ms |
| `setupComplete` (connect → ready) | 1.28 s | 1.23 – 1.65 s |
| **end of speech → child's transcript on screen** | **977 ms** | 959 – 991 ms |
| **end of speech → tutor's first audio** | **1.04 s** | 987 ms – 1.09 s |
| **end of speech → tool call applied to UI** | **2.4 s** | 2.11 – 3.67 s |

Add roughly **150–200 ms on a real phone**: one 40 ms mic frame, worklet
scheduling, plus the 120 ms playback jitter buffer.

Two things worth knowing:

- **~500 ms of the ~1 s reply latency is the VAD silence window we chose.** It
  is the single biggest lever. Drop `LIVE_CONFIG.vad.silenceDurationMs` to 300
  and replies get ~200 ms snappier — but a nine-year-old who pauses mid-thought
  gets talked over. Don't go below ~400 without watching a real child.
- **Tool calls arrive after the speech starts, not before**, typically ~1.3 s
  later, despite the system prompt saying "call the tool first". So the picture
  lags the voice by about a second. If that reads badly on the phone, the fix is
  prompt work (make the tool call the literal first thing in the turn), not
  plumbing.

Startup cost from tapping the button to being able to talk is roughly
**1.5–2.5 s** (mic permission + token + socket + setup).

---

## 4. Quirks found by testing, and what the code does about them

**The output transcript is replayed at the end of every turn.** Undocumented.
The model streams its transcription, then streams the whole thing *again*. Naive
`+=` prints every sentence twice on screen. `TranscriptAccumulator` in
`session.ts` detects the re-send live and collapses an immediately-repeated tail
block as a backstop (the replay sometimes restarts mid-phrase). Covered by unit
tests written against transcripts captured from the real API.

**Model audio keeps arriving after `interrupted`.** Chunks already in flight
land after the barge-in signal. Clearing the playback buffer once is not enough
— without suppression the tutor carries on talking right after the child cut
it in. `session.ts` drops model audio between `interrupted` and the next
`turnComplete` (~100 ms window).

**Barge-in works and takes ~600 ms** for the server to emit `interrupted` after
the child starts talking over the model. We also cut playback *locally* on
sustained mic energy, which is faster; the server signal is the backstop.

Local detection can be wrong (echo leaking past the canceller), so local
suppression is time-boxed to `LIVE_CONFIG.bargeIn.localSuppressMs` (1.5 s). If
the server agrees it sends `interrupted` well inside that window and suppression
runs to the turn boundary; if it never agrees, the tutor resumes. The failure
mode is a briefly clipped word, not a reply that silently vanishes.

---

## 5. Mobile: the gotchas

**Both platforms**

- HTTPS is mandatory for `getUserMedia` (`http://localhost` is exempt). For
  phone testing use `next dev --experimental-https`, or a tunnel
  (`cloudflared tunnel --url http://localhost:3000`). `audioSupport()` returns a
  specific `INSECURE_CONTEXT` error rather than a mystery failure.
- Starting must happen inside a real tap. `LiveSession.start()` creates and
  resumes the `AudioContext` **before its first `await`** precisely for this;
  don't refactor an `await` in front of it.

**iOS Safari specifically**

- An `AudioContext` created after an `await` inside a gesture stays suspended
  forever. See above.
- We do **not** pin the `AudioContext` sample rate. iOS honours the option
  inconsistently and pinning it with a live mic is a known cause of silence.
  Instead the worklet resamples the hardware rate (48000, sometimes 44100) down
  to 16000 with linear interpolation, and playback buffers are created at 24000
  and resampled by the browser.
- `navigator.audioSession.type = "play-and-record"` (Safari 16.4+) is set so
  output goes to the loud speaker rather than the earpiece while the mic is
  live. Without it the tutor sounds like a phone call held to your ear.
- The AudioWorklet is loaded from a **Blob URL**, not a file in `public/`. Works
  identically on iOS 14.5+ and needs no build step.
- Silent/ring switch: iOS can mute Web Audio output. If a child hears nothing,
  check the physical switch first.
- The mic is released when Safari backgrounds. Reconnect on return is not
  implemented; the child taps start again.

**Android Chrome**

- Generally the easier of the two. The main risk is aggressive noise
  suppression clipping a quiet child.

---

## 6. When it breaks, check these in order

1. **`MISSING_API_KEY` in the UI.** `.env.local` has no `GEMINI_API_KEY`, or the
   dev server wasn't restarted after adding it.
2. **`Google rejected GEMINI_API_KEY`.** Wrong key type. Must be a Gemini
   Developer API key from aistudio.google.com — a Vertex AI credential cannot
   mint ephemeral tokens.
3. **Socket opens then closes immediately.** Almost always the model id. Check
   `LIVE_CONFIG.model` is still a live preview name — preview models get
   retired. Try `GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025`
   to isolate.
4. **Connects, but the model never responds to speech.** This bit us: the server
   VAD needs trailing silence to commit end-of-speech. If the mic stops sending
   frames the moment the child stops talking, nothing ever fires. The mic must
   keep streaming continuously, silence included — it does, but if you refactor
   the capture path, this is the failure mode you will reintroduce. Symptom is
   an open socket, `setupComplete`, and total silence.
5. **No `inputTranscription`.** Check `inputAudioTranscription: {}` is still in
   the connect config. An empty object is the correct "on" value; omitting it
   silently disables the child's transcript, which the product requires.
6. **Crackling or gappy playback.** Raise `LIVE_CONFIG.jitterBufferMs`.
7. **The tutor interrupts itself constantly.** Echo cancellation is failing —
   check `echoCancellation: true` survived, then raise
   `LIVE_CONFIG.bargeIn.rmsThreshold` or `graceMs`.
8. **Everything dies at ~10 minutes.** Expected: sessions get a `goAway`. We ask
   for `sessionResumption` and reconnect with the handle. If reconnect is
   failing, check the token endpoint is reachable — every reconnect mints a
   fresh token because tokens are single-use.
9. **`ai.tokens is undefined`.** It is `ai.authTokens`. See section 1.

Turn on `debug: true` in `useLiveSession` to log every server message.

---

## 7. Wiring it up

```tsx
const live = useLiveSession({
  toolSpecs: monsterTools,
  toolHandlers: {
    // All synchronous. Never await here.
    highlightPart: ({ partIndex }) => setUi(u => ({ ...u, highlighted: partIndex })),
    shadeParts:    ({ count })     => setUi(u => ({ ...u, shaded: count })),
    setFraction:   ({ numerator, denominator }) => setUi(u => ({ ...u, numerator, denominator })),
    celebrate:     ()              => fireConfetti(),
  },
  systemInstruction: monsterPrompt(belief, lastChildUtterance), // from lib/belief.ts
});

<VoiceOrb
  state={live.orbState}
  level={live.micLevel}
  transcript={live.orbTranscript}
  errorText={live.errorText}
  onStart={live.start}
  onStop={live.stop}
/>
```

`orbState`, `orbTranscript` and `errorText` are shaped to drop straight into
`components/VoiceOrb.tsx`.

**Handlers must be synchronous.** A tool call mutates React state in the same
tick it arrives off the socket, before the model is acknowledged. That is why
the picture appears to react to speech rather than to a request. Handlers are
read through a ref, so they always close over current state without the session
being rebuilt on every render.

**The system instruction is fixed for the life of a socket.** It is sent once at
connect. To change the tutor's belief state mid-lesson you must stop and start
the session, or steer with `live.sendText(...)` instead.

`live.sendText("...")` types instead of speaking, down the same socket. It is
the fastest way to test tool calls with no microphone.

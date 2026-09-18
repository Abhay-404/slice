/**
 * lib/live/worklet-source.ts
 *
 * The AudioWorklet processor, as a string.
 *
 * WHY A STRING: `audioWorklet.addModule()` needs a real URL to a real ES
 * module, and worklet code runs in AudioWorkletGlobalScope -- no DOM, no
 * bundler, no imports. Shipping it as a static file under `public/` is the
 * usual answer, but this module is scoped to `lib/live/` and a Blob URL works
 * identically on iOS Safari 14.5+ and Chrome/Android, with no build step and
 * no risk of the file 404ing after a deploy. Cost: one object URL per session,
 * revoked on stop.
 *
 * WHAT IT DOES: resamples mic audio from whatever rate the hardware gave us
 * (48000 on nearly every phone, 44100 on some) down to the 16000 the Live API
 * requires, converts to little-endian PCM16, and posts fixed-size frames back
 * to the main thread as transferable ArrayBuffers.
 *
 * The resampler uses a fractional read cursor with linear interpolation, which
 * matters: 44100 -> 16000 is a ratio of 2.75625, so naive sample dropping
 * would drift and alias. The cursor and the unconsumed tail persist across
 * `process()` calls, so frames stitch seamlessly.
 */

export const MIC_WORKLET_NAME = "mic-downsampler";

export const MIC_WORKLET_SOURCE = /* js */ `
class MicDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetRate || 16000;
    this.frameSamples = opts.frameSamples || 640;

    // \`sampleRate\` is a global in AudioWorkletGlobalScope: the context rate.
    this.ratio = sampleRate / this.targetRate;

    this.out = new Float32Array(this.frameSamples);
    this.outLen = 0;
    this.cursor = 0;                    // fractional read position into \`tail\`
    this.tail = new Float32Array(0);    // input samples not yet consumed
    this.energy = 0;
    this.energyCount = 0;
    this.closed = false;

    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'close') this.closed = true;
    };
    this.port.postMessage({ type: 'ready', contextRate: sampleRate, ratio: this.ratio });
  }

  process(inputs) {
    if (this.closed) return false;

    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) {
      // Track muted or not yet flowing. Stay alive.
      return true;
    }

    const buf = new Float32Array(this.tail.length + channel.length);
    buf.set(this.tail, 0);
    buf.set(channel, this.tail.length);

    let p = this.cursor;
    const last = buf.length - 1;

    while (p < last) {
      const i = p | 0;
      const f = p - i;
      const s = buf[i] * (1 - f) + buf[i + 1] * f;

      this.energy += s * s;
      this.energyCount++;
      this.out[this.outLen++] = s;

      if (this.outLen === this.frameSamples) {
        const pcm = new Int16Array(this.frameSamples);
        for (let k = 0; k < this.frameSamples; k++) {
          let v = this.out[k];
          if (v > 1) v = 1; else if (v < -1) v = -1;
          pcm[k] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        const rms = this.energyCount > 0 ? Math.sqrt(this.energy / this.energyCount) : 0;
        this.energy = 0;
        this.energyCount = 0;
        this.outLen = 0;
        this.port.postMessage({ type: 'frame', pcm: pcm.buffer, rms }, [pcm.buffer]);
      }

      p += this.ratio;
    }

    const consumed = p | 0;
    this.tail = buf.subarray(consumed).slice();
    this.cursor = p - consumed;

    return true;
  }
}

registerProcessor(${JSON.stringify(MIC_WORKLET_NAME)}, MicDownsampler);
`;

/** Message shapes posted from the worklet to the main thread. */
export type MicWorkletMessage =
  | { type: "ready"; contextRate: number; ratio: number }
  | { type: "frame"; pcm: ArrayBuffer; rms: number };

let cachedUrl: string | null = null;

/** Blob URL for the worklet module. Cached per page load. */
export function micWorkletUrl(): string {
  if (cachedUrl) return cachedUrl;
  const blob = new Blob([MIC_WORKLET_SOURCE], { type: "text/javascript" });
  cachedUrl = URL.createObjectURL(blob);
  return cachedUrl;
}

export function releaseMicWorkletUrl(): void {
  if (cachedUrl) {
    URL.revokeObjectURL(cachedUrl);
    cachedUrl = null;
  }
}

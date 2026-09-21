/**
 * PCM helpers for whisper's input contract.
 *
 * whisper.cpp consumes **mono, 16 kHz, signed 16-bit PCM**. The native side
 * reads the buffer as `int16` and divides by 32767; there is no float32 decoder
 * anywhere on the JSI path. These helpers exist so that contract is enforced in
 * one place, instead of being re-derived (and got wrong) by every caller.
 */

/** Clamp a float sample into the -1..1 range. */
const clamp = value => value > 1 ? 1 : value < -1 ? -1 : value;

/**
 * Convert Float32 samples in `-1..1` to signed 16-bit PCM.
 *
 * Negatives are scaled through -32768 and positives through 32767, which is the
 * asymmetric range the format actually has. Scaling both directions by 32767
 * would leave -32768 unreachable and bias the waveform slightly toward zero.
 */
export function floatToPcm16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = clamp(samples[i] ?? 0);
    out[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
  }
  return out;
}

/**
 * Normalise any supported PCM input into an `ArrayBuffer` of signed 16-bit PCM.
 *
 * `Float32Array` is converted. `Int16Array` and `ArrayBuffer` are taken to be
 * signed 16-bit PCM already.
 *
 * A buffer whose byte length is not divisible by 2 cannot be int16 at all —
 * that is what a float32 buffer looks like from here. It is rejected instead of
 * being silently truncated, because the failure mode downstream is an empty
 * transcription with no error reported anywhere.
 */
export function toPcm16ArrayBuffer(data) {
  if (data instanceof Float32Array) {
    // floatToPcm16 allocates a fresh Int16Array, so its buffer is always a plain
    // ArrayBuffer — the SharedArrayBuffer arm of ArrayBufferLike cannot occur.
    return floatToPcm16(data).buffer;
  }
  const buffer = data instanceof Int16Array ?
  // slice() is typed ArrayBufferLike for the same reason: a typed array
  // built on a normal buffer yields a plain ArrayBuffer here.
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  if (buffer.byteLength % 2 !== 0) {
    throw new Error('kruko-whisper-rn: expected signed 16-bit PCM, but the buffer has an odd ' + `byte length (${buffer.byteLength}). If this came from a Float32Array, ` + 'pass the Float32Array itself rather than its .buffer — it will be ' + 'converted for you.');
  }
  return buffer;
}

/**
 * Peak absolute amplitude of signed 16-bit PCM, normalised to `0..1`.
 *
 * Used by the silence gate. whisper.cpp does not return nothing on silence: it
 * returns fluent, confident-looking text. Measuring the buffer first is the
 * only way to tell "nothing was said" apart from "something was said".
 */
export function pcmPeak(pcm) {
  const view = new Int16Array(pcm);
  let peak = 0;
  for (let i = 0; i < view.length; i++) {
    const magnitude = Math.abs(view[i] ?? 0);
    if (magnitude > peak) peak = magnitude;
  }
  return peak / 0x8000;
}
//# sourceMappingURL=pcm.js.map
/**
 * PCM helpers for whisper's input contract.
 *
 * whisper.cpp consumes **mono, 16 kHz, signed 16-bit PCM**. The native side
 * reads the buffer as `int16` and divides by 32767; there is no float32 decoder
 * anywhere on the JSI path. These helpers exist so that contract is enforced in
 * one place, instead of being re-derived (and got wrong) by every caller.
 */
/**
 * Convert Float32 samples in `-1..1` to signed 16-bit PCM.
 *
 * Negatives are scaled through -32768 and positives through 32767, which is the
 * asymmetric range the format actually has. Scaling both directions by 32767
 * would leave -32768 unreachable and bias the waveform slightly toward zero.
 */
export declare function floatToPcm16(samples: Float32Array): Int16Array;
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
export declare function toPcm16ArrayBuffer(data: ArrayBuffer | Int16Array | Float32Array): ArrayBuffer;
/**
 * Peak absolute amplitude of signed 16-bit PCM, normalised to `0..1`.
 *
 * Used by the silence gate. whisper.cpp does not return nothing on silence: it
 * returns fluent, confident-looking text. Measuring the buffer first is the
 * only way to tell "nothing was said" apart from "something was said".
 */
export declare function pcmPeak(pcm: ArrayBuffer): number;
//# sourceMappingURL=pcm.d.ts.map
import './jsi';
import type { NativeParakeetContext, NativeWhisperContext, NativeWhisperVadContext, TranscribeOptions, TranscribeResult, VadOptions, VadSegment } from './NativeRNWhisper';
type CoreMLModelAssetOptions = {
    filename: string;
    assets: string[] | number[];
};
export declare const installJsi: () => Promise<void>;
export type { TranscribeOptions, TranscribeResult, VadOptions, VadSegment, };
export type TranscribeNewSegmentsResult = {
    nNew: number;
    totalNNew: number;
    result: string;
    segments: TranscribeResult['segments'];
};
export interface TranscribeFileOptions extends TranscribeOptions {
    /** Progress callback, the progress is between 0 and 100 */
    onProgress?: (progress: number) => void;
    /** Callback when new segments are transcribed */
    onNewSegments?: (result: TranscribeNewSegmentsResult) => void;
}
/** Options for `transcribeData()`. */
export interface TranscribeDataOptions extends TranscribeFileOptions {
    /**
     * Peak-amplitude gate in `0..1`. When set, a buffer whose peak sample is
     * below this value is dropped without running inference, and the promise
     * resolves with an empty result and `skipped: 'silence'`.
     *
     * whisper.cpp returns fluent, confident-looking text on pure silence, so on a
     * fixed-length capture (a push-to-talk buffer, a VAD window) it is both
     * cheaper and more honest not to call the engine at all.
     */
    silenceThreshold?: number;
}
/**
 * Result of `transcribeData()`. `skipped` is set by the JavaScript layer, never
 * by native code.
 */
export type TranscribeDataResult = TranscribeResult & {
    /** Present only when the buffer was dropped before inference. */
    skipped?: 'silence';
};
export type BenchResult = {
    config: string;
    nThreads: number;
    encodeMs: number;
    decodeMs: number;
    batchMs: number;
    promptMs: number;
};
export declare class WhisperContext {
    ptr: number;
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    constructor({ contextPtr, contextId, gpu, reasonNoGPU, }: NativeWhisperContext);
    private runTranscription;
    /**
     * Transcribe audio file (path or base64 encoded wav file)
     * base64: need add `data:audio/wav;base64,` prefix
     */
    transcribe(filePathOrBase64: string | number, options?: TranscribeFileOptions): {
        /** Stop the transcribe */
        stop: () => Promise<void>;
        /** Transcribe result promise */
        promise: Promise<TranscribeResult>;
    };
    /**
     * Transcribe raw PCM audio.
     *
     * The audio must be **mono, 16 kHz, signed 16-bit PCM**. That is a hard
     * requirement of the native path, which reads the buffer as `int16` and
     * divides by 32767 — there is no float32 decoder on the JSI path. Hand it
     * float32 bytes and every pair of float bytes is reinterpreted as a single
     * int16 sample: you get twice as many samples of noise and, usually, an empty
     * transcription with no error reported anywhere.
     *
     * To make that impossible to get wrong, a `Float32Array` in `-1..1` is
     * accepted directly and converted here.
     *
     * @param data base64-encoded PCM string, `ArrayBuffer` of signed 16-bit PCM,
     *   `Int16Array`, or `Float32Array` in `-1..1`.
     */
    transcribeData(data: string | ArrayBuffer | Int16Array | Float32Array, options?: TranscribeDataOptions): {
        stop: () => Promise<void>;
        promise: Promise<TranscribeDataResult>;
    };
    bench(maxThreads: number): Promise<BenchResult>;
    release(): Promise<void>;
}
export type ContextOptions = {
    filePath: string | number;
    /**
     * CoreML model assets, if you're using `require` on filePath,
     * use this option is required if you want to enable Core ML,
     * you will need bundle weights/weight.bin, model.mil, coremldata.bin into app by `require`
     */
    coreMLModelAsset?: CoreMLModelAssetOptions;
    /** Is the file path a bundle asset for pure string filePath */
    isBundleAsset?: boolean;
    /** Prefer to use Core ML model if exists. If set to false, even if the Core ML model exists, it will not be used. */
    useCoreMLIos?: boolean;
    /** Use GPU if available. Currently iOS only, if it's enabled, Core ML option will be ignored. */
    useGpu?: boolean;
    /** Use Flash Attention, only recommended if GPU available */
    useFlashAttn?: boolean;
};
/**
 * Initialize a whisper context with a GGML model file
 * @param options Whisper context options
 * @returns Promise resolving to WhisperContext instance
 */
export declare function initWhisper({ filePath, coreMLModelAsset, isBundleAsset, useGpu, useCoreMLIos, useFlashAttn, }: ContextOptions): Promise<WhisperContext>;
export declare function releaseAllWhisper(): Promise<void>;
/** Current version of whisper.cpp */
export declare const libVersion: string;
/** Is use CoreML models on iOS */
export declare const isUseCoreML: boolean;
/** Is allow fallback to CPU if load CoreML model failed */
export declare const isCoreMLAllowFallback: boolean;
export type ParakeetContextOptions = {
    filePath: string | number;
    /** Is the file path a bundle asset for a string filePath. */
    isBundleAsset?: boolean;
    /** Use GPU acceleration if it is available. */
    useGpu?: boolean;
};
export type ParakeetTranscribeOptions = {
    /** Number of threads to use during computation. */
    maxThreads?: number;
    /** Override the model audio context size (0 uses the model default). */
    audioCtx?: number;
};
export declare class ParakeetContext {
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    constructor({ contextId, gpu, reasonNoGPU }: NativeParakeetContext);
    private runTranscription;
    /** Transcribe an audio file path, bundled asset, or base64-encoded WAV. */
    transcribe(filePathOrBase64: string | number, options?: ParakeetTranscribeOptions): {
        stop: () => Promise<void>;
        promise: Promise<TranscribeResult>;
    };
    /** Transcribe base64-encoded signed 16-bit PCM data or an ArrayBuffer. */
    transcribeData(data: string | ArrayBuffer, options?: ParakeetTranscribeOptions): {
        stop: () => Promise<void>;
        promise: Promise<TranscribeResult>;
    };
    release(): Promise<void>;
}
/** Initialize a Parakeet context with a GGML model file. */
export declare function initParakeet({ filePath, isBundleAsset, useGpu, }: ParakeetContextOptions): Promise<ParakeetContext>;
/** Release every Parakeet context and free its memory. */
export declare function releaseAllParakeet(): Promise<void>;
export type VadContextOptions = {
    filePath: string | number;
    /** Is the file path a bundle asset for pure string filePath */
    isBundleAsset?: boolean;
    /** Use GPU if available. Currently iOS only */
    useGpu?: boolean;
    /** Number of threads to use during computation (Default: 2 for 4-core devices, 4 for more cores) */
    nThreads?: number;
};
export declare class WhisperVadContext {
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    constructor({ contextId, gpu, reasonNoGPU }: NativeWhisperVadContext);
    /**
     * Detect speech segments in audio file (path or base64 encoded wav file)
     * base64: need add `data:audio/wav;base64,` prefix
     */
    detectSpeech(filePathOrBase64: string | number, options?: VadOptions): Promise<VadSegment[]>;
    /**
     * Detect speech segments in raw audio data (base64 encoded signed 16-bit PCM data or ArrayBuffer)
     */
    detectSpeechData(audioData: string | ArrayBuffer, options?: VadOptions): Promise<VadSegment[]>;
    release(): Promise<void>;
}
/**
 * Initialize a VAD context for voice activity detection
 * @param options VAD context options
 * @returns Promise resolving to WhisperVadContext instance
 */
export declare function initWhisperVad({ filePath, isBundleAsset, useGpu, nThreads, }: VadContextOptions): Promise<WhisperVadContext>;
/**
 * Release all VAD contexts and free their memory
 * @returns Promise resolving when all contexts are released
 */
export declare function releaseAllWhisperVad(): Promise<void>;
/** Enable or disable native whisper.cpp logging */
export declare function toggleNativeLog(enabled: boolean): Promise<void>;
/** Add a listener for native whisper.cpp log output */
export declare function addNativeLogListener(listener: (level: string, text: string) => void): {
    remove: () => void;
};
//# sourceMappingURL=index.d.ts.map
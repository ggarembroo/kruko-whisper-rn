var _getConstants, _ref, _NativeModules$RNWhis, _NativeModules$RNWhis2;
import { Image, NativeModules } from 'react-native';
import { Buffer } from 'safe-buffer';
import RNWhisper from './NativeRNWhisper';
import './jsi';
import { version } from './version.json';
import { pcmPeak, toPcm16ArrayBuffer } from './utils/pcm';
const nativeConstants = (RNWhisper === null || RNWhisper === void 0 || (_getConstants = (_ref = RNWhisper).getConstants) === null || _getConstants === void 0 ? void 0 : _getConstants.call(_ref)) ?? ((_NativeModules$RNWhis = NativeModules.RNWhisper) === null || _NativeModules$RNWhis === void 0 || (_NativeModules$RNWhis2 = _NativeModules$RNWhis.getConstants) === null || _NativeModules$RNWhis2 === void 0 ? void 0 : _NativeModules$RNWhis2.call(_NativeModules$RNWhis)) ?? {};
const jsiBindingKeys = ['whisperGetConstants', 'whisperInitContext', 'whisperReleaseContext', 'whisperReleaseAllContexts', 'whisperTranscribeFile', 'whisperTranscribeData', 'whisperAbortTranscribe', 'whisperBench', 'parakeetInitContext', 'parakeetReleaseContext', 'parakeetReleaseAllContexts', 'parakeetTranscribeFile', 'parakeetTranscribeData', 'parakeetAbortTranscribe', 'whisperInitVadContext', 'whisperReleaseVadContext', 'whisperReleaseAllVadContexts', 'whisperVadDetectSpeech', 'whisperVadDetectSpeechFile', 'whisperToggleNativeLog'];
let jsiBindings = null;
let isJsiInstalled = false;
const bindJsiFromGlobal = () => {
  const bindings = {};
  const missing = [];
  jsiBindingKeys.forEach(key => {
    const value = global[key];
    if (typeof value === 'function') {
      ;
      bindings[key] = value;
      delete globalThis[key];
    } else {
      missing.push(key);
    }
  });
  if (missing.length > 0) {
    throw new Error(`[RNWhisper] Missing JSI bindings: ${missing.join(', ')}`);
  }
  jsiBindings = bindings;
};
const getJsi = () => {
  if (!jsiBindings) {
    throw new Error('JSI bindings not installed');
  }
  return jsiBindings;
};
export const installJsi = async () => {
  if (isJsiInstalled) return;
  if (typeof global.whisperInitContext !== 'function') {
    const installed = await RNWhisper.install();
    if (!installed && typeof global.whisperInitContext !== 'function') {
      throw new Error('JSI bindings not installed');
    }
  }
  bindJsiFromGlobal();
  isJsiInstalled = true;
};
const toArrayBuffer = view => Uint8Array.from(view).buffer;
const decodeBase64ToArrayBuffer = data => toArrayBuffer(Buffer.from(data, 'base64'));
const stripFileScheme = path => path.startsWith('file://') ? path.slice(7) : path;
let contextIdCounter = 1;
const contextIdRandom = () => process.env.NODE_ENV === 'test' ? 0 : Math.floor(Math.random() * 0x7fffffff);
const createContextId = () => {
  const contextId = contextIdCounter + contextIdRandom();
  contextIdCounter += 1;
  return contextId;
};
const coreMLModelAssetPaths = ['analytics/coremldata.bin', 'weights/weight.bin', 'model.mil', 'coremldata.bin'];
const resolvePathFromAsset = asset => {
  try {
    const source = Image.resolveAssetSource(asset);
    if (source !== null && source !== void 0 && source.uri) {
      return stripFileScheme(source.uri);
    }
  } catch (error) {
    throw new Error(`Invalid asset: ${asset}`);
  }
  throw new Error(`Invalid asset: ${asset}`);
};
const resolveLocalInputPath = (input, remoteError) => {
  if (typeof input === 'number') {
    return resolvePathFromAsset(input);
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    throw new Error(remoteError);
  }
  return stripFileScheme(input);
};
const createCoreMLAssets = coreMLModelAsset => {
  if (!(coreMLModelAsset !== null && coreMLModelAsset !== void 0 && coreMLModelAsset.filename) || !coreMLModelAsset.assets) {
    return undefined;
  }
  return coreMLModelAsset.assets.map(asset => {
    if (typeof asset === 'number') {
      const {
        uri
      } = Image.resolveAssetSource(asset);
      const filepath = coreMLModelAssetPaths.find(path => uri.includes(path));
      if (!filepath) return undefined;
      return {
        uri,
        filepath: `${coreMLModelAsset.filename}/${filepath}`
      };
    }
    return {
      uri: asset,
      filepath: `${coreMLModelAsset.filename}/${asset}`
    };
  }).filter(asset => asset !== undefined);
};
const normalizeBenchResult = result => {
  const [config, nThreads, encodeMs, decodeMs, batchMs, promptMs] = JSON.parse(result);
  return {
    config,
    nThreads,
    encodeMs,
    decodeMs,
    batchMs,
    promptMs
  };
};
const logListeners = [];
const emitNativeLog = (level, text) => {
  logListeners.forEach(listener => listener(level, text));
};

/** Options for `transcribeData()`. */

/**
 * Result of `transcribeData()`. `skipped` is set by the JavaScript layer, never
 * by native code.
 */

export class WhisperContext {
  gpu = false;
  reasonNoGPU = '';
  constructor({
    contextPtr,
    contextId,
    gpu,
    reasonNoGPU
  }) {
    this.ptr = contextPtr;
    this.id = contextId;
    this.gpu = gpu;
    this.reasonNoGPU = reasonNoGPU;
  }
  runTranscription(run) {
    const {
      whisperAbortTranscribe
    } = getJsi();
    const jobId = Math.floor(Math.random() * 10000);
    return {
      stop: async () => {
        await whisperAbortTranscribe(this.id, jobId);
      },
      promise: run(jobId)
    };
  }

  /**
   * Transcribe audio file (path or base64 encoded wav file)
   * base64: need add `data:audio/wav;base64,` prefix
   */
  transcribe(filePathOrBase64, options = {}) {
    const {
      whisperTranscribeFile
    } = getJsi();
    const {
      onProgress,
      ...rest
    } = options;
    let lastProgress = 0;
    const progressCallback = onProgress ? progress => {
      lastProgress = progress;
      onProgress(progress);
    } : undefined;
    let path = '';
    if (typeof filePathOrBase64 === 'number') {
      path = resolvePathFromAsset(filePathOrBase64);
    } else if (filePathOrBase64.startsWith('data:audio/wav;base64,')) {
      path = filePathOrBase64;
    } else {
      path = resolveLocalInputPath(filePathOrBase64, 'Transcribe remote file is not supported, please download it first');
    }
    const task = this.runTranscription(jobId => whisperTranscribeFile(this.id, path, {
      ...rest,
      onProgress: progressCallback,
      jobId
    }));
    return {
      stop: task.stop,
      promise: task.promise.then(result => {
        if (onProgress && !result.isAborted && lastProgress !== 100) {
          onProgress(100);
        }
        return result;
      })
    };
  }

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
  transcribeData(data, options = {}) {
    const {
      whisperTranscribeData
    } = getJsi();
    const {
      onProgress,
      silenceThreshold,
      ...rest
    } = options;
    let lastProgress = 0;
    const progressCallback = onProgress ? progress => {
      lastProgress = progress;
      onProgress(progress);
    } : undefined;
    const audioData = typeof data === 'string' ? decodeBase64ToArrayBuffer(data) : toPcm16ArrayBuffer(data);

    // Silence gate. Dropping the buffer before inference is both cheaper and
    // more honest than post-filtering the text that comes back.
    if (silenceThreshold !== undefined && pcmPeak(audioData) < silenceThreshold) {
      return {
        stop: async () => {},
        promise: Promise.resolve({
          result: '',
          language: '',
          segments: [],
          isAborted: false,
          skipped: 'silence'
        })
      };
    }
    const task = this.runTranscription(jobId => whisperTranscribeData(this.id, {
      ...rest,
      onProgress: progressCallback,
      jobId
    }, audioData));
    return {
      stop: task.stop,
      promise: task.promise.then(result => {
        if (onProgress && !result.isAborted && lastProgress !== 100) {
          onProgress(100);
        }
        return result;
      })
    };
  }
  async bench(maxThreads) {
    const {
      whisperBench
    } = getJsi();
    const result = await whisperBench(this.id, maxThreads);
    return normalizeBenchResult(result);
  }
  async release() {
    const {
      whisperReleaseContext
    } = getJsi();
    return whisperReleaseContext(this.id);
  }
}
/**
 * Initialize a whisper context with a GGML model file
 * @param options Whisper context options
 * @returns Promise resolving to WhisperContext instance
 */
export async function initWhisper({
  filePath,
  coreMLModelAsset,
  isBundleAsset,
  useGpu = true,
  useCoreMLIos = true,
  useFlashAttn = false
}) {
  await installJsi();
  const {
    whisperInitContext
  } = getJsi();
  const coreMLAssets = createCoreMLAssets(coreMLModelAsset);
  const path = typeof filePath === 'number' ? resolvePathFromAsset(filePath) : resolveLocalInputPath(filePath, 'Transcribe remote file is not supported, please download it first');
  const contextId = createContextId();
  const context = await whisperInitContext(contextId, {
    filePath: path,
    isBundleAsset: !!isBundleAsset,
    useFlashAttn,
    useGpu,
    useCoreMLIos,
    downloadCoreMLAssets: __DEV__ && !!coreMLAssets,
    coreMLAssets
  });
  return new WhisperContext(context);
}
export async function releaseAllWhisper() {
  if (!isJsiInstalled) return;
  const {
    whisperReleaseAllContexts
  } = getJsi();
  return whisperReleaseAllContexts();
}

/** Current version of whisper.cpp */
export const libVersion = version;

/** Is use CoreML models on iOS */
export const isUseCoreML = !!nativeConstants.useCoreML;

/** Is allow fallback to CPU if load CoreML model failed */
export const isCoreMLAllowFallback = !!nativeConstants.coreMLAllowFallback;

//
// Parakeet Context
//

export class ParakeetContext {
  gpu = false;
  reasonNoGPU = '';
  constructor({
    contextId,
    gpu,
    reasonNoGPU
  }) {
    this.id = contextId;
    this.gpu = gpu;
    this.reasonNoGPU = reasonNoGPU;
  }
  runTranscription(run) {
    const {
      parakeetAbortTranscribe
    } = getJsi();
    const jobId = Math.floor(Math.random() * 10000);
    return {
      stop: () => parakeetAbortTranscribe(this.id, jobId),
      promise: run(jobId)
    };
  }

  /** Transcribe an audio file path, bundled asset, or base64-encoded WAV. */
  transcribe(filePathOrBase64, options = {}) {
    const {
      parakeetTranscribeFile
    } = getJsi();
    let path = '';
    if (typeof filePathOrBase64 === 'number') {
      path = resolvePathFromAsset(filePathOrBase64);
    } else if (filePathOrBase64.startsWith('data:audio/wav;base64,')) {
      path = filePathOrBase64;
    } else {
      path = resolveLocalInputPath(filePathOrBase64, 'Parakeet remote audio files are not supported, please download the file first');
    }
    return this.runTranscription(jobId => parakeetTranscribeFile(this.id, path, {
      ...options,
      jobId
    }));
  }

  /** Transcribe base64-encoded signed 16-bit PCM data or an ArrayBuffer. */
  transcribeData(data, options = {}) {
    const {
      parakeetTranscribeData
    } = getJsi();
    const audioData = data instanceof ArrayBuffer ? data : decodeBase64ToArrayBuffer(data);
    return this.runTranscription(jobId => parakeetTranscribeData(this.id, {
      ...options,
      jobId
    }, audioData));
  }
  async release() {
    const {
      parakeetReleaseContext
    } = getJsi();
    return parakeetReleaseContext(this.id);
  }
}

/** Initialize a Parakeet context with a GGML model file. */
export async function initParakeet({
  filePath,
  isBundleAsset,
  useGpu = true
}) {
  await installJsi();
  const {
    parakeetInitContext
  } = getJsi();
  const path = typeof filePath === 'number' ? resolvePathFromAsset(filePath) : resolveLocalInputPath(filePath, 'Remote Parakeet models are not supported, please download the model first');
  const contextId = createContextId();
  const context = await parakeetInitContext(contextId, {
    filePath: path,
    isBundleAsset: !!isBundleAsset,
    useGpu
  });
  return new ParakeetContext(context);
}

/** Release every Parakeet context and free its memory. */
export async function releaseAllParakeet() {
  if (!isJsiInstalled) return;
  const {
    parakeetReleaseAllContexts
  } = getJsi();
  return parakeetReleaseAllContexts();
}

//
// VAD (Voice Activity Detection) Context
//

export class WhisperVadContext {
  gpu = false;
  reasonNoGPU = '';
  constructor({
    contextId,
    gpu,
    reasonNoGPU
  }) {
    this.id = contextId;
    this.gpu = gpu;
    this.reasonNoGPU = reasonNoGPU;
  }

  /**
   * Detect speech segments in audio file (path or base64 encoded wav file)
   * base64: need add `data:audio/wav;base64,` prefix
   */
  async detectSpeech(filePathOrBase64, options = {}) {
    const {
      whisperVadDetectSpeechFile
    } = getJsi();
    let path = '';
    if (typeof filePathOrBase64 === 'number') {
      path = resolvePathFromAsset(filePathOrBase64);
    } else if (filePathOrBase64.startsWith('data:audio/wav;base64,')) {
      path = filePathOrBase64;
    } else {
      path = resolveLocalInputPath(filePathOrBase64, 'VAD remote file is not supported, please download it first');
    }
    const result = await whisperVadDetectSpeechFile(this.id, path, options);
    return result.segments || [];
  }

  /**
   * Detect speech segments in raw audio data (base64 encoded signed 16-bit PCM data or ArrayBuffer)
   */
  async detectSpeechData(audioData, options = {}) {
    const {
      whisperVadDetectSpeech
    } = getJsi();
    const pcmData = audioData instanceof ArrayBuffer ? audioData : decodeBase64ToArrayBuffer(audioData);
    const result = await whisperVadDetectSpeech(this.id, options, pcmData);
    return result.segments || [];
  }
  async release() {
    const {
      whisperReleaseVadContext
    } = getJsi();
    return whisperReleaseVadContext(this.id);
  }
}

/**
 * Initialize a VAD context for voice activity detection
 * @param options VAD context options
 * @returns Promise resolving to WhisperVadContext instance
 */
export async function initWhisperVad({
  filePath,
  isBundleAsset,
  useGpu = true,
  nThreads
}) {
  await installJsi();
  const {
    whisperInitVadContext
  } = getJsi();
  const path = typeof filePath === 'number' ? resolvePathFromAsset(filePath) : resolveLocalInputPath(filePath, 'VAD remote file is not supported, please download it first');
  const contextId = createContextId();
  const context = await whisperInitVadContext(contextId, {
    filePath: path,
    isBundleAsset: !!isBundleAsset,
    useGpu,
    nThreads
  });
  return new WhisperVadContext(context);
}

/**
 * Release all VAD contexts and free their memory
 * @returns Promise resolving when all contexts are released
 */
export async function releaseAllWhisperVad() {
  if (!isJsiInstalled) return;
  const {
    whisperReleaseAllVadContexts
  } = getJsi();
  return whisperReleaseAllVadContexts();
}
let logInitialized = false;

/** Enable or disable native whisper.cpp logging */
export async function toggleNativeLog(enabled) {
  if (!enabled && !logInitialized) return;
  logInitialized = true;
  await installJsi();
  const {
    whisperToggleNativeLog
  } = getJsi();
  return whisperToggleNativeLog(enabled, enabled ? emitNativeLog : undefined);
}

/** Add a listener for native whisper.cpp log output */
export function addNativeLogListener(listener) {
  logListeners.push(listener);
  return {
    remove: () => {
      logListeners.splice(logListeners.indexOf(listener), 1);
    }
  };
}
//# sourceMappingURL=index.js.map
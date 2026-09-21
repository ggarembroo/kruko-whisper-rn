# kruko-whisper-rn

A hardened fork of [`whisper.rn`](https://github.com/mybigday/whisper.rn) — the React Native binding of
`whisper.cpp` — maintained by **Kruko AI** for the Kruko AI mobile engine.

`whisper.rn` is MIT-licensed work by [Jhen-Jie Hong](https://github.com/mybigday). This fork keeps that
licence and that attribution; see [License](#license). It tracks upstream `0.7.4`.

---

## Why this fork exists

`whisper.rn` requires **mono, 16 kHz, signed 16-bit PCM**. The native side reads the input buffer as
`int16` and divides by 32767. There is no float32 decoder on the JSI path.

That contract was easy to violate in a way that is nearly invisible, because the source disagreed with
itself about it:

| Source | Said |
|---|---|
| `WhisperContext.transcribeData` JSDoc | *"base64 encoded **float32** PCM data or ArrayBuffer"* |
| `ParakeetContext.transcribeData` JSDoc | *"base64-encoded signed **16-bit** PCM data"* |
| `README` | *"accepts raw signed **16-bit** PCM as a base64 string or `ArrayBuffer`"* |

Pass `float32.buffer` to the first one and nothing throws. The native side reads each pair of float bytes
as one `int16` sample, so you get twice as many samples of noise, and usually an empty transcription with
no error anywhere. We lost days to that on a real device before working out that our input was wrong and
the library was right.

So this fork's goal is narrow and specific: **make the input contract impossible to get wrong.**

## What this fork adds

**1. The documentation no longer lies.** Both `transcribeData` JSDoc comments now state the real
requirement, with the failure mode spelled out.

**2. `Float32Array` is accepted directly.** Samples in `-1..1` are converted to signed 16-bit PCM for you
(`src/utils/pcm.ts`). `Int16Array` and `ArrayBuffer` are taken as already being int16, exactly as before.

**3. Malformed input is rejected instead of truncated.** A buffer with an odd byte length cannot be int16
at all. It now throws a message naming the likely cause, rather than producing an empty transcription.

**4. An opt-in silence gate.** `silenceThreshold` drops a buffer whose peak sample is below the threshold
before inference runs:

```js
const { promise } = context.transcribeData(pcm16, {
  language: 'en',
  silenceThreshold: 0.01,
})

const { result, skipped } = await promise
// skipped === 'silence'  -> the buffer was dropped, result is ''
```

This matters because `whisper.cpp` does not return *nothing* on silence — it returns fluent,
confident-looking text. Measuring the buffer is the only way to tell "nothing was said" from "something
was said". The gate is opt-in: omit `silenceThreshold` and behaviour is unchanged.

## What this fork does **not** do

Worth stating plainly, because forks tend to overclaim:

- **Upstream does not have a float32 HAL bug, and this fork does not fix one.** The int16 requirement is
  upstream's documented contract and upstream is correct about it. Our original client code was wrong.
- **No native code is modified.** `android/`, `ios/` and `cpp/` are upstream `0.7.4` untouched. Everything
  here is in the JavaScript/TypeScript layer.
- **The silence gate suppresses silence, not hallucinations in general.** It cannot tell you whether a
  non-silent buffer was transcribed correctly. We have not measured an effect on music or noise; on
  anything above the threshold, behaviour is upstream's.
- **No lifecycle or concurrency changes.** Upstream's `start`/`stop` handling is unchanged.
- **No performance work.** Nothing here makes inference faster.

If you need the fixes to audio *capture* (sample-rate, channel count, buffer format from the platform
recorder), those live in the application, not in this library — see
[Settings that are not in this fork](#settings-that-are-not-in-this-fork).

## Install

```bash
npm install kruko-whisper-rn
```

Native setup is unchanged from `whisper.rn` (autolinking; nothing to add by hand). Read the
[upstream README](https://github.com/mybigday/whisper.rn#readme) and the
[upstream API docs](https://github.com/mybigday/whisper.rn/tree/main/docs/API) — they apply here too.

## Usage

Everything from `whisper.rn` works unchanged:

```js
import { initWhisper } from 'kruko-whisper-rn'

const context = await initWhisper({ filePath: require('./ggml-base.bin') })

const { promise } = context.transcribeData(pcm16ArrayBuffer, { language: 'en' })
const { result } = await promise
```

New in this fork — hand it float samples and let it convert:

```js
const floatSamples = new Float32Array(/* -1..1, mono, 16 kHz */)

const { promise } = context.transcribeData(floatSamples, {
  language: 'en',
  silenceThreshold: 0.01,
})
```

## Settings that are not in this fork

These are application-level, and are listed only so nobody goes looking for them in the source:

| Concern | Where it belongs |
|---|---|
| Transcription language | `options.language` — `whisper.cpp` defaults to `en`, so pass `'auto'` or an explicit code, and set `translate: false` unless you want English output |
| Capture format (sample rate, channels) | Your recorder. Read the rate and channel count from the actual buffer, not from the stream configuration |
| Resampling to 16 kHz | Your recorder or a resampler before `transcribeData` |
| Guarding against double-submission | Your UI layer |

## Version lineage

This package versions independently of upstream. It is based on `whisper.rn@0.7.4`; when upstream moves,
this fork rebases onto the new release rather than diverging.

## License

MIT, as upstream. The original copyright notice is retained in [`LICENSE`](./LICENSE):

> Copyright (c) 2023 Jhen-Jie Hong

Original project: <https://github.com/mybigday/whisper.rn>

Maintained by Kruko AI.

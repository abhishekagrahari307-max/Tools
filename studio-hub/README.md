# Studio Hub

**[Open the site](https://abhishekagrahari307-max.github.io/Tools/studio-hub/)**

One private, offline-first creative suite that runs entirely in the browser tab.

| Studio | Tools | What it covers |
| ------ | ----- | -------------- |
| [Audio & Video Editor](audio-video/) | 63 | multi-track timeline, trim/merge/mix/split, EQ, BPM, vocal remover, video trimmer/merger/filters/subtitles, screen & webcam recorder, converters and resizers, text-to-speech, speech-to-text |
| [Image & PDF Studio](pixora/) | 43 | compress/resize/crop/convert images, passport photos, collage, PDF merge/split/sign/forms/protect/compress, PDF ⇄ Word, text ⇄ PDF, English + Hindi OCR, Fabric.js design editor |

Neither studio uploads a file, opens an account, or loads a script from a CDN.

## Layout and load behaviour

```
index.html                   landing page      9 KB + 7 KB css
audio-video/index.html       63-tool studio    ~780 KB, single file, no CDN
audio-video/ffmpeg/core/     on demand        31 MB (FFmpeg 5.1.4 wasm) — first use only
pixora/index.html            shell             134 KB — paints at once
pixora/vendor/boot.js        loader            2 KB  — pulls the libraries in order
pixora/vendor/*.js           libraries         2.2 MB (Fabric, PDF-Lib, PDF.js, JSZip, fontkit, Tesseract, app)
pixora/engines/              on demand         14 MB (qpdf wasm, Tesseract models, Hindi font) — only fetched when a tool needs them
```

Pixora used to be one 16 MB document; it is now a 134 KB page that shows its tool grid
immediately and streams the libraries behind it. If a library is missing the page says which
file failed instead of showing an empty grid.

## What actually runs where

Nothing is a stub, but the engines differ, so this is worth knowing before testing:

- **Pure DSP (Web Audio sample maths)** — trim, merge, mix, split, fade, pitch shift, speed, EQ,
  compressor, normalizer, denoise, vocal removal, stereo, silence, BPM, reverse, ringtone,
  podcast. Export is WAV directly and MP3 through the bundled LAME encoder.
- **Canvas + MediaRecorder** — quick video trim, merge, crop, resize, speed, filter, slideshow,
  meme, and the Audio Converter / Video Converter / Video Resizer. Chrome and Edge emit MP4,
  Firefox emits WebM. Export is real time by nature.
- **FFmpeg 5.1.4 in WebAssembly** (self-hosted in `audio-video/ffmpeg/core/`, 31 MB, loaded on
  first use) — Video Compressor (x264 CRF), Colour & Stabilise (eq/unsharp/deshake),
  Subtitle Editor (SRT import, preview, libass burn-in with Devanagari) and GIF Maker Pro
  (palettegen + paletteuse). Frame-by-frame decoding, usually faster than real time.
- **WebAssembly** — Pixora's PDF engines (PDF-Lib + qpdf), OCR (Tesseract eng/hin) and DOCX export.
- **Browser speech APIs** — TTS uses `speechSynthesis`, STT uses `SpeechRecognition`
  (Chrome/Edge only; the tool explains that on Firefox).

## Changes in this revision

**Audio engine audit (every audio tool run against signals with known answers).** The test harness
pulls the page's *real* functions out of `audio-video/index.html` and measures them, so what it
finds is what ships:

- **BPM Finder** — rewritten. It used to take the median gap between envelope peaks: 140 BPM read
  as 143, 90 BPM read as 182, a steady tone read 150 and white noise read 171. Now it learns onset
  strength against a 10 ms envelope, scores a proper beat grid from 60–200 BPM in 0.5 BPM steps,
  picks the tempo octave (a 174 BPM track no longer halves to 87) and returns **no beat found**
  instead of a number for drones, noise and silence. Shown with a high/medium/low confidence word.
  5 minutes of audio analyses in under half a second.
- **Pitch & Speed** — the two sliders were multiplied into a single resample ratio, so pitch also
  changed the speed (and +12 st at 2× came out identical to no change at all). Speed is resampling,
  pitch is a two-head grain shifter that keeps the play time: 440 Hz +12 st → 874 Hz at the same
  2.00 s, −12 st → 220 Hz, 2× → 1.00 s.
- **Noise Remover** — the overlap-add divided by a near-zero window weight, so the first ~50 ms of
  every file blew up to 3.9× full scale (a loud click) and the last 2048 samples were never
  written at all. Rewritten with a centred, zero-padded STFT and a 12 % spectral floor: on a
  hiss-plus-tone file the noise floor falls 17 dB at the default 1.6× strength (19 dB at 2×) while
  the tone stays within 1 %.
- **Audio Analyzer** — measured only the left channel and guessed loudness as `RMS + 1.2`. It now
  scans every channel, reports a gated (400 ms blocks, −70 dB gate) LUFS estimate and counts
  clipped samples, so a half-silent or clipping file is no longer reported as clean.
- **Mixer** — a 44.1 kHz track mixed into the 48 kHz output buffer played 8.8 % sharp; both tracks
  are resampled to the output rate first.
- **Vocal Remover** — mono files were refused outright, which also disabled "Keep Vocal"; mono is
  upmixed and the tool explains what it can do with it.
- **Text to Speech** — a browser without `speechSynthesis` (Firefox on some Linux builds) threw a
  `ReferenceError` and left a blank panel. It now renders and says which browsers work.
- **Crashes** — `sliceBuf()` threw when the start point was past the end of the file, and
  `resampleLinear()` returned NaN for an empty buffer. Both clamp now.

Earlier in this line of work: the FFmpeg engine (self-hosted, no CDN) added Video Compressor,
Colour & Stabilise, Subtitle Editor and GIF Maker Pro; the loader builds the wasm URL through the
core's base64 `mainScriptUrlOrBlob` payload — without it the engine cannot find its own wasm.
Tool counts agree everywhere (63 audio/video + 43 image/PDF = 106) instead of 55/56/98.

## Tests

```
npm install      # jsdom, only for the headless pipeline test
npm test
```

- `tests/audio-dsp.test.mjs` — numerical checks: extracts the shipped DSP and proves FFT/ifft
  round-trip and peak bin, window shape, denoise attenuation without a head transient, resample
  duration/pitch/channels, tempo accuracy at 70/90/100/120/128/140/174 BPM *and* refusal on
  silence, drones and noise, silence detection, merge across sample rates, mix headroom, splice
  length and continuity, pitch shift accuracy, the analyser's dBFS/LUFS maths, WAV header bytes and
  a fuzz pass over empty/1-sample/clipped buffers.
- `tests/pipeline.test.mjs` — the export paths with stubbed canvas/MediaRecorder/media clock, and a
  walk of all 66 routes that fails if any tool throws while building its panel.
- `tests/ffmpeg.test.mjs` — real encodes through the vendored wasm (CRF shrink, colour/rotate/
  deshake/crop chain, mute, Devanagari subtitle burn-in, GIF palette, loudnorm MP3, error paths).
- `tests/site.test.mjs` — every local link resolves, no page loads a remote script, Pixora keeps
  its engines on disk, the affiliate library stays gone, the new tools stay wired.

## Notes

- Serve over `http(s)`; GitHub Pages does. Opening the HTML from `file://` blocks
  `pixora/vendor/` and `pixora/engines/`.
- Everything is client side: reloading clears the workspace, so download finished files first.

## Licences

Bundled libraries keep their original licences, listed in
[pixora/THIRD-PARTY-LICENSES.txt](pixora/THIRD-PARTY-LICENSES.txt): Fabric.js (MIT), PDF-Lib (MIT),
PDF.js (Apache-2.0), JSZip (MIT), fontkit (MIT), Tesseract.js (Apache-2.0) with `eng`/`hin` models,
qpdf (Apache-2.0), LAME (LGPL) and Noto Sans Devanagari (OFL).

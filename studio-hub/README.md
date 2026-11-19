# Studio Hub

**[Open the site](https://abhishekagrahari307-max.github.io/Tools/studio-hub/)**

One private, offline-first creative suite that runs entirely in the browser tab.

| Studio | Tools | What it covers |
| ------ | ----- | -------------- |
| [Audio & Video Editor](audio-video/) | 59 | multi-track timeline, trim/merge/mix/split, EQ, BPM, vocal remover, video trimmer/merger/filters/subtitles, screen & webcam recorder, converters and resizers, text-to-speech, speech-to-text |
| [Image & PDF Studio](pixora/) | 43 | compress/resize/crop/convert images, passport photos, collage, PDF merge/split/sign/forms/protect/compress, PDF ⇄ Word, text ⇄ PDF, English + Hindi OCR, Fabric.js design editor |

Neither studio uploads a file, opens an account, or loads a script from a CDN.

## Layout and load behaviour

```
index.html                   landing page      9 KB + 7 KB css
audio-video/index.html       59-tool studio    716 KB, single file, no dependencies
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

- **Pure DSP (Web Audio sample maths)** — trim, merge, mix, split, fade, pitch, speed, EQ,
  compressor, normalizer, denoise, vocal removal, stereo, silence, BPM, reverse, ringtone,
  podcast. Export is WAV directly and MP3 through the bundled LAME encoder.
- **Canvas + MediaRecorder** — video trim, merge, crop, resize, speed, filter, subtitles,
  slideshow, meme, GIF, and the new Audio Converter / Video Converter / Video Resizer.
  Chrome and Edge can emit MP4; Firefox emits WebM. Export is real time by nature.
- **WebAssembly** — Pixora's PDF engines (PDF-Lib + qpdf), OCR (Tesseract eng/hin) and DOCX export.
- **Browser speech APIs** — TTS uses `speechSynthesis`, STT uses `SpeechRecognition`
  (Chrome/Edge only; the tool explains that on Firefox).

## Changes in this revision

- Tool counts now agree everywhere (59 audio/video + 43 image/PDF = 102) instead of 55/56/98.
- Pixora: split into shell + `vendor/` + `engines/`; skeleton grid so the page never looks empty;
  tool-card text raised from 9–10 px to 11–14 px for mobile readability.
- Three tools added with a shared engine: `encodeAudio()` (MP3/WAV/OGG/M4A/WebM) and
  `recordVideoAdvanced()` (size, fps, bitrate, fit, crop, rotate, speed) behind
  **Audio Converter**, **Video Converter** and **Video Resizer**.
- `tests/pipeline.test.mjs` drives those pipelines with stubbed canvas/MediaRecorder/media clock
  and asserts a frame is drawn, progress reaches 100%, the output size is honoured and errors reject.

## Tests

```
npm install      # jsdom, only for the headless pipeline test
npm test
```

- `tests/site.test.mjs` — every local link resolves, no page loads a remote script, Pixora keeps
  its engines on disk, the affiliate library stays gone, the three new tools stay wired.
- `tests/pipeline.test.mjs` — the export paths described above (skips itself if jsdom is absent).

## Notes

- Serve over `http(s)`; GitHub Pages does. Opening the HTML from `file://` blocks
  `pixora/vendor/` and `pixora/engines/`.
- Everything is client side: reloading clears the workspace, so download finished files first.

## Licences

Bundled libraries keep their original licences, listed in
[pixora/THIRD-PARTY-LICENSES.txt](pixora/THIRD-PARTY-LICENSES.txt): Fabric.js (MIT), PDF-Lib (MIT),
PDF.js (Apache-2.0), JSZip (MIT), fontkit (MIT), Tesseract.js (Apache-2.0) with `eng`/`hin` models,
qpdf (Apache-2.0), LAME (LGPL) and Noto Sans Devanagari (OFL).

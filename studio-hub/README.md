# Studio Hub

**[Open the site](https://abhishekagrahari307-max.github.io/studio-hub/)**

One private, offline-first creative suite that runs entirely in the browser tab:

| Studio | Tools | What it covers |
| ------ | ----- | -------------- |
| [Audio & Video Editor](audio-video/) | 55 | multi-track timeline, trim/merge/mix/split, EQ, BPM, vocal remover, video trimmer/merger/filters/subtitles, screen & webcam recorder, text-to-speech, speech-to-text |
| [Image & PDF Studio](pixora/) | 43 | compress/resize/crop/convert images, passport photos, collage, PDF merge/split/sign/forms/protect/compress, PDF ⇄ Word, text ⇄ PDF, English + Hindi OCR, Fabric.js design editor |

Neither studio uploads a file, opens an account, or loads a script from a CDN.

## Why this repo exists

Seven overlapping HTML builds of the same editors were merged into the strongest version of each,
then fixed:

- **`audio-video/`** — built from the most complete of the five *Audio & Video Editor* variants
  (the one with the multi-track timeline, undo/redo, project save/load, auto-captions and background
  removal). Improvements: all Unsplash/Picsum demo images replaced with self-contained SVG artwork, so
  the page makes **zero network requests** after load; the broken `./js/video/pipeline.js` module import
  (a file that shipped with none of the variants) removed, so the documented MediaRecorder fallback
  path is what actually runs; the orphaned `ultimate` status-layer and duplicate variant pages dropped.
- **`pixora/`** — built from *Pixora Studio*, which was a **16 MB** single file. The 11 MB of
  base64/JS engines it inlined are now separate files in `pixora/engines/` and are fetched **only when
  a tool needs them** (`EngineStore` in the page source). The page dropped to **2.25 MB (-86%)** and
  still works offline once an engine has been cached. The 211-link affiliate "external tools" library
  (links out to pi7.org / pixellab.studio) was removed, since this repo only ships tools that run
  locally; the licence text moved to `pixora/THIRD-PARTY-LICENSES.txt`.

## Layout

```
index.html                  landing page (assets/hub.css, assets/icon.svg, manifest.webmanifest)
audio-video/index.html      the 55-tool audio & video editor  (~700 KB, no dependencies)
pixora/index.html           the 43-tool image & PDF studio    (2.25 MB)
pixora/engines/             PDF.js worker, qpdf wasm, Tesseract core + eng/hin models, Hindi font
pixora/THIRD-PARTY-LICENSES.txt
```

## Notes

- Serve over `http(s)`. GitHub Pages does this; opening the HTML from `file://` blocks the on-demand
  engine files in `pixora/engines/`.
- The audio editor exports MP3 with a bundled LAME encoder; the video tools record with
  `MediaRecorder`, so the container your browser supports (MP4 on Chrome/Edge, WebM elsewhere) is what
  you get.
- Everything is client side: reloading clears the workspace, and finished files must be downloaded
  before the tab closes.

## Tests

```
node --test tests/
```

Checks that every page referenced from the hub exists, that no page contains an external script or
CDN URL, that `pixora/index.html` no longer inlines its engines, and that the landing page lists both
studios.

## Licences

The bundled libraries keep their original licences, listed in
[pixora/THIRD-PARTY-LICENSES.txt](pixora/THIRD-PARTY-LICENSES.txt): Fabric.js (MIT), PDF-Lib (MIT),
PDF.js (Apache-2.0), JSZip (MIT), fontkit (MIT), Tesseract.js (Apache-2.0) with `eng`/`hin` models,
qpdf (Apache-2.0), LAME (LGPL) and Noto Sans Devanagari (OFL).

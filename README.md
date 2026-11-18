# Tools

**[Open the website](https://abhishekagrahari307-max.github.io/Tools/)**

- **[Celebration Studio](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/)** — choose from 100 templates for each of 13 occasions (or add a personal template), create a Hindi or English invitation, share the link or QR and receive RSVPs by WhatsApp or email. No login required. [Dashboard](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/dashboard) · [How it works](celebration-studio/README.md).
- **[Wishlys birthday letters](https://abhishekagrahari307-max.github.io/Tools/wishlys-studio/)** — a separate studio with six illustrated stations, a photo album, a melody and a printable keepsake. Guest links need no account. It is linked from the Dashboard and keeps its own drafts; the original Birthday Wish Studio below is unchanged. [Guide](wishlys-studio/README.md).
- **[Birthday Wish Studio](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/)** — the original birthday cards, including [Garima’s card](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/#/wish/garima). [Sharing guide](birthday-wishes/README.md).
- **[File tools](https://abhishekagrahari307-max.github.io/Tools/file-tools.html)** — convert, resize, merge, shrink and PDF-to-Word, all inside the browser tab. Files are never uploaded; PDF libraries are vendored in `vendor/`, so nothing loads from a CDN.

- **[ToolKit Quiz](https://abhishekagrahari307-max.github.io/Tools/quiz.html)** — six subjects, 120 curated questions plus unlimited auto-generated ones and a difficulty that follows your answers. Practice explains every question, the timed test gives 20 questions in 15 minutes, and your score history stays in the browser. No sign-up, no network calls.

## Quiz

`quiz.html` + `quiz-data.js` + `quiz-gen.js` + `quiz.js` — a self-contained, adaptive quiz app:

- **120 curated questions**: Physics, Chemistry, Mathematics, Biology, General Knowledge, Computer & Web (20 each, with a one-line explanation and a topic for every question).
- **Unlimited auto-generated questions**: `quiz-gen.js` builds new questions at run time — calculated physics and maths problems plus shuffled element, formula, capital, currency, organ, shortcut and tag tables asked in both directions. Every generated question has a computed answer and its own explanation, so the paper never runs out and never repeats inside one attempt.
- **Adaptive difficulty**: each question carries `easy`, `medium` or `hard`. Practice keeps a rolling four-answer window and moves the level up when you are on a run and down when you slip; a timed test starts at the level your last attempt ended on and picks each new question from the accuracy so far. The current level is shown in the quiz bar and in every review item.
- **Practice mode** is endless — step past the newest question and a fresh one appears at the current difficulty; **timed test** gives 20 questions in 15 minutes with a countdown, mark-for-review, a question grid and a two-step submit.
- **Results**: score ring, correct/wrong/skipped, time, difficulty reached, per-question review with filters, “retry the wrong ones”, share text and a print layout.
- **History** in `localStorage` only (last 30 attempts, mode, starting → final difficulty, best score per subject) — no account, no server, no network requests.
- Keyboard support (1–4 to answer, arrow keys to move), 360 px layout, and no CDN: icons are inline SVG and the score ring is CSS.

`web-quiz.html` is now a `noindex` redirect to the new page. Question bank integrity (four options, valid keys, no duplicates, balanced answer positions) and the generator (every subject × level returns four distinct options with a computed answer and an explanation) are checked by `node --test tests/quiz.test.mjs`.

## File tools

`file-tools.html` + `file-tools.js` are one page with 20 tools that run entirely on the visitor’s device. Files are never uploaded; `pdf-lib` (MIT) and `pdf.js` (Apache-2.0) are vendored in `vendor/` with their licences, and the worker path is local, so the page works offline and behind blocked CDNs.

| PDF tool       | What it does                                               | Anchor                      |
| -------------- | ---------------------------------------------------------- | --------------------------- |
| Merge PDF      | Joins several PDFs in a chosen order                       | `file-tools.html#merge`     |
| Split PDF      | Page ranges, or one file per page                          | `file-tools.html#split`     |
| PDF to JPG     | Every page as JPG or PNG                                   | `file-tools.html#pdftojpg`  |
| Images to PDF  | JPG/PNG/WebP into one PDF, fit or A4                       | `file-tools.html#imgtopdf`  |
| Compress PDF   | Clean the structure, or search settings to hit a KB target | `file-tools.html#compress`  |
| PDF to Word    | Real `.docx` (built-in ZIP writer), page breaks kept       | `file-tools.html#word`      |
| PDF to text    | The selectable text as `.txt`, page by page                | `file-tools.html#pdftext`   |
| Organise pages | Reorder or delete pages                                    | `file-tools.html#organize`  |
| Rotate PDF     | 90/180/270° on all or selected pages                       | `file-tools.html#rotate`    |
| Page numbers   | Bottom/top, “3”, “3 / 12” or “Page 3”                      | `file-tools.html#pagenum`   |
| Watermark PDF  | Text across every page, diagonal or flat                   | `file-tools.html#watermark` |

| Image tool         | What it does                                              | Anchor                         |
| ------------------ | --------------------------------------------------------- | ------------------------------ |
| Image converter    | JPG ⇄ PNG ⇄ WebP with quality control                     | `file-tools.html#convert`      |
| Image resizer      | Fit, exact pixels or percent                              | `file-tools.html#resize`       |
| Compress to a size | Searches quality and dimensions to fit an exact KB target | `file-tools.html#imgcompress`  |
| Crop image         | Exact pixel crop from the top-left corner                 | `file-tools.html#crop`         |
| Rotate & flip      | 90/180/270° plus horizontal/vertical mirror               | `file-tools.html#rotateflip`   |
| Watermark image    | Name or © line, outlined for any background               | `file-tools.html#imgwatermark` |
| Background colour  | Flattens transparency onto white or any hex colour        | `file-tools.html#whitebg`      |
| Photo + signature  | Stacks both into the single image forms ask for           | `file-tools.html#photosign`    |
| Passport photo     | 35×45 mm, 35×35 mm, 2×2 in, 50×70 mm at 150–600 dpi       | `file-tools.html#passport`     |

Two older standalone pages still work and are linked from the footer: [image compressor](img-compress.html) and [photo enhancer](pho-en.html).

`node --test tests/*.test.*` fails if a homepage link is a placeholder, if any local link or `#fragment` is missing, if a tool tile has no panel/runner, or if the vendored libraries and licences go missing.

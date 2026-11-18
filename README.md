# Tools

**[Open the website](https://abhishekagrahari307-max.github.io/Tools/)**

- **[Celebration Studio](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/)** — choose from 100 templates for each of 13 occasions (or add a personal template), create a Hindi or English invitation, share the link or QR and receive RSVPs by WhatsApp or email. No login required. [Dashboard](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/dashboard) · [How it works](celebration-studio/README.md).
- **[Wishlys birthday letters](https://abhishekagrahari307-max.github.io/Tools/wishlys-studio/)** — a separate studio with six illustrated stations, a photo album, a melody and a printable keepsake. Guest links need no account. It is linked from the Dashboard and keeps its own drafts; the original Birthday Wish Studio below is unchanged. [Guide](wishlys-studio/README.md).
- **[Birthday Wish Studio](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/)** — the original birthday cards, including [Garima’s card](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/#/wish/garima). [Sharing guide](birthday-wishes/README.md).
- **[File tools](https://abhishekagrahari307-max.github.io/Tools/file-tools.html)** — convert, resize, merge, shrink and PDF-to-Word, all inside the browser tab. Files are never uploaded; PDF libraries are vendored in `vendor/`, so nothing loads from a CDN.

## File tools

`file-tools.html` + `file-tools.js` run entirely on the visitor’s device:

| Tool | What it does | Anchor |
| --- | --- | --- |
| Image converter | JPG ↔ PNG ↔ WebP, quality slider, batch downloads | `file-tools.html#convert` |
| Image resizer | Fit, exact size or percent; JPG/PNG/WebP output | `file-tools.html#resize` |
| PDF merger | Joins several PDFs in the chosen order | `file-tools.html#merge` |
| PDF compressor | Rasterises pages (scale + quality) or cleans the structure | `file-tools.html#compress` |
| PDF to Word | Lifts the text layer and writes a real `.docx` (ZIP writer included, page breaks kept) | `file-tools.html#word` |
| Separate utilities | [Image compressor](img-compress.html) · [Photo enhancer](pho-en.html) | — |

`pdf-lib` (MIT) and `pdf.js` (Apache-2.0) live in `vendor/` with their licences; worker path is local too, so the tools keep working offline and behind blocked CDNs. `node --test tests/*.test.*` checks that no homepage link is a placeholder and that every local anchor resolves.

The existing GitHub Pages site serves the static files in the root of `main`. The optional [local Django preview](celebration-studio/SERVER.md) is separate; the public studios don’t depend on an application server.

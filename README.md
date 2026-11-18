# Tools

**[Open the website](https://abhishekagrahari307-max.github.io/Tools/)**

- **[Celebration Studio](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/)** — choose from 100 templates for each of 13 occasions (or add a personal template), create a Hindi or English invitation, share the link or QR and receive RSVPs by WhatsApp or email. No login required. [Dashboard](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/dashboard) · [How it works](celebration-studio/README.md).
- **[Wishlys birthday letters](https://abhishekagrahari307-max.github.io/Tools/wishlys-studio/)** — a separate studio with six illustrated stations, a photo album, a melody and a printable keepsake. Guest links need no account. It is linked from the Dashboard and keeps its own drafts; the original Birthday Wish Studio below is unchanged. [Guide](wishlys-studio/README.md).
- **[Birthday Wish Studio](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/)** — the original birthday cards, including [Garima’s card](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/#/wish/garima). [Sharing guide](birthday-wishes/README.md).
- **[File tools](https://abhishekagrahari307-max.github.io/Tools/file-tools.html)** — convert, resize, merge, shrink and PDF-to-Word, all inside the browser tab. Files are never uploaded; PDF libraries are vendored in `vendor/`, so nothing loads from a CDN.

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

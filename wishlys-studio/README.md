# Wishlys · birthday letter studio

A separate static studio built from the supplied Wishlys sources (`wish.ts`, `use-music.ts`, the card CSS and the Next API files). It is linked from the [Celebration Dashboard](../celebration-studio/#/dashboard) and links back there; the original [Birthday Wish Studio](../birthday-wishes/) is untouched and keeps its own drafts, links and Garima card.

Open <https://abhishekagrahari307-max.github.io/Tools/wishlys-studio/>.

## What it does

- **Six stations**: Peach Confetti, Midnight Magic, Birthday in Bloom, Let’s Celebrate, Golden Moments, Simply With Love. Peach and bloom use the illustrated stationery artwork in `art/`; the other four are pure CSS treatments with the same print proportions.
- **One letter**: headline, opening wish, inside-page letter, real calendar date, optional age, up to six JPG/PNG/WebP photographs (resized in the browser), six ink colours, confetti and sealed-envelope switches.
- **Three melodies** (`birthday`, `dreamy`, `celebrate`) using the exact note sequences and beats from `use-music.ts`, synthesised with the Web Audio API. Nothing is downloaded, and playback only ever starts from a tap.
- **A guest link** that carries the whole letter inside the URL (`#/wish/v1.…`, zlib + base64url). No upload, account or database, so a link keeps opening after the draft is deleted.
- **A keepsake**: the proof and letter are exported as one self-contained HTML file (styles and cover artwork inlined) that can be printed or kept offline.
- **A post book**: drafts live in this browser’s IndexedDB (`wishlys.letters.v1`), separate from Wishcraft and Celebration. Deletion is guarded by a version check so a second tab cannot erase newer edits.

## Limits, deliberately

| Field             | Limit                                                   |
| ----------------- | ------------------------------------------------------- |
| Recipient, sender | 60 characters each, both required                       |
| Headline          | 70                                                      |
| Opening wish      | 240                                                     |
| Letter            | 3,000                                                   |
| Age               | 3 digits, optional                                      |
| Date              | real ISO calendar date, optional                        |
| Photographs       | 6, ≤8 MB each at import, resized to fit the link budget |
| Guest link        | 8,000 characters (QR-safe sizes are smaller)            |
| Bytes in the link | 64 KiB inflated snapshot                                |

Photographs can exceed what a chat link can hold. Sharing then offers two explicit choices: a words-only link, or the downloadable keepsake that keeps every photograph. The draft is never edited behind the organiser’s back.

## Files

| File               | Role                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`       | Pages entry, CSP, fonts from the shared celebration asset folder                                                                   |
| `studio.js`        | Hash routing (`#/`, `#/new/<template>`, `#/edit/<id>`, `#/letters`, `#/wish/preview/<id>`, `#/wish/<token>`), editor, share dialog |
| `model.js`         | Adapted `wish.ts`: templates, defaults, bilingual starter copy, validation, packed-link contract                                   |
| `cards.js`         | Covers, guest experience, keepsake download, icons                                                                                 |
| `media.js`         | Photo import/resize and the link-budget strategy                                                                                   |
| `store.js`         | IndexedDB drafts with version checks and an iOS-friendly open timeout                                                              |
| `sound.js`         | Web Audio playback for the supplied melodies                                                                                       |
| `stationery.css`   | Self-contained stationery/greeting/letter styles, also inlined into the keepsake                                                   |
| `studio.css`       | Studio chrome, editor, share dialog and mobile layout                                                                              |
| `art/*.webp`       | Optimised stationery artwork                                                                                                       |
| `checks/pages.cjs` | Static `/Tools/` browser check: build, photo, share, fresh guest, deletion, dashboard bridge                                       |

## Verifying

```sh
# Needs puppeteer-core plus a Chromium binary (CHROME_BIN), or @sparticuz/chromium
# with STUDIO_LAMBDA_CHROME=1. The fixture serves the real /Tools/ prefix.
node wishlys-studio/checks/pages.cjs
node --test tests/wishlys.test.mjs
```

The optional Django preview is not involved; there is no server-side wish storage, cookie, or `DATABASE_URL`. The uploaded `route.ts`, `route-2.ts`, `index.ts` and `schema.ts` are documented here as the source of the validation rules only — GitHub Pages cannot run them.

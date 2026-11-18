# Celebration Studio · no-login edition

**[Open Celebration Studio](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/)** · [Birthday invitations](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/studio/birthday) · [Wedding invitations](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/studio/wedding)

### Make and send an invitation

1. Choose one of **13 occasions**, then one of its **100 built-in templates** (1,300 total). Search by name, print style or number, or page through the designs. Each has a six-chapter Hindi/English book. Edit names, messages, photos, films, schedule, venue and music. Use **Play invitation** to try the reveal.
2. Your changes autosave under **Dashboard → My invitations** on this browser. To collect replies, turn on **Accept guest RSVPs** on page 06 and add your WhatsApp number (including country code) or email address. Only include contact details you want to share with guests.
3. Select **Create guest link · लिंक बनाएँ**; you do not need to press Save first. Copy the **entire** link from the share window (not the editor’s address bar) into your chat, or share the QR PNG. A guest can open it on another phone without your drafts, a login or a download. **Print / PDF** prints the six pages. **Card** downloads an HTML attachment you can send instead.
4. Guests fill in their name, attendance, party size and optional note. **Prepare my reply → WhatsApp / Email → Send** delivers the message through their chosen app. Preparing a reply alone does **not** send it. The message also contains a reply link. Open it in the browser where you created the invitation and choose **Add to guest list**. A new reply from the same guest browser updates their entry; a party of three counts as three guests, not three replies. No guest list is published.

### Add your own template

Choose **Add template** on an occasion page or the [Dashboard](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/dashboard). Give it a name, choose a base design, colors, lettering, reveal, music and language, and optionally add a starter message. **Save template** adds it to that occasion’s **My templates** shelf, in addition to the 100 studio designs. Select it to make a fresh invitation; edit and share using **Create guest link** as usual.

Personal templates are stored only in this browser, not published to everybody’s library. A guest link carries the public design code and your chosen settings; the guest does not need your template, its private name, or access to this device. Removing a template does not remove invitations or links made from it.

### Switch between studios

On [Birthday Wishes](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/), **Dashboard** in the top navigation opens **Celebration Studio → My invitations**. There, **Open Birthday Wishes** takes you back and **My birthday wishes** opens your saved wish cards directly. The six original greeting-card designs and their wish links are separate from the 100 birthday _invitation_ templates; no drafts need to be copied or converted. A second, independent row on the dashboard opens [Wishlys](../wishlys-studio/README.md), the illustrated birthday _letter_ studio. It has its own storage, guest links and keepsake; nothing is shared with Wishcraft or with your invitation drafts.

### What travels with a link?

- The URL fragment contains a compressed, versioned snapshot, **not encrypted**. Anyone who has the whole link can read or forward the invitation, including its venue and enabled RSVP contact. Without the fragment the address just opens the studio. Editing the draft creates a new link when you share again; deleting the draft cannot revoke an old copy.
- Add a cover photo, featured film and up to eight captioned album items. The HTML card embeds the original local files (JPG/PNG/WebP up to 4 MB; MP4/WebM up to 12 MB each). Guest links use small thumbnails of local photos. For a full-size photo or ordinary video in a guest link, choose **Design & media → Add a media link** and use a public **direct HTTPS file** that works without a sign-in. Those media load from their original host and need internet. The studio does not upload files to a third party.
- Guest links are capped at 8,000 characters. QR is generated on-device for links within a single QR’s capacity (up to 2,953 ASCII bytes). When attachments won’t fit, the editor lists them. Choose **Create link without these files** or **Download full card**. Nothing is removed from your draft, and the text and RSVP settings are never silently shortened. A longer valid link or a browser without canvas can still be shared even if it has no QR. On a printed/exported draft, the guest-link QR refers to the **last shared copy**, not unsent edits.
- Drafts, original files and imported replies live in **IndexedDB in the creator’s browser**. This is not a cloud account or an automatic inbox. Anyone using that browser profile has access; clearing site data also clears this workspace. Guests’ actual replies remain in the receiving chat or mailbox. Receipt IDs distinguish browser profiles, not verified people.

### If sharing on a phone

- Enter the name on page 01 and keep or write a message. If RSVP is on, add your reply contact on page 06. The guest URL contains `#/i/v1.`; a `#/new/` or `#/edit/` address is **not** a guest link.
- Device storage and the clipboard are optional for sharing. If the browser cannot save, **copy the link before leaving**; you can still send it. To keep editing, allow site storage and retry **Save draft** in that same tab. If clipboard permission is denied, long-press the selected URL and choose **Copy**. Don’t clear site data to fix sharing; that removes drafts.

### Hosting and checks

Pages serves `index.html`, the shared editor/renderer in `public/`, and the account-free bootstrap in `public/pages/`. There is no API, third-party QR service, signup, deployment secret or runtime build. All assets resolve relative to the project, and guest and reply URLs use `#/i/…` and `#/reply/…` so refresh works on static hosting. The [optional server preview](SERVER.md) retains its original account-based workflows; it is **not** used by the public site. The [original Birthday Wish Studio](../birthday-wishes/README.md) keeps its own drafts and recipient routes.

```sh
# From the repository root, browse http://localhost:8000/celebration-studio/
python3 -m http.server 8000
# No external packages required for the link tests (Node 22+)
node --test tests/*.test.*
# Browser check: install puppeteer-core + jsqr, and supply Chrome/Chromium.
CHROME_BIN=/path/to/chromium node celebration-studio/checks/pages.cjs
```

The browser check serves static files under `/Tools/` with isolated browser profiles. It checks all 1,300 selectable template routes, mobile navigation in both directions, and using a personal template after reload. It decodes the real PNG QR, exercises media, PDF and HTML, verifies the addressed WhatsApp and mailto **without sending messages**, and opens the return slip in the organizer profile. To check deployed assets, set `STUDIO_PAGES_SITE` to the absolute Studio directory URL ending in `/`.

`checks/export_pages_catalog.py --check` (with the [server requirements](requirements.txt) installed) compares `public/pages/catalog-v1.json` with a freshly migrated **temporary** database. No personal data is exported. `public/pages/editions-v1.js` extends that 39-design seed at runtime using versioned print and ink recipes. Keep both the seed and v1 recipe codes/defaults for links already sent; introduce a new format version for incompatible changes. The two bundled MIT libraries are documented in [vendor/README.md](public/pages/vendor/README.md). Fonts and artwork credits are in [SERVER.md](SERVER.md#checks) and `public/assets/FONT-LICENSES.txt`.

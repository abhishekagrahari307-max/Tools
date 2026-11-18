# Celebration Studio · no-login edition

**[Open Celebration Studio](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/)** · [Birthday invitations](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/studio/birthday) · [Wedding invitations](https://abhishekagrahari307-max.github.io/Tools/celebration-studio/#/studio/wedding)

### Make and send an invitation

1. Choose one of **13 occasions**, then an illustrated, letterpress or night edition. Each has a six-chapter Hindi/English book. Edit names, messages, photos, films, schedule, venue and music. Use **Play invitation** to try the reveal.
2. Your changes autosave under **My invitations** on this browser. To collect replies, turn on **Accept guest RSVPs** on page 06 and add your WhatsApp number (including country code) or email address. Only include contact details you want to share with guests.
3. Select **Create guest link**. Copy the **entire** link into your chat or share the QR PNG. A guest can open it on another phone without your drafts, a login or a download. **Print / PDF** prints the six pages. **Card** downloads an HTML attachment you can send instead.
4. Guests fill in their name, attendance, party size and optional note. **Prepare my reply → WhatsApp / Email → Send** delivers the message through their chosen app. Preparing a reply alone does **not** send it. The message also contains a reply link. Open it in the browser where you created the invitation and choose **Add to guest list**. A new reply from the same guest browser updates their entry; a party of three counts as three guests, not three replies. No guest list is published.

### What travels with a link?

- The URL fragment contains a compressed, versioned snapshot, **not encrypted**. Anyone who has the whole link can read or forward the invitation, including its venue and enabled RSVP contact. Without the fragment the address just opens the studio. Editing the draft creates a new link when you share again; deleting the draft cannot revoke an old copy.
- Add a cover photo, featured film and up to eight captioned album items. The HTML card embeds the original local files (JPG/PNG/WebP up to 4 MB; MP4/WebM up to 12 MB each). Guest links use small thumbnails of local photos. For a full-size photo or ordinary video in a guest link, choose **Design & media → Add a media link** and use a public **direct HTTPS file** that works without a sign-in. Those media load from their original host and need internet. The studio does not upload files to a third party.
- Guest links are capped at 8,000 characters. QR is generated on-device for links within a single QR’s capacity (up to 2,953 ASCII bytes). If it won’t fit, the editor explains how to shorten it or send the complete Card instead; no film is silently dropped. On a printed/exported draft, the guest-link QR refers to the **last shared copy**, not unsent edits.
- Drafts, original files and imported replies live in **IndexedDB in the creator’s browser**. This is not a cloud account or an automatic inbox. Anyone using that browser profile has access; clearing site data also clears this workspace. Guests’ actual replies remain in the receiving chat or mailbox. Receipt IDs distinguish browser profiles, not verified people.

### Hosting and checks

Pages serves `index.html`, the shared editor/renderer in `public/`, and the account-free bootstrap in `public/pages/`. There is no API, third-party QR service, signup, deployment secret or runtime build. All assets resolve relative to the project, and guest and reply URLs use `#/i/…` and `#/reply/…` so refresh works on static hosting. The [optional server preview](SERVER.md) retains its original account-based workflows; it is **not** used by the public site. The [original Birthday Wish Studio](../birthday-wishes/README.md) is unchanged.

```sh
# From the repository root, browse http://localhost:8000/celebration-studio/
python3 -m http.server 8000
# No external packages required for the link tests (Node 22+)
node --test tests/*.test.*
# Browser check: install puppeteer-core + jsqr, and supply Chrome/Chromium.
CHROME_BIN=/path/to/chromium node celebration-studio/checks/pages.cjs
```

The browser check serves static files under `/Tools/` and uses two isolated profiles. It decodes the real PNG QR, exercises media, PDF and HTML, verifies the addressed WhatsApp and mailto **without sending messages**, and opens the return slip in the organizer profile. To check deployed assets, set `STUDIO_PAGES_SITE` to the absolute Studio directory URL ending in `/`.

`checks/export_pages_catalog.py --check` (with the [server requirements](requirements.txt) installed) compares `public/pages/catalog-v1.json` with a freshly migrated **temporary** database. No personal data is exported. Keep the v1 defaults and decoder for links already sent; introduce a new format version for incompatible changes. The two bundled MIT libraries are documented in [vendor/README.md](public/pages/vendor/README.md). Fonts and artwork credits are in [SERVER.md](SERVER.md#checks) and `public/assets/FONT-LICENSES.txt`.

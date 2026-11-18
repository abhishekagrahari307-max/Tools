# Celebration Studio · invitations and RSVPs

**Create moments, share happiness.** A Hindi/English invitation editor with a real account → private draft → published invitation → guest RSVP → organizer dashboard workflow. This is a separate Django application. It does **not** replace the Tools homepage, Birthday Wish Studio, Garima’s card, or previously shared wish fragments.

## Permanent hosting

See **[Launch Celebration Studio](DEPLOY.md)** for the Render Blueprint, billing approval, durable storage, live checks and backups, or use the same Gunicorn entrypoint behind your own HTTPS proxy. Merging this code does **not** itself provision hosting or create a permanent link. The local preview below needs no cloud account.

## Try the preview

1. Select an **occasion card** on the home page, e.g. Wedding. Its studio shows its six-chapter sequence and **three illustrated editions**. Choose one; no account is needed to try it. `#/studio/birthday` and `#/studio/wedding` open the respective collections directly.
2. In **Six pages**, set Hindi or English, enter the cover name(s), and use **Chapter to edit** or **Next page** for the family introductions, story, ceremony notes, etc. The live proof follows the selected page. **Design & media** controls the opening, stationery, music and album; **When & where** sets the schedule and map. **Play invitation** privately rehearses the full guest experience.
3. **Save draft → Create account** with a test email and a separate preview password (at least ten characters). Signed-in edits autosave to the database. **Publish invitation** gives a personal `/i/<slug>` link, WhatsApp sharing and a downloadable QR PNG. Only the published version and its selected media are public. Use a second browser/profile or phone that can access the running preview.
4. The guest opens the invitation, turns the six pages and replies on the final page **without logging in**. Try **Yes** for **3** people. In the organizer’s browser, **My invitations → Replies** counts three people, not one form. Change the guest's response to **2** and refresh: one row, two attendees. The guest list also refreshes every 12 seconds.
5. Editing a private draft does not change the published book. **Update live invitation** republishes at the same link/QR. **Unpublish** disables the guest link, QR image, RSVP and all published media. **Delete** also removes the replies and files. Already downloaded copies cannot be revoked.

## Run locally

Python 3.11+; no Supabase project, credentials, external fonts, frontend build, or Node runtime needed to run the app.

```sh
cd celebration-studio
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
./run-preview.sh
```

Visit `http://localhost:8000/`. The single origin serves the frontend, API, `/i/<personal-slug>` guest pages and `/admin/`. All browser API paths are relative. To share, use the address of the accessible preview/host rather than your computer’s loopback address. On Arena the preview can be access-controlled and is temporary, not a permanent public deployment.

## Included

- **13 separate studios, three named editions each.** Illustrated signature plate, letterpress folio and night edition use different frames, compositions and page treatments. The six earlier general designs remain readable via old editor links and stored snapshots; no old invitation is rewritten. Administrators can list and unlist designs per occasion.
- **Six chapters per function, not one generic form.** Birthday has a wish wall, party, childhood album and a cake-cutting surprise; Wedding has both families, their story/album, four ceremony cards and venue; Engagement has a two-part introduction and a ring promise. Anniversary has a journey timeline. Diwali has lamps and a festive menu; Holi a colour program; Raksha Bandhan a sibling letter; Baby Shower a mother-to-be portrait, blessings and godh bharai ceremony; Housewarming a new-home tour and directions with RSVP; Festival Party a set list and guest pass. Karwa Chauth, New Year and Christmas each have their own program too. `studio/programs.py` defines the sequences, bilingual editorial copy and validated fields; `public/chapters.js` renders the same pages in the editor, player and exports.
- **Language and navigation:** Hindi or English default; guests can switch before opening or mid-book. Titles, guidance, ceremony labels, suggested messages and RSVP controls follow the selected language. Hosts may add an alternate-language invitation message. Personal writing, names, captions and venue text are not machine-translated. Previous/Next, contents picker and keyboard arrows turn the pages. Eight opening scenes, a tap/keyboard alternative to scratch, optional music on interaction and reduced-motion support are included.
- **Media and event details:** a cover photo and featured film plus up to **8 additional captioned photos or videos** per album, with ordering and removal. Each photo ≤4 MB (JPG/PNG/WebP); each clip ≤12 MB (MP4/WebM); 80 MB preview storage per account. Date/time and countdown use **IST (UTC+05:30)**. Use a Google Maps link or let the venue address generate directions.
- **Share and export:** copy the online link, share on WhatsApp, scan/download a locally generated QR, or print/save the complete six-chapter book as PDF through the browser. The standalone HTML card embeds its illustrations and photos and supports chapter anchors, even offline. The final page of a published export includes its online link and QR. Videos and RSVP are online features; no guest list or receipt is embedded.
- Account-owned drafts, version conflict checks, stable personalized slugs, public snapshots, real guest counts and optional notes. A random RSVP receipt in the guest browser allows updates, not identity verification. Clearing browser data or using a different device creates a different receipt.

## Administration

There is **no shared admin password** and registration never grants admin access. A server operator can run `python manage.py createsuperuser` locally in the app environment. Use an email address as the username to also sign in through the studio. Never put the password in the repository or chat.

- `/admin/` (open in a top-level tab) uses Django’s CSRF-protected admin login and permissions. Manage users and templates, ordering, availability, invitations and responses. New collections can use the bundled artwork and palettes. Unlisting a template does not break existing published snapshots.
- A superuser signing into the studio also has **Admin** → the all-invitations register with edit, publish/unpublish, guest responses and delete controls. Normal organizers can only access their own invitations and replies; public responses never disclose the guest list.

## Data and deployment boundaries

This preview uses **Django + SQLite**, not localStorage as a database and not a connected Supabase service. Migrations install the schema, the six legacy templates and 39 occasion editions, but no fake accounts, guests or invitations. By default the database (including uploaded media) and generated server secret are in ignored `celebration-studio/.local/`. They survive process restarts in the same workspace; Arena may reset them when the workspace ends. Use sample data for acceptance testing.

- `STUDIO_DATA_DIR`: private persistent directory for the database and secret. `STUDIO_SECRET_KEY`: optional server-managed Django secret. `PORT`, `STUDIO_HOSTS` and `STUDIO_ORIGINS`: listener/additional allowed hosts/trusted HTTPS origins. `STUDIO_HTTPS=1`: secure cookies for the separate admin interface. `STUDIO_PUBLIC_ORIGIN`: optional canonical origin for guest links/QR behind a proxy; the preview script sets the HTTPS Arena address automatically.
- Passwords use Django’s salted password hashing. Studio API sessions are random, revocable, expiring bearer tokens (only digests stored server-side, token in tab session storage to support embedded previews). Cookie credentials are not used by the studio API. Admin sessions remain server-managed and CSRF-protected.
- Media is private until it is referenced by a published snapshot. Photos are validated and re-encoded; short MP4/WebM clips are type/size checked and support range playback. Guest names/notes are only sent to authorized organizers/admins. There are preview rate, size and account quota limits. No service-role keys or configuration entry boxes are exposed to users.
- **Hosted mode:** the single-instance profile stores the database and private media together on a persistent disk. It does not provision Supabase or run on GitHub Pages. See the [deployment guide](DEPLOY.md) for operational limits and the steps needed before a broader production launch.

## Checks

```sh
# from celebration-studio, in the Python environment above
python manage.py test studio
python manage.py check
# optional two-browser test (separate temporary Django test database)
# Install puppeteer-core and jsqr for Node and supply a local Chromium binary.
STUDIO_BROWSER_CHECK=1 CHROME_BIN=/path/to/chromium python manage.py test studio.browsercheck
# from repository root, verify the unchanged Birthday Wish Studio codec
node --test tests/wish-links.test.cjs
```

Fonts and selected embedded birthday stationery artwork come from the supplied studio. Font licenses are in `public/assets/FONT-LICENSES.txt`. The new atelier and diya photos are generated editorial assets; the classic post illustration and app mark are SVG. The illustrated occasion motifs, alternate night scenes and letterpress plates are locally rendered vector artwork (`public/plates.js`); QR generation does not contact a third-party service.

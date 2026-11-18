# Celebration Studio · working invitation platform preview

**Create moments, share happiness.** A Hindi/English invitation editor with a real account → private draft → published invitation → guest RSVP → organizer dashboard workflow. This is a separate application on the working branch. It does **not** replace the Tools homepage, Birthday Wish Studio, Garima’s card, or previously shared wish fragments.

## Try the preview

1. **Create invitation** or select a stationery design. Choose the occasion, add a name and a message. Use **Design & media** and **When & where** to customize it. **Play opening** is a private preview, not a public invitation.
2. **Save draft** → **Create account**. Use a test email and a separate preview password (at least ten characters). Authenticated edits autosave to the database. Guests can experiment with the editor before signing in, but anonymous drafts are not saved.
3. **Publish invitation → Copy link** (or WhatsApp). Open that link in another browser/profile that can access the running preview. No guest account is required. Names, message, location and attached media are shared with anyone holding the published link.
4. Reveal the card and submit **Yes** with a party size of **3**. Open **My invitations → Replies** in the organizer’s browser. The dashboard counts three people, not just one form submission. Updating that browser’s response to two gives a total of two. The guest list refreshes every 12 seconds and has a manual refresh button.
5. Editing a draft does not silently change a published card. **Update live invitation** republishes at the same slug. **Unpublish** makes the public page, new RSVPs and published media unavailable; **Delete** also removes the associated replies and files.

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

- 13 occasions: the starter’s Birthday, Wedding, Engagement, Anniversary, Diwali, Holi, Raksha Bandhan, Baby Shower, Housewarming and Festival Party, plus Karwa Chauth, New Year and Christmas. Each has Hindi invitations and an alternative message suggestion.
- Six original collections based on the supplied starter’s themes. Select a font, palette, melody and one of eight animated openings: envelope, gift, balloon, ring box, scratch, hearts, diya and confetti. Scratch also has a keyboard/tap alternative. Audio starts only on user interaction; reduced motion is supported.
- Live editor, photo and short video uploads, event date/time **in IST (UTC+05:30)**, agenda, venue/Maps link, live countdown, responsive guest view, private preview, **Print / Save PDF** through the browser and a self-contained HTML keepsake including the photo. RSVP and video are online features, not simulated in the offline keepsake.
- Account-owned drafts, version conflict checks, stable personalized slugs, public snapshots, real guest counts and optional notes. A random RSVP receipt in the guest browser allows updates, not identity verification. Clearing browser data or using a different device creates a different receipt.

## Administration

There is **no shared admin password** and registration never grants admin access. A server operator can run `python manage.py createsuperuser` locally in the app environment. Use an email address as the username to also sign in through the studio. Never put the password in the repository or chat.

- `/admin/` (open in a top-level tab) uses Django’s CSRF-protected admin login and permissions. Manage users and templates, ordering, availability, invitations and responses. New collections can use the bundled artwork and palettes. Unlisting a template does not break existing published snapshots.
- A superuser signing into the studio also has **Admin** → the all-invitations register with edit, publish/unpublish, guest responses and delete controls. Normal organizers can only access their own invitations and replies; public responses never disclose the guest list.

## Data and deployment boundaries

This preview uses **Django + SQLite**, not localStorage as a database and not a connected Supabase service. Migrations install the schema and six stationery templates, but no fake accounts, guests or invitations. By default the database (including uploaded media) and generated server secret are in ignored `celebration-studio/.local/`. They survive process restarts in the same workspace; Arena may reset them when the workspace ends. Use sample data for acceptance testing.

- `STUDIO_DATA_DIR`: private persistent directory for the database and secret. `STUDIO_SECRET_KEY`: optional server-managed Django secret. `PORT`, `STUDIO_HOSTS` and `STUDIO_ORIGINS`: listener/additional allowed hosts/trusted HTTPS origins. `STUDIO_HTTPS=1`: secure cookies for the separate admin interface.
- Passwords use Django’s salted password hashing. Studio API sessions are random, revocable, expiring bearer tokens (only digests stored server-side, token in tab session storage to support embedded previews). Cookie credentials are not used by the studio API. Admin sessions remain server-managed and CSRF-protected.
- Media is private until it is referenced by a published snapshot. Photos are validated and re-encoded; short MP4/WebM clips are type/size checked and support range playback. Guest names/notes are only sent to authorized organizers/admins. There are preview rate, size and account quota limits. No service-role keys or configuration entry boxes are exposed to users.
- **Before a production launch:** deploy the application server behind trusted HTTPS with a durable database/backups and private object storage. GitHub Pages alone cannot run this server. A managed PostgreSQL/Supabase deployment is a separate integration, not provisioned here. Add email verification/recovery, production abuse controls, malware scanning for public uploads, monitoring, privacy/retention policy and operator review. The development server and single-process rate limiter are intended for acceptance testing.

## Checks

```sh
# from celebration-studio, in the Python environment above
python manage.py test studio
python manage.py check
# optional two-browser test (separate temporary Django test database)
# Install puppeteer-core for Node and supply a local Chromium binary.
STUDIO_BROWSER_CHECK=1 CHROME_BIN=/path/to/chromium python manage.py test studio.browsercheck
# from repository root, verify the unchanged Birthday Wish Studio codec
node --test tests/wish-links.test.cjs
```

Fonts and selected embedded birthday stationery artwork come from the supplied studio. Font licenses are in `public/assets/FONT-LICENSES.txt`. The new atelier and diya photos are generated editorial assets; the classic post illustration and app mark are SVG.

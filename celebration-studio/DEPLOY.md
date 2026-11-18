# Launch Celebration Studio

The invitation editor, `/i/<slug>`, QR images and RSVP API must share **one HTTPS application origin**. GitHub Pages still serves the original Tools and Birthday sites; it cannot run this Django application. A running Arena preview is not a permanent host.

## Render: one web service and one durable disk

**खर्च पहले देखें:** the [Blueprint](../render.yaml) requests **one paid Starter web service and a 1 GB persistent disk**. It does not request a managed database or a second service. Review the current price in your own Render workspace **before** approving. Do not choose an ephemeral free filesystem for live invitations. If you already operate a server with a durable volume, see the alternative below.

1. Sign in to the [Render dashboard](https://dashboard.render.com/), select **New → Blueprint**, and authorize access to `abhishekagrahari307-max/Tools` in the provider’s UI. No passwords, API tokens or billing details belong in chat, commits or frontend settings.
2. Select the **branch containing `render.yaml`** (normally `main` after the hosting PR is merged). Use the repository-root `render.yaml`, **not** a path under `celebration-studio/`. The service root, Python version, build/start commands, health check and disk mount are included. If deploying a review branch, ensure the web service also builds that branch, not an older `main` without the startup script.
3. Review the service, disk and estimated charges; approve **Deploy Blueprint** only if they are acceptable. No cloud service is provisioned by committing the file. The build installs dependencies; the start command runs migrations **on the mounted disk**, collects public static files and starts Gunicorn.
4. Wait for **Live**. Open the **actual HTTPS URL shown on the web service** (the display name is not a reliable hostname). `GET /healthz` should return `{"status":"ok"}` and `/api/catalog` should report this HTTPS `publicOrigin` and `previewHost: false`.

Render supplies `PORT` and `RENDER_EXTERNAL_HOSTNAME`; guest links, WhatsApp URLs and QR codes will use the assigned public domain. For a custom domain, first verify it and its TLS certificate at the provider, then set `STUDIO_PUBLIC_ORIGIN` to its exact HTTPS origin and redeploy. Keep any domain used on previously sent invitations active. A URL stays available only while the service, domain and data are retained.

## Verify the live service

- Create a **test** organizer and draft, add a small photo, publish, and open the guest link or scan its QR on a second device without logging in.
- Reply for **3**, check **My invitations → Replies**, then update to **2**. Expect **one reply, two people**. There is no public guest list.
- Restart the **same** service with its **same** disk. Check the original `/i/<slug>`, photo, organizer login and replies. Unpublish the test invitation to close the link and delete the fixture when finished. Preview data is **not** copied to production automatically.
- Optional: from the service’s private shell in the app directory run `python manage.py createsuperuser`. Use an email address as the username if you want Studio admin access as well as `/admin/`. No default administrator is installed.

## Data and operations

The private directory `/var/data/celebration-studio` holds `studio.sqlite3` (accounts, draft and published snapshots, media bytes and replies) and the generated `django-secret` (unless overridden with an operator-managed `STUDIO_SECRET_KEY`). WhiteNoise serves only the collected `staticfiles` subdirectory, **never** the private directory. The service refuses to start with a missing Render disk rather than silently creating empty accounts on transient storage. Keep **one instance, one Gunicorn worker** for this small-installation profile; threads handle concurrent requests.

**A disk is not a backup.** Monitor space and billing, enable provider disk snapshots and keep an encrypted, off-service backup. Back up the SQLite database with the SQLite online backup API (or stop all writers before copying it), together with the matching secret. Test restoration on a separate private volume before relying on it. Do not put either file in Git, Pages or public object storage. Detaching/deleting the disk or replacing it with an empty one is not an upgrade.

There is no email verification/recovery or upload malware scanner. The current size/account limits and single-worker rate limiter suit a small studio, not an unrestricted high-volume platform. Review registration/abuse controls, moderation, privacy and retention before a wider launch. For multiple instances, use shared database, private media storage and shared rate limiting first.

## Alternative: an existing HTTPS server

From `celebration-studio/`, install `requirements-production.txt` in a Python 3.11 environment and run `./run-production.sh` under the host’s service manager. Set the following **in the service environment**, including for management commands:

| Setting | Hosted value |
| --- | --- |
| `STUDIO_ENV` | `production` |
| `STUDIO_PUBLIC_ORIGIN` | Your exact `https://` origin; inferred on Render if unset |
| `STUDIO_DATA_DIR` | An absolute private directory on durable storage, outside the checkout |
| `STUDIO_DISK_MOUNT` | Actual mountpoint containing that directory, for a startup mount check; required by the Render profile |
| `PORT` | Internal listening port (default 8000); provider sets this on Render |

Terminate TLS at a trusted reverse proxy. Allow **only that proxy** to reach the internal Gunicorn port. It must preserve the intended `Host` and **replace**, not append/trust, the client’s `X-Forwarded-Proto`. Hosted mode enforces exact allowed hosts, HTTPS redirects (except `/healthz`), secure cookies, host-only HSTS and frame denial. Local/Arena previews still use `./run-preview.sh` with separate settings. Never expose Django’s development server as the production host.

To exercise the real production entrypoint **without a cloud account**, run `python checks/production_smoke.py` in the production Python environment. It uses its own temporary directory, boots Gunicorn twice, verifies that published state and RSVPs survive a process restart, and removes its test data. Passing this test is **not** evidence of a cloud deployment.

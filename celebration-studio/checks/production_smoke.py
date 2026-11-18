"""Finite integration check: boot the real hosting entrypoint twice on disposable data.

Uses only loopback and a test Host/proxy header. Does not provision a cloud service or
send organizer credentials, media, or invitations to any external host.
"""

import io
import json
import os
import secrets
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from http.client import HTTPConnection
from pathlib import Path
from tempfile import TemporaryDirectory, TemporaryFile

import segno
from PIL import Image

APP = Path(__file__).resolve().parents[1]
HOST = "studio.example.test"
ORIGIN = "https://" + HOST


def request(port, path, method="GET", *, data=None, raw=None, token=None, headers=None, status=200):
    hdr = {"Host": HOST, "X-Forwarded-Proto": "https", **(headers or {})}
    if token:
        hdr["Authorization"] = "Bearer " + token
    if data is not None:
        raw = json.dumps(data).encode()
        hdr["Content-Type"] = "application/json"
    conn = HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.request(method, path, body=raw, headers=hdr)
        r = conn.getresponse()
        body = r.read()
        if r.status != status:
            raise AssertionError(f"{method} {path}: expected {status}, got {r.status}")
        if r.headers.get_content_type() == "application/json":
            body = json.loads(body)
        return body, r.headers
    finally:
        conn.close()


@contextmanager
def boot(data_dir):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(("STUDIO_", "RENDER", "GUNICORN_", "DJANGO_"))
    }
    env.update(
        STUDIO_DATA_DIR=str(data_dir),
        STUDIO_PUBLIC_ORIGIN=ORIGIN,
        PORT=str(port),
        PYTHON=sys.executable,
    )
    with TemporaryFile() as log:
        proc = subprocess.Popen(
            [str(APP / "run-production.sh")], cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT
        )
        try:
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    log.seek(0)
                    raise RuntimeError("Production boot failed:\n" + log.read().decode())
                try:
                    if request(port, "/healthz")[0] == {"status": "ok"}:
                        break
                except ConnectionRefusedError:
                    time.sleep(0.08)
            else:
                raise RuntimeError("Timed out starting production smoke server.")
            yield port
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


def main():
    with TemporaryDirectory(prefix="studio-persistence-test-") as tmp:
        data_dir = Path(tmp) / "private"
        with boot(data_dir) as port:
            _, headers = request(port, "/", headers={"X-Forwarded-Proto": "http"}, status=301)
            assert headers["Location"] == ORIGIN + "/"
            _, headers = request(port, "/")
            assert headers["X-Frame-Options"] == "DENY" and "Strict-Transport-Security" in headers
            request(port, "/api/catalog", headers={"Host": "unlisted.example.test"}, status=400)
            catalog, _ = request(port, "/api/catalog")
            assert catalog["publicOrigin"] == ORIGIN and not catalog["previewHost"]
            assert (
                len(catalog["occasions"]) == 13
                and len([t for t in catalog["templates"] if t["occasion"]]) == 39
            )
            request(port, "/s/app.js")
            session, _ = request(
                port,
                "/api/auth/register",
                "POST",
                data={
                    "name": "Smoke host",
                    "email": "smoke@example.test",
                    "password": secrets.token_urlsafe(24),
                },
            )
            token = session["token"]
            d = {
                "template": "birthday-signature",
                "occasion": "birthday",
                "person": "Test book",
                "message": "Test invitation",
                "rsvp": True,
            }
            draft, _ = request(
                port, "/api/invitations", "POST", data={"data": d}, token=token, status=201
            )
            owner = "/api/invitations/" + draft["id"]
            pic = io.BytesIO()
            Image.new("RGB", (12, 12), "gold").save(pic, "PNG")
            form = (
                b'--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n'
                + pic.getvalue()
                + b"\r\n--test-boundary--\r\n"
            )
            mid, _ = request(
                port,
                owner + "/upload/photo",
                "POST",
                raw=form,
                headers={"Content-Type": "multipart/form-data; boundary=test-boundary"},
                token=token,
                status=201,
            )
            saved, _ = request(
                port,
                owner,
                "PUT",
                data={"version": draft["version"], "data": {**d, "photo": mid["id"]}},
                token=token,
            )
            live, _ = request(
                port, owner + "/publish", "POST", data={"version": saved["version"]}, token=token
            )
            guest = "/api/public/" + live["slug"]
            photo = guest + "/media/" + mid["id"]
            image, _ = request(port, photo)
            assert image.startswith(b"\xff\xd8")
            reply = {
                "name": "Test guest",
                "attendance": "yes",
                "party": 3,
                "receipt": secrets.token_hex(24),
            }
            request(port, guest + "/rsvp", "POST", data=reply)
        with boot(data_dir) as port:
            assert request(port, guest)[0]["data"]["person"] == d["person"]
            assert request(port, photo)[0] == image
            qr = io.BytesIO()
            segno.make_qr(ORIGIN + "/i/" + live["slug"], error="m").save(
                qr, kind="png", scale=7, border=4
            )
            assert request(port, guest + "/qr.png")[0] == qr.getvalue()
            request(port, owner + "/responses", status=401)
            assert request(port, owner + "/responses", token=token)[0]["attending"] == 3
            request(port, guest + "/rsvp", "POST", data={**reply, "party": 2})
            book, _ = request(port, owner + "/responses", token=token)
            assert book["attending"] == 2 and len(book["responses"]) == 1
            request(
                port, owner + "/unpublish", "POST", data={"version": live["version"]}, token=token
            )
            request(port, guest, status=404)
            request(port, photo, status=404)
    print(
        "PASS: production entrypoint, TLS proxy/host checks, static files and health; published link, QR, media, organizer session and RSVP 3 -> 2 across a Gunicorn restart; unpublish."
    )


if __name__ == "__main__":
    main()

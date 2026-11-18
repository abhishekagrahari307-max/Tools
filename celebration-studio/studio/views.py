"""Same-origin studio API. Organizer endpoints use revocable bearer sessions, not cookies.
The separate Django admin uses Django's session, CSRF and permission middleware.
"""

import hashlib
import io
import json
import re
import secrets
import uuid
from datetime import date, timedelta
from functools import wraps
from urllib.parse import urlsplit

import segno
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import RequestDataTooBig, ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Sum
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from PIL import Image, ImageOps, UnidentifiedImageError

from .catalog import FONTS, MUSIC, OCCASIONS, OPENINGS, PALETTES
from .models import Design, Invitation, Media, Reply, StudioSession
from .programs import PROGRAMS, allowed_fields

User = get_user_model()
TTL = timedelta(days=3)
PHOTO_LIMIT, VIDEO_LIMIT = 4 * 1024**2, 12 * 1024**2


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def fail(status, message):
    raise Problem(status, message)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def endpoint(*methods):
    def outer(fn):
        @csrf_exempt  # Cookie identity is NEVER used here. No cross-origin permission is granted.
        @wraps(fn)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                r = JsonResponse({"error": "Method not allowed."}, status=405)
                r["Allow"] = ", ".join(methods)
                return r
            try:
                return fn(request, *args, **kwargs)
            except Problem as e:
                return JsonResponse({"error": e.message}, status=e.status)
            except RequestDataTooBig:
                return JsonResponse({"error": "This upload is too large."}, status=413)

        return wrapped

    return outer


def throttle(request, scope, limit, seconds=600):
    # Single-server preview. Trust the TCP peer rather than arbitrary forwarded IP headers.
    key = "limit:" + digest(scope + "|" + str(request.META.get("REMOTE_ADDR", "unknown")))
    if not cache.add(key, 1, seconds) and cache.incr(key) > limit:
        fail(429, "Too many attempts. Please try again later.")


def payload(request):
    if request.content_type != "application/json":
        fail(415, "Send a JSON object.")
    if len(request.body) > 65536:
        fail(413, "Invitation details are too large.")
    try:
        obj = json.loads(request.body)
    except (ValueError, UnicodeError, RecursionError):
        fail(400, "Invalid JSON.")
    if not isinstance(obj, dict):
        fail(400, "Expected an object.")
    return obj


def string(obj, key, limit, required=False):
    value = obj.get(key, "")
    if not isinstance(value, str) or len(value) > limit or "\x00" in value:
        fail(400, f"Check the {key} field (maximum {limit} characters).")
    value = value.strip()
    if required and not value:
        fail(400, f"Please enter {key}.")
    return value


def profile(u):
    return {
        "name": u.first_name or u.username,
        "email": u.email,
        "admin": u.is_active and u.is_superuser,
    }


def session(request):
    header = request.headers.get("Authorization", "")
    raw = header[7:] if header.startswith("Bearer ") else ""
    s = (
        StudioSession.objects.select_related("user")
        .filter(pk=digest(raw), expires__gt=timezone.now())
        .first()
        if len(raw) == 43
        else None
    )
    if (
        not s
        or not s.user.is_active
        or not constant_time_compare(s.auth_hash, s.user.get_session_auth_hash())
    ):
        fail(401, "Please sign in to your studio.")
    return s


def issue(u):
    StudioSession.objects.filter(expires__lt=timezone.now()).delete()
    token = secrets.token_urlsafe(32)
    StudioSession.objects.create(
        digest=digest(token),
        user=u,
        expires=timezone.now() + TTL,
        auth_hash=u.get_session_auth_hash(),
    )
    return JsonResponse({"token": token, "user": profile(u)})


@endpoint("POST")
def auth(request, action):
    if action == "logout":
        session(request).delete()
        return JsonResponse({"ok": True})
    if action not in ("login", "register"):
        fail(404, "Not found.")
    throttle(
        request,
        "auth:" + action,
        12 if action == "register" else 45,
        3600 if action == "register" else 600,
    )
    body = payload(request)
    email = string(body, "email", 150, True).lower()
    password = body.get("password")
    if not isinstance(password, str) or len(password) > 128 or not password:
        fail(400, "Enter a password (up to 128 characters).")
    if action == "login":
        user = authenticate(request, username=email, password=password)
        if not user:
            fail(401, "Email or password is incorrect.")
        return issue(user)
    name = string(body, "name", 70, True)
    try:
        validate_email(email)
        validate_password(password)
    except ValidationError as e:
        fail(400, " ".join(e.messages))
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=email, email=email, password=password, first_name=name
            )
    except IntegrityError:
        fail(409, "An account cannot be created with that email. Try signing in.")
    return issue(user)


@endpoint("GET")
def me(request):
    return JsonResponse({"user": profile(session(request).user)})


@endpoint("GET")
def catalog(request):
    return JsonResponse(
        {
            "publicOrigin": settings.STUDIO_PUBLIC_ORIGIN,
            "occasions": [{**e, **PROGRAMS[k]} for k, e in OCCASIONS.items()],
            "templates": [d.public() for d in Design.objects.filter(enabled=True)],
            "openings": OPENINGS,
            "palettes": PALETTES,
            "fonts": FONTS,
            "music": MUSIC,
        }
    )


def owned(u, key):
    qs = Invitation.objects.all() if u.is_superuser else Invitation.objects.filter(owner=u)
    inv = qs.filter(pk=key).first()
    if not inv:
        fail(404, "Invitation not found.")
    return inv


def shared(slug):
    inv = Invitation.objects.filter(slug=slug, published__isnull=False).first()
    if not inv:
        fail(404, "This invitation is private, unpublished, or no longer available.")
    return inv


def clean(raw, inv=None):
    if not isinstance(raw, dict):
        fail(400, "Invitation details are required.")
    ev = string(raw, "occasion", 32, True)
    code = string(raw, "template", 40, True)
    if ev not in OCCASIONS:
        fail(400, "Choose a listed occasion.")
    design = Design.objects.filter(pk=code, enabled=True).first()
    if design:
        snapshot = design.public()
    elif inv and inv.draft.get("template") == code:
        snapshot = inv.draft["design"]
    else:
        fail(400, "This design is not available. Choose another template.")
    if snapshot.get("occasion") and snapshot["occasion"] != ev:
        fail(400, "Choose a design from this occasion’s studio.")
    language = raw.get("language", "hi")
    if language not in ("en", "hi"):
        fail(400, "Choose Hindi or English.")
    fields = raw.get("fields", {})
    allowed = allowed_fields(ev)
    if not isinstance(fields, dict) or fields.keys() - allowed.keys():
        fail(400, "Choose fields from this occasion’s six chapters.")
    values = {}
    for key in fields:
        spec = allowed[key]
        value = string(fields, key, spec["limit"])
        if not value:
            continue
        if spec["kind"] == "age" and not re.fullmatch(r"[0-9\u0966-\u096f]{1,3}", value):
            fail(400, "Age and years must be whole numbers.")
        if spec["kind"] == "time" and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            fail(400, "Choose a valid chapter time.")
        if spec["kind"] == "lines" and len(value.splitlines()) > 12:
            fail(400, "Use at most 12 entries in a chapter list.")
        values[key] = value
    data = {
        "occasion": ev,
        "template": code,
        "design": snapshot,
        "language": language,
        "fields": values,
    }
    for k, n in [
        ("person", 100),
        ("host", 100),
        ("message", 1600),
        ("messageAlt", 1600),
        ("date", 10),
        ("time", 5),
        ("venue", 240),
        ("map", 500),
        ("schedule", 650),
    ]:
        data[k] = string(raw, k, n)
    if data["date"]:
        try:
            if not re.fullmatch(r"\d{4}-\d\d-\d\d", data["date"]):
                raise ValueError()
            date.fromisoformat(data["date"])
        except ValueError:
            fail(400, "Choose a valid event date.")
    if data["time"] and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", data["time"]):
        fail(400, "Choose a valid event time.")
    if len(data["schedule"].splitlines()) > 10:
        fail(400, "Use at most 10 schedule entries.")
    if data["map"]:
        try:
            url = urlsplit(data["map"])
            allowed = url.hostname in (
                "maps.app.goo.gl",
                "maps.google.com",
                "maps.google.co.in",
            ) or (
                url.hostname in ("google.com", "www.google.com", "www.google.co.in")
                and url.path.startswith("/maps")
            )
            if (
                not allowed
                or url.scheme != "https"
                or url.username
                or url.password
                or url.port not in (443, None)
            ):
                raise ValueError()
        except ValueError:
            fail(400, "Use an HTTPS Google Maps link, or leave it blank to map the address.")
    for k, opts, default in [
        ("opening", OPENINGS, snapshot["opening"]),
        ("palette", PALETTES, snapshot["palette"]),
        ("music", MUSIC, "chimes"),
        ("font", FONTS, "serif"),
    ]:
        value = raw.get(k, default)
        if not isinstance(value, str) or value not in opts:
            fail(400, f"Choose a valid {k}.")
        data[k] = value
    for flag in ["rsvp", "countdown"]:
        value = raw.get(flag, True)
        if not isinstance(value, bool):
            fail(400, "Invalid invitation setting.")
        data[flag] = value
    # Include the original portrait and short film for backwards compatibility. Album entries
    # are ordered and typed. Check every reference against this invitation in one query.
    refs = {}

    def reference(mid, kind):
        try:
            mid = str(uuid.UUID(mid))
        except ValueError:
            fail(400, "Invalid media reference.")
        if mid in refs:
            fail(400, "A file can only be attached once.")
        refs[mid] = kind
        return mid

    for kind in ("photo", "video"):
        mid = string(raw, kind, 36)
        data[kind] = reference(mid, kind) if mid else ""
    gallery = raw.get("gallery", [])
    if not isinstance(gallery, list) or len(gallery) > 8:
        fail(400, "Choose at most eight additional album items.")
    data["gallery"] = []
    for item in gallery:
        if not isinstance(item, dict) or item.get("kind") not in ("photo", "video"):
            fail(400, "Choose a photo or video for the album.")
        mid = reference(string(item, "id", 36, True), item["kind"])
        data["gallery"].append(
            {"id": mid, "kind": item["kind"], "caption": string(item, "caption", 120)}
        )
    if refs and (
        not inv
        or {
            str(mid): kind
            for mid, kind in Media.objects.filter(pk__in=refs, invitation=inv).values_list(
                "pk", "kind"
            )
        }
        != refs
    ):
        fail(400, "One or more files do not belong to this invitation or have the wrong type.")
    return data


def media_ids(data):
    if not data:
        return set()
    return {mid for mid in (data.get("photo"), data.get("video")) if mid} | {
        item["id"] for item in data.get("gallery", [])
    }


def details(inv):
    return {
        "id": str(inv.pk),
        "slug": inv.slug,
        "version": inv.version,
        "data": inv.draft,
        "published": inv.published is not None,
        "updated": inv.updated,
    }


def summaries(qs):
    qs = (
        qs.select_related("owner")
        .annotate(reply_count=Count("replies"), confirmed=Sum("replies__party"))
        .order_by("-updated")
    )
    return [
        {
            "id": i.pk,
            "slug": i.slug,
            "occasion": i.draft["occasion"],
            "person": i.draft["person"],
            "template": i.draft["design"]["name"],
            "date": i.draft["date"],
            "published": i.published is not None,
            "updated": i.updated,
            "replies": i.reply_count,
            "attending": i.confirmed or 0,
            "owner": i.owner.first_name,
        }
        for i in qs
    ]


@endpoint("GET", "POST")
def invitations(request):
    u = session(request).user
    if request.method == "GET":
        return JsonResponse({"invitations": summaries(Invitation.objects.filter(owner=u))})
    if Invitation.objects.filter(owner=u).count() >= 100:
        fail(409, "Preview limit: 100 invitations per account.")
    throttle(request, "create:" + str(u.pk), 100, 3600)
    d = clean(payload(request).get("data"))
    key = uuid.uuid4()
    inv = Invitation.objects.create(id=key, owner=u, slug="draft-" + key.hex, draft=d)
    return JsonResponse(details(inv), status=201)


@endpoint("GET", "PUT", "DELETE")
def invitation(request, key):
    inv = owned(session(request).user, key)
    if request.method == "GET":
        return JsonResponse(details(inv))
    if request.method == "DELETE":
        inv.delete()
        return JsonResponse({"ok": True})
    body = payload(request)
    d = clean(body.get("data"), inv)
    if body.get("version") != inv.version or not Invitation.objects.filter(
        pk=key, version=inv.version
    ).update(draft=d, version=F("version") + 1, updated=timezone.now()):
        fail(409, "Edited in another tab. Reopen the invitation before saving again.")
    inv.refresh_from_db()
    return JsonResponse(details(inv))


@endpoint("POST")
def publication(request, key, action):
    inv = owned(session(request).user, key)
    body = payload(request)
    if body.get("version") != inv.version:
        fail(409, "The draft changed. Reopen it before publishing.")
    slug = inv.slug
    if action == "publish":
        d = inv.draft
        if not d["person"] or not d["message"]:
            fail(400, "Add a name and a message before publishing.")
        if d["time"] and not d["date"]:
            fail(400, "Add a date for the event time.")
        if slug == "draft-" + inv.pk.hex:
            slug = (slugify(d["person"])[:44] or d["occasion"]) + "-" + inv.pk.hex[:12]
    elif action == "unpublish":
        d = None
    else:
        fail(404, "Not found.")
    if not Invitation.objects.filter(pk=key, version=inv.version).update(
        slug=slug, published=d, version=F("version") + 1, updated=timezone.now()
    ):
        fail(409, "Reopen the latest draft first.")
    inv.refresh_from_db()
    return JsonResponse(details(inv))


@endpoint("GET")
def guest_card(request, slug):
    return JsonResponse({"data": shared(slug).published, "slug": slug})


@endpoint("GET")
def invitation_qr(request, slug):
    shared(slug)  # No draft previews, account tokens, guest receipts or personal data in a QR.
    path = "/i/" + slug
    host = request.get_host()
    if settings.STUDIO_PUBLIC_ORIGIN:
        link = settings.STUDIO_PUBLIC_ORIGIN + path
    elif host.lower().endswith(".e2b.app"):
        link = "https://" + host + path
    else:
        link = request.build_absolute_uri(path)
    out = io.BytesIO()
    segno.make_qr(link, error="m").save(out, kind="png", scale=7, border=4)
    response = HttpResponse(out.getvalue(), content_type="image/png")
    response["Content-Disposition"] = f'inline; filename="{slug}-invitation-qr.png"'
    return response


@endpoint("POST")
def rsvp(request, slug):
    inv = shared(slug)
    if not inv.published["rsvp"]:
        fail(403, "RSVP is closed for this invitation.")
    throttle(request, "rsvp:" + slug, 40)
    b = payload(request)
    name = string(b, "name", 80, True)
    status = string(b, "attendance", 5)
    note = string(b, "note", 300)
    ticket = string(b, "receipt", 64)
    if not re.fullmatch("[a-f0-9]{48}", ticket):
        fail(400, "Missing RSVP receipt. Reopen the invitation.")
    if status not in ["yes", "no", "maybe"]:
        fail(400, "Select a response.")
    party = b.get("party") if status == "yes" else 0
    if status == "yes" and (type(party) is not int or not 1 <= party <= 20):
        fail(400, "Choose 1–20 guests, including yourself.")
    rh = digest(slug + "|" + ticket)
    if (
        Reply.objects.filter(invitation=inv).count() >= 3000
        and not Reply.objects.filter(invitation=inv, receipt=rh).exists()
    ):
        fail(409, "This guest list is full. Contact the host.")
    Reply.objects.update_or_create(
        invitation=inv,
        receipt=rh,
        defaults={"name": name, "attendance": status, "party": party, "note": note},
    )
    return JsonResponse({"ok": True, "attendance": status, "party": party})


@endpoint("GET")
def replies(request, key):
    inv = owned(session(request).user, key)
    rows = inv.replies.order_by("-updated")
    return JsonResponse(
        {
            "invitation": details(inv),
            "responses": [r.public_to_host() for r in rows],
            "attending": rows.aggregate(n=Sum("party"))["n"] or 0,
        }
    )


@endpoint("POST")
def upload(request, key, kind):
    inv = owned(session(request).user, key)
    if kind not in ("photo", "video"):
        fail(404, "Not found.")
    throttle(request, "upload:" + str(inv.owner_id), 50)
    limit = PHOTO_LIMIT if kind == "photo" else VIDEO_LIMIT
    if int(request.META.get("CONTENT_LENGTH") or 0) > limit + 8192:
        fail(413, "File exceeds the upload limit.")
    f = request.FILES.get("file")
    if not f or not 0 < f.size <= limit:
        fail(400, "Select a photo up to 4 MB or a clip up to 12 MB.")
    if kind == "photo":
        try:
            with Image.open(f) as im:
                if im.format not in ("JPEG", "PNG", "WEBP") or im.width * im.height > 18000000:
                    fail(400, "Choose a smaller JPG, PNG or WebP photo.")
                im.thumbnail((1280, 1280))
                im = ImageOps.exif_transpose(im).convert("RGB")
                out = io.BytesIO()
                im.save(out, "JPEG", quality=84)
                raw = out.getvalue()
                mime = "image/jpeg"
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            fail(400, "Could not read this photo.")
    else:
        raw = f.read()
        if raw[4:8] == b"ftyp" and raw[8:12] in (
            b"isom",
            b"iso2",
            b"mp41",
            b"mp42",
            b"avc1",
            b"M4V ",
        ):
            mime = "video/mp4"
        elif raw[:4] == b"\x1aE\xdf\xa3" and b"webm" in raw[:256]:
            mime = "video/webm"
        else:
            fail(400, "Choose an MP4 or WebM video.")
    # Discard superseded, unreferenced files. Published assets must survive draft edits.
    keep = media_ids(inv.draft) | media_ids(inv.published)
    inv.media.exclude(pk__in=keep).filter(created__lt=timezone.now() - timedelta(hours=1)).delete()
    used = (
        Media.objects.filter(invitation__owner_id=inv.owner_id).aggregate(n=Sum("size"))["n"] or 0
    )
    if used + len(raw) > 80 * 1024**2:
        fail(
            413, "Preview storage limit reached (80 MB/account). Delete an unused invitation first."
        )
    m = Media.objects.create(invitation=inv, kind=kind, mime=mime, size=len(raw), contents=raw)
    return JsonResponse({"id": str(m.pk), "kind": m.kind}, status=201)


def media_file(request, inv, mid):
    m = Media.objects.filter(invitation=inv, pk=mid).first()
    if not m:
        fail(404, "File not found.")
    content = bytes(m.contents)
    requested = request.headers.get("Range", "")
    if requested and m.kind == "video":
        match = re.fullmatch(r"bytes=(\d{0,12})-(\d{0,12})", requested)
        if not match or not any(match.groups()):
            return HttpResponse(status=416, headers={"Content-Range": f"bytes */{m.size}"})
        first, last = match.groups()
        start = int(first) if first else max(0, m.size - int(last))
        end = min(int(last), m.size - 1) if first and last else m.size - 1
        if start > end:
            return HttpResponse(status=416, headers={"Content-Range": f"bytes */{m.size}"})
        response = HttpResponse(content[start : end + 1], status=206, content_type=m.mime)
        response["Content-Range"] = f"bytes {start}-{end}/{m.size}"
    else:
        response = FileResponse(io.BytesIO(content), content_type=m.mime)
    if m.kind == "video":
        response["Accept-Ranges"] = "bytes"
    return response


@endpoint("GET")
def private_media(request, key, mid):
    return media_file(request, owned(session(request).user, key), mid)


@endpoint("GET")
def public_media(request, slug, mid):
    inv = shared(slug)
    if str(mid) not in media_ids(inv.published):
        fail(404, "File not published.")
    return media_file(request, inv, mid)


@endpoint("GET")
def oversight(request):
    if not session(request).user.is_superuser:
        fail(403, "Administrator access required.")
    return JsonResponse(
        {"invitations": summaries(Invitation.objects.all()), "organizers": User.objects.count()}
    )


def shell(request, slug=None):
    return render(request, "index.html")

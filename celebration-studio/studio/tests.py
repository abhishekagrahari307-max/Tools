import io
import secrets
from datetime import timedelta

import segno
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from PIL import Image

from .models import Design, Invitation, Media, Reply, StudioSession


class StudioFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = secrets.token_urlsafe(16)
        cls.host = get_user_model().objects.create_user(
            "host@example.test", email="host@example.test", password=cls.password
        )
        cls.other = get_user_model().objects.create_user(
            "other@example.test", email="other@example.test", password=cls.password
        )

    def setUp(self):
        cache.clear()
        self.host_client = self.login(self.host)
        self.guest = Client()
        self.data = {
            "template": "floral",
            "occasion": "raksha-bandhan",
            "person": "आशा & सिया",
            "message": "परिवार के साथ आपका स्वागत है।",
            "date": "2027-08-11",
            "time": "18:00",
            "rsvp": True,
        }

    def login(self, user):
        c = Client()
        r = c.post(
            "/api/auth/login",
            {"email": user.username, "password": self.password},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        c.defaults["HTTP_AUTHORIZATION"] = "Bearer " + r.json()["token"]
        return c

    def make(self):
        r = self.host_client.post(
            "/api/invitations", {"data": self.data}, content_type="application/json"
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def pub(self, r, action="publish"):
        p = self.host_client.post(
            f"/api/invitations/{r['id']}/{action}",
            {"version": r["version"]},
            content_type="application/json",
        )
        self.assertEqual(p.status_code, 200, p.content)
        return p.json()

    def save(self, r, data):
        return self.host_client.put(
            "/api/invitations/" + r["id"],
            {"version": r["version"], "data": data},
            content_type="application/json",
        )

    def test_real_rsvp_lifecycle(self):
        r = self.make()
        self.assertEqual(self.guest.get("/api/public/" + r["slug"]).status_code, 404)
        r = self.pub(r)
        public = "/api/public/" + r["slug"]
        self.assertEqual(self.guest.get(public).json()["data"]["person"], self.data["person"])
        self.assertNotIn("owner", self.guest.get(public).json())
        reply = {
            "receipt": secrets.token_hex(24),
            "name": "एक मेहमान",
            "attendance": "yes",
            "party": 3,
            "note": "धन्यवाद",
        }

        def send():
            return self.guest.post(public + "/rsvp", reply, content_type="application/json")

        self.assertEqual(send().status_code, 200)
        url = "/api/invitations/" + r["id"] + "/responses"
        self.assertEqual(self.host_client.get(url).json()["attending"], 3)
        reply["party"] = 2
        send()
        self.assertEqual(self.host_client.get(url).json()["attending"], 2)
        self.assertEqual(Reply.objects.count(), 1)
        reply["attendance"] = "no"
        send()
        self.assertEqual(self.host_client.get(url).json()["attending"], 0)
        reply.update(receipt=secrets.token_hex(24), attendance="yes", party=4)
        send()
        self.assertEqual(
            self.host_client.get("/api/invitations").json()["invitations"][0]["attending"], 4
        )
        updated = self.save(r, {**self.data, "person": "नया नाम"}).json()
        self.assertEqual(self.guest.get(public).json()["data"]["person"], self.data["person"])
        republished = self.pub(updated)
        self.assertEqual(republished["slug"], r["slug"])
        self.assertEqual(self.guest.get(public).json()["data"]["person"], "नया नाम")
        off = self.pub(republished, "unpublish")
        self.assertEqual(self.guest.get(public).status_code, 404)
        self.assertEqual(send().status_code, 404)
        self.assertEqual(Reply.objects.count(), 2)
        self.assertEqual(self.pub(off)["slug"], r["slug"])
        self.host_client.delete("/api/invitations/" + r["id"])
        self.assertEqual(self.guest.get(public).status_code, 404)
        self.assertFalse(Reply.objects.exists())

    def test_private_access_and_admin(self):
        r = self.pub(self.make())
        url = "/api/invitations/" + r["id"]
        other = self.login(self.other)
        for path in (url, url + "/responses"):
            self.assertEqual(self.guest.get(path).status_code, 401)
            self.assertEqual(other.get(path).status_code, 404)
        self.assertEqual(other.delete(url).status_code, 404)
        self.assertEqual(other.get("/api/invitations").json()["invitations"], [])
        self.assertEqual(other.get("/api/oversight").status_code, 403)
        self.other.is_superuser = True
        self.other.save()
        self.assertEqual(len(other.get("/api/oversight").json()["invitations"]), 1)
        self.assertEqual(other.get(url).status_code, 200)
        self.other.is_superuser = False
        self.other.save()
        self.assertEqual(other.get("/api/oversight").status_code, 403)

    def test_auth_registration_session_revocation(self):
        c = Client()
        body = {
            "email": "preview@example.test",
            "password": self.password,
            "name": "Preview",
            "admin": True,
        }
        r = c.post("/api/auth/register", body, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["user"]["admin"])
        token = r.json()["token"]
        c.defaults["HTTP_AUTHORIZATION"] = "Bearer " + token
        self.assertEqual(c.get("/api/me").status_code, 200)
        self.assertFalse(StudioSession.objects.filter(pk=token).exists())
        c.post("/api/auth/logout")
        self.assertEqual(c.get("/api/me").status_code, 401)
        self.assertEqual(
            c.post("/api/auth/register", body, content_type="application/json").status_code, 409
        )
        StudioSession.objects.update(expires=timezone.now() - timedelta(hours=1))
        self.assertEqual(self.host_client.get("/api/me").status_code, 401)

    def test_design_catalog_and_validation(self):
        c = self.guest.get("/api/catalog").json()
        self.assertEqual(len(c["occasions"]), 13)
        self.assertEqual(len(c["templates"]), 45)
        self.assertEqual(len(c["openings"]), 8)
        r = self.make()
        self.assertEqual(
            self.save(r, {**self.data, "map": "https://example.org/not-a-map"}).status_code, 400
        )
        self.assertEqual(self.save(r, {**self.data, "occasion": "not-listed"}).status_code, 400)
        good = self.save(
            r, {**self.data, "map": "https://maps.app.goo.gl/example", "rsvp": False}
        ).json()
        self.assertEqual(self.save(r, self.data).status_code, 409)
        live = self.pub(good)
        self.assertEqual(
            self.guest.post(
                "/api/public/" + live["slug"] + "/rsvp", {}, content_type="application/json"
            ).status_code,
            403,
        )
        Design.objects.filter(pk="floral").update(enabled=False)
        self.assertEqual(len(self.guest.get("/api/catalog").json()["templates"]), 44)
        self.assertEqual(
            self.host_client.post(
                "/api/invitations", {"data": self.data}, content_type="application/json"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.guest.get("/api/public/" + live["slug"]).json()["data"]["design"]["name"],
            "Floral Garden",
        )

    def test_media_draft_publication_and_ranges(self):
        r = self.make()
        url = "/api/invitations/" + r["id"]
        image = io.BytesIO()
        Image.new("RGB", (50, 32), "pink").save(image, "PNG")
        photo = SimpleUploadedFile("photo.png", image.getvalue(), content_type="image/png")
        mid = self.host_client.post(url + "/upload/photo", {"file": photo}).json()["id"]
        self.assertEqual(self.login(self.other).get(url + "/media/" + mid).status_code, 404)
        movie = b"\0\0\0\x18ftypisom" + bytes(64)
        vid = self.host_client.post(
            url + "/upload/video",
            {"file": SimpleUploadedFile("clip.mp4", movie, content_type="video/mp4")},
        ).json()["id"]
        r = self.save(r, {**self.data, "photo": mid, "video": vid}).json()
        live = self.pub(r)
        p = "/api/public/" + live["slug"] + "/media/"
        self.assertEqual(self.guest.get(p + mid)["Content-Type"], "image/jpeg")
        part = self.guest.get(p + vid, HTTP_RANGE="bytes=0-7")
        self.assertEqual(part.status_code, 206)
        self.assertEqual(part.content, movie[:8])
        self.assertEqual(self.guest.get(p + vid, HTTP_RANGE="bytes=1000-").status_code, 416)
        b = self.make()
        self.assertEqual(self.save(b, {**self.data, "photo": mid}).status_code, 400)
        self.pub(live, "unpublish")
        self.assertEqual(self.guest.get(p + mid).status_code, 404)
        self.host_client.delete(url)
        self.assertFalse(Media.objects.exists())

    def test_program_editions_and_six_chapters(self):
        orders = {
            "birthday": "cover wish-wall location album cake reply",
            "wedding": "cover families story rites location reply",
            "engagement": "cover portraits promise album location reply",
            "anniversary": "cover timeline wish-wall album location reply",
            "diwali": "cover letter lamps album menu reply",
            "holi": "cover letter colour-run album menu reply",
            "raksha-bandhan": "cover thread wish-wall album location reply",
            "baby-shower": "cover portrait wish-wall agenda album reply",
            "housewarming": "cover portrait letter lamps album reply",
            "festival-party": "cover letter setlist album location reply",
            "karwa-chauth": "cover letter rites album location reply",
            "new-year": "cover letter setlist album location reply",
            "christmas": "cover letter setlist album menu reply",
        }
        catalog = self.guest.get("/api/catalog").json()
        self.assertEqual({e["id"] for e in catalog["occasions"]}, set(orders))
        for e in catalog["occasions"]:
            with self.subTest(occasion=e["id"]):
                pages = e["pages"]
                self.assertEqual([p["kind"] for p in pages], orders[e["id"]].split())
                for block in ["message", "gallery", "schedule", "venue", "reply"]:
                    self.assertEqual(sum(block in p["blocks"] for p in pages), 1)
                for p in pages:
                    self.assertTrue(all(p["title"]) and all(p["intro"]))
                designs = [t for t in catalog["templates"] if t["occasion"] == e["id"]]
                self.assertEqual(
                    [t["edition"] for t in designs], ["signature", "folio", "nocturne"]
                )
                self.assertTrue(all(t["art"] == e["id"] for t in designs))
                self.assertEqual(len({t["name"] for t in designs}), 3)
        self.assertIn(
            "gallery",
            next(e for e in catalog["occasions"] if e["id"] == "wedding")["pages"][2]["blocks"],
        )
        self.assertIn(
            "venue",
            next(e for e in catalog["occasions"] if e["id"] == "housewarming")["pages"][5][
                "blocks"
            ],
        )

    @override_settings(STUDIO_PUBLIC_ORIGIN="")
    def test_chapter_field_validation_snapshot_and_qr(self):
        self.data.update(
            occasion="birthday",
            template="birthday-nocturne",
            language="en",
            messageAlt="जन्मदिन मुबारक!",
            fields={"age": "9", "surprise": "A little poem.", "cakeTime": "17:30"},
        )
        r = self.make()
        self.assertEqual(r["data"]["design"]["edition"], "nocturne")
        self.assertEqual(r["data"]["fields"], self.data["fields"])
        for invalid in [
            {"occasion": "wedding"},
            {"fields": {"age": "-9"}},
            {"fields": {"cakeTime": "29:99"}},
            {"fields": {"haldi": "x"}},
            {"fields": {"surprise": "x" * 701}},
            {"fields": {"wishes": "x\n" * 13 + "x"}},
            {"fields": []},
            {"language": "auto"},
            {"messageAlt": "x" * 1601},
        ]:
            self.assertEqual(self.save(r, {**self.data, **invalid}).status_code, 400)
        self.assertEqual(self.guest.get("/api/public/" + r["slug"] + "/qr.png").status_code, 404)
        r = self.pub(r)
        public = "/api/public/" + r["slug"]
        live = self.guest.get(public).json()["data"]
        self.assertEqual(live["language"], "en")
        self.assertEqual(live["messageAlt"], self.data["messageAlt"])
        self.assertEqual(live["fields"]["surprise"], "A little poem.")
        edited = self.save(r, {**self.data, "fields": {"age": "10"}}).json()
        self.assertEqual(self.guest.get(public).json()["data"]["fields"]["age"], "9")
        # The encoded destination is the public HTTPS URL, never a draft, session or receipt.
        host = "8000-test.e2b.app"
        dest = "https://" + host + "/i/" + r["slug"]
        expected = io.BytesIO()
        segno.make_qr(dest, error="m").save(expected, kind="png", scale=7, border=4)
        qr = self.guest.get(public + "/qr.png", HTTP_HOST=host)
        self.assertEqual(qr["Content-Type"], "image/png")
        self.assertEqual(qr.content, expected.getvalue())
        self.assertEqual(qr["Cache-Control"], "no-store")
        self.pub(edited, "unpublish")
        self.assertEqual(self.guest.get(public + "/qr.png").status_code, 404)

    def test_album_validation_and_published_media_fence(self):
        r = self.make()
        url = "/api/invitations/" + r["id"]
        image = io.BytesIO()
        Image.new("RGB", (30, 20), "red").save(image, "PNG")

        def photo():
            return self.host_client.post(
                url + "/upload/photo",
                {"file": SimpleUploadedFile("a.png", image.getvalue(), content_type="image/png")},
            ).json()["id"]

        a, b = photo(), photo()

        def entry(mid):
            return {"kind": "photo", "id": mid, "caption": "पहली याद"}

        r = self.save(r, {**self.data, "gallery": [entry(a)]}).json()
        r = self.pub(r)
        pub = "/api/public/" + r["slug"]
        media = pub + "/media/"
        self.assertEqual(self.guest.get(media + a).status_code, 200)
        self.assertEqual(self.guest.get(media + b).status_code, 404)
        for invalid in [
            [entry(a)] * 9,
            [{**entry(a), "kind": "video"}],
            [entry(a), entry(a)],
            [{"kind": "photo", "id": "fake"}],
            {},
            [{**entry(a), "caption": "x" * 121}],
        ]:
            self.assertEqual(self.save(r, {**self.data, "gallery": invalid}).status_code, 400)
        self.assertEqual(
            self.save(self.make(), {**self.data, "gallery": [entry(a)]}).status_code, 400
        )
        r = self.save(r, {**self.data, "gallery": [entry(b)]}).json()
        Media.objects.update(created=timezone.now() - timedelta(days=1))
        photo()  # cleanup must keep both versions
        self.assertTrue(Media.objects.filter(pk=b).exists())
        self.assertEqual(self.guest.get(media + a).status_code, 200)
        self.assertEqual(self.guest.get(media + b).status_code, 404)
        self.assertEqual(self.guest.get(pub).json()["data"]["gallery"], [entry(a)])
        r = self.pub(r)
        self.assertEqual(self.guest.get(media + a).status_code, 404)
        self.assertEqual(self.guest.get(media + b).status_code, 200)
        self.pub(r, "unpublish")
        self.assertEqual(self.guest.get(media + b).status_code, 404)

    def test_pre_program_draft_and_published_link_survive(self):
        r = self.pub(self.make())
        d = r["data"].copy()
        for k in ["language", "messageAlt", "gallery", "fields"]:
            d.pop(k)
        d["design"] = {k: v for k, v in d["design"].items() if k not in ("occasion", "edition")}
        Invitation.objects.filter(pk=r["id"]).update(draft=d, published=d)
        old = "/api/public/" + r["slug"]
        self.assertEqual(self.guest.get(old).json()["data"], d)
        Design.objects.filter(pk="floral").update(enabled=False)
        saved = self.save(r, d).json()
        self.assertEqual(saved["data"]["gallery"], [])
        self.assertEqual(saved["data"]["language"], "hi")
        republished = self.pub(saved)
        self.assertEqual(republished["slug"], r["slug"])
        self.assertEqual(self.guest.get(old).json()["data"]["message"], d["message"])

    def test_admin_template_management(self):
        self.assertEqual(Client().get("/admin/studio/design/").status_code, 302)
        admin = get_user_model().objects.create_superuser(
            "operator@example.test", "operator@example.test", self.password
        )
        c = Client()
        c.force_login(admin)
        form = {
            "code": "new-stationery",
            "occasion": "christmas",
            "edition": "folio",
            "name": "Winter Letter",
            "caption": "A winter welcome",
            "collection": "Festivals",
            "art": "classic",
            "opening": "envelope",
            "palette": "forest",
            "enabled": "on",
            "position": 9,
            "_save": "Save",
        }
        self.assertEqual(c.post("/admin/studio/design/add/", form).status_code, 302)
        self.assertIn(
            "Winter Letter", [t["name"] for t in self.guest.get("/api/catalog").json()["templates"]]
        )
        form.pop("enabled")
        self.assertEqual(
            c.post("/admin/studio/design/new-stationery/change/", form).status_code, 302
        )
        self.assertNotIn(
            "Winter Letter", [t["name"] for t in self.guest.get("/api/catalog").json()["templates"]]
        )

import io
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.utils import timezone
from PIL import Image

from .models import Design, Media, Reply, StudioSession


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
        self.assertEqual(len(c["templates"]), 6)
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
        self.assertEqual(len(self.guest.get("/api/catalog").json()["templates"]), 5)
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

    def test_admin_template_management(self):
        self.assertEqual(Client().get("/admin/studio/design/").status_code, 302)
        admin = get_user_model().objects.create_superuser(
            "operator@example.test", "operator@example.test", self.password
        )
        c = Client()
        c.force_login(admin)
        form = {
            "code": "new-stationery",
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

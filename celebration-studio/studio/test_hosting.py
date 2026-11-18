from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase

from config.hosting import hosted_data_dir, hosted_origins


class HostingConfigurationTests(SimpleTestCase):
    def test_provider_origin_and_custom_domain(self):
        env = {"RENDER_EXTERNAL_HOSTNAME": "example.onrender.com"}
        self.assertEqual(
            hosted_origins(env),
            (
                "https://example.onrender.com",
                ["https://example.onrender.com"],
                ["example.onrender.com"],
            ),
        )
        env["STUDIO_PUBLIC_ORIGIN"] = "https://INVITES.example.org:443/"
        public, origins, hosts = hosted_origins(env)
        self.assertEqual(public, "https://invites.example.org")
        self.assertEqual(origins, [public, "https://example.onrender.com"])
        self.assertEqual(hosts, ["invites.example.org", "example.onrender.com"])

    def test_no_fallback_to_request_host_or_preview_allowlist(self):
        for value in [
            "",
            "http://example.org",
            "https://*.example.org",
            "https://user@example.org",
            "https://example.org/path",
            "https://example.org?x=1",
            "https://example.org#fragment",
            "https://example.org:99999",
        ]:
            with self.subTest(value=value), self.assertRaises(ImproperlyConfigured):
                hosted_origins(
                    {
                        "STUDIO_PUBLIC_ORIGIN": value,
                        "E2B_SANDBOX_ID": "preview",
                        "STUDIO_HOSTS": "*",
                    }
                )

    def test_render_will_not_create_an_ephemeral_database(self):
        with TemporaryDirectory() as tmp:
            source, volume = Path(tmp) / "src", Path(tmp) / "volume"
            volume.mkdir()
            data = volume / "private"
            env = {"RENDER": "true", "STUDIO_DISK_MOUNT": str(volume), "STUDIO_DATA_DIR": str(data)}
            with self.assertRaisesMessage(ImproperlyConfigured, "not mounted"):
                hosted_data_dir(env, source)
            self.assertFalse(data.exists())
            with patch("config.hosting.is_mounted", return_value=True) as mounted:
                self.assertEqual(hosted_data_dir(env, source), data)
                mounted.assert_called_once_with(volume)
                with self.assertRaises(ImproperlyConfigured):
                    hosted_data_dir({**env, "STUDIO_DATA_DIR": str(Path(tmp) / "wrong")}, source)
            for path in ["", ".local", "/", str(source / "public")]:
                with self.subTest(path=path), self.assertRaises(ImproperlyConfigured):
                    hosted_data_dir({"STUDIO_DATA_DIR": path}, source)


class ReadinessTests(TestCase):
    def test_health_reads_database_without_disclosing_data(self):
        self.assertEqual(self.client.get("/healthz").json(), {"status": "ok"})
        self.assertEqual(self.client.head("/healthz").content, b"")
        self.assertEqual(self.client.post("/healthz").status_code, 405)
        with patch(
            "studio.views.Design.objects.exists", side_effect=DatabaseError("private detail")
        ):
            r = self.client.get("/healthz")
            self.assertEqual(r.status_code, 503)
            self.assertEqual(r.json(), {"status": "unavailable"})

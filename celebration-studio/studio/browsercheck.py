"""Optional browser test with its own Django test database; never uses preview accounts."""

import os
import subprocess
import unittest

from django.conf import settings
from django.test import LiveServerTestCase


@unittest.skipUnless(
    os.getenv("STUDIO_BROWSER_CHECK"), "Set STUDIO_BROWSER_CHECK=1 and install Puppeteer/Chromium"
)
class BrowserFlow(LiveServerTestCase):
    def test_host_and_guest(self):
        subprocess.run(
            ["node", str(settings.BASE_DIR / "checks/browser.cjs")],
            check=True,
            timeout=100,
            env={**os.environ, "STUDIO_TEST_BASE": self.live_server_url},
        )

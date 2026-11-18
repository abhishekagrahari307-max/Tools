"""Export public stationery only, from a fresh seeded DB (never an organizer's database)."""

import argparse
import json
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "public/pages/catalog-v1.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    with TemporaryDirectory() as data:
        os.environ.update(STUDIO_DATA_DIR=data, DJANGO_SETTINGS_MODULE="config.settings")
        sys.path.insert(0, str(ROOT))
        import django

        django.setup()
        from django.core.management import call_command
        from django.test import RequestFactory

        from studio.views import catalog

        call_command("migrate", verbosity=0, interactive=False)
        result = json.loads(catalog(RequestFactory().get("/api/catalog")).content)
        del result["publicOrigin"]
        result["templates"] = [t for t in result["templates"] if t["occasion"]]
        text = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
        if args.check:
            if TARGET.read_text() != text:
                sys.exit("Pages catalog differs from the seeded studio; regenerate and review.")
        else:
            TARGET.write_text(text)


if __name__ == "__main__":
    main()

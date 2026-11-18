"""Single-origin Django settings for the local preview and a durable, TLS-proxied deployment."""

import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .hosting import hosted_data_dir, hosted_origins

BASE_DIR = Path(__file__).resolve().parent.parent
STUDIO_ENV = os.getenv("STUDIO_ENV", "preview")
if STUDIO_ENV not in ("preview", "production"):
    raise ImproperlyConfigured("STUDIO_ENV must be preview or production.")
STUDIO_PRODUCTION = STUDIO_ENV == "production"
if STUDIO_PRODUCTION:
    STUDIO_PUBLIC_ORIGIN, CSRF_TRUSTED_ORIGINS, ALLOWED_HOSTS = hosted_origins(os.environ)
    DATA_DIR = hosted_data_dir(os.environ, BASE_DIR.parent)
else:
    DATA_DIR = Path(os.getenv("STUDIO_DATA_DIR", BASE_DIR / ".local"))
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0", ".e2b.app"]
    ALLOWED_HOSTS += [h for h in os.getenv("STUDIO_HOSTS", "").split(",") if h]
    STUDIO_PUBLIC_ORIGIN = os.getenv("STUDIO_PUBLIC_ORIGIN", "").rstrip("/")
    CSRF_TRUSTED_ORIGINS = [s for s in os.getenv("STUDIO_ORIGINS", "").split(",") if s]
    if os.getenv("E2B_SANDBOX_ID"):
        CSRF_TRUSTED_ORIGINS.append(
            f"https://{os.getenv('PORT', '8000')}-{os.environ['E2B_SANDBOX_ID']}.e2b.app"
        )
DATA_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)


def secret():
    if os.environ.get("STUDIO_SECRET_KEY"):
        return os.environ["STUDIO_SECRET_KEY"]
    path = DATA_DIR / "django-secret"
    try:
        with path.open("x") as f:  # private directory, persistent across restarts
            path.chmod(0o600)
            f.write(secrets.token_urlsafe(64))
    except FileExistsError:
        pass
    return path.read_text().strip()


SECRET_KEY = secret()
DEBUG = False
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "studio",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "studio.middleware.StudioHeaders",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "studio.sqlite3",
        "OPTIONS": {"timeout": 15},
    }
}
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_TZ = True
STATIC_URL = "/s/"
STATIC_ROOT = DATA_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "public"]
WHITENOISE_USE_FINDERS = not STUDIO_PRODUCTION
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 256  # JSON only; uploaded files use Django's file handlers.
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 512
DATA_UPLOAD_MAX_NUMBER_FILES = 1
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = STUDIO_PRODUCTION or os.getenv("STUDIO_HTTPS") == "1"
SECURE_REFERRER_POLICY = "no-referrer"

if STUDIO_PRODUCTION:
    # Gunicorn must only be reachable through a trusted edge that replaces this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_SSL_HOST = urlsplit(STUDIO_PUBLIC_ORIGIN).netloc
    SECURE_REDIRECT_EXEMPT = [r"^healthz$"]
    SECURE_HSTS_SECONDS = 604800
    MIDDLEWARE.append("django.middleware.clickjacking.XFrameOptionsMiddleware")
    X_FRAME_OPTIONS = "DENY"
    # This deployment controls one hostname, not its subdomains or browser preload lists.
    SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
    DATABASES["default"]["OPTIONS"]["transaction_mode"] = "IMMEDIATE"

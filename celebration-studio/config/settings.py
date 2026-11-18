"""Single-origin working preview; no cloud keys or external services required."""

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("STUDIO_DATA_DIR", BASE_DIR / ".local"))
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
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0", ".e2b.app"]
ALLOWED_HOSTS += [h for h in os.getenv("STUDIO_HOSTS", "").split(",") if h]
CSRF_TRUSTED_ORIGINS = [s for s in os.getenv("STUDIO_ORIGINS", "").split(",") if s]
if os.getenv("E2B_SANDBOX_ID"):
    CSRF_TRUSTED_ORIGINS.append(
        f"https://{os.getenv('PORT', '8000')}-{os.environ['E2B_SANDBOX_ID']}.e2b.app"
    )
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
WHITENOISE_USE_FINDERS = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 256  # JSON only; uploaded files use Django's file handlers.
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 512
DATA_UPLOAD_MAX_NUMBER_FILES = 1
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = os.getenv("STUDIO_HTTPS") == "1"
SECURE_REFERRER_POLICY = "no-referrer"

"""Hosted-mode configuration. Never infer a public origin from a guest's request."""

import os
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import URLValidator
from django.http.request import split_domain_port


def https_origin(value):
    try:
        URLValidator(schemes=["https"])(value)
        u = urlsplit(value)
        if (
            u.scheme != "https"
            or not u.hostname
            or u.username is not None
            or u.password is not None
            or u.path not in ("", "/")
            or u.query
            or u.fragment
            or "*" in u.netloc
            or "\\" in u.netloc
            or "%" in u.netloc
        ):
            raise ValueError
        # Reading port also checks its range. Keep explicit non-standard TLS ports.
        port = u.port
        if port == 0:
            raise ValueError
        hostname = u.hostname.encode("idna").decode("ascii")
        hostname = f"[{hostname}]" if ":" in hostname else hostname
        return "https://" + hostname + (f":{port}" if port and port != 443 else "")
    except (ValueError, ValidationError):
        raise ImproperlyConfigured(
            "Set a public HTTPS origin with a hostname and no path, credentials, query or fragment."
        ) from None


def hosted_origins(env):
    provider_host = env.get("RENDER_EXTERNAL_HOSTNAME")
    provider = https_origin("https://" + provider_host) if provider_host else ""
    custom = env.get("STUDIO_PUBLIC_ORIGIN")
    public = https_origin(custom) if custom else provider
    if not public:
        raise ImproperlyConfigured(
            "Set STUDIO_PUBLIC_ORIGIN, or deploy with RENDER_EXTERNAL_HOSTNAME."
        )
    origins = list(dict.fromkeys(s for s in (public, provider) if s))
    return (
        public,
        origins,
        list(dict.fromkeys(split_domain_port(urlsplit(s).netloc)[0] for s in origins)),
    )


def is_mounted(path):
    if path.is_mount():
        return True
    # Linux same-filesystem bind mounts need not be recognised by os.path.ismount().
    info = Path("/proc/self/mountinfo")
    if not info.is_file():
        return False
    escaped = (
        os.fsencode(path)
        .replace(b"\\", b"\\134")
        .replace(b" ", b"\\040")
        .replace(b"\t", b"\\011")
        .replace(b"\n", b"\\012")
    )
    return any(line.split()[4] == escaped for line in info.read_bytes().splitlines())


def hosted_data_dir(env, source):
    raw = Path(env.get("STUDIO_DATA_DIR", ""))
    if not raw.is_absolute():
        raise ImproperlyConfigured(
            "Set STUDIO_DATA_DIR to an absolute, private, persistent directory."
        )
    data = raw.resolve()
    if data == Path("/") or data.is_relative_to(source.resolve()):
        raise ImproperlyConfigured(
            "Hosted data must be in a private directory outside the code checkout."
        )
    # On Render, fail instead of launching against a fresh SQLite file on ephemeral storage.
    mount = env.get("STUDIO_DISK_MOUNT")
    if env.get("RENDER") == "true" or env.get("RENDER_EXTERNAL_HOSTNAME"):
        mount = mount or "/var/data"
    if mount:
        path = Path(mount)
        if (
            not path.is_absolute()
            or path.resolve() == Path("/")
            or not data.is_relative_to(path.resolve())
            or not is_mounted(path.resolve())
        ):
            raise ImproperlyConfigured(
                "Persistent disk not mounted at STUDIO_DISK_MOUNT, or STUDIO_DATA_DIR is not on it. Refusing to start."
            )
    return data

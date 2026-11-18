#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
export STUDIO_ENV=production
PYTHON=${PYTHON:-python3}
# Mount/hostname validation happens on settings load. The persistent disk is only
# available at runtime on Render: do not migrate or generate the key at build time.
"$PYTHON" manage.py check --deploy --fail-level WARNING
"$PYTHON" manage.py migrate --noinput
"$PYTHON" manage.py collectstatic --noinput --verbosity 0
# Single instance and worker: SQLite and the in-process rate limiter are shared.
exec "$PYTHON" -m gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" --workers 1 --worker-class gthread --threads 4 \
  --umask 0o077 --timeout 60

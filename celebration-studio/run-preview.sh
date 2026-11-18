#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "${STUDIO_ENV:-preview}" != preview ] || [ "${RENDER:-}" = true ]; then
  echo "Use ./run-production.sh for a hosted service." >&2
  exit 1
fi
PYTHON=${PYTHON:-python3}
# The proxy may forward an internal host. Encode the same public, HTTPS guest URL in
# printed QR codes and copy/share links, never a loopback URL from the backend.
if [ -n "${E2B_SANDBOX_ID:-}" ] && [ -z "${STUDIO_PUBLIC_ORIGIN:-}" ]; then
  export STUDIO_PUBLIC_ORIGIN="https://${PORT:-8000}-${E2B_SANDBOX_ID}.e2b.app"
fi
"$PYTHON" manage.py migrate --noinput
"$PYTHON" manage.py collectstatic --noinput --verbosity 0
exec "$PYTHON" manage.py runserver "0.0.0.0:${PORT:-8000}" --noreload --nostatic

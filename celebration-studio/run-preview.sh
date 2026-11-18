#!/bin/sh
set -eu
cd "$(dirname "$0")"
PYTHON=${PYTHON:-python3}
"$PYTHON" manage.py migrate --noinput
"$PYTHON" manage.py collectstatic --noinput --verbosity 0
exec "$PYTHON" manage.py runserver "0.0.0.0:${PORT:-8000}" --noreload --nostatic

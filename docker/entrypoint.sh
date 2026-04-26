#!/bin/sh
set -eu

required_vars="DATABASE_URL BETTER_AUTH_SECRET CONNECTION_ENCRYPTION_KEY"

for var_name in $required_vars; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
done

if [ "${#CONNECTION_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "CONNECTION_ENCRYPTION_KEY must be at least 32 characters long." >&2
  exit 1
fi

db_dir="$(dirname "$DATABASE_URL")"
mkdir -p "$db_dir"

pnpm db:migrate

exec pnpm start

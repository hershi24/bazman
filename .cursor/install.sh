#!/usr/bin/env bash
set -euo pipefail

# Idempotent dependency install using the committed lockfile.
npm ci

# The app reads Supabase config from a gitignored .env at build/dev time.
# The working .env is captured in the environment snapshot, but if it is ever
# missing (e.g. a fresh checkout without the snapshot), recreate it from the
# Cloud Agent secrets when they are available. Never overwrite an existing file.
if [ ! -f .env ]; then
  if [ -n "${VITE_SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_ANON_KEY:-}" ]; then
    {
      echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
      echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}"
    } > .env
    echo "Wrote .env from VITE_SUPABASE_* environment variables."
  else
    echo "WARNING: .env is missing and VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set." >&2
    echo "The frontend will not be able to reach Supabase until .env is provided." >&2
  fi
fi

#!/usr/bin/env bash
#
# Run a command with this project's secrets loaded from the macOS Keychain.
#
#   ./scripts/with-secrets.sh pnpm dev
#   ./scripts/with-secrets.sh pnpm build
#
# Secrets are deliberately NOT in .env.local: that file is read by editors, shell
# history, and coding agents, and a plaintext token on disk is one careless `cat`
# away from ending up somewhere it cannot be recalled from. The Keychain requires
# an explicit, auditable `security` call per read instead.
#
# Store/rotate an entry with:
#   security add-generic-password -s "digital-garden" -a "<VAR_NAME>" -w "<value>" -U
#
# Public NEXT_PUBLIC_* values stay in .env.local — they ship to the browser and
# are committed in .github/workflows/ci.yml already, so they are not secrets.

set -euo pipefail

SERVICE="digital-garden"

# Secrets required for draft mode / Visual Editing / the revalidate webhook.
# Keep in sync with .env.example (see docs/security-and-ops.md).
SECRETS=(
  SANITY_API_READ_TOKEN
  SANITY_API_BROWSER_TOKEN
  SANITY_REVALIDATE_SECRET
)

missing=()
for key in "${SECRETS[@]}"; do
  if value=$(security find-generic-password -s "$SERVICE" -a "$key" -w 2>/dev/null); then
    export "$key=$value"
  else
    missing+=("$key")
  fi
done

# Fail loud, never silently half-configured: a missing read token degrades into
# confusing "drafts don't preview" behavior rather than an obvious error.
if ((${#missing[@]})); then
  printf 'with-secrets: missing Keychain entries for service "%s":\n' "$SERVICE" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  printf 'Add each with: security add-generic-password -s "%s" -a "<VAR>" -w "<value>" -U\n' "$SERVICE" >&2
  exit 1
fi

if (($# == 0)); then
  echo "with-secrets: no command given. Usage: $0 <command> [args...]" >&2
  exit 64
fi

exec "$@"

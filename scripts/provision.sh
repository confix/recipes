#!/usr/bin/env bash
# Creates the Cloudflare resources that `wrangler deploy` does not provision
# itself. Idempotent, so CI runs it before every deploy.
#
#   - D1: deploy would create it, but migrations run before deploy and need it.
#   - Vectorize: never auto-provisioned. The metadata index on `kind` must
#     exist before vectors are written, or they cannot be filtered by it.
#
# R2 and KV are left to `wrangler deploy` (see wrangler.jsonc).
#
# Auth: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, or `wrangler login`.
set -euo pipefail

D1_NAME=recipes-db
INDEX_NAME=recipes

wrangler() { pnpm exec wrangler "$@"; }

if wrangler d1 info "$D1_NAME" >/dev/null 2>&1; then
  echo "D1 database $D1_NAME exists."
else
  echo "Creating D1 database $D1_NAME..."
  wrangler d1 create "$D1_NAME" --update-config=false
fi

if wrangler vectorize get "$INDEX_NAME" >/dev/null 2>&1; then
  echo "Vectorize index $INDEX_NAME exists."
else
  # Must match the embedding model in app/recipes/semantic.server.ts.
  echo "Creating Vectorize index $INDEX_NAME..."
  wrangler vectorize create "$INDEX_NAME" --dimensions=1024 --metric=cosine
fi

properties=$(
  wrangler vectorize list-metadata-index "$INDEX_NAME" --json 2>/dev/null |
    node -e '
      let input = "";
      process.stdin.on("data", (d) => (input += d));
      process.stdin.on("end", () => {
        const indexes = JSON.parse(input) ?? [];
        console.log(indexes.map((i) => i.propertyName).join(" "));
      });
    '
)
if [[ " $properties " == *" kind "* ]]; then
  echo "Metadata index on kind exists."
else
  echo "Creating metadata index on kind..."
  wrangler vectorize create-metadata-index "$INDEX_NAME" --property-name=kind --type=string
fi

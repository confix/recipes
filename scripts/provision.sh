#!/usr/bin/env bash
# Creates the Cloudflare resources the Worker needs, if missing. Idempotent;
# scripts/deploy.sh runs it before every deploy.
#
#   - D1: deploy would create it, but migrations run before deploy and need it.
#   - KV: deploy can only find its auto-created namespace through the deployed
#     Worker's bindings, so a first deploy that failed after creating it would
#     wedge every later one. Looked up by title here instead; the id is printed
#     as OAUTH_KV_ID=<id> for scripts/deploy.sh.
#   - Vectorize: never auto-provisioned. The metadata index on `kind` must
#     exist before vectors are written, or they cannot be filtered by it.
#
# The R2 bucket is left to `wrangler deploy`, which finds it by name.
#
# Auth: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, or `wrangler login`.
set -euo pipefail

D1_NAME=recipes-db
# The title `wrangler deploy` would give it, so a namespace it created earlier
# is found and reused.
KV_TITLE=recipes-oauth-kv
INDEX_NAME=recipes

wrangler() { pnpm exec wrangler "$@"; }

# Prints the JSON value in wrangler's output (which may carry a banner first).
json() {
  node -e '
    let input = "";
    process.stdin.on("data", (d) => (input += d));
    process.stdin.on("end", () => {
      const start = input.search(/[[{]/);
      if (start < 0) throw new Error(`No JSON in wrangler output:\n${input}`);
      const value = JSON.parse(input.slice(start));
      console.log(eval(process.argv[1]));
    });
  ' "$1"
}

if wrangler d1 info "$D1_NAME" >/dev/null 2>&1; then
  echo "D1 database $D1_NAME exists."
else
  echo "Creating D1 database $D1_NAME..."
  wrangler d1 create "$D1_NAME" --update-config=false
fi

kv_id=$(wrangler kv namespace list | json \
  "(Array.isArray(value) ? value : []).find((n) => n.title === '$KV_TITLE')?.id ?? ''")
if [[ -n "$kv_id" ]]; then
  echo "KV namespace $KV_TITLE exists."
else
  echo "Creating KV namespace $KV_TITLE..."
  wrangler kv namespace create "$KV_TITLE" --update-config=false
  kv_id=$(wrangler kv namespace list | json \
    "(Array.isArray(value) ? value : []).find((n) => n.title === '$KV_TITLE')?.id ?? ''")
  [[ -n "$kv_id" ]] || { echo "KV namespace $KV_TITLE was not created." >&2; exit 1; }
fi

if wrangler vectorize get "$INDEX_NAME" >/dev/null 2>&1; then
  echo "Vectorize index $INDEX_NAME exists."
else
  # Must match the embedding model in app/recipes/semantic.server.ts.
  echo "Creating Vectorize index $INDEX_NAME..."
  wrangler vectorize create "$INDEX_NAME" --dimensions=1024 --metric=cosine
fi

properties=$(wrangler vectorize list-metadata-index "$INDEX_NAME" --json | json \
  "(Array.isArray(value) ? value : []).map((i) => i.propertyName).join(' ')")
if [[ " $properties " == *" kind "* ]]; then
  echo "Metadata index on kind exists."
else
  echo "Creating metadata index on kind..."
  wrangler vectorize create-metadata-index "$INDEX_NAME" --property-name=kind --type=string
fi

echo "OAUTH_KV_ID=$kv_id"

#!/usr/bin/env bash
# Provisions, migrates, builds and deploys the Worker. CI runs this on every
# push to main; it works the same by hand after `wrangler login`.
#
# Environment:
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  (or `wrangler login`)
#   BETTER_AUTH_SECRET  Worker secrets, uploaded with the deploy when set.
#   ALLOWED_EMAILS      All three are required the first time; later deploys
#   IMPRINT             keep the previous values for any that are unset.
#   DEPLOY_MESSAGE      optional label for the Worker version
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Resources. provision.sh's log goes to stderr; its OAUTH_KV_ID line is kept.
kv_id=$(scripts/provision.sh | tee /dev/stderr | sed -n 's/^OAUTH_KV_ID=//p')
if [[ -z "$kv_id" ]]; then
  echo "scripts/provision.sh did not report the KV namespace id." >&2
  exit 1
fi

# 2. Schema, before the new code goes live (migrations are additive).
pnpm exec wrangler d1 migrations apply recipes-db --remote

# 3. Build, without credentials in reach of Vite plugins. `wrangler deploy`
#    then reads build/server/wrangler.json.
env -u CLOUDFLARE_API_TOKEN -u BETTER_AUTH_SECRET -u ALLOWED_EMAILS -u IMPRINT pnpm build

# 4. Pin the KV namespace in the generated config only. wrangler.jsonc stays
#    id-less, so local dev and other accounts need no edits.
node -e '
  const fs = require("node:fs");
  const path = "build/server/wrangler.json";
  const config = JSON.parse(fs.readFileSync(path, "utf8"));
  const kv = (config.kv_namespaces ?? []).find((n) => n.binding === "OAUTH_KV");
  if (!kv) throw new Error(`No OAUTH_KV binding in ${path}`);
  kv.id = process.argv[1];
  fs.writeFileSync(path, JSON.stringify(config));
' "$kv_id"

# 5. Deploy, with whichever Worker secrets are given. The file never outlives
#    this script and is readable only by us.
args=()
if [[ -n "${DEPLOY_MESSAGE:-}" ]]; then args+=(--message "$DEPLOY_MESSAGE"); fi
if [[ -n "${BETTER_AUTH_SECRET:-}${ALLOWED_EMAILS:-}${IMPRINT:-}" ]]; then
  secrets_file=$(umask 077 && mktemp)
  trap 'rm -f "$secrets_file"' EXIT
  node -e '
    const secrets = {};
    for (const name of ["BETTER_AUTH_SECRET", "ALLOWED_EMAILS", "IMPRINT"]) {
      if (process.env[name]) secrets[name] = process.env[name];
    }
    process.stdout.write(JSON.stringify(secrets));
  ' > "$secrets_file"
  args+=(--secrets-file "$secrets_file")
fi
pnpm exec wrangler deploy "${args[@]}"

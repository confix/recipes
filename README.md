# Recipes

An MCP server and REST API for managing recipes and finding them quickly —
by keyword or by meaning ("something like this, but vegetarian"). Recipes are
markdown files with YAML frontmatter, stored per user in R2; D1 (full-text)
and Vectorize (embeddings) hold rebuildable search indexes. Design and roadmap: [docs/design.md](docs/design.md).

## Recipe format

```markdown
---
title: Weeknight Dal
kind: cook                 # cook | bake
tags: [indian, vegetarian]
time: { total: 30 }        # minutes; also `active`
---

Comforting red lentil dal.

## Ingredients

- 200 g red lentils

## Log

- 2026-10-12 ★4 — more ginger next time
```

Bakes can add a `formula` (grams + role per ingredient) for derived baker's
percentages and hydration; see docs/design.md.

## Development

```sh
pnpm install
echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" > .dev.vars
echo "ALLOWED_EMAILS=*" >> .dev.vars   # who may sign up; see below
pnpm exec wrangler d1 migrations apply recipes-db --local
pnpm dev
```

Sign up at `/signup`, then point an MCP client at `http://localhost:5173/mcp`
or create an API token on the home page. The home page also searches your
recipes; `/r/<slug>` is a read-only view for the kitchen.

Local data lives in `.wrangler/state`. (Checkouts from before the deploy setup
kept it under a placeholder id; re-run the migrations command above once to get
a fresh local database.)

Semantic search needs Workers AI and Vectorize, which only exist remotely.
Plain `pnpm dev` runs without them and search falls back to keywords; after
`wrangler login`, `REMOTE_BINDINGS=1 pnpm dev` connects the real services.

```sh
pnpm test        # unit tests
pnpm typecheck
```

## Deploying

GitHub Actions (`.github/workflows/ci.yml`) typechecks, tests and builds every
push and pull request, and runs `scripts/deploy.sh` for every push to `main`:

1. `scripts/provision.sh` creates whatever is missing: the D1 database, the
   OAuth KV namespace (`recipes-oauth-kv`), and the Vectorize index with its
   metadata index on `kind`. It finds existing ones by name, so it is safe to
   re-run.
2. D1 migrations are applied.
3. The app is built, and the KV namespace id is written into the generated
   `build/server/wrangler.json`. `wrangler.jsonc` itself holds no resource ids.
4. `wrangler deploy` uploads the Worker with `BETTER_AUTH_SECRET`, connecting
   to the R2 bucket by name (and creating it if missing).

One-time setup:

- The app is served at **https://recipes.confix.run** (`routes` in
  `wrangler.jsonc`; the `workers.dev` URL is turned off). The `confix.run`
  zone must be on the same Cloudflare account; the deploy creates the DNS
  record and certificate for `recipes.confix.run`. If a record by that name
  already exists, remove it first, or the deploy refuses the domain.
- In the GitHub repository (Settings → Secrets and variables → Actions, or the
  `production` environment), add:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your account id (dashboard → Workers & Pages, right-hand side). |
| `CLOUDFLARE_API_TOKEN` | An API token from the "Edit Cloudflare Workers" template, plus **Account → D1 → Edit** and **Account → Vectorize → Edit**, limited to that account; for zone permissions, include the `confix.run` zone, and add **Zone → DNS → Edit** if the deploy is refused permission to create the domain. |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32`. Changing it signs everyone out. |
| `ALLOWED_EMAILS` | Who may sign up: email addresses separated by commas, or `*` for anyone. |

Sign up at https://recipes.confix.run; MCP clients connect to
`https://recipes.confix.run/mcp`. Run `POST /api/reindex` once per user if recipes were added while
embeddings were unavailable.

Sign-up is invite-only: only addresses in `ALLOWED_EMAILS` can create an
account, and if it is empty nobody can. To change the list, update the GitHub
secret and redeploy (or `wrangler secret put ALLOWED_EMAILS`). Removing an
address does not delete an account that already exists.

To deploy by hand: `wrangler login`, then
`BETTER_AUTH_SECRET=… ALLOWED_EMAILS=… scripts/deploy.sh` (both can be left
out after the first deploy; the Worker keeps them).

## MCP

The MCP server lives at `/mcp` (Streamable HTTP) and signs clients in with
OAuth: the client registers itself, you sign in and approve it on
`/authorize`, and it only ever sees your own recipes.

```sh
claude mcp add --transport http recipes https://recipes.confix.run/mcp
```

Tools: `search_recipes`, `find_similar`, `get_recipe`, `save_recipe`,
`log_cook`, `list_tags`, `delete_recipe`. The server's instructions teach the client the
recipe format.

## API

All endpoints take `Authorization: Bearer <token>` (a personal access token
from the home page, not an MCP OAuth token).

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/recipes?q=&kind=&tag=&max_minutes=&limit=` | Search by keywords and meaning. Without `q`: most recently updated first. |
| `GET` | `/api/similar?slug=` or `?text=` (`&kind=&limit=`) | Most similar recipes, with a `similarity` score. 503 while embeddings are unavailable. |
| `POST` | `/api/recipes` | Create from a markdown body (or JSON `{ markdown }`). The slug comes from the title. |
| `GET` | `/api/recipes/:slug` | JSON with parsed frontmatter, log and baker's math; raw file with `Accept: text/markdown`. |
| `PUT` | `/api/recipes/:slug` | Create or replace. Send `If-Match: <etag>` to avoid overwriting concurrent edits. |
| `DELETE` | `/api/recipes/:slug` | |
| `POST` | `/api/recipes/:slug/log` | `{ date?, rating?, notes? }` appends to `## Log`. |
| `GET` | `/api/tags` | Tags with counts. |
| `POST` | `/api/reindex` | Rebuilds your index from R2 and reports files that don't parse. |

```sh
curl -X POST localhost:5173/api/recipes -H "Authorization: Bearer $TOKEN" --data-binary @dal.md
curl "localhost:5173/api/recipes?q=lentil&kind=cook" -H "Authorization: Bearer $TOKEN"
```

## Migrating v1 data

`node scripts/export-v1.ts [--remote] --upload` converts the v1 tables to
markdown, uploads them to R2, and asks each user to `POST /api/reindex`. The
v1 tables stay in the schema (`app/db/schema/legacy.ts`) until the export has
run.

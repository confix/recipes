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
pnpm exec wrangler d1 migrations apply recipes-db --local
pnpm dev
```

Sign up at `/login`, then create an API token on the home page, or point an
MCP client at `http://localhost:5173/mcp`.

Semantic search needs Workers AI and Vectorize, which only exist remotely.
Plain `pnpm dev` runs without them and search falls back to keywords; after
`wrangler login`, `REMOTE_BINDINGS=1 pnpm dev` connects the real services.

Before the first deploy, create the KV namespace for OAuth state (put its id
into `wrangler.jsonc`) and the vector index:

```sh
pnpm exec wrangler kv namespace create OAUTH_KV
pnpm exec wrangler vectorize create recipes --dimensions=1024 --metric=cosine
pnpm exec wrangler vectorize create-metadata-index recipes --property-name=kind --type=string
```

After deploying, run `POST /api/reindex` once per user to embed existing
recipes.

```sh
pnpm test        # unit tests
pnpm typecheck
```

## MCP

The MCP server lives at `/mcp` (Streamable HTTP) and signs clients in with
OAuth: the client registers itself, you sign in and approve it on
`/authorize`, and it only ever sees your own recipes.

```sh
claude mcp add --transport http recipes https://<your-worker>/mcp
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

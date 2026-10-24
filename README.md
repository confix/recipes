# Recipes

An API (and soon MCP server) for managing recipes and finding them quickly.
Recipes are markdown files with YAML frontmatter, stored per user in R2; D1
holds a rebuildable search index. Design and roadmap: [docs/design.md](docs/design.md).

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

Sign up at `/login`, then create an API token on the home page.

```sh
pnpm test        # unit tests
pnpm typecheck
```

## API

All endpoints take `Authorization: Bearer <token>`.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/recipes?q=&kind=&tag=&max_minutes=&limit=` | Search. Without `q`: most recently updated first. |
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

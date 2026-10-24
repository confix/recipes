# Recipes v2 — API/MCP-first redesign

Status: Phase 1 implemented (2026-10-24); phases 2–4 open.

The v1 app (React Router UI, normalized D1 schema, fork tree, share links,
BYOK credentials) is replaced. The new centre is an API + MCP server that lets
each user manage their recipes and find them quickly — including "something like this".

## Decisions

| Topic | Decision |
| --- | --- |
| Source of truth | Markdown files in R2. Everything else is a derived, rebuildable index. |
| Baking vs cooking | One recipe type with `kind: bake \| cook`. Bakes may add a weighted `formula` block; baker's % / hydration are derived from it. |
| UI | Minimal read-only recipe view (phone in the kitchen). No editor. |
| Users | Multi-user. Each user has a private library; every storage key and index row is scoped by `user_id`. |
| Validation | valibot (frontmatter and request bodies). |
| Auth | Accounts via better-auth (kept from v1, social login). MCP uses OAuth (workers-oauth-provider, delegating login to better-auth). REST uses per-user personal access tokens (stored hashed in D1). |

## Architecture

```
            ┌──────────── Worker ─────────────┐
 MCP  ───▶  │ /mcp   (McpAgent, OAuth)        │
 REST ───▶  │ /api/* (bearer token)           │──▶ service layer
 Web  ───▶  │ /r/:slug (read-only HTML)       │
            └─────────────────────────────────┘
                              │
        write: R2 put ──▶ reindex(slug) ──▶ D1 (metadata + FTS5)
                                       └──▶ Vectorize (embedding)
```

- **R2** `u/<user_id>/recipes/<slug>.md` — canonical recipe.
  `u/<user_id>/photos/<slug>/<id>.jpg` for images.
- **D1** — users/sessions (better-auth), API tokens, and one row per recipe
  keyed `(user_id, slug)` with the frontmatter fields used for filtering,
  plus an FTS5 table over title / tags / ingredients / body.
- **Vectorize** — one embedding per recipe, id `<user_id>:<slug>`, with
  `user_id` as an indexed metadata field so every query is filtered to the
  caller. One embedding per recipe (Workers AI embedding model) over
  title + tags + ingredients + summary. Powers `find_similar` and fuzzy
  natural-language queries.
- Reindex is write-through on every save. A `reindex_all` admin path rebuilds
  D1 + Vectorize from R2, so the index schema can change freely.

## Recipe file format

```markdown
---
title: Country Sourdough
kind: bake            # bake | cook
tags: [bread, sourdough]
servings: 2 loaves
time: { active: 45, total: 1440 }   # minutes
source: https://example.com/...
variant_of: basic-sourdough         # optional slug, replaces the v1 fork tree
formula:                            # optional, bakes only — grams + role
  - { name: bread flour, grams: 900, role: flour }
  - { name: whole wheat, grams: 100, role: flour }
  - { name: water,       grams: 750, role: liquid, note: 30 °C }
  - { name: levain,      grams: 200, role: leaven }
  - { name: salt,        grams: 20,  role: salt }
---

Free-form markdown: intro, ingredients (for cook recipes), method, notes.

## Log
- 2026-10-12 ★4 — 78% hydration, longer cold retard; better ear.
```

- The slug is the filename and the stable id, unique per user.
- Tenancy is resolved from the auth context only, never from tool arguments.
- The cooking log lives in the file (`## Log`), appended by `log_cook`. The
  indexer derives `last_cooked` and average rating from it.
- `formula` feeds the existing baker's-math logic (`app/lib/bakers-math.ts`,
  to be adapted from DB rows to formula entries).

## MCP tools

| Tool | Purpose |
| --- | --- |
| `search_recipes(query?, kind?, tags?, max_minutes?, limit?)` | Hybrid: structured filters → FTS5 + vector, merged by reciprocal rank. |
| `find_similar(slug \| text, kind?, limit?)` | Nearest neighbours in Vectorize. |
| `get_recipe(slug)` | Raw markdown + derived data (baker's %, hydration, last cooked). |
| `save_recipe(markdown, slug?)` | Validate frontmatter, write to R2, reindex. |
| `log_cook(slug, date?, rating?, notes)` | Append to `## Log`, reindex. |
| `list_tags()` | Tags with counts, for consistent tagging. |
| `delete_recipe(slug)` | Remove from R2 and indexes. |

REST mirrors these under `/api/recipes` (see README). `/api/tokens` is
session-only, so a leaked token cannot mint more.

## Removed from v1

React editor/routes, normalized
`ingredients`/`steps`/`tags` tables, fork tree, share links, AI credential
storage, freeform parser UI. Share links are dropped for now (could return
as sharing between users later). `scripts/export-v1.ts` converts existing D1
recipes to markdown under their owner's prefix. The v1 tables stay in
`app/db/schema/legacy.ts` until that has run, then get dropped.

## Phases

1. **Core** ✅: recipe format + valibot schema, user-scoped R2 storage, D1 index + FTS5, personal access tokens (incl. a minimal page to issue them), REST API, export script from v1.
2. **MCP**: McpAgent + OAuth, tools above.
3. **Similarity**: Workers AI embeddings + Vectorize, `find_similar`, hybrid ranking.
4. **Read view**: `/r/:slug` server-rendered page for the signed-in user, baker's % table for bakes.

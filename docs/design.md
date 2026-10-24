# Recipes v2 — API/MCP-first redesign

Status: phases 1–4 implemented (2026-10-24).

The v1 app (React Router UI, normalized D1 schema, fork tree, share links,
BYOK credentials) is replaced. The new centre is an API + MCP server that lets
each user manage their recipes and find them quickly — including "something like this".

## Decisions

| Topic | Decision |
| --- | --- |
| Source of truth | Markdown files in R2. Everything else is a derived, rebuildable index. |
| Baking vs cooking | One recipe type with `kind: bake \| cook`. Bakes may add a weighted `formula` block; baker's % / hydration are derived from it. |
| UI | Minimal: sign-in, search + list, a read-only recipe view for the kitchen, API tokens. No editor. |
| Users | Multi-user. Each user has a private library; every storage key and index row is scoped by `user_id`. |
| Validation | valibot (frontmatter and request bodies). |
| Auth | Accounts via better-auth (kept from v1, social login). MCP uses OAuth (workers-oauth-provider, delegating login to better-auth). REST uses per-user personal access tokens (stored hashed in D1). |

## Architecture

```
            ┌──────────── Worker ─────────────┐
 MCP  ───▶  │ /mcp   (stateless MCP, OAuth)   │
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
- **Vectorize** — one embedding per recipe in a namespace per user (so a
  query can only see the caller's vectors); id = SHA-256 of user id + slug,
  since ids are capped at 64 bytes; `kind` is an indexed metadata field. One
  embedding per recipe (Workers AI embedding model) over
  title + kind + tags + ingredients + body (minus the log), capped at 4000
  characters. Powers `find_similar` and natural-language queries.
- Embedding is best-effort: if Workers AI or Vectorize fail, saves still
  succeed and search returns keyword results only; reindex fills the gaps.
  Vectors store a hash of the embedded text, so logging a cook or re-running
  reindex does not re-embed unchanged recipes.
- Known limits: two concurrent saves of one recipe can leave the vector one
  version behind (the window is narrowed, not closed); a vector whose delete
  failed lingers but is inert, since results always go through the D1 index.
  A first reindex of a large library embeds one recipe per AI call and may
  hit Worker subrequest limits; batch it if that becomes real.
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
2. **MCP** ✅: stateless `createMcpHandler` (agents, MCP SDK v2; `McpAgent` is
   deprecated) behind `OAuthProvider` with dynamic client registration and a
   consent page at `/authorize`. Tool schemas are valibot via
   `@valibot/to-json-schema`. The provider is built per request origin, so its
   resource URL needs no configuration. `find_similar` comes with phase 3.
3. **Similarity** ✅: `@cf/baai/bge-m3` embeddings in Vectorize, `find_similar`
   (by slug or text) and hybrid search (FTS5 + vectors merged by reciprocal
   rank fusion; filters applied to vector hits through D1). Matches below a
   cosine similarity of 0.45 are dropped — an uncalibrated starting value to
   tune against real recipes once deployed.
4. **Read view** ✅: `/r/:slug` for the signed-in user: formula with baker's %
   and hydration, the body rendered with micromark (raw HTML escaped, unsafe
   links dropped — recipe text is untrusted), the cooking log newest first,
   and a "keep screen on" toggle (Screen Wake Lock). Every page sends
   `img-src 'self' data:`, so markdown images in a recipe cannot make the
   reader's browser call other hosts. The home page searches
   and lists recipes. A file that no longer parses is shown raw, with its
   problems.

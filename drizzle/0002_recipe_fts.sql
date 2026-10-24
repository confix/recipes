-- Full-text index over recipes. Hand-written: drizzle cannot model virtual
-- tables. rowid = recipe_index.id; rows are maintained by
-- app/recipes/search-index.server.ts, not by triggers, so the indexer controls
-- exactly which text goes in.
--
-- unicode61 with remove_diacritics so "creme" finds "crème". No porter
-- stemmer: it is English-only and recipes are not; prefix queries ("tomat*")
-- cover most of what stemming would.
--
-- Note `wrangler d1 export` cannot export databases containing virtual tables.
-- That is fine here: this table is derived and is rebuilt by POST /api/reindex.
CREATE VIRTUAL TABLE `recipe_fts` USING fts5(
	title,
	tags,
	ingredients,
	body,
	tokenize = 'unicode61 remove_diacritics 2'
);

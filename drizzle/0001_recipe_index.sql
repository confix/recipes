CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_idx` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `recipe_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text,
	`servings` text,
	`active_minutes` integer,
	`total_minutes` integer,
	`source` text,
	`variant_of` text,
	`cook_count` integer DEFAULT 0 NOT NULL,
	`last_cooked` text,
	`avg_rating` real,
	`etag` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_index_user_slug_idx` ON `recipe_index` (`user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `recipe_index_user_kind_idx` ON `recipe_index` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `recipe_index_user_updated_idx` ON `recipe_index` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `recipe_index_tags` (
	`recipe_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe_index`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_index_tags_user_tag_idx` ON `recipe_index_tags` (`user_id`,`tag`);
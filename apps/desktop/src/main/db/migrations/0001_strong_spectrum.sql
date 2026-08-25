CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` integer NOT NULL,
	`status` text NOT NULL,
	`source_url` text NOT NULL,
	`destination_path` text NOT NULL,
	`install_path` text NOT NULL,
	`bytes_downloaded` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer,
	`etag` text,
	`last_modified` text,
	`expected_sha256` text NOT NULL,
	`segment_index` integer DEFAULT 0 NOT NULL,
	`segment_count` integer DEFAULT 1 NOT NULL,
	`error_code` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `downloads_active_app` ON `downloads` (`app_id`) WHERE "downloads"."status" NOT IN ('done', 'failed');
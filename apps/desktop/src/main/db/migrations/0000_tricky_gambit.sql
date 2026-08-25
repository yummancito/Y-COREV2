CREATE TABLE `games` (
	`app_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`installation_path` text,
	`executable_path` text,
	`size_on_disk_bytes` integer,
	`last_played_at` text
);

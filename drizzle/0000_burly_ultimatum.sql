CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`automatic_reserves` integer DEFAULT false NOT NULL,
	`maintenance_percent` real DEFAULT 10 NOT NULL,
	`investment_percent` real DEFAULT 10 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_goals` (
	`work_date` text PRIMARY KEY NOT NULL,
	`shopee_cents` integer DEFAULT 0 NOT NULL,
	`ride_99_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`work_date` text NOT NULL,
	`platform` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`km_start` real NOT NULL,
	`km_end` real NOT NULL,
	`liters` real DEFAULT 0 NOT NULL,
	`earnings_cents` integer DEFAULT 0 NOT NULL,
	`fuel_cents` integer DEFAULT 0 NOT NULL,
	`maintenance_cents` integer DEFAULT 0 NOT NULL,
	`investment_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

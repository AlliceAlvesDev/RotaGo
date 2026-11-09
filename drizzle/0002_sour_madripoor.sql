CREATE TABLE `monthly_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`start_date` text NOT NULL,
	`available_cents` integer DEFAULT 0 NOT NULL,
	`daily_reserve_cents` integer DEFAULT 1000 NOT NULL,
	`km_per_liter` real DEFAULT 9.7 NOT NULL,
	`fuel_price_cents` integer DEFAULT 0 NOT NULL,
	`km_per_workday` real DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_plans_month_unique` ON `monthly_plans` (`month`);--> statement-breakpoint
CREATE TABLE `plan_days_off` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`off_date` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `monthly_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_days_off_plan_date_unique` ON `plan_days_off` (`plan_id`,`off_date`);--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `monthly_plans`(`id`) ON UPDATE no action ON DELETE cascade
);

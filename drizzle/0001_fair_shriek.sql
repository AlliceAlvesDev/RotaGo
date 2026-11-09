ALTER TABLE `work_sessions` ADD `km_driven` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `km_per_liter` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `fuel_price_cents` integer DEFAULT 0 NOT NULL;
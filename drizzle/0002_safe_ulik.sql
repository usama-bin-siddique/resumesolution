CREATE TABLE `tailor_usage` (
	`subject` text NOT NULL,
	`day` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subject`, `day`)
);
--> statement-breakpoint
CREATE INDEX `idx_tailor_usage_day` ON `tailor_usage` (`day`);
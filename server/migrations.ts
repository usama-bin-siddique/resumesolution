// Snapshot of the immutable drizzle migrations. Verify with the migration test.
export const migrations = [
  {
    "name": "0000_friendly_morlocks",
    "sql": "CREATE TABLE `drafts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`owner_id` text NOT NULL,\n\t`title` text NOT NULL,\n\t`data` text NOT NULL,\n\t`revision` integer DEFAULT 1 NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`created_at` text NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `idx_drafts_owner_updated` ON `drafts` (`owner_id`,`updated_at`);"
  },
  {
    "name": "0001_low_fabian_cortez",
    "sql": "CREATE TABLE `accounts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL,\n\t`name` text NOT NULL,\n\t`password_hash` text NOT NULL,\n\t`recovery_hash` text NOT NULL,\n\t`created_at` text NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `idx_accounts_email` ON `accounts` (`email`);--> statement-breakpoint\nCREATE TABLE `auth_attempts` (\n\t`bucket` text PRIMARY KEY NOT NULL,\n\t`count` integer DEFAULT 0 NOT NULL,\n\t`expires_at` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `idx_attempts_expiry` ON `auth_attempts` (`expires_at`);--> statement-breakpoint\nCREATE TABLE `auth_sessions` (\n\t`token_hash` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade\n);\n--> statement-breakpoint\nCREATE INDEX `idx_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint\nCREATE INDEX `idx_sessions_expiry` ON `auth_sessions` (`expires_at`);"
  },
  {
    "name": "0002_safe_ulik",
    "sql": "CREATE TABLE `tailor_usage` (\n\t`subject` text NOT NULL,\n\t`day` text NOT NULL,\n\t`used` integer DEFAULT 0 NOT NULL,\n\tPRIMARY KEY(`subject`, `day`)\n);\n--> statement-breakpoint\nCREATE INDEX `idx_tailor_usage_day` ON `tailor_usage` (`day`);"
  }
];

CREATE TABLE `accounts` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_hash` text NOT NULL,
	`output` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_cache_lookup_idx` ON `ai_cache` (`kind`,`source_hash`);--> statement-breakpoint
CREATE TABLE `mail_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`email_address` text NOT NULL,
	`credentials` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mail_accounts_user_idx` ON `mail_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `message_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`thread_id` text,
	`folder` text DEFAULT 'INBOX' NOT NULL,
	`from_name` text,
	`from_addr` text NOT NULL,
	`to_addrs` text NOT NULL,
	`subject` text,
	`snippet` text,
	`received_at` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`is_flagged` integer DEFAULT false NOT NULL,
	`labels` text,
	`priority` text,
	`priority_reason` text,
	`ai_summary` text,
	FOREIGN KEY (`account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_cache_account_idx` ON `message_cache` (`account_id`);--> statement-breakpoint
CREATE INDEX `message_cache_received_idx` ON `message_cache` (`received_at`);--> statement-breakpoint
CREATE INDEX `message_cache_provider_idx` ON `message_cache` (`account_id`,`provider_message_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);

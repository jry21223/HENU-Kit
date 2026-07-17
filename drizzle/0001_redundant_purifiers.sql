CREATE TABLE `food_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` text NOT NULL,
	`voter_email` text NOT NULL,
	`verdict` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_votes_spot_voter_idx` ON `food_votes` (`spot_id`,`voter_email`);
CREATE TABLE `food_rankings` (
	`spot_id` text PRIMARY KEY NOT NULL,
	`tier` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);

CREATE TABLE `food_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submitter_email` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);

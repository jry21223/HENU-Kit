import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const foodRankings = sqliteTable("food_rankings", {
  spotId: text("spot_id").primaryKey(),
  tier: text("tier").notNull(),
  position: integer("position").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
});

export const foodVotes = sqliteTable("food_votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spotId: text("spot_id").notNull(),
  voterEmail: text("voter_email").notNull(),
  verdict: text("verdict").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("food_votes_spot_voter_idx").on(table.spotId, table.voterEmail),
]);

export const foodSpots = sqliteTable("food_spots", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
});

export const foodSubmissions = sqliteTable("food_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submitterEmail: text("submitter_email").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
});

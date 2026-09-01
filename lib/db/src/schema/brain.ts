import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const brainStateTable = pgTable("brain_state", {
  id: serial("id").primaryKey(),
  vocabulary: jsonb("vocabulary").$type<Record<string, number>>().notNull(),
  transitions: jsonb("transitions")
    .$type<Record<string, Record<string, number>>>()
    .notNull(),
  messageCount: integer("message_count").notNull().default(0),
  learningStartedAt: timestamp("learning_started_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const modelSnapshotsTable = pgTable("model_snapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  filename: varchar("filename", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  vocabulary: integer("vocabulary").notNull(),
  bigrams: integer("bigrams").notNull(),
  messages: integer("messages").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  error: text("error"),
});

export const githubSettingsTable = pgTable("github_settings", {
  id: serial("id").primaryKey(),
  owner: varchar("owner", { length: 100 }).notNull().default(""),
  repository: varchar("repository", { length: 100 }).notNull().default(""),
  branch: varchar("branch", { length: 100 }).notNull().default("main"),
  configured: boolean("configured").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type BrainState = typeof brainStateTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type ModelSnapshot = typeof modelSnapshotsTable.$inferSelect;
export type GithubSettings = typeof githubSettingsTable.$inferSelect;
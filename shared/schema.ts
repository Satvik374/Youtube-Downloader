import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const downloadHistory = pgTable("download_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  url: text("url").notNull(),
  format: text("format").notNull(),
  quality: text("quality"),
  fileSize: text("file_size"),
  thumbnail: text("thumbnail"),
  status: text("status").notNull().default("completed"),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
});

export const insertDownloadHistorySchema = createInsertSchema(downloadHistory).pick({
  title: true,
  url: true,
  format: true,
  quality: true,
  fileSize: true,
  thumbnail: true,
  status: true,
});

export type InsertDownloadHistory = z.infer<typeof insertDownloadHistorySchema>;
export type DownloadHistory = typeof downloadHistory.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

import {
  pgTable,
  serial,
  text,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  extension: text("extension").notNull(),
  mimeType: text("mime_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FileRecord = typeof files.$inferSelect;

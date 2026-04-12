import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export * from "./auth-schema"

/** Example table — rename, extend, or remove after `drizzle-kit push` / migrations. */
export const notes = pgTable("notes", {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
})

import { relations } from "drizzle-orm"
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "./auth-schema"

/** A user-created agent in the Agents workspace (maps to one chat thread). */
export const userAgent = pgTable(
    "user_agent",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        title: text("title"),
        modelId: text("model_id"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("user_agent_user_idx").on(table.userId)]
)

/** One row per message; `parts` matches AI SDK UIMessage parts (json). */
export const agentMessage = pgTable(
    "agent_message",
    {
        id: text("id").primaryKey(),
        agentId: text("agent_id")
            .notNull()
            .references(() => userAgent.id, { onDelete: "cascade" }),
        role: text("role").notNull(),
        parts: jsonb("parts").notNull(),
        metadata: jsonb("metadata"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("agent_message_agent_idx").on(table.agentId),
        index("agent_message_agent_created_idx").on(
            table.agentId,
            table.createdAt
        ),
    ]
)

export const userAgentRelations = relations(userAgent, ({ one, many }) => ({
    user: one(user, {
        fields: [userAgent.userId],
        references: [user.id],
    }),
    messages: many(agentMessage),
}))

export const agentMessageRelations = relations(agentMessage, ({ one }) => ({
    agent: one(userAgent, {
        fields: [agentMessage.agentId],
        references: [userAgent.id],
    }),
}))

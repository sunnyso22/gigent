/** Drizzle schema for `agent_job` / `agent_job_bid` (formerly `marketplace-schema.ts`). */
import { relations } from "drizzle-orm"
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "./auth-schema"

export const agentJob = pgTable(
    "agent_job",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        description: text("description").notNull(),
        requiredModelId: text("required_model_id").notNull(),
        rewardAmount: text("reward_amount").notNull(),
        rewardCurrency: text("reward_currency").notNull(),
        status: text("status").notNull().default("open"),
        posterUserId: text("poster_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        assigneeUserId: text("assignee_user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        /** Set when a bid is accepted; not a DB FK to avoid circular DDL. */
        acceptedBidId: text("accepted_bid_id"),
        /** Structured delivery: text / image / file blocks (JSON). */
        deliveryPayload: jsonb("delivery_payload").$type<Record<
            string,
            unknown
        > | null>(),
        deliveredAt: timestamp("delivered_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("agent_job_poster_idx").on(table.posterUserId),
        index("agent_job_model_idx").on(table.requiredModelId),
        index("agent_job_status_idx").on(table.status),
    ]
)

export const agentJobBid = pgTable(
    "agent_job_bid",
    {
        id: text("id").primaryKey(),
        jobId: text("job_id")
            .notNull()
            .references(() => agentJob.id, { onDelete: "cascade" }),
        bidderUserId: text("bidder_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        amount: text("amount").notNull(),
        currency: text("currency").notNull(),
        status: text("status").notNull().default("pending"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("agent_job_bid_job_idx").on(table.jobId),
        index("agent_job_bid_bidder_idx").on(table.bidderUserId),
        uniqueIndex("agent_job_bid_job_bidder_unique").on(
            table.jobId,
            table.bidderUserId
        ),
    ]
)

export const agentJobRelations = relations(agentJob, ({ one, many }) => ({
    poster: one(user, {
        fields: [agentJob.posterUserId],
        references: [user.id],
    }),
    assignee: one(user, {
        fields: [agentJob.assigneeUserId],
        references: [user.id],
    }),
    bids: many(agentJobBid),
}))

export const agentJobBidRelations = relations(agentJobBid, ({ one }) => ({
    job: one(agentJob, {
        fields: [agentJobBid.jobId],
        references: [agentJob.id],
    }),
    bidder: one(user, {
        fields: [agentJobBid.bidderUserId],
        references: [user.id],
    }),
}))

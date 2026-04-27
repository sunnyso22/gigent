/** Drizzle schema for `agent_job` / `agent_job_bid` — ERC-8183 + app fields. */
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
        /** Long-form listing copy (editable in DB only; on-chain uses `acpDescription`). */
        description: text("description").notNull(),
        requiredModelId: text("required_model_id").notNull(),
        /** App workflow: open | funded | submitted | completed | rejected | expired */
        status: text("status").notNull().default("open"),
        clientUserId: text("client_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        providerUserId: text("provider_user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        acceptedBidId: text("accepted_bid_id"),
        deliveryPayload: jsonb("delivery_payload").$type<Record<
            string,
            unknown
        > | null>(),
        submittedAt: timestamp("submitted_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        providerPayoutAddress: text("provider_payout_address"),
        /** On-chain job id (uint256 as string); null until `createJob` is confirmed. */
        acpJobId: text("acp_job_id"),
        acpChainId: text("acp_chain_id").notNull().default("2368"),
        acpContractAddress: text("acp_contract_address"),
        acpClientAddress: text("acp_client_address"),
        acpProviderAddress: text("acp_provider_address"),
        acpEvaluatorAddress: text("acp_evaluator_address"),
        acpDescription: text("acp_description"),
        /** Escrow budget in payment token wei (string integer). */
        acpBudget: text("acp_budget"),
        acpExpiresAt: timestamp("acp_expires_at", { withTimezone: true }),
        /** Mirror of chain JobStatus: open | funded | submitted | completed | rejected | expired */
        acpStatus: text("acp_status"),
        acpHookAddress: text("acp_hook_address"),
        /** bytes32 hex from on-chain `submit`. */
        deliverableCommitment: text("deliverable_commitment"),
        lastChainSyncAt: timestamp("last_chain_sync_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("agent_job_client_idx").on(table.clientUserId),
        index("agent_job_model_idx").on(table.requiredModelId),
        index("agent_job_status_idx").on(table.status),
        index("agent_job_acp_job_idx").on(table.acpJobId),
    ]
)

export const agentJobBid = pgTable(
    "agent_job_bid",
    {
        id: text("id").primaryKey(),
        jobId: text("job_id")
            .notNull()
            .references(() => agentJob.id, { onDelete: "cascade" }),
        providerUserId: text("provider_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        amount: text("amount").notNull(),
        currency: text("currency").notNull(),
        status: text("status").notNull().default("pending"),
        providerWalletAddress: text("provider_wallet_address"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("agent_job_bid_job_idx").on(table.jobId),
        index("agent_job_bid_provider_idx").on(table.providerUserId),
        uniqueIndex("agent_job_bid_job_provider_unique").on(
            table.jobId,
            table.providerUserId
        ),
    ]
)

export const agentJobRelations = relations(agentJob, ({ one, many }) => ({
    client: one(user, {
        fields: [agentJob.clientUserId],
        references: [user.id],
    }),
    provider: one(user, {
        fields: [agentJob.providerUserId],
        references: [user.id],
    }),
    bids: many(agentJobBid),
}))

export const agentJobBidRelations = relations(agentJobBid, ({ one }) => ({
    job: one(agentJob, {
        fields: [agentJobBid.jobId],
        references: [agentJob.id],
    }),
    provider: one(user, {
        fields: [agentJobBid.providerUserId],
        references: [user.id],
    }),
}))

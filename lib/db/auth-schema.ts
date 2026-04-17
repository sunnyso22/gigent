import { relations } from "drizzle-orm"
import {
    pgTable,
    primaryKey,
    text,
    timestamp,
    boolean,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core"

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
})

/** One verified EVM address per app user per chain (e.g. Base Sepolia for x402 MVP). */
export const userWallet = pgTable(
    "user_wallet",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** CAIP-2 style e.g. eip155:84532 */
        chainId: text("chain_id").notNull(),
        address: text("address").notNull(),
        verifiedAt: timestamp("verified_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.chainId] }),
        uniqueIndex("user_wallet_chain_address_unique").on(
            table.chainId,
            table.address
        ),
        index("user_wallet_chain_idx").on(table.chainId),
    ]
)

/** Ephemeral SIWE-style link challenge (nonce + expiry). */
export const walletLinkChallenge = pgTable(
    "wallet_link_challenge",
    {
        userId: text("user_id")
            .primaryKey()
            .references(() => user.id, { onDelete: "cascade" }),
        nonce: text("nonce").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("wallet_link_challenge_expires_idx").on(table.expiresAt)]
)

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
    },
    (table) => [index("session_userId_idx").on(table.userId)]
)

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("verification_identifier_idx").on(table.identifier)]
)

/** Encrypted Vercel AI Gateway API key (BYOK); ciphertext is AES-256-GCM payload. */
export const userAiGatewayKey = pgTable("user_ai_gateway_key", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    keyLast4: text("key_last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
})

export const userRelations = relations(user, ({ many, one }) => ({
    sessions: many(session),
    accounts: many(account),
    aiGatewayKey: one(userAiGatewayKey, {
        fields: [user.id],
        references: [userAiGatewayKey.userId],
    }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}))

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}))

export const userAiGatewayKeyRelations = relations(
    userAiGatewayKey,
    ({ one }) => ({
        user: one(user, {
            fields: [userAiGatewayKey.userId],
            references: [user.id],
        }),
    })
)

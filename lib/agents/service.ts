import { and, asc, desc, eq } from "drizzle-orm"
import type { UIMessage } from "ai"

import { hasUserAiGatewayApiKey } from "@/lib/ai-gateway"
import { db } from "@/lib/db"
import { agentMessage, userAgent } from "@/lib/db/schema"

const normalizeMessageForCompare = (m: UIMessage) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
    metadata: m.metadata ?? null,
})

const messagesPayloadEqual = (a: UIMessage[], b: UIMessage[]) => {
    if (a.length !== b.length) {
        return false
    }
    return (
        JSON.stringify(a.map(normalizeMessageForCompare)) ===
        JSON.stringify(b.map(normalizeMessageForCompare))
    )
}

const agentMetaEqual = (
    a: { title: string | null; modelId: string | null },
    b: { title: string | null; modelId: string | null }
) =>
    (a.title ?? null) === (b.title ?? null) &&
    (a.modelId ?? null) === (b.modelId ?? null)

export type UserAgentSummary = {
    id: string
    title: string | null
    modelId: string | null
    updatedAt: Date
}

export const listUserAgents = async (
    userId: string
): Promise<UserAgentSummary[]> => {
    return db
        .select({
            id: userAgent.id,
            title: userAgent.title,
            modelId: userAgent.modelId,
            updatedAt: userAgent.updatedAt,
        })
        .from(userAgent)
        .where(eq(userAgent.userId, userId))
        .orderBy(desc(userAgent.updatedAt), desc(userAgent.createdAt))
}

export const getAgentForUser = async (
    userId: string,
    agentId: string
): Promise<UserAgentSummary | null> => {
    const rows = await db
        .select({
            id: userAgent.id,
            title: userAgent.title,
            modelId: userAgent.modelId,
            updatedAt: userAgent.updatedAt,
        })
        .from(userAgent)
        .where(
            and(eq(userAgent.id, agentId), eq(userAgent.userId, userId))
        )
        .limit(1)
    return rows[0] ?? null
}

/** Loads messages for `agentId`. Only call after access is verified (e.g. `getAgentForUser`). */
export const listAgentMessagesForAgentId = async (
    agentId: string
): Promise<UIMessage[]> => {
    const rows = await db
        .select({
            id: agentMessage.id,
            role: agentMessage.role,
            parts: agentMessage.parts,
            metadata: agentMessage.metadata,
        })
        .from(agentMessage)
        .where(eq(agentMessage.agentId, agentId))
        .orderBy(asc(agentMessage.createdAt))

    return rows.map((row) => ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: row.parts as UIMessage["parts"],
        ...(row.metadata != null
            ? { metadata: row.metadata as UIMessage["metadata"] }
            : {}),
    }))
}

export const getAgentMessages = async (
    userId: string,
    agentId: string
): Promise<UIMessage[] | null> => {
    const agent = await getAgentForUser(userId, agentId)
    if (!agent) {
        return null
    }
    return listAgentMessagesForAgentId(agentId)
}

export type UpsertAgentResult =
    | { ok: true }
    | {
          ok: false
          error: "forbidden" | "invalid_messages" | "no_api_key"
      }

/** Without a gateway API key there is no valid model run; do not persist agent rows or messages. */
export const upsertAgentWithMessages = async (input: {
    userId: string
    agentId: string
    title: string | null
    modelId: string | null
    messages: UIMessage[]
}): Promise<UpsertAgentResult> => {
    if (!Array.isArray(input.messages)) {
        return { ok: false, error: "invalid_messages" }
    }

    if (!(await hasUserAiGatewayApiKey(input.userId))) {
        return { ok: false, error: "no_api_key" }
    }

    const existingRows = await db
        .select({
            userId: userAgent.userId,
            title: userAgent.title,
            modelId: userAgent.modelId,
        })
        .from(userAgent)
        .where(eq(userAgent.id, input.agentId))
        .limit(1)

    const existing = existingRows[0]

    if (existing && existing.userId !== input.userId) {
        return { ok: false, error: "forbidden" }
    }

    if (existing) {
        const prevMessages = await listAgentMessagesForAgentId(input.agentId)

        const sameMessages = messagesPayloadEqual(prevMessages, input.messages)
        const sameMeta = agentMetaEqual(
            { title: existing.title, modelId: existing.modelId },
            { title: input.title, modelId: input.modelId }
        )

        if (sameMessages && sameMeta) {
            return { ok: true }
        }

        if (sameMessages && !sameMeta) {
            await db
                .update(userAgent)
                .set({
                    title: input.title,
                    modelId: input.modelId,
                })
                .where(eq(userAgent.id, input.agentId))
            return { ok: true }
        }
    }

    await db.transaction(async (tx) => {
        if (existing) {
            await tx
                .update(userAgent)
                .set({
                    title: input.title,
                    modelId: input.modelId,
                    updatedAt: new Date(),
                })
                .where(eq(userAgent.id, input.agentId))
        } else {
            await tx.insert(userAgent).values({
                id: input.agentId,
                userId: input.userId,
                title: input.title,
                modelId: input.modelId,
            })
        }

        await tx
            .delete(agentMessage)
            .where(eq(agentMessage.agentId, input.agentId))

        if (input.messages.length > 0) {
            await tx.insert(agentMessage).values(
                input.messages.map((m) => ({
                    id: m.id,
                    agentId: input.agentId,
                    role: m.role,
                    parts: m.parts,
                    metadata: m.metadata ?? null,
                }))
            )
        }
    })

    return { ok: true }
}

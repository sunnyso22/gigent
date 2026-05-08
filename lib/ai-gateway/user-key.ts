import { eq } from "drizzle-orm"

import { aiGatewayKey } from "@/lib/db/auth-schema"
import { db } from "@/lib/db"
import { decryptAiGatewayApiKey, encryptAiGatewayApiKey } from "@/lib/ai-gateway/crypto"

export const hasUserAiGatewayApiKey = async (
    userId: string
): Promise<boolean> => {
    const row = await getMaskedUserAiGatewayKey(userId)
    return row !== null
}

export const getMaskedUserAiGatewayKey = async (
    userId: string
): Promise<{ keyLast4: string } | null> => {
    const rows = await db
        .select({ keyLast4: aiGatewayKey.keyLast4 })
        .from(aiGatewayKey)
        .where(eq(aiGatewayKey.userId, userId))
        .limit(1)
    return rows[0] ?? null
}

export const getDecryptedUserAiGatewayApiKey = async (
    userId: string
): Promise<string | null> => {
    const rows = await db
        .select({ ciphertext: aiGatewayKey.ciphertext })
        .from(aiGatewayKey)
        .where(eq(aiGatewayKey.userId, userId))
        .limit(1)
    const row = rows[0]
    if (!row) {
        return null
    }
    return decryptAiGatewayApiKey(row.ciphertext)
}

export const upsertUserAiGatewayApiKey = async ({
    userId,
    apiKey,
}: {
    userId: string
    apiKey: string
}) => {
    const trimmed = apiKey.trim()
    const keyLast4 =
        trimmed.length <= 4 ? trimmed : trimmed.slice(-4)
    const ciphertext = encryptAiGatewayApiKey(trimmed)
    await db
        .insert(aiGatewayKey)
        .values({
            userId,
            ciphertext,
            keyLast4,
        })
        .onConflictDoUpdate({
            target: aiGatewayKey.userId,
            set: {
                ciphertext,
                keyLast4,
                updatedAt: new Date(),
            },
        })
}

export const deleteUserAiGatewayApiKey = async (userId: string) => {
    await db
        .delete(aiGatewayKey)
        .where(eq(aiGatewayKey.userId, userId))
}

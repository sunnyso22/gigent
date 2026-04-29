import {
    deleteUserAiGatewayApiKey,
    getMaskedUserAiGatewayKey,
    isValidAiGatewayApiKeyFormat,
    upsertUserAiGatewayApiKey,
} from "@/lib/ai-gateway"

export const getAiGatewaySettingsState = async (userId: string) => {
    const row = await getMaskedUserAiGatewayKey(userId)
    return {
        configured: Boolean(row),
        keyLast4: row?.keyLast4 ?? null,
    }
}

export const saveUserAiGatewayKey = async (userId: string, apiKey: string) => {
    const trimmed = apiKey.trim()
    if (trimmed.length === 0) {
        return { ok: false as const, error: "apiKey is required" }
    }
    if (!isValidAiGatewayApiKeyFormat(trimmed)) {
        return {
            ok: false as const,
            error: "apiKey must be a Vercel AI Gateway key (starts with vck_).",
        }
    }
    if (trimmed.length > 2048) {
        return { ok: false as const, error: "apiKey is too long" }
    }

    try {
        await upsertUserAiGatewayApiKey({ userId, apiKey: trimmed })
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save key"
        console.error("[saveUserAiGatewayKey]", e)
        return { ok: false as const, error: message }
    }

    const row = await getMaskedUserAiGatewayKey(userId)
    return {
        ok: true as const,
        configured: true as const,
        keyLast4: row?.keyLast4 ?? null,
    }
}

export const removeUserAiGatewayKey = async (userId: string) => {
    await deleteUserAiGatewayApiKey(userId)
}

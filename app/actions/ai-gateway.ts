"use server"

import {
    getAiGatewaySettingsState,
    removeUserAiGatewayKey,
    saveUserAiGatewayKey,
} from "@/lib/ai-gateway/settings-server"
import { getSession } from "@/lib/auth/session"

export const getAiGatewaySettingsAction = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    const data = await getAiGatewaySettingsState(session.user.id)
    return { ok: true as const, ...data }
}

export const saveAiGatewayApiKeyAction = async (apiKey: string) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    if (typeof apiKey !== "string") {
        return { ok: false as const, error: "apiKey must be a string" }
    }
    const result = await saveUserAiGatewayKey(session.user.id, apiKey)
    if (!result.ok) {
        return { ok: false as const, error: result.error }
    }
    return {
        ok: true as const,
        configured: result.configured,
        keyLast4: result.keyLast4,
    }
}

export const deleteAiGatewayApiKeyAction = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    await removeUserAiGatewayKey(session.user.id)
    return { ok: true as const, configured: false as const, keyLast4: null }
}

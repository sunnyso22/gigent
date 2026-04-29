import { jsonError, unauthorizedJson } from "@/lib/api-response"
import {
    getAiGatewaySettingsState,
    removeUserAiGatewayKey,
    saveUserAiGatewayKey,
} from "@/lib/ai-gateway/settings-server"
import { getSession } from "@/lib/auth/session"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const data = await getAiGatewaySettingsState(session.user.id)
    return Response.json(data)
}

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    let body: { apiKey?: unknown }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON body")
    }

    const raw = body.apiKey
    if (typeof raw !== "string") {
        return jsonError(400, "apiKey must be a string")
    }

    const result = await saveUserAiGatewayKey(session.user.id, raw)
    if (!result.ok) {
        const clientErrors = new Set([
            "apiKey is required",
            "apiKey must be a Vercel AI Gateway key (starts with vck_).",
            "apiKey is too long",
        ])
        const status = clientErrors.has(result.error) ? 400 : 500
        return jsonError(status, result.error)
    }

    return Response.json({
        configured: result.configured,
        keyLast4: result.keyLast4,
    })
}

export const DELETE = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    await removeUserAiGatewayKey(session.user.id)
    return Response.json({ configured: false, keyLast4: null })
}

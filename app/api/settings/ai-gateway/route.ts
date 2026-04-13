import { jsonError, unauthorizedJson } from "@/lib/api-response"
import {
    deleteUserAiGatewayApiKey,
    getMaskedUserAiGatewayKey,
    isValidAiGatewayApiKeyFormat,
    upsertUserAiGatewayApiKey,
} from "@/lib/ai-gateway"
import { getSession } from "@/lib/auth/session"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const row = await getMaskedUserAiGatewayKey(session.user.id)
    return Response.json({
        configured: Boolean(row),
        keyLast4: row?.keyLast4 ?? null,
    })
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

    const apiKey = raw.trim()
    if (apiKey.length === 0) {
        return jsonError(400, "apiKey is required")
    }
    if (!isValidAiGatewayApiKeyFormat(apiKey)) {
        return jsonError(
            400,
            "apiKey must be a Vercel AI Gateway key (starts with vck_).",
        )
    }
    if (apiKey.length > 2048) {
        return jsonError(400, "apiKey is too long")
    }

    try {
        await upsertUserAiGatewayApiKey({
            userId: session.user.id,
            apiKey,
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save key"
        console.error("[api/settings/ai-gateway POST]", e)
        return jsonError(500, message)
    }

    const row = await getMaskedUserAiGatewayKey(session.user.id)
    return Response.json({
        configured: true,
        keyLast4: row?.keyLast4 ?? null,
    })
}

export const DELETE = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    await deleteUserAiGatewayApiKey(session.user.id)
    return Response.json({ configured: false, keyLast4: null })
}

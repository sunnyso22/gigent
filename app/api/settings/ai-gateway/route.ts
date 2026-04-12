import { getSession } from "@/lib/auth/session"
import {
    deleteUserAiGatewayApiKey,
    getMaskedUserAiGatewayKey,
    upsertUserAiGatewayApiKey,
} from "@/lib/ai-gateway"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        })
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        })
    }

    let body: { apiKey?: unknown }
    try {
        body = await req.json()
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    const raw = body.apiKey
    if (typeof raw !== "string") {
        return new Response(JSON.stringify({ error: "apiKey must be a string" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    const apiKey = raw.trim()
    if (apiKey.length === 0) {
        return new Response(JSON.stringify({ error: "apiKey is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }
    if (apiKey.length > 2048) {
        return new Response(JSON.stringify({ error: "apiKey is too long" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    try {
        await upsertUserAiGatewayApiKey({
            userId: session.user.id,
            apiKey,
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save key"
        console.error("[api/settings/ai-gateway POST]", e)
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        })
    }

    await deleteUserAiGatewayApiKey(session.user.id)
    return Response.json({ configured: false, keyLast4: null })
}

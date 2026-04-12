import { createGatewayProvider } from "@ai-sdk/gateway"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { getSession } from "@/lib/auth/session"
import {
    DEFAULT_CHAT_MODEL_ID,
    isChatModelId,
    type ChatModelId,
} from "@/lib/chat/models"
import {
    getDecryptedUserAiGatewayApiKey,
    hasUserAiGatewayApiKey,
} from "@/lib/ai-gateway"

export const maxDuration = 60

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        })
    }

    let body: { messages: UIMessage[]; model?: string }

    try {
        body = await req.json()
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    const { messages, model: modelFromBody } = body

    if (!Array.isArray(messages)) {
        return new Response(
            JSON.stringify({ error: "messages must be an array" }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        )
    }

    const modelId: ChatModelId = isChatModelId(modelFromBody)
        ? modelFromBody
        : DEFAULT_CHAT_MODEL_ID

    if (!(await hasUserAiGatewayApiKey(session.user.id))) {
        return new Response(
            JSON.stringify({
                error: "Add your Vercel AI Gateway API key in /settings before chatting.",
            }),
            {
                status: 403,
                headers: { "Content-Type": "application/json" },
            }
        )
    }

    const userApiKey = await getDecryptedUserAiGatewayApiKey(session.user.id)
    if (!userApiKey) {
        return new Response(
            JSON.stringify({
                error: "Could not load your API key. Try saving it again in /settings.",
            }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            }
        )
    }

    const gatewayModel = createGatewayProvider({ apiKey: userApiKey })(modelId)

    try {
        const result = streamText({
            model: gatewayModel,
            messages: await convertToModelMessages(messages),
            providerOptions: {
                gateway: {
                    user: session.user.id,
                    tags: ["feature:chat"],
                },
            },
        })

        return result.toUIMessageStreamResponse()
    } catch (err) {
        console.error("[api/chat]", err)
        return new Response(
            JSON.stringify({
                error: "Failed to start model stream",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}

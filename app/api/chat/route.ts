import { convertToModelMessages, streamText, type UIMessage } from "ai"

import {
    DEFAULT_CHAT_MODEL_ID,
    isChatModelId,
    type ChatModelId,
} from "@/lib/chat-models"

export const maxDuration = 60

export const POST = async (req: Request) => {
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

    const model: ChatModelId = isChatModelId(modelFromBody)
        ? modelFromBody
        : DEFAULT_CHAT_MODEL_ID

    try {
        const result = streamText({
            model,
            messages: await convertToModelMessages(messages),
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

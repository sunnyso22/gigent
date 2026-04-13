import { createGatewayProvider } from "@ai-sdk/gateway"
import {
    convertToModelMessages,
    stepCountIs,
    streamText,
    type UIMessage,
} from "ai"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { createMarketplaceTools } from "@/lib/marketplace/jbs"
import {
    DEFAULT_CHAT_MODEL_ID,
    isChatModelId,
    type ChatModelId,
} from "@/lib/chat/models"
import {
    getDecryptedUserAiGatewayApiKey,
    hasUserAiGatewayApiKey,
} from "@/lib/ai-gateway"

export const maxDuration = 120

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    let body: { messages: UIMessage[]; model?: string }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON body")
    }

    const { messages, model: modelFromBody } = body

    if (!Array.isArray(messages)) {
        return jsonError(400, "messages must be an array")
    }

    const modelId: ChatModelId = isChatModelId(modelFromBody)
        ? modelFromBody
        : DEFAULT_CHAT_MODEL_ID

    if (!(await hasUserAiGatewayApiKey(session.user.id))) {
        return jsonError(
            403,
            "Add your Vercel AI Gateway API key in /settings before chatting."
        )
    }

    const userApiKey = await getDecryptedUserAiGatewayApiKey(session.user.id)
    if (!userApiKey) {
        return jsonError(
            503,
            "Could not load your API key. Try saving it again in /settings."
        )
    }

    const gatewayModel = createGatewayProvider({ apiKey: userApiKey })(modelId)

    const marketplaceTools = createMarketplaceTools(session.user.id)

    try {
        const result = streamText({
            model: gatewayModel,
            messages: await convertToModelMessages(messages),
            tools: marketplaceTools,
            stopWhen: stepCountIs(28),
            system: `You are the user's agent in the Agents workspace. You have marketplace_* tools to create and search Agent Jobs using structured filters (keywords, status, modelContains, posterNameContains, reward bounds + currency). "Bid accepted" jobs use status assigned. Use modelContains for partial model names, not only exactRequiredModelId. Update open jobs you posted (title, description, model, reward), place at most one bid per job per user (withdraw first to change amount), withdraw your own pending bids on open jobs, list bids, accept a bid as poster. To finish an assigned job, build file URLs then submit: (1) marketplace_uploadDeliveryTextFile — UTF-8 source files (html, css, js, md, json, svg, xml, etc.) via content string. (2) marketplace_generateDeliveryImage — raster image from prompt only (AI Gateway image model). (3) marketplace_generateDeliveryPdf — simple PDF from title + body text. (4) marketplace_uploadDeliveryFile — any binary (including pre-built PDF, zip, png bytes) as standard base64. Then marketplace_submitDelivery with deliveryPayload: { blocks: [ { type: "text", body: "..." }, { type: "file", name, mimeType, url: "https://..." } ] } — raster images use type file with image/* mimeType. All file URLs must be https. Confirm completion as poster. Reward amounts are placeholder (USDC/ETH) until payments exist. Use tools to act; then summarize results clearly.`,
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
        return jsonError(500, "Failed to start model stream")
    }
}

import { createGatewayProvider } from "@ai-sdk/gateway"
import {
    convertToModelMessages,
    stepCountIs,
    streamText,
    type UIMessage,
} from "ai"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { createAgentJobTools } from "@/lib/agent-jobs/agent-tools"
import {
    DEFAULT_CHAT_MODEL_ID,
    isChatModelId,
    type ChatModelId,
} from "@/lib/agents/models"
import { getDecryptedUserAiGatewayApiKey } from "@/lib/ai-gateway"

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

    const [userApiKey, modelMessages] = await Promise.all([
        getDecryptedUserAiGatewayApiKey(session.user.id),
        convertToModelMessages(messages),
    ])

    if (!userApiKey) {
        return jsonError(
            403,
            "Add your Vercel AI Gateway API key in /settings before chatting."
        )
    }

    const gatewayModel = createGatewayProvider({ apiKey: userApiKey })(modelId)

    const agentJobTools = createAgentJobTools(session.user.id)

    try {
        const result = streamText({
            model: gatewayModel,
            messages: modelMessages,
            tools: agentJobTools,
            stopWhen: stepCountIs(28),
            system: `You are the user's agent in the Agents workspace. You have job_* and bid_* tools for the Marketplace.

**Status pending_review:** Always means the assignee has **already submitted** their delivery. Never tell the poster the assignee still needs to submit or that delivery is "not in yet" when status is pending_review.

**Poster viewing:** Pay-to-view (USDC, x402, Base Sepolia) only gates **visibility** of the delivery for the poster. After payment is settled, the poster can use job_review **any time** to read the submission. job_complete is for when the poster confirms they accept the work after reviewing.

**Pay-to-view automation:** The Agents UI runs the x402 payment automatically after job_pay_to_view returns paymentRequired (wallet confirmation only). When the user message states that **x402 pay-to-view just settled** for a job id, **immediately** call **job_review** for that job and present the delivery—do not ask them to type again.

**Wallet:** Link a Base Sepolia wallet in **Settings** before accepting bids (assignee payout) and before paying to view delivery.

**Poster tools:** job_create, job_update, job_cancel (open jobs only), job_search, job_list_mine, job_get, job_review, job_pay_to_view, bid_list_for_job, bid_accept. If pending_review and payment unsettled: call job_pay_to_view; the client completes payment, then job_review shows content (or the next user message may be the automation that pay-to-view settled—call job_review then).

**Bidder tools:** job_search, job_get, bid_place, bid_update, bid_withdraw, bid_list_mine, bid_status. When assigned: job_submit (sets pending_review when done).

Filters: "open" vs "assigned"; modelContains for partial model ids; reward filters need rewardCurrency. Pay-to-view amount = accepted USDC bid.

Use tools to act; then summarize results clearly.`,
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

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
            system: `You are the user's agent in the Agents workspace. You have job_* and bid_* tools for the Marketplace (ERC-8183 Agentic Commerce on **Kite Testnet**, chain id **2368**, USDT).

**Roles:** **Client** creates and funds jobs; **Provider** bids and delivers. Evaluator on-chain is the client wallet.

**App status submitted:** The provider has **already saved** off-chain delivery. Never say they still need to submit.

**Delivery visibility:** The client sees delivery content only after on-chain status is **submitted** (or terminal). The provider always sees their own submission when allowed. No HTTP paywall.

**Wallet:** Link a **Kite Testnet** wallet (eip155:2368) in **Settings** before bid_accept (provider payout address) and for all contract txs (createJob, setBudget, setProvider, fund, submit, complete, reject).

**On-chain immutability:** After createJob, contract fields (description, budget, expiry, hook, etc.) cannot be edited. job_update only applies to DB listing fields **before** acp_job_id exists; otherwise return the immutability guidance and suggest job_reject (when the chain allows) then job_create.

**Client tools:** job_create, job_update, job_reject, job_sync_chain, job_search, job_list_mine, job_get, job_review, job_complete, bid_list_for_job, bid_accept.

**Provider tools:** job_search, job_get, job_sync_chain, bid_place, bid_update, bid_withdraw, bid_list_mine, bid_status. When job is funded: job_submit (saves delivery + deliverableCommitment; wallet must call submit on-chain).

**Tx flow (client):** createJob → setBudget(initial) → accept bid off-chain / on-chain setProvider + setBudget(final) + fund → after provider submit: complete or reject. Use job_sync_chain after receipts.

**Status questions:** Do not infer job or bid status only from earlier chat. When the user asks about a job’s current state and you have (or can find) its id, call **job_get** (refreshes chain-mirrored fields when the job is on-chain). Use **bid_status** for your bids; use **job_get** for the job’s authoritative status.

Filters: status open vs funded vs submitted; modelContains; budget filters use USDT amounts.

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

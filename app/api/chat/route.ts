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
import { getAddress, type Address } from "viem"

export const maxDuration = 120

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    let body: { messages: UIMessage[]; model?: string; kiteWalletAddress?: string }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON body")
    }

    const { messages, model: modelFromBody, kiteWalletAddress: rawWallet } =
        body

    const rawKiteWallet =
        typeof rawWallet === "string" && rawWallet.trim()
            ? rawWallet.trim()
            : undefined

    if (!rawKiteWallet) {
        return jsonError(
            403,
            "Connect your wallet in the app header before using Agents."
        )
    }

    let kiteWalletAddress: string
    try {
        kiteWalletAddress = getAddress(rawKiteWallet as Address)
    } catch {
        return jsonError(
            400,
            "Invalid wallet address. Reconnect your wallet and try again."
        )
    }

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

    const agentJobTools = createAgentJobTools(session.user.id, {
        kiteWalletAddress,
    })

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

**Wallet:** The user must have their browser wallet **connected** before this chat runs; without it the request is rejected. Use a **Kite Testnet** wallet (chain **2368**) for contract calldata (createJob uses their address as evaluator) and for **bid_place** (records payout address). Other contract txs require the same wallet for signing.

**On-chain immutability:** After createJob, contract fields (description, budget, expiry, hook, etc.) cannot be edited. job_update only applies to DB listing fields **before** acp_job_id exists; otherwise return the immutability guidance and suggest job_reject (when the chain allows) then job_create.

**job_create wording:** Users often paste the full scope under **Job description** (see the “Create a job” shortcut)—that block is stored off-chain **and** drives the human-readable part of the on-chain description (the server adds a stable id tag). **\`job_create.description\` must be copied verbatim from the user’s job-description text**—same wording and structure aside from trimming leading/trailing whitespace around the whole block. Never summarize, shorten, rephrase, “clean up”, translate, or rearrange bullets in **\`description\`**. **\`title\`** is **off-chain only** (listing/search headline): derive a **short** label (about one line, ≤120 characters) from what they wrote—never substitute that shortened phrase for **\`description\`**.

**Client tools:** job_create, job_update, job_reject, job_sync_chain, job_search, job_list_mine, job_get, job_review, job_complete, bid_list_for_job, bid_accept.

**Provider tools:** job_search, job_get, job_sync_chain, bid_place, bid_update, bid_withdraw, bid_list_mine, bid_status. When job is funded: job_submit (saves delivery + deliverableCommitment; wallet must call submit on-chain).

**Tx flow (client):** createJob → setBudget(initial) → accept bid off-chain / on-chain setProvider + setBudget(final) + fund → after provider submit: complete or reject. Use job_sync_chain after receipts.

**Status questions:** Do not infer job or bid status only from earlier chat. When the user asks about a job’s current state and you have (or can find) its id, call **job_get** (refreshes chain-mirrored fields when the job is on-chain). Use **bid_status** for your bids; use **job_get** for the job’s authoritative status.

Filters: status open vs funded vs submitted; budget filters use USDT amounts.

Use tools to act; then summarize results clearly.

**After wallet / on-chain tools:** The Agents UI runs wallet prompts automatically when tools return \`onChain\` calldata or \`onChain.steps\`. Users usually confirm transactions **before** they read your next reply—assume they already saw tx titles and counts in the wallet. Reply with a **brief outcome**: ids (job/bid), success vs blocked, and **only** what they should do next when needed (e.g. call **job_sync_chain** after broadcasts). Do **not** re-list each transaction, repeat “approve / setProvider / fund” breakdowns, paste hex/calldata, or give long signing tutorials unless something failed, is still pending, or the user asks for detail.`,
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

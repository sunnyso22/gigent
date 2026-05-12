import type { ChatModelId } from "@/lib/agents/models"

/** Passed from chat transport (connected Kite wallet, chat model) into job/bid tools. */
export type AgentJobToolsContext = {
    kiteWalletAddress?: string | null
    /** Selected Agents chat model — used for job_review evaluation. */
    chatModelId?: ChatModelId
}

import { getToolName, isToolUIPart, type UIMessage } from "ai"

import type { OnChainStepsBundle } from "@/lib/agent-jobs/onchain-tx-payloads"

const STEP_TOOLS = [
    "bid_accept",
    "job_submit",
    "job_complete",
    "job_reject",
    "job_claim_refund",
] as const

type StepToolName = (typeof STEP_TOOLS)[number]

type StepToolOutput = {
    success?: boolean
    /** Published Job ID (decimal) when set—pass-through for wallet preflight. */
    jobId?: string | null
    /** Unpublished listing row id (UUID)—legacy / edge; wallet preflight accepts either. */
    listingId?: string
    onChain?: OnChainStepsBundle | { error?: string }
}

const isStepsBundle = (v: unknown): v is OnChainStepsBundle => {
    if (!v || typeof v !== "object" || !("steps" in v)) {
        return false
    }
    const o = v as OnChainStepsBundle
    if (!Array.isArray(o.steps) || o.steps.length === 0) {
        return false
    }
    if ("error" in o && typeof (o as { error?: string }).error === "string") {
        return false
    }
    if (typeof o.chainId !== "number" || typeof o.commerceAddress !== "string") {
        return false
    }
    return o.steps.every(
        (s) =>
            s &&
            typeof s.label === "string" &&
            typeof s.to === "string" &&
            s.to.startsWith("0x") &&
            typeof s.data === "string" &&
            s.data.startsWith("0x")
    )
}

/** Latest tool result that includes sequential wallet calldata (`onChain.steps`). */
export const extractLatestOnChainStepsFromMessages = (
    messages: UIMessage[]
): { jobId: string; bundle: OnChainStepsBundle; toolName: StepToolName } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role !== "assistant") {
            continue
        }
        for (const p of m.parts) {
            if (!isToolUIPart(p)) {
                continue
            }
            const name = getToolName(p) as string
            if (!STEP_TOOLS.includes(name as StepToolName)) {
                continue
            }
            if (p.state !== "output-available") {
                continue
            }
            const out = p.output as StepToolOutput | null
            if (!out) {
                continue
            }
            const ref = out.jobId ?? out.listingId
            if (!ref || !isStepsBundle(out.onChain)) {
                continue
            }
            if (name === "bid_accept" || name === "job_submit") {
                if (out.success !== true) {
                    continue
                }
            }
            return {
                jobId: String(ref),
                bundle: out.onChain,
                toolName: name as StepToolName,
            }
        }
    }
    return null
}

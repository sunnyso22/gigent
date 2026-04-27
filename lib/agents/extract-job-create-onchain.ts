import { getToolName, isToolUIPart, type UIMessage } from "ai"

export type JobCreateOnChainPayload = {
    chainId: number
    commerceAddress: `0x${string}`
    createJobData: `0x${string}`
    /** Whole USDT for `setBudget` (legacy tool output used `initialBudgetWei`). */
    initialBudgetAmount: string
}

export type JobCreateToolOutput = {
    success?: boolean
    jobId?: string
    onChain?:
        | (JobCreateOnChainPayload & { error?: undefined })
        | { error: string }
    message?: string
}

/** Latest successful `job_create` tool result that includes wallet calldata. */
export const extractJobCreateOnChainFromMessages = (
    messages: UIMessage[]
): { jobId: string; onChain: JobCreateOnChainPayload } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role !== "assistant") {
            continue
        }
        for (const p of m.parts) {
            if (!isToolUIPart(p) || getToolName(p) !== "job_create") {
                continue
            }
            if (p.state !== "output-available") {
                continue
            }
            const out = p.output as JobCreateToolOutput | null
            if (!out?.success || !out.jobId || !out.onChain) {
                continue
            }
            if (typeof out.onChain === "object" && "error" in out.onChain) {
                continue
            }
            const oc = out.onChain as JobCreateOnChainPayload & {
                initialBudgetWei?: string
            }
            const initialBudgetAmount =
                typeof oc.initialBudgetAmount === "string"
                    ? oc.initialBudgetAmount
                    : typeof oc.initialBudgetWei === "string"
                      ? oc.initialBudgetWei
                      : null
            if (
                typeof oc.createJobData !== "string" ||
                !oc.createJobData.startsWith("0x") ||
                typeof oc.commerceAddress !== "string" ||
                initialBudgetAmount == null
            ) {
                continue
            }
            const chainId =
                typeof oc.chainId === "number"
                    ? oc.chainId
                    : Number.parseInt(String(oc.chainId), 10)
            if (!Number.isFinite(chainId)) {
                continue
            }
            return {
                jobId: String(out.jobId),
                onChain: {
                    chainId,
                    commerceAddress: oc.commerceAddress as `0x${string}`,
                    createJobData: oc.createJobData as `0x${string}`,
                    initialBudgetAmount,
                },
            }
        }
    }
    return null
}

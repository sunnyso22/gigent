import { getToolName, isToolUIPart, type UIMessage } from "ai"

export type PayToViewFromTool = {
    paymentRequired: true
    payPath: string
    amount: string
    currency: string
    network: string
    jobId?: string
}

const parsePayToViewOutput = (out: unknown): PayToViewFromTool | null => {
    if (
        out &&
        typeof out === "object" &&
        "paymentRequired" in out &&
        (out as { paymentRequired?: boolean }).paymentRequired === true &&
        typeof (out as { payPath?: unknown }).payPath === "string"
    ) {
        return out as PayToViewFromTool
    }
    return null
}

/** Scans only the most recent assistant message (avoids stale tool outputs from earlier turns). */
export const findPayToViewInLastAssistantMessage = (
    messages: UIMessage[]
): { payload: PayToViewFromTool; message: UIMessage } | null => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i]
        if (m.role !== "assistant") {
            continue
        }
        for (const p of m.parts) {
            if (!isToolUIPart(p) || getToolName(p) !== "job_pay_to_view") {
                continue
            }
            if (p.state !== "output-available") {
                continue
            }
            const payload = parsePayToViewOutput(p.output)
            if (payload) {
                return { payload, message: m }
            }
        }
        return null
    }
    return null
}

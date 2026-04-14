export const AGENT_JOB_STATUS_VALUES = [
    "open",
    "assigned",
    "pending_review",
    "completed",
    "cancelled",
] as const

export type AgentJobStatus = (typeof AGENT_JOB_STATUS_VALUES)[number]

/** Validates `status` search param for job listing; unknown values → `"all"`. */
export const parseAgentJobStatusFilter = (
    raw: string | undefined | null
): AgentJobStatus | "all" => {
    if (raw == null || raw === "") {
        return "all"
    }
    const t = raw.trim().toLowerCase()
    if (t === "" || t === "all") {
        return "all"
    }
    if ((AGENT_JOB_STATUS_VALUES as readonly string[]).includes(t)) {
        return t as AgentJobStatus
    }
    return "all"
}

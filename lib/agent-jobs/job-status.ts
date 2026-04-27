export const AGENT_JOB_STATUS_VALUES = [
    "open",
    "funded",
    "submitted",
    "completed",
    "rejected",
    "expired",
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
    if (t === "cancelled") {
        return "rejected"
    }
    /** Legacy URLs / bookmarks */
    if (t === "assigned") {
        return "funded"
    }
    if (t === "pending_review") {
        return "submitted"
    }
    if ((AGENT_JOB_STATUS_VALUES as readonly string[]).includes(t)) {
        return t as AgentJobStatus
    }
    return "all"
}

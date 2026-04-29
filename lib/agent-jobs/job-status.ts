export const AGENT_JOB_STATUS_VALUES = [
    "open",
    "funded",
    "submitted",
    "completed",
    "rejected",
    "expired",
] as const

export type AgentJobStatus = (typeof AGENT_JOB_STATUS_VALUES)[number]

/** Human-readable labels for job workflow states (filters, marketplace UI). */
export const AGENT_JOB_STATUS_LABELS = {
    open: "Open",
    funded: "Funded",
    submitted: "Submitted",
    completed: "Completed",
    rejected: "Rejected",
    expired: "Expired",
} satisfies Record<AgentJobStatus, string>

export const formatAgentJobStatusLabel = (status: string): string => {
    const k = status.trim().toLowerCase()
    return (AGENT_JOB_STATUS_VALUES as readonly string[]).includes(k)
        ? AGENT_JOB_STATUS_LABELS[k as AgentJobStatus]
        : status
}

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

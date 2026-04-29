import {
    getAgentJobById,
    linkDbJobToAcpJobId,
    syncAgentJobFromChainByDbId,
} from "@/lib/agent-jobs/service"

export const syncJobFromChainForUser = async (
    userId: string,
    jobId: string
) => {
    const job = await getAgentJobById(jobId)
    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }

    const allowed =
        job.clientUserId === userId || job.providerUserId === userId

    if (!allowed) {
        return {
            ok: false as const,
            error: "Only the client or provider can sync this job",
        }
    }

    const result = await syncAgentJobFromChainByDbId(jobId)
    if (!result.ok) {
        return { ok: false as const, error: result.error }
    }

    const next = await getAgentJobById(jobId)
    return { ok: true as const, job: next }
}

export const linkJobToAcpForUser = async (
    userId: string,
    jobId: string,
    acpJobId: string,
    clientWalletAddress: string
) => {
    const trimmed = acpJobId.trim()
    if (!trimmed) {
        return { ok: false as const, error: "acpJobId is required" }
    }

    const result = await linkDbJobToAcpJobId({
        userId,
        jobId,
        acpJobId: trimmed,
        clientWalletAddress,
    })

    if (!result.ok) {
        return { ok: false as const, error: result.error }
    }

    return { ok: true as const }
}

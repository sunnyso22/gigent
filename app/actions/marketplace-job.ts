"use server"

import { getJobWithBidsForViewer } from "@/lib/agent-jobs/job-for-viewer"
import {
    linkJobToAcpForUser,
    syncJobFromChainForUser,
} from "@/lib/agent-jobs/participant-chain"
import { getSession } from "@/lib/auth/session"

export const getMarketplaceJobWithBidsAction = async (jobId: string) => {
    const session = await getSession()
    const viewerId = session?.user?.id ?? null
    const data = await getJobWithBidsForViewer(jobId, viewerId)
    if (!data) {
        return { ok: false as const, error: "not_found" as const }
    }
    return { ok: true as const, job: data.job, bids: data.bids }
}

export const linkJobToAcpAction = async (input: {
    jobId: string
    acpJobId: string
    clientWalletAddress: string
}) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    const result = await linkJobToAcpForUser(
        session.user.id,
        input.jobId,
        input.acpJobId,
        input.clientWalletAddress
    )
    if (!result.ok) {
        return { ok: false as const, error: result.error }
    }
    return { ok: true as const }
}

export const syncMarketplaceJobFromChainAction = async (jobId: string) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "Unauthorized" }
    }
    const result = await syncJobFromChainForUser(session.user.id, jobId)
    if (!result.ok) {
        return { ok: false as const, error: result.error }
    }
    return { ok: true as const, job: result.job }
}

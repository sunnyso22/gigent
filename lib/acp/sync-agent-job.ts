import { eq } from "drizzle-orm"
import { zeroHash } from "viem"

import { job as jobTable } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { resolveAgentJobDbId } from "@/lib/agent-jobs/resolve-job-db-id"

import { AGENTIC_COMMERCE_ADDRESS } from "./constants"
import { readAcpJob } from "./read-job"

const ZERO = "0x0000000000000000000000000000000000000000"

const addrOrNull = (a: string): string | null => {
    const s = typeof a === "string" ? a.toLowerCase() : String(a).toLowerCase()
    return s === ZERO ? null : s
}

export const syncAgentJobFromChainByDbId = async (jobId: string) => {
    const dbJobId = await resolveAgentJobDbId(jobId)
    if (!dbJobId) {
        return { ok: false as const, error: "Job not found" }
    }

    const [row] = await db
        .select()
        .from(jobTable)
        .where(eq(jobTable.id, dbJobId))
        .limit(1)

    if (!row) {
        return { ok: false as const, error: "Job not found" }
    }
    if (!row.acpJobId) {
        return { ok: false as const, error: "No Job ID yet—publish the job on Kite first" }
    }

    let j
    try {
        j = await readAcpJob(BigInt(row.acpJobId))
    } catch (e) {
        return {
            ok: false as const,
            error: e instanceof Error ? e.message : "Chain read failed",
        }
    }

    const statusLower = j.acpStatusLabel.toLowerCase()
    const now = new Date()

    const terminalReasonLower =
        statusLower === "completed" || statusLower === "rejected"
            ? j.reason.toLowerCase()
            : null
    const patch: Partial<typeof jobTable.$inferInsert> = {
        acpClientAddress: addrOrNull(j.client),
        acpProviderAddress: addrOrNull(j.provider),
        acpEvaluatorAddress: addrOrNull(j.evaluator),
        acpDescription: j.description,
        acpBudget: j.budget.toString(),
        acpExpiresAt: new Date(Number(j.expiredAt) * 1000),
        acpStatus: statusLower,
        acpHookAddress: addrOrNull(String(j.hook)),
        acpContractAddress: AGENTIC_COMMERCE_ADDRESS.toLowerCase(),
        lastChainSyncAt: now,
        updatedAt: now,
        acpEvaluationReason:
            terminalReasonLower != null &&
            terminalReasonLower !== zeroHash.toLowerCase()
                ? terminalReasonLower
                : null,
    }

    if (statusLower === "completed") {
        patch.status = "completed"
        if (!row.completedAt) {
            patch.completedAt = now
        }
    } else if (statusLower === "rejected") {
        patch.status = "rejected"
    } else if (statusLower === "expired") {
        patch.status = "expired"
    }

    await db.update(jobTable).set(patch).where(eq(jobTable.id, dbJobId))

    return { ok: true as const }
}

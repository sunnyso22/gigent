import { eq } from "drizzle-orm"

import { agentJob } from "@/lib/db/schema"
import { db } from "@/lib/db"

import { AGENTIC_COMMERCE_ADDRESS } from "./constants"
import { readAcpJob } from "./read-job"

const ZERO = "0x0000000000000000000000000000000000000000"

const addrOrNull = (a: string): string | null => {
    const s = typeof a === "string" ? a.toLowerCase() : String(a).toLowerCase()
    return s === ZERO ? null : s
}

export const syncAgentJobFromChainByDbId = async (dbJobId: string) => {
    const [row] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, dbJobId))
        .limit(1)

    if (!row) {
        return { ok: false as const, error: "Job not found" }
    }
    if (!row.acpJobId) {
        return { ok: false as const, error: "Job has no on-chain id yet" }
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

    const patch: Partial<typeof agentJob.$inferInsert> = {
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

    await db.update(agentJob).set(patch).where(eq(agentJob.id, dbJobId))

    return { ok: true as const }
}

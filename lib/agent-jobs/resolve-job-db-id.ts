import { eq, or, type SQL } from "drizzle-orm"

import { job as jobTable } from "@/lib/db/schema"
import { db } from "@/lib/db"

/**
 * `job.id` uses UUIDs; a pure-decimal string may instead match the published
 * **Job ID** (`acp_job_id`, uint256 as decimal).
 */
export const jobTableLookupWhere = (raw: string): SQL | null => {
    const t = raw.trim()
    if (!t) {
        return null
    }
    if (/^\d+$/.test(t)) {
        return or(eq(jobTable.id, t), eq(jobTable.acpJobId, t))!
    }
    return eq(jobTable.id, t)
}

export const resolveAgentJobDbId = async (
    raw: string
): Promise<string | null> => {
    const w = jobTableLookupWhere(raw)
    if (!w) {
        return null
    }
    const [row] = await db
        .select({ id: jobTable.id })
        .from(jobTable)
        .where(w)
        .limit(1)
    return row?.id ?? null
}

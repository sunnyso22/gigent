import {
    type SQL,
    and,
    desc,
    eq,
    ilike,
    inArray,
    ne,
    or,
    sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import {
    AGENTIC_COMMERCE_ADDRESS,
    DEFAULT_JOB_EXPIRY_SECONDS,
    KITE_TESTNET_CHAIN_ID,
} from "@/lib/acp/constants"
import { encodeAcpCreateJob } from "@/lib/acp/encode-calls"
import {
    buildGigentTaggedJobDescription,
    gigentJobTagPrefix,
} from "@/lib/acp/listing-description"
import { deliverableCommitmentBytes32 } from "@/lib/acp/deliverable-commitment"
import { syncAgentJobFromChainByDbId } from "@/lib/acp/sync-agent-job"
import { formatUsdtWei, usdtDecimalToWei } from "@/lib/acp/usdt-amount"
import { agentJob, agentJobBid, user } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { getAddress, zeroAddress, type Address } from "viem"

import { readAcpJob } from "@/lib/acp/read-job"

import {
    parseJobDeliveryPayload,
    parseJobDeliveryPayloadFromDb,
} from "./delivery/payload"
import { shouldExposeDeliveryFieldsToViewer } from "./delivery/visibility"
import type { AgentJobStatus } from "./job-status"

export { syncAgentJobFromChainByDbId } from "@/lib/acp/sync-agent-job"

export const JOB_ONCHAIN_IMMUTABLE_GUIDANCE =
    "Fields committed in Agentic Commerce (on-chain description, budget, expiry, hook, etc.) cannot be edited after createJob. When the chain allows, use job_reject to terminate this job, then job_create for a replacement listing."

const escapeIlikePattern = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")

/** Trims; returns undefined if empty after trim. */
export const trimOptional = (s: string | undefined): string | undefined => {
    const t = s?.trim()
    return t ? t : undefined
}

export type KeywordMatchMode = "any" | "all"

/** Strips filler so full user prompts still match job text. */
const tokenizeSearchQuery = (raw: string): string[] => {
    const stop = new Set([
        "a",
        "an",
        "the",
        "for",
        "any",
        "in",
        "on",
        "at",
        "to",
        "of",
        "and",
        "or",
        "is",
        "are",
        "it",
        "if",
        "as",
        "by",
        "with",
        "look",
        "find",
        "search",
        "please",
        "can",
        "you",
        "help",
        "need",
        "want",
        "get",
        "show",
        "give",
        "list",
        "some",
        "all",
        "return",
        "listed",
        "everything",
        "every",
        "browse",
        "current",
        "this",
        "that",
        "me",
        "my",
    ])
    const splitAlnum = raw
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !stop.has(t))
    const primary = [...new Set(splitAlnum)]
    if (primary.length > 0) {
        return primary
    }
    const loose = raw
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9._-]+/g, "").trim())
        .filter((t) => t.length >= 2)
    return [...new Set(loose)]
}

export {
    AGENT_JOB_STATUS_VALUES,
    parseAgentJobStatusFilter,
    type AgentJobStatus,
} from "./job-status"

export type BidStatus = "pending" | "accepted" | "rejected"

/** Validates a positive USDT amount (same base-unit mapping as `usdtDecimalToWei`). */
const parsePositiveAmount = (raw: string): void => {
    const s = usdtDecimalToWei(raw)
    if (BigInt(s) <= BigInt(0)) {
        throw new Error("Amount must be positive")
    }
}

export const createAgentJob = async (input: {
    userId: string
    title: string
    description: string
    /** USDT amount as a string (e.g. "50", "0.5", "1.23"); stored as base units in `acp_budget`. */
    budgetAmount: string
    /** Unix seconds for on-chain `expiredAt`; default now + 7 days when omitted. */
    expiresAtUnix?: number
}) => {
    parsePositiveAmount(input.budgetAmount)

    const id = crypto.randomUUID()
    const acpBudget = usdtDecimalToWei(input.budgetAmount)
    const expMs =
        input.expiresAtUnix != null
            ? input.expiresAtUnix * 1000
            : Date.now() + DEFAULT_JOB_EXPIRY_SECONDS * 1000
    const acpDescription = buildGigentTaggedJobDescription(
        id,
        input.description.trim()
    )

    await db.insert(agentJob).values({
        id,
        title: input.title.trim(),
        description: input.description.trim(),
        clientUserId: input.userId,
        status: "open",
        acpBudget,
        acpDescription,
        acpExpiresAt: new Date(expMs),
        acpContractAddress: AGENTIC_COMMERCE_ADDRESS.toLowerCase(),
    })

    return { id }
}

export type GetCreateJobOnChainPayloadResult =
    | {
          ok: true
          dbJobId: string
          chainId: number
          commerceAddress: Address
          createJobData: `0x${string}`
          /** Base units (string) for `setBudget` / `approve`, from `usdtDecimalToWei`. */
          initialBudgetAmount: string
      }
    | { ok: false; error: string }

/** Calldata for `createJob` on Kite (evaluator = client wallet; provider/hook = zero). */
export const getCreateJobOnChainPayload = async (input: {
    userId: string
    jobId: string
    /** Checksummed 0x address from the connected browser wallet. */
    evaluatorAddress: string | undefined
}): Promise<GetCreateJobOnChainPayloadResult> => {
    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the job client can publish on-chain" }
    }
    if (job.acpJobId) {
        return { ok: false, error: "Job already has an on-chain id" }
    }
    if (job.status !== "open") {
        return { ok: false, error: "Only open listings can be published on-chain" }
    }

    let acpDesc = job.acpDescription?.trim()
    if (!acpDesc) {
        acpDesc = buildGigentTaggedJobDescription(job.id, job.description)
        await db
            .update(agentJob)
            .set({ acpDescription: acpDesc })
            .where(eq(agentJob.id, job.id))
    }

    if (!job.acpExpiresAt) {
        return { ok: false, error: "Job is missing expiry timestamp" }
    }

    const rawEval = input.evaluatorAddress?.trim()
    if (!rawEval) {
        return {
            ok: false,
            error:
                "Connect your Kite Testnet wallet in the header or Settings so createJob can use your address as evaluator.",
        }
    }
    let evaluator: Address
    try {
        evaluator = getAddress(rawEval as Address)
    } catch {
        return { ok: false, error: "Invalid evaluator wallet address" }
    }

    const budget = job.acpBudget?.trim() ?? "0"
    if (budget === "0") {
        return { ok: false, error: "Budget must be greater than zero for setBudget" }
    }

    const createJobData = encodeAcpCreateJob({
        provider: zeroAddress,
        evaluator,
        expiredAt: BigInt(Math.floor(job.acpExpiresAt.getTime() / 1000)),
        description: acpDesc,
        hook: zeroAddress,
    })

    return {
        ok: true,
        dbJobId: job.id,
        chainId: KITE_TESTNET_CHAIN_ID,
        commerceAddress: getAddress(AGENTIC_COMMERCE_ADDRESS),
        createJobData,
        initialBudgetAmount: budget,
    }
}

export const linkDbJobToAcpJobId = async (input: {
    userId: string
    jobId: string
    acpJobId: string
    /** Connected client wallet that called `createJob` on-chain. */
    clientWalletAddress: string
}) => {
    const acpIdRaw = input.acpJobId.trim()
    if (!/^\d+$/.test(acpIdRaw)) {
        return { ok: false as const, error: "acpJobId must be a decimal string" }
    }

    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false as const, error: "Only the client can link this job" }
    }
    if (job.acpJobId) {
        return { ok: false as const, error: "Job is already linked on-chain" }
    }

    const rawClient = input.clientWalletAddress.trim()
    if (!rawClient) {
        return {
            ok: false as const,
            error: "Client wallet address is required to verify the on-chain job",
        }
    }
    let clientAddr: Address
    try {
        clientAddr = getAddress(rawClient as Address)
    } catch {
        return { ok: false as const, error: "Invalid client wallet address" }
    }

    const chainJob = await readAcpJob(BigInt(acpIdRaw))
    if (getAddress(chainJob.client) !== clientAddr) {
        return {
            ok: false as const,
            error:
                "On-chain job client does not match the wallet address you used for createJob",
        }
    }

    if (!chainJob.description.startsWith(gigentJobTagPrefix(job.id))) {
        return {
            ok: false as const,
            error: "On-chain job does not match this listing (description tag)",
        }
    }

    await db
        .update(agentJob)
        .set({ acpJobId: acpIdRaw })
        .where(eq(agentJob.id, job.id))

    await syncAgentJobFromChainByDbId(job.id)

    return { ok: true as const }
}

export type UpdateAgentJobAsClientResult =
    | { ok: true; applied: true }
    | { ok: true; applied: false; guidance: string }
    | { ok: false; error: string }

export const updateAgentJobAsClient = async (input: {
    userId: string
    jobId: string
    title?: string
    description?: string
    budgetAmount?: string
}): Promise<UpdateAgentJobAsClientResult> => {
    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the client can update this job" }
    }
    if (job.acpJobId != null) {
        return {
            ok: true,
            applied: false,
            guidance: JOB_ONCHAIN_IMMUTABLE_GUIDANCE,
        }
    }
    if (job.status !== "open") {
        return {
            ok: false,
            error: "Only open jobs can be edited before an on-chain job exists",
        }
    }

    const patch: Partial<typeof agentJob.$inferInsert> = {}

    if (input.title !== undefined) {
        patch.title = input.title.trim()
    }
    if (input.description !== undefined) {
        patch.description = input.description.trim()
    }
    if (input.budgetAmount !== undefined) {
        parsePositiveAmount(input.budgetAmount)
        patch.acpBudget = usdtDecimalToWei(input.budgetAmount)
    }

    if (Object.keys(patch).length === 0) {
        return { ok: false, error: "No fields to update" }
    }

    await db.update(agentJob).set(patch).where(eq(agentJob.id, input.jobId))

    return { ok: true, applied: true }
}

export type SearchAgentJobsInput = {
    keywords?: string
    keywordMode?: KeywordMatchMode
    status?: AgentJobStatus | AgentJobStatus[] | "all"
    clientNameContains?: string
    minBudgetAmount?: string
    maxBudgetAmount?: string
    limit?: number
}

/** Human USDT amount string → same base units as `acp_budget` for SQL comparison. */
const parseBudgetBound = (raw: string): string => usdtDecimalToWei(raw)

export const searchAgentJobs = async (input: SearchAgentJobsInput) => {
    const rawLimit = input.limit
    const limit = Math.min(
        Math.max(
            1,
            typeof rawLimit === "number" && Number.isFinite(rawLimit)
                ? rawLimit
                : 20
        ),
        50
    )

    const q = trimOptional(input.keywords)
    const keywordMode: KeywordMatchMode = input.keywordMode ?? "any"

    const clientHas = trimOptional(input.clientNameContains)

    const conditions: SQL[] = []

    const statusIn = input.status
    if (statusIn !== undefined && statusIn !== "all") {
        if (Array.isArray(statusIn)) {
            if (statusIn.length > 0) {
                conditions.push(inArray(agentJob.status, statusIn))
            }
        } else {
            conditions.push(eq(agentJob.status, statusIn))
        }
    }

    if (clientHas) {
        conditions.push(ilike(user.name, `%${escapeIlikePattern(clientHas)}%`))
    }

    const minRaw = trimOptional(input.minBudgetAmount)
    const maxRaw = trimOptional(input.maxBudgetAmount)
    if (minRaw !== undefined) {
        conditions.push(
            sql`(${agentJob.acpBudget})::numeric >= ${parseBudgetBound(minRaw)}`
        )
    }
    if (maxRaw !== undefined) {
        conditions.push(
            sql`(${agentJob.acpBudget})::numeric <= ${parseBudgetBound(maxRaw)}`
        )
    }

    if (q) {
        const tokens = tokenizeSearchQuery(q)
        if (tokens.length > 0) {
            const perToken = tokens.map((tok) => {
                const pattern = `%${escapeIlikePattern(tok)}%`
                return or(
                    ilike(agentJob.title, pattern),
                    ilike(agentJob.description, pattern),
                    ilike(user.name, pattern)
                )
            })
            const textMatch: SQL =
                perToken.length === 1
                    ? perToken[0]!
                    : keywordMode === "all"
                      ? and(...perToken)!
                      : or(...perToken)!
            conditions.push(textMatch)
        }
    }

    const base = db
        .select({
            id: agentJob.id,
            title: agentJob.title,
            description: agentJob.description,
            acpBudget: agentJob.acpBudget,
            acpExpiresAt: agentJob.acpExpiresAt,
            status: agentJob.status,
            clientUserId: agentJob.clientUserId,
            clientName: user.name,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .innerJoin(user, eq(agentJob.clientUserId, user.id))

    const filtered =
        conditions.length > 0 ? base.where(and(...conditions)!) : base

    const rows = await filtered
        .orderBy(desc(agentJob.createdAt))
        .limit(limit)

    return rows.map((r) => ({
        ...r,
        budgetAmount: formatUsdtWei(r.acpBudget ?? "0"),
        budgetCurrency: "USDT" as const,
    }))
}

export const getAgentJobById = async (jobId: string) => {
    const providerUser = alias(user, "agent_job_provider")

    const [row] = await db
        .select({
            id: agentJob.id,
            title: agentJob.title,
            description: agentJob.description,
            acpBudget: agentJob.acpBudget,
            status: agentJob.status,
            clientUserId: agentJob.clientUserId,
            clientName: user.name,
            providerUserId: agentJob.providerUserId,
            providerName: providerUser.name,
            acceptedBidId: agentJob.acceptedBidId,
            deliveryPayload: agentJob.deliveryPayload,
            submittedAt: agentJob.submittedAt,
            completedAt: agentJob.completedAt,
            providerPayoutAddress: agentJob.providerPayoutAddress,
            acpJobId: agentJob.acpJobId,
            acpChainId: agentJob.acpChainId,
            acpContractAddress: agentJob.acpContractAddress,
            acpClientAddress: agentJob.acpClientAddress,
            acpProviderAddress: agentJob.acpProviderAddress,
            acpEvaluatorAddress: agentJob.acpEvaluatorAddress,
            acpDescription: agentJob.acpDescription,
            acpExpiresAt: agentJob.acpExpiresAt,
            acpStatus: agentJob.acpStatus,
            acpHookAddress: agentJob.acpHookAddress,
            deliverableCommitment: agentJob.deliverableCommitment,
            lastChainSyncAt: agentJob.lastChainSyncAt,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .innerJoin(user, eq(agentJob.clientUserId, user.id))
        .leftJoin(providerUser, eq(agentJob.providerUserId, providerUser.id))
        .where(eq(agentJob.id, jobId))
        .limit(1)

    if (!row) {
        return null
    }

    return {
        ...row,
        budgetAmount: formatUsdtWei(row.acpBudget ?? "0"),
        budgetCurrency: "USDT" as const,
        deliveryPayload: parseJobDeliveryPayloadFromDb(row.deliveryPayload),
    }
}

export const listBidsForJob = async (jobId: string) => {
    return db
        .select({
            id: agentJobBid.id,
            jobId: agentJobBid.jobId,
            providerUserId: agentJobBid.providerUserId,
            providerName: user.name,
            amount: agentJobBid.amount,
            currency: agentJobBid.currency,
            status: agentJobBid.status,
            createdAt: agentJobBid.createdAt,
        })
        .from(agentJobBid)
        .innerJoin(user, eq(agentJobBid.providerUserId, user.id))
        .where(eq(agentJobBid.jobId, jobId))
        .orderBy(desc(agentJobBid.createdAt))
}

export const placeBid = async (input: {
    userId: string
    jobId: string
    amount: string
    /** Provider’s Kite wallet for escrow payout (must match their connected wallet). */
    providerWalletAddress: string
}) => {
    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.status !== "open") {
        return { ok: false as const, error: "Job is not open for bids" }
    }
    if (job.clientUserId === input.userId) {
        return { ok: false as const, error: "You cannot bid on your own job" }
    }

    const [existingBid] = await db
        .select({ id: agentJobBid.id })
        .from(agentJobBid)
        .where(
            and(
                eq(agentJobBid.jobId, input.jobId),
                eq(agentJobBid.providerUserId, input.userId)
            )
        )
        .limit(1)

    if (existingBid) {
        return {
            ok: false as const,
            error: "You already have a bid on this job",
        }
    }

    parsePositiveAmount(input.amount)

    let payout: Address
    try {
        payout = getAddress(input.providerWalletAddress.trim() as Address)
    } catch {
        return {
            ok: false as const,
            error: "Invalid provider wallet address",
        }
    }

    const id = crypto.randomUUID()
    try {
        await db.insert(agentJobBid).values({
            id,
            jobId: input.jobId,
            providerUserId: input.userId,
            amount: input.amount.trim(),
            currency: "USDT",
            status: "pending",
            providerWalletAddress: payout,
        })
    } catch (e) {
        if (
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            (e as { code: string }).code === "23505"
        ) {
            return {
                ok: false as const,
                error: "You already have a bid on this job",
            }
        }
        throw e
    }

    return { ok: true as const, bidId: id }
}

export const withdrawBid = async (input: {
    userId: string
    jobId: string
    bidId: string
}) => {
    const [bid] = await db
        .select()
        .from(agentJobBid)
        .where(
            and(
                eq(agentJobBid.id, input.bidId),
                eq(agentJobBid.jobId, input.jobId)
            )
        )
        .limit(1)

    if (!bid) {
        return { ok: false as const, error: "Bid not found for this job" }
    }
    if (bid.providerUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the bidder can withdraw this bid",
        }
    }
    if (bid.status !== "pending") {
        return {
            ok: false as const,
            error: "Only pending bids can be withdrawn",
        }
    }

    const [job] = await db
        .select({ status: agentJob.status })
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.status !== "open") {
        return {
            ok: false as const,
            error: "Cannot withdraw a bid after the job is no longer open",
        }
    }

    await db.delete(agentJobBid).where(eq(agentJobBid.id, input.bidId))

    return { ok: true as const }
}

export const acceptBid = async (input: {
    userId: string
    jobId: string
    bidId: string
}) => {
    return db.transaction(async (tx) => {
        const [job] = await tx
            .select()
            .from(agentJob)
            .where(eq(agentJob.id, input.jobId))
            .limit(1)

        if (!job) {
            return { ok: false as const, error: "Job not found" }
        }
        if (job.clientUserId !== input.userId) {
            return {
                ok: false as const,
                error: "Only the client can accept a bid",
            }
        }
        if (job.status !== "open") {
            return {
                ok: false as const,
                error: "Job is not open for acceptance",
            }
        }
        if (!job.acpJobId) {
            return {
                ok: false as const,
                error:
                    "Finish job_create on-chain first (wallet prompts for createJob + setBudget) so this job has an on-chain id before you accept a bid.",
            }
        }

        const [bid] = await tx
            .select()
            .from(agentJobBid)
            .where(
                and(
                    eq(agentJobBid.id, input.bidId),
                    eq(agentJobBid.jobId, input.jobId)
                )
            )
            .limit(1)

        if (!bid) {
            return { ok: false as const, error: "Bid not found for this job" }
        }
        if (bid.status !== "pending") {
            return { ok: false as const, error: "Bid is no longer pending" }
        }

        const providerPayoutAddress = bid.providerWalletAddress?.trim() ?? null
        if (!providerPayoutAddress) {
            return {
                ok: false as const,
                error:
                    "The provider’s bid is missing a Kite payout address. They should connect their wallet and place or update the bid with their address.",
            }
        }

        let payoutNormalized: string
        try {
            payoutNormalized = getAddress(providerPayoutAddress as Address)
        } catch {
            return {
                ok: false as const,
                error: "Invalid provider payout address on this bid",
            }
        }

        await tx
            .update(agentJobBid)
            .set({ status: "accepted" })
            .where(eq(agentJobBid.id, input.bidId))

        await tx
            .update(agentJobBid)
            .set({ status: "rejected" })
            .where(
                and(
                    eq(agentJobBid.jobId, input.jobId),
                    ne(agentJobBid.id, input.bidId),
                    eq(agentJobBid.status, "pending")
                )
            )

        await tx
            .update(agentJob)
            .set({
                status: "funded",
                providerUserId: bid.providerUserId,
                acceptedBidId: input.bidId,
                providerPayoutAddress: payoutNormalized,
                acpBudget: usdtDecimalToWei(bid.amount.trim()),
            })
            .where(eq(agentJob.id, input.jobId))

        return { ok: true as const }
    })
}

export const submitJobDelivery = async (input: {
    userId: string
    jobId: string
    deliveryPayload: unknown
}) => {
    const parsed = parseJobDeliveryPayload(input.deliveryPayload)
    if (!parsed.ok) {
        return { ok: false as const, error: parsed.error }
    }

    const commitment = deliverableCommitmentBytes32(parsed.data)

    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.providerUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the assigned provider can submit delivery",
        }
    }
    if (job.status !== "funded") {
        return {
            ok: false as const,
            error: "Job must be in funded state to submit delivery",
        }
    }

    await db
        .update(agentJob)
        .set({
            status: "submitted",
            deliveryPayload: parsed.data as Record<string, unknown>,
            deliverableCommitment: commitment,
            submittedAt: new Date(),
        })
        .where(eq(agentJob.id, input.jobId))

    return {
        ok: true as const,
        deliverableCommitment: commitment,
    }
}

export const assertJobDeliveryUploadAllowed = async (input: {
    userId: string
    jobId: string
}) => {
    const [job] = await db
        .select({
            id: agentJob.id,
            status: agentJob.status,
            providerUserId: agentJob.providerUserId,
        })
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.providerUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the provider can upload delivery files for this job",
        }
    }
    if (job.status !== "funded") {
        return {
            ok: false as const,
            error: "Upload is only allowed while the job is funded",
        }
    }
    return { ok: true as const }
}

export const confirmJobCompletion = async (input: {
    userId: string
    jobId: string
}) => {
    await syncAgentJobFromChainByDbId(input.jobId)

    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the client can confirm completion",
        }
    }
    if (job.status !== "submitted" && job.status !== "completed") {
        return {
            ok: false as const,
            error: "Job is not awaiting your review",
        }
    }
    if (job.acpStatus?.toLowerCase() !== "completed") {
        return {
            ok: false as const,
            error:
                "Call complete on the Agentic Commerce contract from your Kite wallet after reviewing, then use job_sync_chain or try again.",
        }
    }

    if (job.status !== "completed") {
        await db
            .update(agentJob)
            .set({
                status: "completed",
                completedAt: job.completedAt ?? new Date(),
            })
            .where(eq(agentJob.id, input.jobId))
    }

    return { ok: true as const }
}

export const rejectAgentJobAsClient = async (input: {
    userId: string
    jobId: string
}) => {
    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false as const, error: "Only the client can reject this job" }
    }

    if (!job.acpJobId) {
        if (job.status !== "open") {
            return {
                ok: false as const,
                error: "Only open jobs without an on-chain id can be abandoned this way",
            }
        }
        await db
            .update(agentJob)
            .set({ status: "rejected" })
            .where(eq(agentJob.id, input.jobId))
        return { ok: true as const }
    }

    await syncAgentJobFromChainByDbId(input.jobId)

    const [again] = await db
        .select({ acpStatus: agentJob.acpStatus })
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    const st = again?.acpStatus?.toLowerCase() ?? ""
    if (st === "rejected" || st === "expired") {
        await db
            .update(agentJob)
            .set({
                status: st === "expired" ? "expired" : "rejected",
            })
            .where(eq(agentJob.id, input.jobId))
        return { ok: true as const }
    }

    return {
        ok: false as const,
        error:
            "Send reject (or wait for expiry) on the Agentic Commerce contract on Kite Testnet for this job, then call job_sync_chain.",
    }
}

export const getJobForViewer = async (input: {
    viewerUserId: string
    jobId: string
}) => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false as const, error: "Job not found" as const }
    }

    const exposeDelivery = shouldExposeDeliveryFieldsToViewer({
        viewerUserId: input.viewerUserId,
        clientUserId: job.clientUserId,
        providerUserId: job.providerUserId,
        jobStatus: job.status,
        acpJobId: job.acpJobId,
        acpStatus: job.acpStatus,
    })

    if (!exposeDelivery) {
        return {
            ok: true as const,
            job: {
                ...job,
                deliveryPayload: null,
                submittedAt: null,
            },
        }
    }

    return { ok: true as const, job }
}

export const listMyPostedJobs = async (userId: string, limit = 30) => {
    const rows = await db
        .select({
            id: agentJob.id,
            title: agentJob.title,
            status: agentJob.status,
            acpBudget: agentJob.acpBudget,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .where(eq(agentJob.clientUserId, userId))
        .orderBy(desc(agentJob.createdAt))
        .limit(limit)

    return rows.map((r) => ({
        ...r,
        budgetAmount: formatUsdtWei(r.acpBudget ?? "0"),
        budgetCurrency: "USDT" as const,
    }))
}

export const listMyBids = async (userId: string, limit = 30) => {
    return db
        .select({
            bidId: agentJobBid.id,
            jobId: agentJobBid.jobId,
            amount: agentJobBid.amount,
            currency: agentJobBid.currency,
            bidStatus: agentJobBid.status,
            jobTitle: agentJob.title,
            jobStatus: agentJob.status,
            createdAt: agentJobBid.createdAt,
        })
        .from(agentJobBid)
        .innerJoin(agentJob, eq(agentJobBid.jobId, agentJob.id))
        .where(eq(agentJobBid.providerUserId, userId))
        .orderBy(desc(agentJobBid.createdAt))
        .limit(limit)
}

export const getBidStatusForUser = async (input: {
    userId: string
    jobId?: string
}) => {
    if (input.jobId) {
        const bids = await db
            .select({
                bidId: agentJobBid.id,
                jobId: agentJobBid.jobId,
                amount: agentJobBid.amount,
                bidStatus: agentJobBid.status,
                jobTitle: agentJob.title,
                jobStatus: agentJob.status,
            })
            .from(agentJobBid)
            .innerJoin(agentJob, eq(agentJobBid.jobId, agentJob.id))
            .where(
                and(
                    eq(agentJobBid.providerUserId, input.userId),
                    eq(agentJobBid.jobId, input.jobId)
                )
            )
        return bids
    }

    return listMyBids(input.userId, 20)
}

export const completeJobAsClient = confirmJobCompletion

export const updateBidAmount = async (input: {
    userId: string
    jobId: string
    bidId: string
    amount: string
    providerWalletAddress?: string
}) => {
    const [bid] = await db
        .select()
        .from(agentJobBid)
        .where(
            and(
                eq(agentJobBid.id, input.bidId),
                eq(agentJobBid.jobId, input.jobId)
            )
        )
        .limit(1)

    if (!bid) {
        return { ok: false as const, error: "Bid not found for this job" }
    }
    if (bid.providerUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the bidder can update this bid",
        }
    }
    if (bid.status !== "pending") {
        return {
            ok: false as const,
            error: "Only pending bids can be updated",
        }
    }

    const [job] = await db
        .select({ status: agentJob.status })
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.status !== "open") {
        return {
            ok: false as const,
            error: "Cannot update a bid after the job is no longer open",
        }
    }

    parsePositiveAmount(input.amount)

    const patch: { amount: string; providerWalletAddress?: string } = {
        amount: input.amount.trim(),
    }
    const rawPayout = input.providerWalletAddress?.trim()
    if (rawPayout) {
        try {
            patch.providerWalletAddress = getAddress(rawPayout as Address)
        } catch {
            return { ok: false as const, error: "Invalid provider wallet address" }
        }
    }

    await db.update(agentJobBid).set(patch).where(eq(agentJobBid.id, input.bidId))

    return { ok: true as const }
}

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

import { agentJob, agentJobBid, user, userWallet } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { X402_BASE_SEPOLIA_NETWORK } from "@/lib/wallet/constants"

import {
    parseJobDeliveryPayload,
    parseJobDeliveryPayloadFromDb,
} from "./delivery/payload"
import {
    canViewerAccessJobDelivery,
    shouldHideDeliveryFromPosterUntilPaid,
} from "./delivery/visibility"
import type { AgentJobStatus } from "./job-status"

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
        // Keep "job(s)" / marketplace terms — users and the agent often search with them.
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
    /** If everything was stop words, fall back to whitespace words (still drops 1-char noise). */
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

const parsePositiveAmount = (raw: string): number => {
    const n = Number.parseFloat(raw.trim())
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error("Amount must be a positive number")
    }
    return n
}

export const createAgentJob = async (input: {
    userId: string
    title: string
    description: string
    requiredModelId: string
    rewardAmount: string
    rewardCurrency: string
}) => {
    parsePositiveAmount(input.rewardAmount)

    const id = crypto.randomUUID()
    await db.insert(agentJob).values({
        id,
        title: input.title.trim(),
        description: input.description.trim(),
        requiredModelId: input.requiredModelId.trim(),
        rewardAmount: input.rewardAmount.trim(),
        rewardCurrency: input.rewardCurrency.trim().toUpperCase(),
        posterUserId: input.userId,
        status: "open",
    })

    return { id }
}

export const updateAgentJobAsPoster = async (input: {
    userId: string
    jobId: string
    title?: string
    description?: string
    requiredModelId?: string
    rewardAmount?: string
    rewardCurrency?: string
}) => {
    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.posterUserId !== input.userId) {
        return { ok: false as const, error: "Only the poster can update this job" }
    }
    if (job.status !== "open") {
        return {
            ok: false as const,
            error: "Only open jobs can be edited (cancel or complete flow first)",
        }
    }

    const patch: {
        title?: string
        description?: string
        requiredModelId?: string
        rewardAmount?: string
        rewardCurrency?: string
    } = {}

    if (input.title !== undefined) {
        patch.title = input.title.trim()
    }
    if (input.description !== undefined) {
        patch.description = input.description.trim()
    }
    if (input.requiredModelId !== undefined) {
        patch.requiredModelId = input.requiredModelId.trim()
    }
    if (input.rewardAmount !== undefined) {
        parsePositiveAmount(input.rewardAmount)
        patch.rewardAmount = input.rewardAmount.trim()
    }
    if (input.rewardCurrency !== undefined) {
        const c = input.rewardCurrency.trim().toUpperCase()
        if (c !== "USDC" && c !== "ETH") {
            return { ok: false as const, error: "rewardCurrency must be USDC or ETH" }
        }
        patch.rewardCurrency = c
    }

    if (Object.keys(patch).length === 0) {
        return { ok: false as const, error: "No fields to update" }
    }

    await db.update(agentJob).set(patch).where(eq(agentJob.id, input.jobId))

    return { ok: true as const }
}

export type SearchAgentJobsInput = {
    /** Matched against title, description, model id, poster name (see keywordMode). */
    keywords?: string
    /** Default `any` (OR tokens); `all` = every token must match (AND). */
    keywordMode?: KeywordMatchMode
    status?: AgentJobStatus | AgentJobStatus[] | "all"
    /** Exact match on required_model_id. */
    exactRequiredModelId?: string
    /** Substring match on required_model_id (ILIKE). */
    modelContains?: string
    /** Substring match on poster display name (ILIKE). */
    posterNameContains?: string
    minRewardAmount?: string
    maxRewardAmount?: string
    /** Required when filtering by min/max reward; same-currency rows only. */
    rewardCurrency?: "USDC" | "ETH"
    limit?: number
}

const parseRewardBound = (raw: string): number => {
    const n = Number.parseFloat(raw.trim())
    if (!Number.isFinite(n)) {
        throw new Error("Reward bound must be a finite number")
    }
    return n
}

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

    const exactModel = trimOptional(input.exactRequiredModelId)
    const modelHas = trimOptional(input.modelContains)
    const posterHas = trimOptional(input.posterNameContains)

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

    if (exactModel) {
        conditions.push(eq(agentJob.requiredModelId, exactModel))
    }
    if (modelHas) {
        conditions.push(
            ilike(agentJob.requiredModelId, `%${escapeIlikePattern(modelHas)}%`)
        )
    }
    if (posterHas) {
        conditions.push(ilike(user.name, `%${escapeIlikePattern(posterHas)}%`))
    }

    const minRaw = trimOptional(input.minRewardAmount)
    const maxRaw = trimOptional(input.maxRewardAmount)
    if (minRaw !== undefined || maxRaw !== undefined) {
        const currency = input.rewardCurrency?.trim().toUpperCase()
        if (currency !== "USDC" && currency !== "ETH") {
            throw new Error(
                "rewardCurrency (USDC or ETH) is required when filtering by min/max reward"
            )
        }
        conditions.push(eq(agentJob.rewardCurrency, currency))
        if (minRaw !== undefined) {
            conditions.push(
                sql`(${agentJob.rewardAmount})::numeric >= ${parseRewardBound(minRaw)}`
            )
        }
        if (maxRaw !== undefined) {
            conditions.push(
                sql`(${agentJob.rewardAmount})::numeric <= ${parseRewardBound(maxRaw)}`
            )
        }
    }

    if (q) {
        const tokens = tokenizeSearchQuery(q)
        if (tokens.length > 0) {
            const perToken = tokens.map((tok) => {
                const pattern = `%${escapeIlikePattern(tok)}%`
                return or(
                    ilike(agentJob.title, pattern),
                    ilike(agentJob.description, pattern),
                    ilike(agentJob.requiredModelId, pattern),
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
            requiredModelId: agentJob.requiredModelId,
            rewardAmount: agentJob.rewardAmount,
            rewardCurrency: agentJob.rewardCurrency,
            status: agentJob.status,
            posterUserId: agentJob.posterUserId,
            posterName: user.name,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .innerJoin(user, eq(agentJob.posterUserId, user.id))

    const filtered =
        conditions.length > 0 ? base.where(and(...conditions)!) : base

    const rows = await filtered
        .orderBy(desc(agentJob.createdAt))
        .limit(limit)

    return rows
}

export const getAgentJobById = async (jobId: string) => {
    const assigneeUser = alias(user, "agent_job_assignee")

    const [row] = await db
        .select({
            id: agentJob.id,
            title: agentJob.title,
            description: agentJob.description,
            requiredModelId: agentJob.requiredModelId,
            rewardAmount: agentJob.rewardAmount,
            rewardCurrency: agentJob.rewardCurrency,
            status: agentJob.status,
            posterUserId: agentJob.posterUserId,
            posterName: user.name,
            assigneeUserId: agentJob.assigneeUserId,
            assigneeName: assigneeUser.name,
            acceptedBidId: agentJob.acceptedBidId,
            deliveryPayload: agentJob.deliveryPayload,
            deliveredAt: agentJob.deliveredAt,
            completedAt: agentJob.completedAt,
            assigneePayoutAddress: agentJob.assigneePayoutAddress,
            paymentStatus: agentJob.paymentStatus,
            paymentSettledAt: agentJob.paymentSettledAt,
            paymentReceipt: agentJob.paymentReceipt,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .innerJoin(user, eq(agentJob.posterUserId, user.id))
        .leftJoin(assigneeUser, eq(agentJob.assigneeUserId, assigneeUser.id))
        .where(eq(agentJob.id, jobId))
        .limit(1)

    if (!row) {
        return null
    }

    return {
        ...row,
        deliveryPayload: parseJobDeliveryPayloadFromDb(row.deliveryPayload),
    }
}

export const listBidsForJob = async (jobId: string) => {
    return db
        .select({
            id: agentJobBid.id,
            jobId: agentJobBid.jobId,
            bidderUserId: agentJobBid.bidderUserId,
            bidderName: user.name,
            amount: agentJobBid.amount,
            currency: agentJobBid.currency,
            status: agentJobBid.status,
            createdAt: agentJobBid.createdAt,
        })
        .from(agentJobBid)
        .innerJoin(user, eq(agentJobBid.bidderUserId, user.id))
        .where(eq(agentJobBid.jobId, jobId))
        .orderBy(desc(agentJobBid.createdAt))
}

export const placeBid = async (input: {
    userId: string
    jobId: string
    amount: string
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
    if (job.posterUserId === input.userId) {
        return { ok: false as const, error: "You cannot bid on your own job" }
    }

    const [existingBid] = await db
        .select({ id: agentJobBid.id })
        .from(agentJobBid)
        .where(
            and(
                eq(agentJobBid.jobId, input.jobId),
                eq(agentJobBid.bidderUserId, input.userId)
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

    const id = crypto.randomUUID()
    try {
        await db.insert(agentJobBid).values({
            id,
            jobId: input.jobId,
            bidderUserId: input.userId,
            amount: input.amount.trim(),
            currency: job.rewardCurrency,
            status: "pending",
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
    if (bid.bidderUserId !== input.userId) {
        return { ok: false as const, error: "Only the bidder can withdraw this bid" }
    }
    if (bid.status !== "pending") {
        return { ok: false as const, error: "Only pending bids can be withdrawn" }
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
        if (job.posterUserId !== input.userId) {
            return { ok: false as const, error: "Only the poster can accept a bid" }
        }
        if (job.status !== "open") {
            return { ok: false as const, error: "Job is not open for acceptance" }
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

        const [walletRow] = await tx
            .select({ address: userWallet.address })
            .from(userWallet)
            .where(
                and(
                    eq(userWallet.userId, bid.bidderUserId),
                    eq(userWallet.chainId, X402_BASE_SEPOLIA_NETWORK)
                )
            )
            .limit(1)

        const assigneePayoutAddress = walletRow?.address ?? null
        if (!assigneePayoutAddress) {
            return {
                ok: false as const,
                error:
                    "The bidder must link a Base Sepolia wallet in Settings before their bid can be accepted.",
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
                status: "assigned",
                assigneeUserId: bid.bidderUserId,
                acceptedBidId: input.bidId,
                assigneePayoutAddress,
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

    const [job] = await db
        .select()
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.assigneeUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the assigned bidder can submit delivery",
        }
    }
    if (job.status !== "assigned") {
        return {
            ok: false as const,
            error: "Job must be in assigned state to submit delivery",
        }
    }

    await db
        .update(agentJob)
        .set({
            status: "pending_review",
            deliveryPayload: parsed.data,
            deliveredAt: new Date(),
        })
        .where(eq(agentJob.id, input.jobId))

    return { ok: true as const }
}

export const assertJobDeliveryUploadAllowed = async (input: {
    userId: string
    jobId: string
}) => {
    const [job] = await db
        .select({
            id: agentJob.id,
            status: agentJob.status,
            assigneeUserId: agentJob.assigneeUserId,
        })
        .from(agentJob)
        .where(eq(agentJob.id, input.jobId))
        .limit(1)

    if (!job) {
        return { ok: false as const, error: "Job not found" }
    }
    if (job.assigneeUserId !== input.userId) {
        return {
            ok: false as const,
            error: "Only the assignee can upload delivery files for this job",
        }
    }
    if (job.status !== "assigned") {
        return {
            ok: false as const,
            error: "Upload is only allowed while the job is assigned",
        }
    }
    return { ok: true as const }
}

export const confirmJobCompletion = async (input: {
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
    if (job.posterUserId !== input.userId) {
        return { ok: false as const, error: "Only the poster can confirm completion" }
    }
    if (job.status !== "pending_review") {
        return {
            ok: false as const,
            error: "Job is not awaiting your review",
        }
    }
    if (job.paymentStatus !== "settled") {
        return {
            ok: false as const,
            error: "Pay to view delivery (x402 USDC) before completing the job",
        }
    }

    await db
        .update(agentJob)
        .set({
            status: "completed",
            completedAt: new Date(),
        })
        .where(eq(agentJob.id, input.jobId))

    return { ok: true as const }
}

export const cancelAgentJobAsPoster = async (input: {
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
    if (job.posterUserId !== input.userId) {
        return { ok: false as const, error: "Only the poster can cancel this job" }
    }
    if (job.status !== "open") {
        return {
            ok: false as const,
            error: "Only open jobs can be cancelled",
        }
    }

    await db
        .update(agentJob)
        .set({ status: "cancelled" })
        .where(eq(agentJob.id, input.jobId))

    return { ok: true as const }
}

export const updateBidAmount = async (input: {
    userId: string
    jobId: string
    bidId: string
    amount: string
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
    if (bid.bidderUserId !== input.userId) {
        return { ok: false as const, error: "Only the bidder can update this bid" }
    }
    if (bid.status !== "pending") {
        return { ok: false as const, error: "Only pending bids can be updated" }
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

    await db
        .update(agentJobBid)
        .set({ amount: input.amount.trim() })
        .where(eq(agentJobBid.id, input.bidId))

    return { ok: true as const }
}

export const getJobForViewer = async (input: {
    viewerUserId: string
    jobId: string
}) => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false as const, error: "Job not found" as const }
    }

    const canSeeDelivery = canViewerAccessJobDelivery(
        input.viewerUserId,
        job.posterUserId,
        job.assigneeUserId
    )

    if (!canSeeDelivery) {
        return {
            ok: true as const,
            job: {
                ...job,
                deliveryPayload: null,
                deliveredAt: null,
            },
        }
    }

    const hideForPayToView = shouldHideDeliveryFromPosterUntilPaid({
        viewerUserId: input.viewerUserId,
        posterUserId: job.posterUserId,
        status: job.status,
        paymentStatus: job.paymentStatus,
    })

    if (hideForPayToView) {
        return {
            ok: true as const,
            job: {
                ...job,
                deliveryPayload: null,
                deliveredAt: null,
            },
        }
    }

    return { ok: true as const, job }
}

export const getPayToViewPreviewForPoster = async (input: {
    userId: string
    jobId: string
}): Promise<
    | { ok: true; settled: true }
    | {
          ok: true
          settled: false
          paymentRequired: true
          amount: string
          currency: string
          network: typeof X402_BASE_SEPOLIA_NETWORK
          payPath: string
      }
    | { ok: false; error: string }
> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.posterUserId !== input.userId) {
        return { ok: false, error: "Only the poster can use pay-to-view" }
    }
    if (job.status !== "pending_review") {
        return {
            ok: false,
            error: "Pay-to-view applies only while the job is pending review",
        }
    }
    if (job.paymentStatus === "settled") {
        return { ok: true, settled: true }
    }
    if (!job.acceptedBidId || job.assigneePayoutAddress == null) {
        return {
            ok: false,
            error: "Job is missing accepted bid or assignee payout address",
        }
    }

    const [bid] = await db
        .select()
        .from(agentJobBid)
        .where(eq(agentJobBid.id, job.acceptedBidId))
        .limit(1)

    if (!bid) {
        return { ok: false, error: "Accepted bid not found" }
    }
    if (bid.currency !== "USDC") {
        return {
            ok: false,
            error: "Pay-to-view on Base Sepolia supports USDC bids only",
        }
    }

    return {
        ok: true,
        settled: false,
        paymentRequired: true,
        amount: bid.amount.trim(),
        currency: bid.currency,
        network: X402_BASE_SEPOLIA_NETWORK,
        payPath: `/api/marketplace/jobs/${input.jobId}/pay-to-view`,
    }
}

export const markJobPaymentSettled = async (input: {
    jobId: string
    receipt?: Record<string, unknown> | null
}) => {
    await db
        .update(agentJob)
        .set({
            paymentStatus: "settled",
            paymentSettledAt: new Date(),
            paymentReceipt: input.receipt ?? null,
        })
        .where(eq(agentJob.id, input.jobId))
}

export const completeJobAsPoster = async (input: {
    userId: string
    jobId: string
}): Promise<{ ok: true } | { ok: false; error: string }> => {
    return confirmJobCompletion(input)
}

export const listMyPostedJobs = async (userId: string, limit = 30) => {
    return db
        .select({
            id: agentJob.id,
            title: agentJob.title,
            status: agentJob.status,
            requiredModelId: agentJob.requiredModelId,
            rewardAmount: agentJob.rewardAmount,
            rewardCurrency: agentJob.rewardCurrency,
            createdAt: agentJob.createdAt,
        })
        .from(agentJob)
        .where(eq(agentJob.posterUserId, userId))
        .orderBy(desc(agentJob.createdAt))
        .limit(limit)
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
        .where(eq(agentJobBid.bidderUserId, userId))
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
                    eq(agentJobBid.bidderUserId, input.userId),
                    eq(agentJobBid.jobId, input.jobId)
                )
            )
        return bids
    }

    return listMyBids(input.userId, 20)
}

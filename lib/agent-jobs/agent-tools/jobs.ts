import { tool } from "ai"
import { z } from "zod"

import { generateDeliveryImageAndUpload } from "@/lib/agent-jobs/delivery/image-gen"
import type { JobDeliveryPayload } from "@/lib/agent-jobs/delivery/payload"
import {
    getCompleteJobOnChainBundle,
    getRejectJobOnChainBundle,
    getSubmitDeliveryOnChainBundle,
} from "@/lib/agent-jobs/onchain-tx-payloads"
import {
    completeJobAsClient,
    createAgentJob,
    getCreateJobOnChainPayload,
    getJobForViewer,
    listMyPostedJobs,
    rejectAgentJobAsClient,
    searchAgentJobs,
    submitJobDelivery,
    syncAgentJobFromChainByDbId,
    trimOptional,
    updateAgentJobAsClient,
    JOB_ONCHAIN_IMMUTABLE_GUIDANCE,
} from "@/lib/agent-jobs/service"

import type { AgentJobToolsContext } from "./types"
import { parseAgentJobStatusFilter } from "@/lib/agent-jobs/job-status"

import { budgetAmountSchema, keywordModeSchema } from "./schemas"

type GetJobForViewerResult = Awaited<ReturnType<typeof getJobForViewer>>
type JobRow = Extract<GetJobForViewerResult, { ok: true }>["job"]

const serializeJobForTool = (job: JobRow) => ({
    ...job,
    createdAt: job.createdAt?.toISOString?.() ?? String(job.createdAt),
    submittedAt:
        job.submittedAt == null
            ? null
            : (job.submittedAt?.toISOString?.() ?? String(job.submittedAt)),
    completedAt:
        job.completedAt == null
            ? null
            : (job.completedAt?.toISOString?.() ?? String(job.completedAt)),
    acpExpiresAt:
        job.acpExpiresAt == null
            ? null
            : (job.acpExpiresAt?.toISOString?.() ?? String(job.acpExpiresAt)),
    lastChainSyncAt:
        job.lastChainSyncAt == null
            ? null
            : (job.lastChainSyncAt?.toISOString?.() ??
              String(job.lastChainSyncAt)),
})

/** Flat object so JSON Schema root is `type: object` (Gateway rejects root `oneOf` from discriminated unions). */
const jobSubmitInputSchema = z
    .object({
        mode: z.enum(["text", "image", "text_and_image"]),
        jobId: z.string().min(1),
        body: z.string().min(1).max(500_000).optional(),
        prompt: z.string().min(1).max(4000).optional(),
        modelId: z.string().min(1).optional(),
        aspectRatio: z
            .string()
            .regex(/^\d+\s*:\s*\d+$/)
            .optional(),
    })
    .refine((d) => d.mode !== "text" || d.body != null, {
        path: ["body"],
        message: "Required when mode is text.",
    })
    .refine((d) => d.mode !== "image" || d.prompt != null, {
        path: ["prompt"],
        message: "Required when mode is image.",
    })
    .refine(
        (d) =>
            d.mode !== "text_and_image" || (d.body != null && d.prompt != null),
        {
            path: ["body"],
            message:
                "body and prompt are required when mode is text_and_image.",
        }
    )

const normalizeAspectRatio = (
    s: string | undefined
): `${number}:${number}` | undefined => {
    if (s == null || s === "") {
        return undefined
    }
    return s.replace(/\s/g, "") as `${number}:${number}`
}

export const createJobsTools = (userId: string, ctx: AgentJobToolsContext) => ({
    job_create: tool({
        description:
            "Create a new Agent Job (client): USDT budget as a decimal string (e.g. 10, 0.5, 1.23), optional on-chain expiresAt as Unix seconds (default listing expiry is now + 7 days when omitted). **description** = the user’s full job scope copied **verbatim** from chat (never summarized). **title** = short off-chain headline only—you derive it from their text (≤120 chars). Saves the listing and returns calldata when the Kite wallet is connected; the UI prompts createJob + setBudget. After success, reply briefly—the wallet UI already showed the txs.",
        inputSchema: z.object({
            title: z
                .string()
                .min(1)
                .max(120)
                .describe(
                    "Short listing title for search/cards only (off-chain). Derive from the user’s job description; do not reuse this as the full description."
                ),
            description: z
                .string()
                .min(1)
                .describe(
                    "Exact job specification text from the user’s message (their Job description block). Character-for-character match aside from trimming outer whitespace—never summarize or rephrase."
                ),
            budgetAmount: budgetAmountSchema,
            expiresAtUnix: z
                .number()
                .int()
                .positive()
                .optional()
                .describe(
                    "Optional Unix timestamp (seconds) for on-chain expiredAt; server defaults to now + 7 days when omitted."
                ),
        }),
        execute: async (input) => {
            const { id } = await createAgentJob({ userId, ...input })
            const prep = await getCreateJobOnChainPayload({
                userId,
                jobId: id,
                evaluatorAddress: ctx.kiteWalletAddress ?? undefined,
            })
            if (prep.ok) {
                return {
                    success: true as const,
                    jobId: id,
                    onChain: {
                        chainId: prep.chainId,
                        commerceAddress: prep.commerceAddress,
                        createJobData: prep.createJobData,
                        initialBudgetAmount: prep.initialBudgetAmount,
                    },
                    message: `Job ${id} saved; createJob + setBudget run in the app wallet flow.`,
                }
            }
            return {
                success: true as const,
                jobId: id,
                onChain: { error: prep.error },
                message: `Job ${id} saved (DB only). On-chain prep failed: ${prep.error}`,
            }
        },
    }),

    job_update: tool({
        description:
            "Client-only. Before an on-chain job exists (no acp_job_id), updates open listing fields in the database. After createJob, on-chain fields are immutable—this tool returns guidance to job_reject (when the chain allows) then job_create; do not imply the contract row was edited.",
        inputSchema: z
            .object({
                jobId: z.string().min(1),
                title: z.string().min(1).max(120).optional(),
                description: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        "If updating description before on-chain publish: use the user’s exact new wording—never summarize or rephrase."
                    ),
                budgetAmount: budgetAmountSchema.optional(),
            })
            .refine(
                (v) =>
                    v.title !== undefined ||
                    v.description !== undefined ||
                    v.budgetAmount !== undefined,
                { message: "Provide at least one field to update" }
            ),
        execute: async (input) => {
            const { jobId, ...rest } = input
            const result = await updateAgentJobAsClient({
                userId,
                jobId,
                ...rest,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            if (!result.applied) {
                return {
                    success: true as const,
                    applied: false as const,
                    guidance: result.guidance,
                    reminder: JOB_ONCHAIN_IMMUTABLE_GUIDANCE,
                }
            }
            return {
                success: true as const,
                applied: true as const,
                message: `Updated job ${jobId}`,
            }
        },
    }),

    job_reject: tool({
        description:
            "Client: abandon an off-chain-only open job, or after sending reject on Kite Agentic Commerce, sync terminal rejected/expired state. If the chain is not yet rejected, the tool returns onChain.steps to run reject() from the wallet, then job_sync_chain. After wallet steps, reply briefly.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await rejectAgentJobAsClient({ userId, jobId })
            if (result.ok) {
                return {
                    success: true as const,
                    jobId,
                    message: `Job ${jobId} marked rejected or sync completed.`,
                }
            }
            const prep = await getRejectJobOnChainBundle({ userId, jobId })
            if (prep.ok) {
                return {
                    success: false as const,
                    jobId,
                    error: result.error,
                    onChain: prep.bundle,
                }
            }
            return {
                success: false as const,
                jobId,
                error: result.error,
            }
        },
    }),

    job_sync_chain: tool({
        description:
            "Refresh mirrored ERC-8183 fields (budget, status, expiry, addresses) from Kite via getJob for a job that already has acp_job_id. Use after wallet txs or when you need a chain refresh without loading the full job via job_get (errors if the job has no on-chain id yet).",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await syncAgentJobFromChainByDbId(jobId)
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: `Synced job ${jobId}.` }
        },
    }),

    job_search: tool({
        description:
            "Search jobs: keywords, status, client display name, USDT budget range. Omit filters for recent jobs.",
        inputSchema: z.object({
            keywords: z.string().optional(),
            keywordMode: keywordModeSchema.optional(),
            status: z
                .unknown()
                .optional()
                .transform((v) => {
                    if (v === undefined || v === null) {
                        return undefined
                    }
                    if (v === "all") {
                        return "all" as const
                    }
                    if (Array.isArray(v)) {
                        const xs = v
                            .filter((x): x is string => typeof x === "string")
                            .map((x) => parseAgentJobStatusFilter(x))
                            .filter((s) => s !== "all")
                        if (xs.length === 0) {
                            return "all" as const
                        }
                        return xs.length === 1 ? xs[0]! : xs
                    }
                    if (typeof v !== "string") {
                        return "all" as const
                    }
                    return parseAgentJobStatusFilter(v)
                }),
            clientNameContains: z.string().optional(),
            minBudgetAmount: z.string().optional(),
            maxBudgetAmount: z.string().optional(),
            limit: z.number().int().min(1).max(50).optional(),
        }),
        execute: async (input) => {
            try {
                const jobs = await searchAgentJobs({
                    keywords: trimOptional(input.keywords),
                    keywordMode: input.keywordMode ?? "any",
                    status: input.status ?? "all",
                    clientNameContains: trimOptional(input.clientNameContains),
                    minBudgetAmount: trimOptional(input.minBudgetAmount),
                    maxBudgetAmount: trimOptional(input.maxBudgetAmount),
                    limit: input.limit,
                })
                return {
                    success: true as const,
                    count: jobs.length,
                    jobs: jobs.map((j) => ({
                        id: j.id,
                        title: j.title,
                        description: j.description,
                        budget: `${j.budgetAmount} ${j.budgetCurrency}`,
                        status: j.status,
                        clientName: j.clientName,
                        createdAt:
                            j.createdAt?.toISOString?.() ?? String(j.createdAt),
                    })),
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Search failed"
                return { success: false as const, error: msg }
            }
        },
    }),

    job_list_mine: tool({
        description: "List jobs you created as client.",
        inputSchema: z.object({}),
        execute: async () => {
            const jobs = await listMyPostedJobs(userId)
            return {
                success: true as const,
                jobs: jobs.map((j) => ({
                    ...j,
                    createdAt:
                        j.createdAt?.toISOString?.() ?? String(j.createdAt),
                })),
            }
        },
    }),

    job_get: tool({
        description:
            "Get one job by id with fields for your role. Refreshes chain-mirrored fields from Kite when the job has acp_job_id (best-effort before read). App status submitted means the provider already saved off-chain delivery. Client sees delivery content only after on-chain status is submitted (or terminal); provider always sees their submission when allowed.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            await syncAgentJobFromChainByDbId(jobId)
            const result = await getJobForViewer({
                viewerUserId: userId,
                jobId,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                job: serializeJobForTool(result.job),
            }
        },
    }),

    job_review: tool({
        description:
            "Read job details and delivery (same visibility rules as job_get, including chain refresh when on-chain id exists). App status submitted means delivery was already saved off-chain—do not say the provider still needs to submit.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            await syncAgentJobFromChainByDbId(jobId)
            const result = await getJobForViewer({
                viewerUserId: userId,
                jobId,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                job: serializeJobForTool(result.job),
            }
        },
    }),

    job_submit: tool({
        description:
            "As the assigned provider: upload final delivery (text / image / both). Saves delivery and deliverableCommitment in the app and returns onChain.steps for contract submit(); then job_sync_chain. After submit txs in the UI, reply briefly—user already signed in the wallet.",
        inputSchema: jobSubmitInputSchema,
        execute: async (input) => {
            let payload: JobDeliveryPayload

            if (input.mode === "text") {
                payload = {
                    blocks: [{ type: "text", body: input.body! }],
                }
            } else if (input.mode === "image") {
                const img = await generateDeliveryImageAndUpload({
                    userId,
                    jobId: input.jobId,
                    prompt: input.prompt!,
                    modelId: input.modelId,
                    aspectRatio: normalizeAspectRatio(input.aspectRatio),
                })
                if (!img.ok) {
                    return { success: false as const, error: img.error }
                }
                payload = {
                    blocks: [
                        {
                            type: "file",
                            name: img.name,
                            mimeType: img.mimeType,
                            url: img.url,
                        },
                    ],
                }
            } else {
                const img = await generateDeliveryImageAndUpload({
                    userId,
                    jobId: input.jobId,
                    prompt: input.prompt!,
                    modelId: input.modelId,
                    aspectRatio: normalizeAspectRatio(input.aspectRatio),
                })
                if (!img.ok) {
                    return { success: false as const, error: img.error }
                }
                payload = {
                    blocks: [
                        { type: "text", body: input.body! },
                        {
                            type: "file",
                            name: img.name,
                            mimeType: img.mimeType,
                            url: img.url,
                        },
                    ],
                }
            }

            const result = await submitJobDelivery({
                userId,
                jobId: input.jobId,
                deliveryPayload: payload,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            const bundle = await getSubmitDeliveryOnChainBundle({
                userId,
                jobId: input.jobId,
            })
            if (!bundle.ok) {
                return {
                    success: true as const,
                    jobId: input.jobId,
                    deliverableCommitment: result.deliverableCommitment,
                    message: `Delivery saved; submit calldata unavailable: ${bundle.error}`,
                }
            }
            return {
                success: true as const,
                jobId: input.jobId,
                deliverableCommitment: result.deliverableCommitment,
                onChain: bundle.bundle,
                message: `Delivery saved for job ${input.jobId}; job_sync_chain after chain confirms.`,
            }
        },
    }),

    job_complete: tool({
        description:
            "As the client: align app with chain after delivery. If the chain is not completed yet, the tool returns onChain.steps so the user can send complete() from their wallet, then sync. After the wallet tx + sync, call this tool again to finalize DB. After wallet steps, reply briefly.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await completeJobAsClient({
                userId,
                jobId,
            })
            if (result.ok) {
                return {
                    success: true as const,
                    jobId,
                    message: "Job completed (chain + app aligned).",
                }
            }
            const prep = await getCompleteJobOnChainBundle({ userId, jobId })
            if (prep.ok) {
                return {
                    success: false as const,
                    jobId,
                    error: result.error,
                    onChain: prep.bundle,
                }
            }
            return {
                success: false as const,
                jobId,
                error: result.error,
            }
        },
    }),
})

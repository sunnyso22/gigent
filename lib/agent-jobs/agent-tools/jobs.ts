import { tool } from "ai"
import { z } from "zod"

import { generateDeliveryImageAndUpload } from "@/lib/agent-jobs/delivery/image-gen"
import type { JobDeliveryPayload } from "@/lib/agent-jobs/delivery/payload"
import {
    cancelAgentJobAsPoster,
    completeJobAsPoster,
    createAgentJob,
    getJobForViewer,
    getPayToViewPreviewForPoster,
    listMyPostedJobs,
    searchAgentJobs,
    submitJobDelivery,
    trimOptional,
    updateAgentJobAsPoster,
} from "@/lib/agent-jobs/service"

import { parseAgentJobStatusFilter } from "@/lib/agent-jobs/job-status"

import { keywordModeSchema, rewardCurrencySchema } from "./schemas"

type GetJobForViewerResult = Awaited<ReturnType<typeof getJobForViewer>>
type JobRow = Extract<GetJobForViewerResult, { ok: true }>["job"]

const serializeJobForTool = (job: JobRow) => ({
    ...job,
    createdAt: job.createdAt?.toISOString?.() ?? String(job.createdAt),
    deliveredAt:
        job.deliveredAt == null
            ? null
            : (job.deliveredAt?.toISOString?.() ?? String(job.deliveredAt)),
    completedAt:
        job.completedAt == null
            ? null
            : (job.completedAt?.toISOString?.() ?? String(job.completedAt)),
    paymentSettledAt:
        job.paymentSettledAt == null
            ? null
            : (job.paymentSettledAt?.toISOString?.() ??
              String(job.paymentSettledAt)),
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

export const createJobsTools = (userId: string) => ({
    job_create: tool({
        description:
            "Create a new Agent Job: title, description, required AI model id (e.g. openai/gpt-5), reward amount and currency (USDC or ETH). Reward is recorded only until payments exist.",
        inputSchema: z.object({
            title: z.string().min(1),
            description: z.string().min(1),
            requiredModelId: z.string().min(1),
            rewardAmount: z
                .string()
                .describe('Decimal string, e.g. "50" or "49.99"'),
            rewardCurrency: rewardCurrencySchema,
        }),
        execute: async (input) => {
            const { id } = await createAgentJob({ userId, ...input })
            return {
                success: true as const,
                jobId: id,
                message: `Created job ${id}`,
            }
        },
    }),

    job_update: tool({
        description:
            "Update a job you posted. Only while status is open. Provide jobId and fields to change.",
        inputSchema: z
            .object({
                jobId: z.string().min(1),
                title: z.string().min(1).optional(),
                description: z.string().min(1).optional(),
                requiredModelId: z.string().min(1).optional(),
                rewardAmount: z
                    .string()
                    .optional()
                    .describe('Decimal string, e.g. "50" or "49.99"'),
                rewardCurrency: rewardCurrencySchema.optional(),
            })
            .refine(
                (v) =>
                    v.title !== undefined ||
                    v.description !== undefined ||
                    v.requiredModelId !== undefined ||
                    v.rewardAmount !== undefined ||
                    v.rewardCurrency !== undefined,
                { message: "Provide at least one field to update" }
            ),
        execute: async (input) => {
            const { jobId, ...rest } = input
            const result = await updateAgentJobAsPoster({
                userId,
                jobId,
                ...rest,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: `Updated job ${jobId}` }
        },
    }),

    job_cancel: tool({
        description:
            "Cancel a job you posted while it is still open (soft cancel). Cannot cancel after a bid is accepted.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await cancelAgentJobAsPoster({ userId, jobId })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                message: `Job ${jobId} cancelled.`,
            }
        },
    }),

    job_search: tool({
        description:
            "Search jobs: filters for keywords, status (open = bidding; assigned = bid accepted), model id substring, poster name, reward range + currency. Omit filters for recent jobs.",
        inputSchema: z
            .object({
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
                                .filter(
                                    (x): x is string => typeof x === "string"
                                )
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
                exactRequiredModelId: z.string().optional(),
                modelContains: z.string().optional(),
                posterNameContains: z.string().optional(),
                minRewardAmount: z.string().optional(),
                maxRewardAmount: z.string().optional(),
                rewardCurrency: rewardCurrencySchema.optional(),
                limit: z.number().int().min(1).max(50).optional(),
            })
            .refine(
                (v) => {
                    const hasR =
                        (v.minRewardAmount?.trim() ?? "") !== "" ||
                        (v.maxRewardAmount?.trim() ?? "") !== ""
                    if (!hasR) {
                        return true
                    }
                    return v.rewardCurrency !== undefined
                },
                {
                    message:
                        "rewardCurrency is required when minRewardAmount or maxRewardAmount is set",
                }
            ),
        execute: async (input) => {
            try {
                const jobs = await searchAgentJobs({
                    keywords: trimOptional(input.keywords),
                    keywordMode: input.keywordMode ?? "any",
                    status: input.status ?? "all",
                    exactRequiredModelId: trimOptional(
                        input.exactRequiredModelId
                    ),
                    modelContains: trimOptional(input.modelContains),
                    posterNameContains: trimOptional(input.posterNameContains),
                    minRewardAmount: trimOptional(input.minRewardAmount),
                    maxRewardAmount: trimOptional(input.maxRewardAmount),
                    rewardCurrency: input.rewardCurrency,
                    limit: input.limit,
                })
                return {
                    success: true as const,
                    count: jobs.length,
                    jobs: jobs.map((j) => ({
                        id: j.id,
                        title: j.title,
                        description: j.description,
                        requiredModelId: j.requiredModelId,
                        reward: `${j.rewardAmount} ${j.rewardCurrency}`,
                        status: j.status,
                        posterName: j.posterName,
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
        description: "List jobs you posted.",
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
            "Get one job by id with fields appropriate for your role. Status pending_review always means the assignee has already submitted delivery. As poster, the delivery payload may be hidden until x402 USDC pay-to-view is settled (check paymentStatus); after settled, delivery is visible. Assignee always sees their submitted delivery.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
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
            "Read job details and delivery. pending_review means the assignee has already submitted—do not say they still need to submit. Poster: if payment is unsettled, delivery is hidden; after pay-to-view settles (wallet or automation message), call job_review anytime to read the full delivery. Assignee: sees their submission.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
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

    job_pay_to_view: tool({
        description:
            "As the poster: for pending_review jobs (delivery already submitted by assignee), when pay-to-view is not settled returns paymentRequired + payPath (USDC, Base Sepolia). The Agents client then runs x402 payment (no separate pay banner). After payment settles, the UI may send an automation user message—then call job_review immediately. If already settled, returns settled: true.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await getPayToViewPreviewForPoster({
                userId,
                jobId,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            if (result.settled) {
                return {
                    success: true as const,
                    paymentRequired: false as const,
                    settled: true as const,
                    message:
                        "Pay-to-view already settled. Delivery was submitted by the assignee; use job_review to read it anytime.",
                }
            }
            return {
                success: true as const,
                paymentRequired: true as const,
                settled: false as const,
                jobId,
                amount: result.amount,
                currency: result.currency,
                network: result.network,
                payPath: result.payPath,
                message:
                    "Assignee has already submitted (pending_review). Link wallet in Settings if needed; the client will complete x402 payment next. After payment settles, call job_review to see delivery (or when the automation message says pay-to-view settled).",
            }
        },
    }),

    job_submit: tool({
        description:
            "As the assignee: submit final delivery in one step. Mode text = essay/article body; image = AI-generated image from prompt; text_and_image = both. Uploads to storage as needed. Sets status to pending_review (meaning submission is complete; poster must pay-to-view before seeing it).",
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
            return {
                success: true as const,
                message:
                    "Delivery submitted. Job is pending_review—the assignee has finished submitting; the poster can read the delivery after pay-to-view (if required), using job_review.",
            }
        },
    }),

    job_complete: tool({
        description:
            "As the poster: after you have read the delivery via job_review (pay-to-view must be settled first if applicable), mark the job completed when the user confirms acceptance. USDC moved at pay-to-view, not here.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await completeJobAsPoster({
                userId,
                jobId,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                message: "Job completed.",
            }
        },
    }),
})

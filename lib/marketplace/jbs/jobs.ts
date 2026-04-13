import { tool } from "ai"
import { z } from "zod"

import { generateDeliveryPdfAndUpload } from "@/lib/marketplace/delivery/pdf-gen"
import { generateDeliveryImageAndUpload } from "@/lib/marketplace/delivery/image-gen"
import { jobDeliveryPayloadSchema } from "@/lib/marketplace/delivery/payload"
import { uploadDeliveryFileBytes } from "@/lib/marketplace/delivery/storage"
import {
    MAX_TEXT_DELIVERY_CONTENT_CHARS,
    uploadUtf8TextDeliveryFile,
} from "@/lib/marketplace/delivery/text-file"
import { DELIVERY_UPLOAD_MAX_BYTES } from "@/lib/marketplace/delivery/upload-rules"
import {
    assertJobDeliveryUploadAllowed,
    confirmJobCompletion,
    createAgentJob,
    listMyPostedJobs,
    searchAgentJobs,
    submitJobDelivery,
    trimOptional,
    updateAgentJobAsPoster,
} from "@/lib/marketplace/service"

import {
    aspectRatioStringSchema,
    keywordModeSchema,
    rewardCurrencySchema,
    singleJobStatusSchema,
} from "./schemas"

export const createJobsTools = (userId: string) => ({
    marketplace_createJob: tool({
        description:
            "Create a new Agent Job on the Marketplace: title, description, required AI model id (e.g. openai/gpt-5.4), reward amount and currency (USDC or ETH). Payments are recorded only (placeholder).",
        inputSchema: z.object({
            title: z.string().min(1),
            description: z.string().min(1),
            requiredModelId: z.string().min(1),
            rewardAmount: z.string().describe('Decimal string, e.g. "50" or "49.99"'),
            rewardCurrency: rewardCurrencySchema,
        }),
        execute: async (input) => {
            const { id } = await createAgentJob({ userId, ...input })
            return { success: true as const, jobId: id, message: `Created job ${id}` }
        },
    }),

    marketplace_updateJob: tool({
        description:
            "Update a Marketplace job you posted. Only jobs in open status can be edited. Provide jobId and any fields to change: title, description, requiredModelId, reward amount, and/or reward currency (USDC or ETH).",
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
            const result = await updateAgentJobAsPoster({ userId, jobId, ...rest })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: `Updated job ${jobId}` }
        },
    }),

    marketplace_searchJobs: tool({
        description:
            "Search Marketplace jobs with composable filters. Map user language: \"open jobs\" → status open; \"bid accepted\" / assigned worker → status assigned; topics (e.g. image generation) → keywords + keywordMode any (default) or all for stricter matches; model names → modelContains (substring on required model id); poster → posterNameContains; reward thresholds → minRewardAmount/maxRewardAmount + rewardCurrency (same currency only). Omit filters to list recent jobs (up to limit).",
        inputSchema: z
            .object({
                keywords: z
                    .string()
                    .optional()
                    .describe(
                        "Topic or search words; matched across title, description, model id, poster name. Empty = no keyword filter."
                    ),
                keywordMode: keywordModeSchema
                    .optional()
                    .describe(
                        "any = any token matches (OR, default); all = every token must match (AND)."
                    ),
                status: z
                    .union([
                        singleJobStatusSchema,
                        z.array(singleJobStatusSchema),
                        z.literal("all"),
                    ])
                    .optional()
                    .describe(
                        "Filter by lifecycle. Omit or \"all\" for every status. \"Bid accepted\" = assigned."
                    ),
                exactRequiredModelId: z
                    .string()
                    .optional()
                    .describe(
                        "Only if the user gave this exact required_model_id string."
                    ),
                modelContains: z
                    .string()
                    .optional()
                    .describe(
                        "Substring match on required model id (e.g. gpt-5, claude-sonnet)."
                    ),
                posterNameContains: z
                    .string()
                    .optional()
                    .describe("Substring match on poster display name (e.g. David Lee)."),
                minRewardAmount: z
                    .string()
                    .optional()
                    .describe('Lower bound decimal string, e.g. "100"'),
                maxRewardAmount: z
                    .string()
                    .optional()
                    .describe("Upper bound decimal string."),
                rewardCurrency: rewardCurrencySchema
                    .optional()
                    .describe("Required when min or max reward is set."),
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
                    exactRequiredModelId: trimOptional(input.exactRequiredModelId),
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

    marketplace_listMyPostedJobs: tool({
        description: "List Agent Jobs you posted.",
        inputSchema: z.object({}),
        execute: async () => {
            const jobs = await listMyPostedJobs(userId)
            return {
                success: true as const,
                jobs: jobs.map((j) => ({
                    ...j,
                    createdAt: j.createdAt?.toISOString?.() ?? String(j.createdAt),
                })),
            }
        },
    }),

    marketplace_uploadDeliveryFile: tool({
        description:
            "As the assignee on an assigned job: upload file bytes to Supabase Storage and get an https URL. Use for html, css, js, md, pdf, images, etc. Pass standard base64 (no data: URL prefix). Then put { type: \"file\", name, mimeType, url } in marketplace_submitDelivery. Job must be assigned to you.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            filename: z.string().min(1).max(512),
            mimeType: z.string().min(1).max(200),
            base64: z
                .string()
                .min(1)
                .max(Math.ceil(DELIVERY_UPLOAD_MAX_BYTES * 1.4)),
        }),
        execute: async ({ jobId, filename, mimeType, base64 }) => {
            const allowed = await assertJobDeliveryUploadAllowed({
                userId,
                jobId,
            })
            if (!allowed.ok) {
                return { success: false as const, error: allowed.error }
            }
            let buf: Buffer
            try {
                buf = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64")
            } catch {
                return { success: false as const, error: "Invalid base64" }
            }
            const result = await uploadDeliveryFileBytes({
                jobId,
                buffer: buf,
                originalFileName: filename,
                mimeType,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                url: result.data.url,
                name: result.data.name,
                mimeType: result.data.mimeType,
            }
        },
    }),

    marketplace_uploadDeliveryTextFile: tool({
        description:
            "As the assignee: upload a UTF-8 text or code file (html, css, js, ts, md, json, svg, xml, etc.) to Supabase without base64. Pass raw file content as the content string. Returns https URL for a file block. Not for raster images or binary PDFs — use marketplace_uploadDeliveryFile (base64) or marketplace_generateDeliveryImage / marketplace_generateDeliveryPdf instead.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            filename: z.string().min(1).max(512),
            mimeType: z.string().min(1).max(200),
            content: z.string().max(MAX_TEXT_DELIVERY_CONTENT_CHARS),
        }),
        execute: async ({ jobId, filename, mimeType, content }) => {
            const result = await uploadUtf8TextDeliveryFile({
                userId,
                jobId,
                filename,
                mimeType,
                content,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                url: result.url,
                name: result.name,
                mimeType: result.mimeType,
            }
        },
    }),

    marketplace_generateDeliveryPdf: tool({
        description:
            "As the assignee: build a simple PDF from title and body text (plain text / line breaks), upload to Supabase, return https URL for a file block. Use for reports or text deliverables exported as PDF. For complex PDFs from existing bytes use marketplace_uploadDeliveryFile with base64.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            body: z.string().min(1).max(500_000),
            title: z.string().max(500).optional(),
            filename: z.string().max(512).optional(),
        }),
        execute: async ({ jobId, body, title, filename }) => {
            const result = await generateDeliveryPdfAndUpload({
                userId,
                jobId,
                body,
                title,
                filename,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                url: result.url,
                name: result.name,
                mimeType: result.mimeType,
            }
        },
    }),

    marketplace_generateDeliveryImage: tool({
        description:
            "As the assignee: generate one raster image (PNG/JPEG/WebP) from a text prompt via the AI Gateway image model, upload to Supabase, return https URL for a file block. Image generation only — not for HTML/CSS/code/PDF. For code or markdown use marketplace_uploadDeliveryTextFile; for PDF text reports use marketplace_generateDeliveryPdf; for arbitrary binary use marketplace_uploadDeliveryFile (base64).",
        inputSchema: z.object({
            jobId: z.string().min(1),
            prompt: z.string().min(1).max(4000),
            modelId: z.string().min(1).optional(),
            aspectRatio: aspectRatioStringSchema.optional(),
        }),
        execute: async ({ jobId, prompt, modelId, aspectRatio }) => {
            const result = await generateDeliveryImageAndUpload({
                userId,
                jobId,
                prompt,
                modelId,
                aspectRatio,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                url: result.url,
                name: result.name,
                mimeType: result.mimeType,
            }
        },
    }),

    marketplace_submitDelivery: tool({
        description:
            "As the assigned bidder, submit final delivery for review: deliveryPayload.blocks with type text (body) and/or type file (name, mimeType, https url). Use the delivery file tools first to obtain https URLs: marketplace_uploadDeliveryTextFile (utf-8 code/docs), marketplace_generateDeliveryImage (raster image from prompt), marketplace_generateDeliveryPdf (simple PDF from text), marketplace_uploadDeliveryFile (any binary including pre-built PDF via base64).",
        inputSchema: z.object({
            jobId: z.string().min(1),
            deliveryPayload: jobDeliveryPayloadSchema,
        }),
        execute: async (input) => {
            const result = await submitJobDelivery({
                userId,
                jobId: input.jobId,
                deliveryPayload: input.deliveryPayload,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                message: "Delivery submitted; poster can review and confirm.",
            }
        },
    }),

    marketplace_confirmCompletion: tool({
        description:
            "As the poster, confirm the job is complete after reviewing the delivery.",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const result = await confirmJobCompletion({ userId, jobId })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: "Job marked completed." }
        },
    }),
})

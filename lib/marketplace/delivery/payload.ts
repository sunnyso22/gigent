import { z } from "zod"

const MAX_TEXT_BODY = 500_000
const MAX_BLOCKS = 100

const httpsUrlSchema = z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "URL must use https")

const deliveryBlockSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text"),
        body: z.string().min(1).max(MAX_TEXT_BODY),
    }),
    z.object({
        type: z.literal("file"),
        name: z.string().min(1).max(512),
        mimeType: z.string().min(1).max(200),
        url: httpsUrlSchema,
    }),
])

export const jobDeliveryPayloadSchema = z.object({
    blocks: z.array(deliveryBlockSchema).min(1).max(MAX_BLOCKS),
})

export type DeliveryBlock = z.infer<typeof deliveryBlockSchema>
export type JobDeliveryPayload = z.infer<typeof jobDeliveryPayloadSchema>

export const parseJobDeliveryPayload = (
    raw: unknown
): { ok: true; data: JobDeliveryPayload } | { ok: false; error: string } => {
    const r = jobDeliveryPayloadSchema.safeParse(raw)
    if (!r.success) {
        return {
            ok: false,
            error: r.error.issues.map((i) => i.message).join("; ") || "Invalid delivery",
        }
    }
    return { ok: true, data: r.data }
}

/** Same shape as submit; allows http(s) for legacy rows. */
const jobDeliveryPayloadFromDbSchema = z.object({
    blocks: z
        .array(
            z.discriminatedUnion("type", [
                z.object({
                    type: z.literal("text"),
                    body: z.string().min(1).max(MAX_TEXT_BODY),
                }),
                z.object({
                    type: z.literal("file"),
                    name: z.string().min(1).max(512),
                    mimeType: z.string().min(1).max(200),
                    url: z.string().url(),
                }),
            ])
        )
        .min(1)
        .max(MAX_BLOCKS),
})

export type JobDeliveryPayloadFromDb = z.infer<
    typeof jobDeliveryPayloadFromDbSchema
>

export const parseJobDeliveryPayloadFromDb = (
    raw: unknown
): JobDeliveryPayloadFromDb | null => {
    if (raw === null || raw === undefined) {
        return null
    }
    const r = jobDeliveryPayloadFromDbSchema.safeParse(raw)
    return r.success ? r.data : null
}

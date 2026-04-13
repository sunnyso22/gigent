import { createGatewayProvider } from "@ai-sdk/gateway"
import { generateImage } from "ai"

import { getDecryptedUserAiGatewayApiKey } from "@/lib/ai-gateway"

import { assertJobDeliveryUploadAllowed } from "@/lib/marketplace/service"

import { uploadDeliveryFileBytes } from "./storage"

const defaultImageModelId = (): string => "openai/gpt-image-1-mini"

const extFromMediaType = (mediaType: string): string => {
    const m = mediaType.toLowerCase()
    if (m.includes("png")) {
        return "png"
    }
    if (m.includes("jpeg") || m.includes("jpg")) {
        return "jpg"
    }
    if (m.includes("webp")) {
        return "webp"
    }
    if (m.includes("gif")) {
        return "gif"
    }
    return "png"
}

export const generateDeliveryImageAndUpload = async (input: {
    userId: string
    jobId: string
    prompt: string
    modelId?: string
    aspectRatio?: `${number}:${number}`
}): Promise<
    | { ok: true; url: string; name: string; mimeType: string }
    | { ok: false; error: string }
> => {
    const allowed = await assertJobDeliveryUploadAllowed({
        userId: input.userId,
        jobId: input.jobId,
    })
    if (!allowed.ok) {
        return { ok: false, error: allowed.error }
    }

    const apiKey = await getDecryptedUserAiGatewayApiKey(input.userId)
    if (!apiKey) {
        return {
            ok: false,
            error: "Add your Vercel AI Gateway API key in /settings before generating images.",
        }
    }

    const modelId = input.modelId?.trim() || defaultImageModelId()
    const gateway = createGatewayProvider({ apiKey })
    const imageModel = gateway.image(
        modelId as Parameters<typeof gateway.image>[0]
    )

    try {
        const result = await generateImage({
            model: imageModel,
            prompt: input.prompt,
            aspectRatio: input.aspectRatio,
            providerOptions: {
                gateway: {
                    user: input.userId,
                    tags: ["feature:delivery-image"],
                },
            },
        })

        const file = result.image
        const buf = Buffer.from(file.uint8Array)
        const ext = extFromMediaType(file.mediaType)
        const name = `delivery-${crypto.randomUUID()}.${ext}`

        const up = await uploadDeliveryFileBytes({
            jobId: input.jobId,
            buffer: buf,
            originalFileName: name,
            mimeType: file.mediaType,
        })
        if (!up.ok) {
            return { ok: false, error: up.error }
        }
        return {
            ok: true,
            url: up.data.url,
            name: up.data.name,
            mimeType: up.data.mimeType,
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Image generation failed"
        console.error("[delivery-image-gen]", e)
        return { ok: false, error: msg }
    }
}

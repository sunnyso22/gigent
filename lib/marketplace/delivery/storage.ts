import {
    DELIVERY_UPLOAD_MAX_BYTES,
    isAllowedDeliveryUploadMime,
    sanitizeDeliveryUploadFileName,
} from "./upload-rules"
import {
    createSupabaseServiceClient,
    getSupabaseStorageEnv,
} from "@/lib/supabase/admin"

export type UploadDeliveryFileResult = {
    url: string
    path: string
    name: string
    mimeType: string
}

export const uploadDeliveryFileBytes = async (input: {
    jobId: string
    buffer: Buffer
    originalFileName: string
    mimeType: string
}): Promise<
    { ok: true; data: UploadDeliveryFileResult } | { ok: false; error: string }
> => {
    const mime = (input.mimeType || "application/octet-stream").trim()
    if (!isAllowedDeliveryUploadMime(mime)) {
        return { ok: false, error: "File type not allowed for delivery upload" }
    }
    if (input.buffer.length <= 0 || input.buffer.length > DELIVERY_UPLOAD_MAX_BYTES) {
        return {
            ok: false,
            error: `File must be between 1 byte and ${DELIVERY_UPLOAD_MAX_BYTES} bytes`,
        }
    }

    const env = getSupabaseStorageEnv()
    const client = createSupabaseServiceClient()
    if (!env || !client) {
        return {
            ok: false,
            error:
                "Supabase Storage is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)",
        }
    }

    const safeName = sanitizeDeliveryUploadFileName(input.originalFileName)
    const path = `${input.jobId}/${crypto.randomUUID()}-${safeName}`

    const { data, error } = await client.storage
        .from(env.bucket)
        .upload(path, input.buffer, {
            contentType: mime,
            upsert: false,
        })

    if (error) {
        console.error("[delivery-storage]", error)
        return { ok: false, error: "Upload failed" }
    }

    const {
        data: { publicUrl },
    } = client.storage.from(env.bucket).getPublicUrl(data.path)

    return {
        ok: true,
        data: {
            url: publicUrl,
            path: data.path,
            name: input.originalFileName,
            mimeType: mime,
        },
    }
}

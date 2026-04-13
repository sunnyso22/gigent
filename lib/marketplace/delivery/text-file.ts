import { assertJobDeliveryUploadAllowed } from "@/lib/marketplace/service"

import { uploadDeliveryFileBytes } from "./storage"
import { DELIVERY_UPLOAD_MAX_BYTES } from "./upload-rules"

/** UTF-8 text/code assets (not arbitrary binary). */
export const MAX_TEXT_DELIVERY_CONTENT_CHARS = 2_000_000

export const isAllowedUtf8TextDeliveryMime = (mime: string): boolean => {
    const m = mime.trim().toLowerCase()
    if (m === "image/svg+xml") {
        return true
    }
    if (m.startsWith("text/")) {
        return true
    }
    if (
        m === "application/json" ||
        m === "application/javascript" ||
        m === "application/xml"
    ) {
        return true
    }
    return false
}

export const uploadUtf8TextDeliveryFile = async (input: {
    userId: string
    jobId: string
    filename: string
    mimeType: string
    content: string
}): Promise<
    | { ok: true; url: string; name: string; mimeType: string }
    | { ok: false; error: string }
> => {
    if (!isAllowedUtf8TextDeliveryMime(input.mimeType)) {
        return {
            ok: false,
            error:
                "mimeType must be text/*, image/svg+xml, application/json, application/javascript, or application/xml",
        }
    }
    if (input.content.length > MAX_TEXT_DELIVERY_CONTENT_CHARS) {
        return { ok: false, error: "Content exceeds maximum length" }
    }

    const allowed = await assertJobDeliveryUploadAllowed({
        userId: input.userId,
        jobId: input.jobId,
    })
    if (!allowed.ok) {
        return { ok: false, error: allowed.error }
    }

    const buf = Buffer.from(input.content, "utf8")
    if (buf.length > DELIVERY_UPLOAD_MAX_BYTES) {
        return { ok: false, error: "Encoded file exceeds upload size limit" }
    }

    const result = await uploadDeliveryFileBytes({
        jobId: input.jobId,
        buffer: buf,
        originalFileName: input.filename,
        mimeType: input.mimeType,
    })
    if (!result.ok) {
        return { ok: false, error: result.error }
    }
    return {
        ok: true,
        url: result.data.url,
        name: result.data.name,
        mimeType: result.data.mimeType,
    }
}

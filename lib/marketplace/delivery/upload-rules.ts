/** Max size for a single file uploaded to Supabase Storage for job delivery. */
export const DELIVERY_UPLOAD_MAX_BYTES = 15 * 1024 * 1024

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "text/plain",
    "text/html",
    "text/css",
    "text/markdown",
    "text/javascript",
    "application/javascript",
    "application/json",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
])

export const isAllowedDeliveryUploadMime = (mime: string): boolean => {
    const m = mime.trim().toLowerCase()
    if (ALLOWED_MIME.has(m)) {
        return true
    }
    if (m.startsWith("text/")) {
        return true
    }
    return false
}

export const sanitizeDeliveryUploadFileName = (name: string): string => {
    const base = name.replace(/[/\\]/g, "").trim()
    const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200)
    return safe || "file"
}

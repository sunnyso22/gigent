import type { JobDeliveryPayloadFromDb } from "@/lib/marketplace/delivery/payload"
import { canViewerAccessJobDelivery } from "@/lib/marketplace/delivery/visibility"
import {
    createSupabaseServiceClient,
    getSupabaseStorageEnv,
} from "@/lib/supabase/admin"

const SIGNED_URL_TTL_SEC = 60 * 60

/** Parses `/storage/v1/object/public/{bucket}/{objectPath}` for this Supabase project. */
const parseSupabasePublicObjectUrl = (
    fileUrl: string,
    supabaseProjectUrl: string
): { bucket: string; objectPath: string } | null => {
    let file: URL
    try {
        file = new URL(fileUrl)
    } catch {
        return null
    }
    let base: URL
    try {
        base = new URL(supabaseProjectUrl)
    } catch {
        return null
    }
    if (file.origin !== base.origin) {
        return null
    }
    const prefix = "/storage/v1/object/public/"
    if (!file.pathname.startsWith(prefix)) {
        return null
    }
    const rest = file.pathname.slice(prefix.length)
    const i = rest.indexOf("/")
    if (i === -1) {
        return null
    }
    const bucket = decodeURIComponent(rest.slice(0, i))
    const objectPath = decodeURIComponent(rest.slice(i + 1))
    return { bucket, objectPath }
}

/**
 * Replaces public Storage URLs with time-limited signed URLs so images/files load when the
 * bucket is **private** (public URLs return 404). No-op if Storage is unconfigured or the
 * viewer is not the poster or assignee.
 */
export const signDeliveryPayloadUrlsForViewer = async (input: {
    jobId: string
    deliveryPayload: JobDeliveryPayloadFromDb | null
    viewerUserId: string | null
    posterUserId: string
    assigneeUserId: string | null
}): Promise<JobDeliveryPayloadFromDb | null> => {
    const { jobId, deliveryPayload, viewerUserId, posterUserId, assigneeUserId } =
        input

    if (!deliveryPayload?.blocks?.length) {
        return deliveryPayload
    }

    if (
        !canViewerAccessJobDelivery(viewerUserId, posterUserId, assigneeUserId)
    ) {
        return deliveryPayload
    }

    const env = getSupabaseStorageEnv()
    const client = createSupabaseServiceClient()
    if (!env || !client) {
        return deliveryPayload
    }

    const blocks = await Promise.all(
        deliveryPayload.blocks.map(async (block) => {
            if (block.type !== "file") {
                return block
            }
            const parsed = parseSupabasePublicObjectUrl(block.url, env.url)
            if (!parsed) {
                return block
            }
            if (!parsed.objectPath.startsWith(`${jobId}/`)) {
                return block
            }
            const { data, error } = await client.storage
                .from(parsed.bucket)
                .createSignedUrl(parsed.objectPath, SIGNED_URL_TTL_SEC)
            if (error || !data?.signedUrl) {
                console.error("[delivery-sign-url]", error)
                return block
            }
            return { ...block, url: data.signedUrl }
        })
    )

    return { blocks }
}

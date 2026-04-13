import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { uploadDeliveryFileBytes } from "@/lib/marketplace/delivery/storage"
import { assertJobDeliveryUploadAllowed } from "@/lib/marketplace/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    const allowed = await assertJobDeliveryUploadAllowed({
        userId: session.user.id,
        jobId,
    })
    if (!allowed.ok) {
        return jsonError(400, allowed.error)
    }

    let form: FormData
    try {
        form = await req.formData()
    } catch {
        return jsonError(400, "Expected multipart form data")
    }

    const file = form.get("file")
    if (!file || !(file instanceof File)) {
        return jsonError(400, 'Missing file field "file"')
    }

    const mime = (file.type || "application/octet-stream").trim()
    const buf = Buffer.from(await file.arrayBuffer())

    const result = await uploadDeliveryFileBytes({
        jobId,
        buffer: buf,
        originalFileName: file.name,
        mimeType: mime,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({
        ok: true as const,
        url: result.data.url,
        path: result.data.path,
        name: result.data.name,
        mimeType: result.data.mimeType,
    })
}

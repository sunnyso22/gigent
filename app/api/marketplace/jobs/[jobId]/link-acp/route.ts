import { NextResponse } from "next/server"

import { linkJobToAcpForUser } from "@/lib/agent-jobs/participant-chain"
import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: { acpJobId?: string; clientWalletAddress?: string }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const clientWallet = body.clientWalletAddress?.trim()
    if (!clientWallet) {
        return jsonError(400, "clientWalletAddress is required")
    }

    const result = await linkJobToAcpForUser(
        session.user.id,
        jobId,
        body.acpJobId ?? "",
        clientWallet
    )

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true as const })
}

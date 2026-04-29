import { NextResponse } from "next/server"

import { agentsListPayload } from "@/lib/agents/server-payloads"
import { unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const data = await agentsListPayload(session.user.id)
    return NextResponse.json(data)
}

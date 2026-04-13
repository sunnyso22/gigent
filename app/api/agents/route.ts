import { NextResponse } from "next/server"

import { listUserAgents } from "@/lib/agents/service"
import { unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const agents = await listUserAgents(session.user.id)
    return NextResponse.json({
        agents: agents.map((a) => ({
            id: a.id,
            title: a.title,
            modelId: a.modelId,
            updatedAt: a.updatedAt.toISOString(),
        })),
    })
}

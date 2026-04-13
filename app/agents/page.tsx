import { redirect } from "next/navigation"

import { Agents } from "@/components/agents/agents-chat"
import { hasUserAiGatewayApiKey } from "@/lib/ai-gateway"
import { getSession } from "@/lib/auth/session"

const Page = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/agents")
    }
    const hasApiKey = await hasUserAiGatewayApiKey(session.user.id)
    return <Agents hasApiKey={hasApiKey} />
}

export default Page

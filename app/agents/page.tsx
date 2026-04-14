import dynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { Loading } from "@/components/ui/loading"
import { hasUserAiGatewayApiKey } from "@/lib/ai-gateway"
import { getSession } from "@/lib/auth/session"

const Agents = dynamic(
    () =>
        import("@/components/agents/agents-chat").then((m) => ({
            default: m.Agents,
        })),
    {
        loading: () => (
            <Loading
                layout="page"
                label="Loading workspace…"
                className="bg-background text-foreground"
            />
        ),
    }
)

const Page = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/agents")
    }
    const hasApiKey = await hasUserAiGatewayApiKey(session.user.id)
    return <Agents hasApiKey={hasApiKey} />
}

export default Page

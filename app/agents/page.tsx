import { redirect } from "next/navigation"

import { Agents } from "@/components/agents"
import { getSession } from "@/lib/auth/session"

const Page = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/agents")
    }
    return <Agents />
}

export default Page

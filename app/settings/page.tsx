import Link from "next/link"
import { redirect } from "next/navigation"
import { IconArrowLeft } from "@tabler/icons-react"

import { AiGatewaySettingsForm } from "@/components/settings/ai-gateway-settings-form"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth/session"
import { hasUserAiGatewayApiKey } from "@/lib/ai-gateway"

type SettingsPageProps = {
    searchParams: Promise<{ needsKey?: string }>
}

const Page = async ({ searchParams }: SettingsPageProps) => {
    const session = await getSession()
    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/settings")
    }

    const hasKey = await hasUserAiGatewayApiKey(session.user.id)
    const sp = await searchParams
    const showNeedsKeyBanner = sp.needsKey === "1"

    const backHref = hasKey ? "/agents" : "/"
    const backLabel = hasKey ? "Back to agents" : "Back to home"

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    asChild
                >
                    <Link href={backHref} aria-label={backLabel}>
                        <IconArrowLeft />
                    </Link>
                </Button>
                <div className="flex min-w-0 flex-col">
                    <span className="font-heading text-sm">Settings</span>
                    <span className="text-[10px] text-muted-foreground">
                        Account
                    </span>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 py-8">
                <section aria-labelledby="gateway-heading">
                    <h2
                        id="gateway-heading"
                        className="sr-only"
                    >
                        Vercel AI Gateway
                    </h2>
                    <AiGatewaySettingsForm
                        showRequiredBanner={showNeedsKeyBanner}
                    />
                </section>
            </main>
        </div>
    )
}

export default Page

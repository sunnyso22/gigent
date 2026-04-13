import Link from "next/link"

import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"

const Page = () => {
    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <SiteHeader />

            <main className="flex flex-1 flex-col px-4 py-12 sm:px-6">
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 text-center">
                    <h1 className="font-heading text-2xl tracking-tight sm:text-3xl">
                        Where AI agents meet real missions
                    </h1>
                    <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
                        Chat in Agents and list missions on the Marketplace.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/agents">Go to Agents</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/marketplace">Browse Marketplace</Link>
                        </Button>
                    </div>
                </div>
            </main>

            <footer className="border-t border-border px-4 py-6 sm:px-6">
                <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
                    <span>© {new Date().getFullYear()} Gigent</span>
                    <span className="sm:ml-auto">
                        Powered by Next.js and the Vercel AI SDK
                    </span>
                </div>
            </footer>
        </div>
    )
}

export default Page

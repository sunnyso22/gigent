import Link from "next/link"

import { Button } from "@/components/ui/button"

const Page = () => {
    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <header className="border-b border-border px-4 py-4 sm:px-6">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                    <Link
                        href="/"
                        className="font-heading text-sm font-medium tracking-tight text-foreground"
                    >
                        Agents Marketplace
                    </Link>
                    <nav className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/agents">Agents</Link>
                        </Button>
                    </nav>
                </div>
            </header>

            <main className="flex flex-1 flex-col px-4 py-12 sm:px-6">
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 text-center">
                    <h1 className="font-heading text-2xl tracking-tight sm:text-3xl">
                        Build and chat with AI agents
                    </h1>
                    <p className="text-sm text-muted-foreground sm:text-base">
                        Open the workspace to start a conversation, pick a
                        model, and stream replies from your API route.
                    </p>
                    <div className="flex justify-center">
                        <Button asChild>
                            <Link href="/agents">Go to Agents</Link>
                        </Button>
                    </div>
                </div>
            </main>

            <footer className="border-t border-border px-4 py-6 sm:px-6">
                <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
                    <span>© {new Date().getFullYear()} Agents Marketplace</span>
                    <span className="sm:ml-auto">
                        Powered by Next.js and the Vercel AI SDK
                    </span>
                </div>
            </footer>
        </div>
    )
}

export default Page

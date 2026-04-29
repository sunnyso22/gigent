"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { HeaderConnectWalletButton } from "./header-connect-wallet-button"
import { UserAccountMenu } from "./user-account-menu"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { useConnection } from "wagmi"

export const SiteHeader = () => {
    const pathname = usePathname()
    const { data: session, isPending } = authClient.useSession()
    const { address, status } = useConnection()
    const walletAddress =
        status === "connected" && address ? address : null

    const agentsActive = pathname.startsWith("/agents")
    const marketplaceActive = pathname.startsWith("/marketplace")

    return (
        <header className="border-b border-border px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                <Link
                    href="/"
                    className="font-heading text-sm font-medium tracking-tight text-foreground"
                >
                    Gigent
                </Link>
                <div className="flex items-center gap-2">
                    <nav
                        className="flex items-center gap-1"
                        aria-label="Primary"
                    >
                        <Button
                            variant={agentsActive ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            asChild
                        >
                            <Link
                                href="/agents"
                                aria-current={agentsActive ? "page" : undefined}
                            >
                                Agents
                            </Link>
                        </Button>
                        <Button
                            variant={marketplaceActive ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            asChild
                        >
                            <Link
                                href="/marketplace"
                                aria-current={
                                    marketplaceActive ? "page" : undefined
                                }
                            >
                                Marketplace
                            </Link>
                        </Button>
                    </nav>
                    {isPending ? (
                        <div
                            className="size-7 shrink-0 animate-pulse rounded-full bg-muted"
                            aria-hidden
                        />
                    ) : session?.user ? (
                        <div className="flex items-center gap-2">
                            <HeaderConnectWalletButton />
                            <UserAccountMenu
                                user={{
                                    name: session.user.name,
                                    email: session.user.email,
                                    image: session.user.image,
                                }}
                                walletAddress={walletAddress}
                            />
                        </div>
                    ) : (
                        <Button size="sm" asChild>
                            <Link href="/login">Sign in</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}

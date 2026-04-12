"use client"

import Link from "next/link"

import { UserAccountMenu } from "@/components/user-account-menu"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export const SiteHeader = () => {
    const { data: session, isPending } = authClient.useSession()

    return (
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
                    {isPending ? (
                        <div
                            className="size-7 shrink-0 animate-pulse rounded-full bg-muted"
                            aria-hidden
                        />
                    ) : session?.user ? (
                        <UserAccountMenu
                            user={{
                                name: session.user.name,
                                email: session.user.email,
                                image: session.user.image,
                            }}
                        />
                    ) : (
                        <Button size="sm" asChild>
                            <Link href="/login">Sign in</Link>
                        </Button>
                    )}
                </nav>
            </div>
        </header>
    )
}

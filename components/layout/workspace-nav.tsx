"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

type WorkspaceNavProps = {
    /** Omit on the home page so no tab is highlighted. */
    active?: "agents" | "marketplace"
}

export const WorkspaceNav = ({ active }: WorkspaceNavProps) => {
    const pathname = usePathname()
    const { data: session, isPending } = authClient.useSession()
    const loginHref =
        pathname && pathname !== "/login"
            ? `/login?callbackUrl=${encodeURIComponent(pathname)}`
            : "/login"

    return (
        <nav
            className="flex shrink-0 items-center gap-1"
            aria-label="Workspace"
        >
            <Button
                variant={active === "agents" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none"
                asChild
            >
                <Link
                    href="/agents"
                    aria-current={active === "agents" ? "page" : undefined}
                >
                    Agents
                </Link>
            </Button>
            <Button
                variant={active === "marketplace" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none"
                asChild
            >
                <Link
                    href="/marketplace"
                    aria-current={
                        active === "marketplace" ? "page" : undefined
                    }
                >
                    Marketplace
                </Link>
            </Button>
            {!isPending && !session?.user ? (
                <Button size="sm" className="rounded-none" asChild>
                    <Link href={loginHref}>Sign in</Link>
                </Button>
            ) : null}
        </nav>
    )
}

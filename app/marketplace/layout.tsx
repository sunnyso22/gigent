import Link from "next/link"
import { IconArrowLeft } from "@tabler/icons-react"

import { SessionAccountMenu } from "@/components/layout/user-account-menu"
import { WorkspaceNav } from "@/components/layout/workspace-nav"
import { Button } from "@/components/ui/button"

type MarketplaceLayoutProps = {
    children: React.ReactNode
}

const Layout = ({ children }: MarketplaceLayoutProps) => (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    asChild
                >
                    <Link href="/agents" aria-label="Back to agents">
                        <IconArrowLeft />
                    </Link>
                </Button>
                <div className="flex min-w-0 flex-col">
                    <span className="font-heading text-sm">Marketplace</span>
                    <span className="text-[10px] text-muted-foreground">
                        Agent jobs
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <WorkspaceNav active="marketplace" />
                <SessionAccountMenu />
            </div>
        </header>
        {children}
    </div>
)

export default Layout

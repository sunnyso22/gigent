"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export const KeySavedBanner = () => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const [dismissed, setDismissed] = React.useState(false)
    const show = searchParams.get("keySaved") === "1" && !dismissed

    if (!show) {
        return null
    }

    return (
        <div
            role="status"
            className="flex shrink-0 items-start justify-between gap-3 border-b border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/15"
        >
            <p className="min-w-0 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                API key saved. New messages will use your Vercel AI Gateway
                account.
            </p>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 text-emerald-800 hover:bg-emerald-500/20 hover:text-emerald-900 dark:text-emerald-200 dark:hover:text-emerald-50"
                onClick={() => {
                    setDismissed(true)
                    router.replace(pathname)
                }}
                aria-label="Dismiss"
            >
                <IconX className="size-4" aria-hidden />
            </Button>
        </div>
    )
}

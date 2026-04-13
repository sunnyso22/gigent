"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconLogout, IconMoon, IconSettings, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import { UserAvatarDisplay } from "./session-avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { requiresSessionPath } from "@/lib/auth/public-paths"
import { authClient } from "@/lib/auth/client"

type AccountUser = {
    name?: string | null
    email?: string | null
    image?: string | null
}

type UserAccountMenuProps = {
    user: AccountUser
}

const ThemeToggleMenuItem = () => {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }}
        >
            {!mounted ? (
                <>
                    <IconSun className="size-4 opacity-60" aria-hidden />
                    Theme
                </>
            ) : resolvedTheme === "dark" ? (
                <>
                    <IconSun className="size-4" aria-hidden />
                    Light mode
                </>
            ) : (
                <>
                    <IconMoon className="size-4" aria-hidden />
                    Dark mode
                </>
            )}
        </DropdownMenuItem>
    )
}

export const UserAccountMenu = ({ user }: UserAccountMenuProps) => {
    const pathname = usePathname()

    const signOutAndLeaveProtectedRoute = async () => {
        await authClient.signOut()
        if (pathname && requiresSessionPath(pathname)) {
            const login = new URL("/login", window.location.origin)
            login.searchParams.set("callbackUrl", pathname)
            window.location.assign(login.toString())
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="rounded-full outline-none focus:outline-none focus-visible:outline-none"
                    aria-label="Open account menu"
                >
                    <UserAvatarDisplay image={user.image} name={user.name} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="min-w-48"
                sideOffset={6}
            >
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                        {user.name ? (
                            <span className="truncate text-sm text-foreground">
                                {user.name}
                            </span>
                        ) : null}
                        {user.email ? (
                            <span className="truncate text-xs text-muted-foreground">
                                {user.email}
                            </span>
                        ) : null}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link
                        href="/settings"
                        className="flex cursor-pointer items-center gap-2"
                    >
                        <IconSettings className="size-4" aria-hidden />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <ThemeToggleMenuItem />
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                        void signOutAndLeaveProtectedRoute()
                    }}
                >
                    <IconLogout className="size-4" aria-hidden />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export const SessionAccountMenu = () => {
    const { data: session, isPending } = authClient.useSession()

    if (isPending) {
        return (
            <div
                className="size-7 shrink-0 animate-pulse rounded-full bg-muted"
                aria-hidden
            />
        )
    }

    if (!session?.user) {
        return null
    }

    return (
        <UserAccountMenu
            user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
            }}
        />
    )
}

"use client"

import Link from "next/link"
import { IconLogout, IconSettings } from "@tabler/icons-react"

import { UserAvatarDisplay } from "./session-avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"

type AccountUser = {
    name?: string | null
    email?: string | null
    image?: string | null
}

type UserAccountMenuProps = {
    user: AccountUser
}

export const UserAccountMenu = ({ user }: UserAccountMenuProps) => {
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
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                        void authClient.signOut()
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

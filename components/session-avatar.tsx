"use client"

import { IconUserCircle } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type UserAvatarDisplayProps = {
    image?: string | null
    name?: string | null
}

export const UserAvatarDisplay = ({ image, name }: UserAvatarDisplayProps) => {
    return (
        <Avatar size="sm" className="size-7 shrink-0">
            {image ? <AvatarImage src={image} alt={name ?? "Account"} /> : null}
            <AvatarFallback>
                <IconUserCircle
                    className="size-4 text-muted-foreground"
                    stroke={1.5}
                    aria-hidden
                />
            </AvatarFallback>
        </Avatar>
    )
}

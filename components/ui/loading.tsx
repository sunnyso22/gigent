import * as React from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const loadingVariants = cva(
    "flex items-center justify-center gap-2 text-sm text-muted-foreground",
    {
        variants: {
            layout: {
                inline: "flex-row",
                section: "min-h-[12rem] w-full flex-col gap-3 py-8",
                page: "min-h-dvh w-full flex-col gap-3",
            },
        },
        defaultVariants: {
            layout: "inline",
        },
    }
)

type LoadingProps = {
    label?: string
    className?: string
} & VariantProps<typeof loadingVariants>

export const Loading = ({
    label = "Loading…",
    layout = "inline",
    className,
}: LoadingProps) => (
    <div
        className={cn(loadingVariants({ layout }), className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
    >
        <IconLoader2
            className={cn(
                "shrink-0 animate-spin",
                layout == null || layout === "inline" ? "size-4" : "size-8"
            )}
            aria-hidden
        />
        <span>{label}</span>
    </div>
)

type LoadingSpinnerProps = Omit<
    React.ComponentProps<typeof IconLoader2>,
    "ref"
>

export const LoadingSpinner = ({
    className,
    ...props
}: LoadingSpinnerProps) => (
    <IconLoader2
        className={cn("shrink-0 animate-spin", className)}
        aria-hidden
        {...props}
    />
)

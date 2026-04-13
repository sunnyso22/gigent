"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"

import type { JobDeliveryPayloadFromDb } from "@/lib/marketplace/delivery/payload"
import { Button } from "@/components/ui/button"

type JobDetail = {
    id: string
    title: string
    description: string
    requiredModelId: string
    rewardAmount: string
    rewardCurrency: string
    status: string
    posterUserId: string
    posterName: string
    assigneeUserId: string | null
    assigneeName: string | null
    acceptedBidId: string | null
    deliveryPayload: JobDeliveryPayloadFromDb | null
    deliveredAt: Date | null
    completedAt: Date | null
}

type MarketplaceJobActionsProps = {
    job: JobDetail
    sessionUserId: string | null
}

export const MarketplaceJobActions = ({
    job,
    sessionUserId,
}: MarketplaceJobActionsProps) => {
    const router = useRouter()
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState<string | null>(null)

    const refresh = () => {
        router.refresh()
    }

    const postJson = async (url: string, body?: object) => {
        setErr(null)
        setBusy(true)
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
            })
            const data = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            if (!res.ok) {
                setErr(data.error ?? res.statusText)
                return false
            }
            refresh()
            return true
        } finally {
            setBusy(false)
        }
    }

    const onConfirm = async () => {
        await postJson(`/api/marketplace/jobs/${job.id}/complete`, {})
    }

    const isPoster = sessionUserId === job.posterUserId
    const isAssignee =
        sessionUserId != null &&
        job.assigneeUserId != null &&
        sessionUserId === job.assigneeUserId

    const showDeliveryPanel =
        (isPoster || isAssignee) &&
        (job.status === "pending_review" || job.status === "completed") &&
        (job.deliveredAt != null ||
            (job.deliveryPayload?.blocks?.length ?? 0) > 0)

    const deliveryHeading = (() => {
        if (isAssignee) {
            return job.status === "completed"
                ? "Your delivery"
                : "Your submission"
        }
        return job.status === "completed" ? "Delivery" : "Review delivery"
    })()

    return (
        <div className="flex flex-col gap-6">
            {err ? (
                <p
                    className="rounded-none border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive"
                    role="alert"
                >
                    {err}
                </p>
            ) : null}

            {!sessionUserId ? (
                <p className="text-xs text-muted-foreground">
                    <Link
                        href={`/login?callbackUrl=/marketplace/${job.id}`}
                        className="text-foreground underline"
                    >
                        Sign in
                    </Link>{" "}
                    to manage this job.
                </p>
            ) : null}

            {showDeliveryPanel ? (
                <div className="flex flex-col gap-3 rounded-none border border-border bg-card p-3">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-medium">{deliveryHeading}</p>
                        {isPoster && job.assigneeName ? (
                            <p className="text-[10px] text-muted-foreground">
                                From {job.assigneeName}
                            </p>
                        ) : null}
                        {job.deliveredAt ? (
                            <p className="text-[10px] text-muted-foreground">
                                Submitted{" "}
                                {new Date(job.deliveredAt).toLocaleString()}
                            </p>
                        ) : null}
                        {job.status === "completed" && job.completedAt ? (
                            <p className="text-[10px] text-muted-foreground">
                                Job completed{" "}
                                {new Date(job.completedAt).toLocaleString()}
                            </p>
                        ) : null}
                    </div>
                    {job.deliveryPayload?.blocks?.length ? (
                        <ul className="flex flex-col gap-3">
                            {job.deliveryPayload.blocks.map((block, i) => (
                                <li
                                    key={i}
                                    className="border border-border/80 bg-background/50 px-2 py-2"
                                >
                                    {block.type === "text" ? (
                                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                            {block.body}
                                        </p>
                                    ) : null}
                                    {block.type === "file" &&
                                    block.mimeType
                                        .toLowerCase()
                                        .startsWith("image/") ? (
                                        <div className="flex max-h-64 w-full flex-col gap-1">
                                            <Image
                                                src={block.url}
                                                alt={block.name}
                                                width={800}
                                                height={600}
                                                unoptimized
                                                className="max-h-64 w-auto rounded-none border border-border object-contain"
                                            />
                                            <a
                                                href={block.url}
                                                className="text-[10px] break-all text-foreground underline"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {block.name} · {block.mimeType}
                                            </a>
                                        </div>
                                    ) : null}
                                    {block.type === "file" &&
                                    !block.mimeType
                                        .toLowerCase()
                                        .startsWith("image/") ? (
                                        <div className="flex flex-col gap-0.5 text-xs">
                                            <a
                                                href={block.url}
                                                className="font-medium break-all text-foreground underline"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {block.name}
                                            </a>
                                            <span className="text-[10px] text-muted-foreground">
                                                {block.mimeType}
                                            </span>
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            No structured delivery payload (legacy or empty).
                        </p>
                    )}
                    {isPoster && job.status === "pending_review" ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onConfirm()}
                        >
                            Mark complete
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

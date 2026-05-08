import Image from "next/image"
import Link from "next/link"

import type { JobDeliveryPayloadFromDb } from "@/lib/agent-jobs/delivery/payload"
import { isJobStatusEligibleForDeliveryContent } from "@/lib/agent-jobs/delivery/visibility"

type JobDetail = {
    id: string
    acpJobId?: string | null
    title: string
    description: string
    budgetAmount: string
    budgetCurrency: string
    status: string
    clientUserId: string
    clientName: string
    providerUserId: string | null
    providerName: string | null
    acceptedBidId: string | null
    deliveryPayload: JobDeliveryPayloadFromDb | null
    submittedAt: Date | null
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
    const isClient = sessionUserId === job.clientUserId
    const isProvider =
        sessionUserId != null &&
        job.providerUserId != null &&
        sessionUserId === job.providerUserId

    const showDeliveryPanel =
        (isClient || isProvider) &&
        isJobStatusEligibleForDeliveryContent(job.status) &&
        (job.submittedAt != null ||
            (job.deliveryPayload?.blocks?.length ?? 0) > 0)

    const deliveryHeading = (() => {
        if (isProvider) {
            return job.status === "completed"
                ? "Your delivery"
                : "Your submission"
        }
        return job.status === "completed" ? "Delivery" : "Review delivery"
    })()

    return (
        <div className="flex flex-col gap-6">
            {!sessionUserId ? (
                <p className="text-xs text-muted-foreground">
                    <Link
                        href={`/login?callbackUrl=/marketplace/${job.acpJobId ?? job.id}`}
                        className="text-foreground underline"
                    >
                        Sign in
                    </Link>{" "}
                    to manage this job.
                </p>
            ) : null}

            {showDeliveryPanel ? (
                <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium">{deliveryHeading}</p>
                    <div className="flex flex-col gap-3 rounded-none border border-border bg-card p-3">
                        <div className="flex flex-col gap-0.5">
                            {isClient && job.providerName ? (
                                <p className="text-[10px] text-muted-foreground">
                                    Provider: {job.providerName}
                                </p>
                            ) : null}
                            {job.submittedAt ? (
                                <p className="text-[10px] text-muted-foreground">
                                    Submitted:{" "}
                                    {new Date(job.submittedAt).toLocaleString()}
                                </p>
                            ) : null}
                            {job.status === "completed" && job.completedAt ? (
                                <p className="text-[10px] text-muted-foreground">
                                    Job completed:{" "}
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
                    </div>
                </div>
            ) : null}
        </div>
    )
}

import { notFound } from "next/navigation"

import { MarketplaceJobActions } from "@/components/marketplace/marketplace-job-actions"
import { getSession } from "@/lib/auth/session"
import { signDeliveryPayloadUrlsForViewer } from "@/lib/agent-jobs/delivery/sign-viewer-urls"
import {
    canViewerAccessJobDelivery,
    shouldHideDeliveryFromPosterUntilPaid,
} from "@/lib/agent-jobs/delivery/visibility"
import { getAgentJobById, listBidsForJob } from "@/lib/agent-jobs/service"

type JobPageProps = {
    params: Promise<{ jobId: string }>
}

const Page = async ({ params }: JobPageProps) => {
    const { jobId } = await params
    const job = await getAgentJobById(jobId)
    if (!job) {
        notFound()
    }

    const [bids, session] = await Promise.all([
        listBidsForJob(jobId),
        getSession(),
    ])

    const viewerId = session?.user?.id ?? null
    const canViewDelivery = canViewerAccessJobDelivery(
        viewerId,
        job.posterUserId,
        job.assigneeUserId
    )

    const hideUntilPosterPays =
        viewerId != null &&
        shouldHideDeliveryFromPosterUntilPaid({
            viewerUserId: viewerId,
            posterUserId: job.posterUserId,
            status: job.status,
            paymentStatus: job.paymentStatus,
        })

    const showDeliveryContent =
        canViewDelivery && !hideUntilPosterPays

    const deliveryPayload = showDeliveryContent
        ? await signDeliveryPayloadUrlsForViewer({
              jobId,
              deliveryPayload: job.deliveryPayload,
              viewerUserId: viewerId,
              posterUserId: job.posterUserId,
              assigneeUserId: job.assigneeUserId,
          })
        : null

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="font-heading text-lg">{job.title}</h1>
                <p className="text-[10px] text-muted-foreground">
                    {job.rewardAmount} {job.rewardCurrency} · {job.status} ·
                    Model {job.requiredModelId}
                </p>
                <p className="text-xs text-muted-foreground">
                    Poster: {job.posterName}
                </p>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {job.description}
            </p>

            <section aria-labelledby="bids-heading" className="flex flex-col gap-2">
                <h2 id="bids-heading" className="text-xs font-medium">
                    Bids
                </h2>
                {bids.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No bids yet.</p>
                ) : (
                    <ul className="flex flex-col gap-1 text-xs">
                        {bids.map((b) => (
                            <li
                                key={b.id}
                                className="flex flex-wrap justify-between gap-2 border border-border bg-card px-2 py-1.5"
                            >
                                <span>
                                    {b.bidderName}: {b.amount} {b.currency}
                                </span>
                                <span className="text-muted-foreground">
                                    {b.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <MarketplaceJobActions
                job={{
                    id: job.id,
                    title: job.title,
                    description: job.description,
                    requiredModelId: job.requiredModelId,
                    rewardAmount: job.rewardAmount,
                    rewardCurrency: job.rewardCurrency,
                    status: job.status,
                    posterUserId: job.posterUserId,
                    posterName: job.posterName,
                    assigneeUserId: job.assigneeUserId,
                    assigneeName: job.assigneeName,
                    acceptedBidId: job.acceptedBidId,
                    deliveryPayload,
                    deliveredAt: showDeliveryContent ? job.deliveredAt : null,
                    completedAt: job.completedAt,
                }}
                sessionUserId={session?.user?.id ?? null}
            />
        </main>
    )
}

export default Page

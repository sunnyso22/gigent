import { notFound } from "next/navigation"

import { MarketplaceJobActions } from "@/components/marketplace/marketplace-job-actions"
import { getSession } from "@/lib/auth/session"
import { signDeliveryPayloadUrlsForViewer } from "@/lib/agent-jobs/delivery/sign-viewer-urls"
import {
    canViewerAccessJobDelivery,
    shouldHideDeliveryFromClientUntilOnChainSubmit,
} from "@/lib/agent-jobs/delivery/visibility"
import { formatJobBudgetStatusExpiryLine } from "@/lib/agent-jobs/format-job-summary"
import { getAgentJobById, listBidsForJob } from "@/lib/agent-jobs/service"

type JobPageProps = {
    params: Promise<{ jobId: string }>
}

const Page = async ({ params }: JobPageProps) => {
    const { jobId } = await params
    const [job, session] = await Promise.all([
        getAgentJobById(jobId),
        getSession(),
    ])
    if (!job) {
        notFound()
    }

    const bids = await listBidsForJob(jobId)

    const viewerId = session?.user?.id ?? null
    const canViewDelivery = canViewerAccessJobDelivery(
        viewerId,
        job.clientUserId,
        job.providerUserId
    )

    const hideUntilChainSubmit =
        viewerId != null &&
        shouldHideDeliveryFromClientUntilOnChainSubmit({
            viewerUserId: viewerId,
            clientUserId: job.clientUserId,
            acpJobId: job.acpJobId,
            acpStatus: job.acpStatus,
        })

    const showDeliveryContent = canViewDelivery && !hideUntilChainSubmit

    const deliveryPayload = showDeliveryContent
        ? await signDeliveryPayloadUrlsForViewer({
              jobId,
              deliveryPayload: job.deliveryPayload,
              viewerUserId: viewerId,
              clientUserId: job.clientUserId,
              providerUserId: job.providerUserId,
          })
        : null

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="font-heading text-lg">{job.title}</h1>
                <p className="text-[10px] text-muted-foreground">
                    {formatJobBudgetStatusExpiryLine(job)} · Model{" "}
                    {job.requiredModelId}
                </p>
                <p className="text-xs text-muted-foreground">
                    Client: {job.clientName}
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
                                    {b.providerName}: {b.amount} {b.currency}
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
                    budgetAmount: job.budgetAmount,
                    budgetCurrency: job.budgetCurrency,
                    status: job.status,
                    clientUserId: job.clientUserId,
                    clientName: job.clientName,
                    providerUserId: job.providerUserId,
                    providerName: job.providerName,
                    acceptedBidId: job.acceptedBidId,
                    deliveryPayload,
                    submittedAt: showDeliveryContent ? job.submittedAt : null,
                    completedAt: job.completedAt,
                }}
                sessionUserId={session?.user?.id ?? null}
            />
        </main>
    )
}

export default Page

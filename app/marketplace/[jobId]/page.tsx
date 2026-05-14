import { notFound } from "next/navigation"

import MarketplaceJobListingFields, {
    MarketplaceJobStatusBadge,
} from "@/components/marketplace/marketplace-job-listing-fields"
import MarketplaceJobTitle from "@/components/marketplace/marketplace-job-title"
import { MarketplaceJobActions } from "@/components/marketplace/marketplace-job-actions"
import { getSession } from "@/lib/auth/session"
import { signDeliveryPayloadUrlsForViewer } from "@/lib/agent-jobs/delivery/sign-viewer-urls"
import { shouldExposeDeliveryFieldsToViewer } from "@/lib/agent-jobs/delivery/visibility"
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
    const showDeliveryContent = shouldExposeDeliveryFieldsToViewer({
        viewerUserId: viewerId,
        clientUserId: job.clientUserId,
        providerUserId: job.providerUserId,
        jobStatus: job.status,
        acpJobId: job.acpJobId,
        acpStatus: job.acpStatus,
    })

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
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-8">
            <header className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="min-w-0 flex-1 font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
                        <MarketplaceJobTitle
                            title={job.title}
                            jobId={job.acpJobId}
                        />
                    </h1>
                    <MarketplaceJobStatusBadge status={job.status} />
                </div>
                <MarketplaceJobListingFields
                    clientName={job.clientName}
                    description={job.description}
                    budgetAmount={job.budgetAmount}
                    budgetCurrency={job.budgetCurrency}
                    acpExpiresAt={job.acpExpiresAt}
                />
            </header>

            <section
                aria-labelledby="bids-heading"
                className="flex flex-col gap-3 rounded-none border border-border bg-card"
            >
                <div className="border-b border-border px-4 py-3">
                    <h2
                        id="bids-heading"
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        Bids
                    </h2>
                </div>
                {bids.length === 0 ? (
                    <p className="px-4 pb-4 text-xs text-muted-foreground">
                        No bids yet.
                    </p>
                ) : (
                    <ul className="flex flex-col divide-y divide-border px-4 pb-2">
                        {bids.map((b) => (
                            <li
                                key={b.id}
                                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-xs first:pt-2"
                            >
                                <span className="text-foreground">
                                    {b.providerName}: {b.amount} {b.currency}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
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
                    acpJobId: job.acpJobId,
                    title: job.title,
                    description: job.description,
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
                    evaluationReason: showDeliveryContent
                        ? job.evaluationReason ?? null
                        : null,
                    acpEvaluationReason: showDeliveryContent
                        ? job.acpEvaluationReason ?? null
                        : null,
                }}
                sessionUserId={session?.user?.id ?? null}
            />
        </main>
    )
}

export default Page

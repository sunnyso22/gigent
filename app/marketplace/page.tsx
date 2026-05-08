import Link from "next/link"

import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters"
import { MarketplaceJobStatusBadge } from "@/components/marketplace/marketplace-job-listing-fields"
import MarketplaceJobTitle from "@/components/marketplace/marketplace-job-title"
import { parseAgentJobStatusFilter } from "@/lib/agent-jobs/job-status"
import { searchAgentJobs } from "@/lib/agent-jobs/service"

type MarketplacePageProps = {
    searchParams: Promise<{ q?: string; status?: string }>
}

const Page = async ({ searchParams }: MarketplacePageProps) => {
    const sp = await searchParams
    const q = sp.q?.trim()
    const statusFilter = parseAgentJobStatusFilter(sp.status)

    const jobs = await searchAgentJobs({
        keywords: q,
        keywordMode: "any",
        limit: 40,
        status: statusFilter,
    })

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-heading text-lg">Agent Jobs</h1>
            </div>

            <MarketplaceFilters
                initialQuery={q ?? ""}
                initialStatus={statusFilter}
            />

            <ul className="flex flex-col gap-3">
                {jobs.length === 0 ? (
                    <li className="rounded-none border border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
                        No jobs match. Create one from{" "}
                        <Link
                            href="/agents"
                            className="text-foreground underline"
                        >
                            Agents
                        </Link>
                        .
                    </li>
                ) : (
                    jobs.map((j) => (
                        <li key={j.id}>
                            <Link
                                href={`/marketplace/${j.acpJobId ?? j.id}`}
                                className="block rounded-none border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/40"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="min-w-0 flex-1 font-medium text-foreground">
                                        <MarketplaceJobTitle
                                            title={j.title}
                                            jobId={j.acpJobId}
                                        />
                                    </span>
                                    <MarketplaceJobStatusBadge
                                        status={j.status}
                                        className="shrink-0"
                                    />
                                </div>
                                <p className="mt-4 line-clamp-2 text-xs text-muted-foreground">
                                    {j.description}
                                </p>
                            </Link>
                        </li>
                    ))
                )}
            </ul>
        </main>
    )
}

export default Page

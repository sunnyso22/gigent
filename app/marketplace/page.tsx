import Link from "next/link"

import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters"
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
                <h1 className="font-heading text-lg">Jobs</h1>
                <p className="text-xs text-muted-foreground">
                    Filter by status or search.
                </p>
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
                                href={`/marketplace/${j.id}`}
                                className="block rounded-none border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/40"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-medium">
                                        {j.title}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {j.budgetAmount} {j.budgetCurrency} ·{" "}
                                        {j.status}
                                        {j.acpExpiresAt != null
                                            ? ` · Expires ${j.acpExpiresAt.toLocaleDateString(
                                                  undefined,
                                                  { dateStyle: "medium" }
                                              )}`
                                            : ""}
                                    </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {j.description}
                                </p>
                                <p className="mt-2 text-[10px] text-muted-foreground">
                                    Model: {j.requiredModelId} · Client:{" "}
                                    {j.clientName}
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

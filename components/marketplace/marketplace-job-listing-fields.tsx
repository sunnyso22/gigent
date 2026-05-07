import { formatJobExpiryDate } from "@/lib/agent-jobs/format-job-summary"
import {
    AGENT_JOB_STATUS_VALUES,
    formatAgentJobStatusLabel,
    type AgentJobStatus,
} from "@/lib/agent-jobs/job-status"
import { cn } from "@/lib/utils"

const statusToneClasses = (raw: string): string => {
    const s = raw.trim().toLowerCase()
    const isKnown = (
        AGENT_JOB_STATUS_VALUES as readonly string[]
    ).includes(s)
    const label = isKnown ? (s as AgentJobStatus) : null

    const tone: Record<AgentJobStatus, string> = {
        open: "border-border bg-muted/40 text-foreground",
        funded:
            "border-amber-500/45 bg-amber-500/[0.12] text-amber-950 dark:text-amber-100",
        submitted: "border-primary/45 bg-primary/10 text-primary",
        completed:
            "border-emerald-500/45 bg-emerald-500/[0.12] text-emerald-900 dark:text-emerald-300",
        rejected: "border-destructive/45 bg-destructive/10 text-destructive",
        expired:
            "border-muted-foreground/40 bg-muted text-muted-foreground",
    }

    return label != null
        ? tone[label]
        : "border-border bg-card text-muted-foreground"
}

type MarketplaceJobStatusBadgeProps = {
    status: string
    className?: string
}

export const MarketplaceJobStatusBadge = ({
    status,
    className,
}: MarketplaceJobStatusBadgeProps) => (
    <span
        aria-label={`Job status: ${formatAgentJobStatusLabel(status)}`}
        title={formatAgentJobStatusLabel(status)}
        className={cn(
            "inline-flex shrink-0 items-center rounded-none border px-2.5 py-1 text-[11px] font-medium tracking-tight",
            statusToneClasses(status),
            className
        )}
    >
        {formatAgentJobStatusLabel(status)}
    </span>
)

type MarketplaceJobListingFieldsProps = {
    clientName: string
    description: string
    budgetAmount: string
    budgetCurrency: string
    acpExpiresAt: Date | null
}

const MarketplaceJobListingFields = ({
    clientName,
    description,
    budgetAmount,
    budgetCurrency,
    acpExpiresAt,
}: MarketplaceJobListingFieldsProps) => {
    const expiryText = formatJobExpiryDate(acpExpiresAt)

    return (
        <section
            aria-label="Job listing details"
            className="rounded-none border border-border bg-card"
        >
            <dl className="divide-y divide-border">
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
                    <dt className="text-[11px] font-medium text-muted-foreground">
                        Client
                    </dt>
                    <dd className="text-sm text-foreground">{clientName}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-6">
                    <dt className="pt-0.5 text-[11px] font-medium text-muted-foreground">
                        Description
                    </dt>
                    <dd className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {description}
                    </dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
                    <dt className="text-[11px] font-medium text-muted-foreground">
                        Budget
                    </dt>
                    <dd className="font-heading text-foreground font-semibold tabular-nums tracking-tight text-foreground">
                        {budgetAmount}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                            {budgetCurrency}
                        </span>
                    </dd>
                </div>
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
                    <dt className="text-[11px] font-medium text-muted-foreground">
                        Expired At
                    </dt>
                    <dd className="text-sm leading-snug text-foreground">
                        {expiryText ? (
                            expiryText
                        ) : (
                            <span className="text-muted-foreground">
                                Not set yet
                            </span>
                        )}
                    </dd>
                </div>
            </dl>
        </section>
    )
}

export default MarketplaceJobListingFields

export type JobBudgetStatusExpiryFields = {
    budgetAmount: string
    budgetCurrency: string
    status: string
    acpExpiresAt: Date | null
}

const jobExpiryUtcFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
})

/** Listing/on-chain expiry shown in UTC (matches Unix \`expiredAt\` semantics). */
export const formatJobExpiryDate = (expiry: Date | null): string | null => {
    if (expiry == null) {
        return null
    }
    return `${jobExpiryUtcFormatter.format(expiry)} UTC`
}

/** Budget · status · optional expiry line (used on marketplace list and job detail). */
export const formatJobBudgetStatusExpiryLine = (
    j: JobBudgetStatusExpiryFields
) => {
    const expiry =
        j.acpExpiresAt != null
            ? ` · Expires ${jobExpiryUtcFormatter.format(j.acpExpiresAt)} UTC`
            : ""
    return `${j.budgetAmount} ${j.budgetCurrency} · ${j.status}${expiry}`
}

export type JobBudgetStatusExpiryFields = {
    budgetAmount: string
    budgetCurrency: string
    status: string
    acpExpiresAt: Date | null
}

/** Long-form expiry for job detail (timezone-aware). */
export const formatJobExpiryDate = (expiry: Date | null): string | null => {
    if (expiry == null) {
        return null
    }
    return expiry.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    })
}

/** Budget · status · optional expiry line (used on marketplace list and job detail). */
export const formatJobBudgetStatusExpiryLine = (
    j: JobBudgetStatusExpiryFields
) => {
    const expiry =
        j.acpExpiresAt != null
            ? ` · Expires ${j.acpExpiresAt.toLocaleDateString(undefined, {
                  dateStyle: "medium",
              })}`
            : ""
    return `${j.budgetAmount} ${j.budgetCurrency} · ${j.status}${expiry}`
}

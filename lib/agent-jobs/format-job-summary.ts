export type JobBudgetStatusExpiryFields = {
    budgetAmount: string
    budgetCurrency: string
    status: string
    acpExpiresAt: Date | null
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

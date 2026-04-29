/** Only the job client and the assigned provider may access delivery flows. */
export const canViewerAccessJobDelivery = (
    viewerUserId: string | null | undefined,
    clientUserId: string,
    providerUserId: string | null
): boolean =>
    viewerUserId != null &&
    (viewerUserId === clientUserId ||
        (providerUserId != null && viewerUserId === providerUserId))

/**
 * Delivery may exist once the job leaves the open listing phase (fund through terminal).
 * Mirrors app workflow statuses where work or resolution exists—not public to other bidders/users.
 */
const DELIVERY_APP_STATUSES = new Set([
    "funded",
    "submitted",
    "completed",
    "rejected",
    "expired",
])

export const isJobStatusEligibleForDeliveryContent = (status: string): boolean =>
    DELIVERY_APP_STATUSES.has(status.trim().toLowerCase())

/**
 * Whether to attach delivery payload / submittedAt for this viewer (role + status + on-chain rules).
 */
export const shouldExposeDeliveryFieldsToViewer = (input: {
    viewerUserId: string | null | undefined
    clientUserId: string
    providerUserId: string | null
    jobStatus: string
    acpJobId: string | null | undefined
    acpStatus: string | null | undefined
}): boolean => {
    if (
        !canViewerAccessJobDelivery(
            input.viewerUserId,
            input.clientUserId,
            input.providerUserId
        )
    ) {
        return false
    }
    if (!isJobStatusEligibleForDeliveryContent(input.jobStatus)) {
        return false
    }
    if (
        input.viewerUserId != null &&
        shouldHideDeliveryFromClientUntilOnChainSubmit({
            viewerUserId: input.viewerUserId,
            clientUserId: input.clientUserId,
            acpJobId: input.acpJobId,
            acpStatus: input.acpStatus,
        })
    ) {
        return false
    }
    return true
}

/**
 * Client sees off-chain delivery only after on-chain `submit` (or terminal states).
 * Jobs with no `acp_job_id` yet are not gated (listing-only / pre-chain).
 * Provider always sees their own draft via role check in callers.
 */
export const shouldHideDeliveryFromClientUntilOnChainSubmit = (input: {
    viewerUserId: string
    clientUserId: string
    acpJobId: string | null | undefined
    acpStatus: string | null | undefined
}): boolean => {
    if (input.viewerUserId !== input.clientUserId) {
        return false
    }
    if (!input.acpJobId) {
        return false
    }
    const s = input.acpStatus?.toLowerCase() ?? ""
    if (
        s === "submitted" ||
        s === "completed" ||
        s === "rejected" ||
        s === "expired"
    ) {
        return false
    }
    return true
}

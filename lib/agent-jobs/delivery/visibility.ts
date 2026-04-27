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

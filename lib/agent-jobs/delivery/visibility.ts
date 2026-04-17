/** Only the job poster and the accepted assignee may see delivery content. */
export const canViewerAccessJobDelivery = (
    viewerUserId: string | null | undefined,
    posterUserId: string,
    assigneeUserId: string | null
): boolean =>
    viewerUserId != null &&
    (viewerUserId === posterUserId ||
        (assigneeUserId != null && viewerUserId === assigneeUserId))

/** Pay-to-view: poster does not see delivery until x402 payment is settled. */
export const shouldHideDeliveryFromPosterUntilPaid = (input: {
    viewerUserId: string
    posterUserId: string
    status: string
    paymentStatus: string
}): boolean =>
    input.viewerUserId === input.posterUserId &&
    input.status === "pending_review" &&
    input.paymentStatus !== "settled"

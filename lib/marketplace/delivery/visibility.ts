/** Only the job poster and the accepted assignee may see delivery content. */
export const canViewerAccessJobDelivery = (
    viewerUserId: string | null | undefined,
    posterUserId: string,
    assigneeUserId: string | null
): boolean =>
    viewerUserId != null &&
    (viewerUserId === posterUserId ||
        (assigneeUserId != null && viewerUserId === assigneeUserId))

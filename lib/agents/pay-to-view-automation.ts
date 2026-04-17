export const PAY_TO_VIEW_SETTLED_AUTOMATION_PREFIX =
    "x402 pay-to-view just settled for job"

export const buildPayToViewSettledAutomationMessage = (jobId: string) =>
    `${PAY_TO_VIEW_SETTLED_AUTOMATION_PREFIX} ${jobId}. Call job_review now and present the delivery.`

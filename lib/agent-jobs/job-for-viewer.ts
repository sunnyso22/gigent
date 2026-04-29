import {
    canViewerAccessJobDelivery,
    shouldHideDeliveryFromClientUntilOnChainSubmit,
} from "@/lib/agent-jobs/delivery/visibility"
import { getAgentJobById, listBidsForJob } from "@/lib/agent-jobs/service"

export const getJobWithBidsForViewer = async (
    jobId: string,
    viewerUserId: string | null | undefined
) => {
    const job = await getAgentJobById(jobId)
    if (!job) {
        return null
    }

    const bids = await listBidsForJob(jobId)
    const canViewDelivery = canViewerAccessJobDelivery(
        viewerUserId ?? null,
        job.clientUserId,
        job.providerUserId
    )

    let jobResponse = canViewDelivery
        ? job
        : {
              ...job,
              deliveryPayload: null,
              submittedAt: null,
          }

    if (
        canViewDelivery &&
        viewerUserId &&
        shouldHideDeliveryFromClientUntilOnChainSubmit({
            viewerUserId,
            clientUserId: job.clientUserId,
            acpJobId: job.acpJobId,
            acpStatus: job.acpStatus,
        })
    ) {
        jobResponse = {
            ...job,
            deliveryPayload: null,
            submittedAt: null,
        }
    }

    return { job: jobResponse, bids }
}

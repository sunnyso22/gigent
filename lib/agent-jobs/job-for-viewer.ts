import { shouldExposeDeliveryFieldsToViewer } from "@/lib/agent-jobs/delivery/visibility"
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
    const showDeliveryFields = shouldExposeDeliveryFieldsToViewer({
        viewerUserId,
        clientUserId: job.clientUserId,
        providerUserId: job.providerUserId,
        jobStatus: job.status,
        acpJobId: job.acpJobId,
        acpStatus: job.acpStatus,
    })

    const jobResponse = showDeliveryFields
        ? job
        : {
              ...job,
              deliveryPayload: null,
              submittedAt: null,
          }

    return { job: jobResponse, bids }
}

import { AcpJobStatus } from "@/lib/acp/constants"
import { readAcpJob } from "@/lib/acp/read-job"
import { syncAgentJobFromChainByDbId } from "@/lib/acp/sync-agent-job"
import type { ChatModelId } from "@/lib/agents/models"

import {
    evaluatorBroadcastComplete,
    evaluatorBroadcastReject,
} from "@/lib/agent-jobs/evaluator-signer"
import {
    jobUsesPlatformEvaluator,
    getEvaluatorAccount,
} from "@/lib/agent-jobs/evaluator-config"
import { evaluateJobDeliveryWithLlm } from "@/lib/agent-jobs/job-review-llm"
import {
    getJobForViewer,
    setJobEvaluationReason,
} from "@/lib/agent-jobs/service"
import { parseJobDeliveryPayloadFromDb } from "@/lib/agent-jobs/delivery/payload"

export type JobReviewRunResult =
    | {
          ok: true
          platformEvaluator: boolean
          decision: "complete" | "reject"
          rationale: string
          txHash?: `0x${string}`
          syncedJobStatus?: string
          message: string
      }
    | { ok: false; error: string }

export const runAgentJobReview = async (input: {
    userId: string
    jobId: string
    gatewayApiKey: string
    modelId: ChatModelId
}): Promise<JobReviewRunResult> => {
    await syncAgentJobFromChainByDbId(input.jobId)

    const viewer = await getJobForViewer({
        viewerUserId: input.userId,
        jobId: input.jobId,
    })
    if (!viewer.ok) {
        return { ok: false, error: viewer.error }
    }

    const job = viewer.job
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the job client can run delivery review" }
    }

    if (!job.acpJobId?.trim()) {
        return {
            ok: false,
            error: "Job has no on-chain Job ID yet—publish the listing first",
        }
    }

    const listingDesc = job.description?.trim() ?? ""
    const onChainDesc = job.acpDescription?.trim() ?? listingDesc
    if (!job.deliveryPayload) {
        return { ok: false, error: "No delivery payload to review" }
    }
    const parsedDelivery = parseJobDeliveryPayloadFromDb(job.deliveryPayload)
    if (!parsedDelivery) {
        return {
            ok: false,
            error: "Delivery payload is invalid or empty for review",
        }
    }
    const deliveryJson = JSON.stringify(parsedDelivery)

    let review
    try {
        review = await evaluateJobDeliveryWithLlm({
            gatewayApiKey: input.gatewayApiKey,
            modelId: input.modelId,
            gatewayUserId: input.userId,
            title: job.title ?? "",
            listingDescription: listingDesc,
            onChainDescription: onChainDesc,
            deliveryJson,
        })
    } catch (e) {
        const msg =
            e instanceof Error ? e.message : "Evaluation model request failed"
        return { ok: false, error: msg }
    }

    const evaluation = review.evaluation

    const persisted = await setJobEvaluationReason(input.jobId, {
        evaluationReason: evaluation.rationale,
        evaluationMetadata: review.metadata,
    })
    if (!persisted.ok) {
        return { ok: false, error: persisted.error }
    }

    const platform = jobUsesPlatformEvaluator(job)

    if (!platform) {
        const walletHint =
            evaluation.decision === "complete"
                ? "Agents does not drive **complete()** for this listing (your wallet is the on-chain evaluator). New jobs with **EVALUATOR_PRIVATE_KEY** use custody evaluation here; otherwise finalize completion outside Agents if needed, then **job_sync_chain**."
                : "Use **job_reject** so your wallet can send reject() when the chain allows (Open/Funded/Submitted per contract rules), then sync."
        return {
            ok: true,
            platformEvaluator: false,
            decision: evaluation.decision,
            rationale: evaluation.rationale,
            message: `Legacy evaluator mode: ${walletHint}`,
        }
    }

    if (!getEvaluatorAccount()) {
        return {
            ok: false,
            error:
                "This job uses the Gigent platform evaluator on-chain, but EVALUATOR_PRIVATE_KEY is not configured on the server.",
        }
    }

    const appSt = job.status?.toLowerCase() ?? ""
    if (appSt !== "submitted") {
        return {
            ok: false,
            error: `Review with custodial finalization applies when app status is submitted (current: ${job.status})`,
        }
    }

    let chainJob
    try {
        chainJob = await readAcpJob(BigInt(job.acpJobId))
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Chain read failed"
        return { ok: false, error: msg }
    }

    if (chainJob.status !== AcpJobStatus.Submitted) {
        return {
            ok: false,
            error: `Custodial complete/reject runs only while on-chain status is Submitted (current: ${chainJob.acpStatusLabel}). Sync with job_sync_chain if stale.`,
        }
    }

    const broadcast =
        evaluation.decision === "complete"
            ? await evaluatorBroadcastComplete({
                  acpJobId: BigInt(job.acpJobId),
                  rationaleText: evaluation.rationale,
              })
            : await evaluatorBroadcastReject({
                  acpJobId: BigInt(job.acpJobId),
                  rationaleText: evaluation.rationale,
              })

    if (!broadcast.ok) {
        return {
            ok: false,
            error: `${evaluation.decision === "complete" ? "complete" : "reject"} broadcast failed: ${broadcast.error}`,
        }
    }

    await syncAgentJobFromChainByDbId(input.jobId)

    const again = await getJobForViewer({
        viewerUserId: input.userId,
        jobId: input.jobId,
    })
    const syncedStatus =
        again.ok && again.job.status ? again.job.status : undefined

    return {
        ok: true,
        platformEvaluator: true,
        decision: evaluation.decision,
        rationale: evaluation.rationale,
        txHash: broadcast.txHash,
        syncedJobStatus: syncedStatus,
        message:
            evaluation.decision === "complete"
                ? `Evaluation: complete. Transaction ${broadcast.txHash}. App status after sync: ${syncedStatus ?? "unknown"}.`
                : `Evaluation: reject. Transaction ${broadcast.txHash}. App status after sync: ${syncedStatus ?? "unknown"}.`,
    }
}

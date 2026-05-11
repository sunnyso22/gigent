import {
    AGENTIC_COMMERCE_ADDRESS,
    KITE_TESTNET_CHAIN_ID,
    KITE_USDT_ADDRESS,
} from "@/lib/acp/constants"
import { encodeErc20Approve } from "@/lib/acp/erc20-encode"
import {
    encodeAcpClaimRefund,
    encodeAcpComplete,
    encodeAcpFund,
    encodeAcpReject,
    encodeAcpSetBudget,
    encodeAcpSetProvider,
    encodeAcpSubmit,
} from "@/lib/acp/encode-calls"
import { getAddress, type Address, type Hex } from "viem"

import { getAgentJobById } from "./service"

export type OnChainStep = {
    label: string
    to: `0x${string}`
    data: `0x${string}`
}

export type OnChainStepsBundle = {
    chainId: number
    commerceAddress: `0x${string}`
    usdtAddress?: `0x${string}`
    steps: OnChainStep[]
}

const commerceAddr = (): Address => getAddress(AGENTIC_COMMERCE_ADDRESS)
const usdtAddr = (): Address => getAddress(KITE_USDT_ADDRESS)

type PrepOk = { ok: true; bundle: OnChainStepsBundle }
type PrepErr = { ok: false; error: string }

/** After DB bid_accept: approve USDT → setProvider → setBudget → fund. */
export const getAcceptBidOnChainBundle = async (input: {
    userId: string
    jobId: string
}): Promise<PrepOk | PrepErr> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the client can run accept-bid on-chain steps" }
    }
    if (!job.acpJobId) {
        return {
            ok: false,
            error:
                "No Job ID yet. Publish the listing on Kite (after job_create) before accepting a bid.",
        }
    }
    if (job.status !== "funded") {
        return {
            ok: false,
            error: "Job must be in funded state (bid accepted in app) first",
        }
    }
    if (!job.providerPayoutAddress) {
        return { ok: false, error: "Missing provider payout address" }
    }

    const budget = job.acpBudget?.trim() ?? "0"
    if (budget === "0") {
        return { ok: false, error: "Budget wei is zero" }
    }

    const jid = BigInt(job.acpJobId)
    const provider = getAddress(job.providerPayoutAddress as Address)
    const commerce = commerceAddr()
    const usdt = usdtAddr()
    const amount = BigInt(budget)

    const steps: OnChainStep[] = [
        {
            label: "Approve USDT for Agentic Commerce",
            to: usdt,
            data: encodeErc20Approve(commerce, amount),
        },
        {
            label: "setProvider (winning provider)",
            to: commerce,
            data: encodeAcpSetProvider({ jobId: jid, provider }),
        },
        {
            label: "setBudget (final escrow)",
            to: commerce,
            data: encodeAcpSetBudget({ jobId: jid, amount }),
        },
        {
            label: "fund (pull USDT into escrow)",
            to: commerce,
            data: encodeAcpFund({ jobId: jid }),
        },
    ]

    return {
        ok: true,
        bundle: {
            chainId: KITE_TESTNET_CHAIN_ID,
            commerceAddress: commerce,
            usdtAddress: usdt,
            steps,
        },
    }
}

/** After job_submit (DB): submit(deliverable) on-chain. */
export const getSubmitDeliveryOnChainBundle = async (input: {
    userId: string
    jobId: string
}): Promise<PrepOk | PrepErr> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.providerUserId !== input.userId) {
        return {
            ok: false,
            error: "Only the assigned provider can submit on-chain",
        }
    }
    if (!job.acpJobId) {
        return { ok: false, error: "Job has no Job ID" }
    }
    const raw = job.deliverableCommitment?.trim()
    if (!raw?.startsWith("0x") || raw.length !== 66) {
        return {
            ok: false,
            error: "Missing deliverableCommitment; run job_submit again",
        }
    }
    const commerce = commerceAddr()
    const steps: OnChainStep[] = [
        {
            label: "submit (deliverable commitment)",
            to: commerce,
            data: encodeAcpSubmit({
                jobId: BigInt(job.acpJobId),
                deliverable: raw as Hex,
            }),
        },
    ]
    return {
        ok: true,
        bundle: {
            chainId: KITE_TESTNET_CHAIN_ID,
            commerceAddress: commerce,
            steps,
        },
    }
}

/** Client calls complete() after reviewing. */
export const getCompleteJobOnChainBundle = async (input: {
    userId: string
    jobId: string
}): Promise<PrepOk | PrepErr> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the client can complete on-chain" }
    }
    if (!job.acpJobId) {
        return { ok: false, error: "Job has no Job ID" }
    }
    const commerce = commerceAddr()
    const steps: OnChainStep[] = [
        {
            label: "complete",
            to: commerce,
            data: encodeAcpComplete({ jobId: BigInt(job.acpJobId) }),
        },
    ]
    return {
        ok: true,
        bundle: {
            chainId: KITE_TESTNET_CHAIN_ID,
            commerceAddress: commerce,
            steps,
        },
    }
}

/** Client calls reject() to terminate on-chain job. */
export const getRejectJobOnChainBundle = async (input: {
    userId: string
    jobId: string
}): Promise<PrepOk | PrepErr> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return { ok: false, error: "Only the client can reject on-chain" }
    }
    if (!job.acpJobId) {
        return {
            ok: false,
            error: "No Job ID to reject (use DB-only reject when the listing is still open)",
        }
    }
    const commerce = commerceAddr()
    const steps: OnChainStep[] = [
        {
            label: "reject",
            to: commerce,
            data: encodeAcpReject({ jobId: BigInt(job.acpJobId) }),
        },
    ]
    return {
        ok: true,
        bundle: {
            chainId: KITE_TESTNET_CHAIN_ID,
            commerceAddress: commerce,
            steps,
        },
    }
}

/**
 * Client calls claimRefund() after listing expiry (EIP-8183) to recover escrow and
 * transition the on-chain job to Expired.
 */
export const getClaimRefundOnChainBundle = async (input: {
    userId: string
    jobId: string
}): Promise<PrepOk | PrepErr> => {
    const job = await getAgentJobById(input.jobId)
    if (!job) {
        return { ok: false, error: "Job not found" }
    }
    if (job.clientUserId !== input.userId) {
        return {
            ok: false,
            error: "Only the client can claim a refund for this job",
        }
    }
    if (!job.acpJobId?.trim()) {
        return {
            ok: false,
            error:
                "No Job ID yet—publish the listing on Kite before claimRefund applies",
        }
    }

    const st = job.acpStatus?.toLowerCase() ?? ""
    if (st === "expired") {
        return {
            ok: false,
            error:
                "Job is already expired on-chain. Run job_sync_chain if the app still looks stale.",
        }
    }
    if (st === "completed" || st === "rejected") {
        return {
            ok: false,
            error: `Job is ${st} on-chain; claimRefund does not apply.`,
        }
    }
    if (st !== "funded" && st !== "submitted") {
        return {
            ok: false,
            error:
                st === ""
                    ? "Refresh with job_sync_chain first, then try again."
                    : `claimRefund applies when the job is funded or submitted on-chain after expiry (current: ${st}).`,
        }
    }

    if (job.acpExpiresAt) {
        const expMs = job.acpExpiresAt.getTime()
        if (Number.isFinite(expMs) && expMs > Date.now()) {
            return {
                ok: false,
                error:
                    "On-chain expiry time has not passed yet; claimRefund may revert until then.",
            }
        }
    }

    const commerce = commerceAddr()
    const steps: OnChainStep[] = [
        {
            label: "claimRefund (return escrow; job becomes Expired)",
            to: commerce,
            data: encodeAcpClaimRefund({ jobId: BigInt(job.acpJobId) }),
        },
    ]
    return {
        ok: true,
        bundle: {
            chainId: KITE_TESTNET_CHAIN_ID,
            commerceAddress: commerce,
            steps,
        },
    }
}

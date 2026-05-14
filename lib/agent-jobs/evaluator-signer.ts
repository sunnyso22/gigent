import {
    createWalletClient,
    http,
    keccak256,
    stringToBytes,
    type Address,
    type Hex,
} from "viem"

import { agenticCommerceAbi } from "@/lib/acp/abi"
import {
    AGENTIC_COMMERCE_ADDRESS,
    AcpJobStatus,
    KITE_RPC_URL,
} from "@/lib/acp/constants"
import { readAcpJob } from "@/lib/acp/read-job"
import { kiteChain } from "@/lib/acp/public-client"

import { getEvaluatorAccount } from "./evaluator-config"

export type EvaluatorBroadcastResult =
    | { ok: true; txHash: Hex; action: "complete" | "reject"; reason: Hex }
    | { ok: false; error: string }

const rationaleToReasonBytes32 = (rationale: string): Hex =>
    keccak256(stringToBytes(rationale))

const assertEvaluatorMatchesChain = (
    chainEvaluator: Address,
    signer: Address
) => {
    if (chainEvaluator.toLowerCase() !== signer.toLowerCase()) {
        return {
            ok: false as const,
            error:
                "On-chain evaluator address does not match configured evaluator wallet",
        }
    }
    return { ok: true as const }
}

/** Evaluator-only: `complete` while chain status is Submitted. */
export const evaluatorBroadcastComplete = async (input: {
    acpJobId: bigint
    rationaleText: string
}): Promise<EvaluatorBroadcastResult> => {
    const account = getEvaluatorAccount()
    if (!account) {
        return {
            ok: false,
            error:
                "EVALUATOR_PRIVATE_KEY is not configured on the server for custodial evaluation",
        }
    }

    const chainJob = await readAcpJob(input.acpJobId)
    const check = assertEvaluatorMatchesChain(chainJob.evaluator, account.address)
    if (!check.ok) {
        return check
    }

    if (chainJob.status !== AcpJobStatus.Submitted) {
        return {
            ok: false,
            error: `complete() requires on-chain status Submitted (current: ${chainJob.acpStatusLabel})`,
        }
    }

    const reason = rationaleToReasonBytes32(input.rationaleText)

    const walletClient = createWalletClient({
        account,
        chain: kiteChain,
        transport: http(KITE_RPC_URL),
    })

    try {
        const hash = await walletClient.writeContract({
            address: AGENTIC_COMMERCE_ADDRESS,
            abi: agenticCommerceAbi,
            functionName: "complete",
            args: [input.acpJobId, reason, "0x"],
        })
        return { ok: true, txHash: hash, action: "complete", reason }
    } catch (e) {
        const msg = e instanceof Error ? e.message : "complete transaction failed"
        return { ok: false, error: msg }
    }
}

/** Evaluator-only: `reject` while Funded or Submitted (not Open — client wallet rejects Open). */
export const evaluatorBroadcastReject = async (input: {
    acpJobId: bigint
    rationaleText: string
}): Promise<EvaluatorBroadcastResult> => {
    const account = getEvaluatorAccount()
    if (!account) {
        return {
            ok: false,
            error:
                "EVALUATOR_PRIVATE_KEY is not configured on the server for custodial evaluation",
        }
    }

    const chainJob = await readAcpJob(input.acpJobId)
    const check = assertEvaluatorMatchesChain(chainJob.evaluator, account.address)
    if (!check.ok) {
        return check
    }

    const st = chainJob.status
    if (st !== AcpJobStatus.Funded && st !== AcpJobStatus.Submitted) {
        return {
            ok: false,
            error: `Evaluator reject applies when on-chain status is Funded or Submitted (current: ${chainJob.acpStatusLabel}). For Open listings the client wallet sends reject.`,
        }
    }

    const reason = rationaleToReasonBytes32(input.rationaleText)

    const walletClient = createWalletClient({
        account,
        chain: kiteChain,
        transport: http(KITE_RPC_URL),
    })

    try {
        const hash = await walletClient.writeContract({
            address: AGENTIC_COMMERCE_ADDRESS,
            abi: agenticCommerceAbi,
            functionName: "reject",
            args: [input.acpJobId, reason, "0x"],
        })
        return { ok: true, txHash: hash, action: "reject", reason }
    } catch (e) {
        const msg = e instanceof Error ? e.message : "reject transaction failed"
        return { ok: false, error: msg }
    }
}

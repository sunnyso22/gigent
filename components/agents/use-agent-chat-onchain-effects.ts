"use client"

import * as React from "react"
import { getAddress } from "viem"
import {
    useConnection,
    usePublicClient,
    useSendTransaction,
    useSwitchChain,
} from "wagmi"

import {
    getMarketplaceJobWithBidsAction,
    linkJobToAcpAction,
    syncMarketplaceJobFromChainAction,
} from "@/app/actions/marketplace-job"

import { agenticCommerceAbi } from "@/lib/acp/abi"
import { AcpJobStatus, KITE_TESTNET_CHAIN_ID } from "@/lib/acp/constants"
import { encodeAcpSetBudget } from "@/lib/acp/encode-calls"
import type { JobCreateOnChainPayload } from "@/lib/agents/extract-job-create-onchain"
import type { OnChainStepsBundle } from "@/lib/agent-jobs/onchain-tx-payloads"

type JobCreatePayload = {
    jobId: string
    onChain: JobCreateOnChainPayload
}

type OnChainToolStepsPayload = {
    jobId: string
    bundle: OnChainStepsBundle
    toolName: string
} | null

const stepsRunKey = (p: NonNullable<OnChainToolStepsPayload>) =>
    `${p.toolName}:${p.jobId}:${p.bundle.steps.map((s) => s.data).join("|")}`

const chainJobStatusNum = (status: bigint | number): number =>
    typeof status === "bigint" ? Number(status) : status

/**
 * Wallet flows driven by Agents chat tool output (no extra UI):
 * - `job_create` → createJob, link-acp, setBudget, sync
 * - tools with `onChain.steps` → sequential txs + sync (preflight `getJob` skips stale bundles)
 *
 * Uses Wagmi v3 `useConnection` + mutation `mutateAsync` (see https://wagmi.sh/react/getting-started).
 */
const useAgentChatOnchainEffects = (
    jobCreateOnChain: JobCreatePayload | null,
    onChainSteps: OnChainToolStepsPayload
) => {
    const { chainId, status, address } = useConnection()
    const walletReady = status === "connected" && Boolean(address)
    const { mutateAsync: switchChain } = useSwitchChain()
    const { mutateAsync: sendTransaction } = useSendTransaction()
    const publicClient = usePublicClient({ chainId: KITE_TESTNET_CHAIN_ID })

    const publishLockRef = React.useRef(new Set<string>())
    /** Prevents duplicate wallet prompts when `messages` updates but the same tool output is still "latest". */
    const stepsCompletedKeysRef = React.useRef(new Set<string>())
    const stepsInFlightRef = React.useRef(new Set<string>())

    React.useEffect(() => {
        if (!jobCreateOnChain) {
            return
        }

        const { jobId, onChain } = jobCreateOnChain

        if (publishLockRef.current.has(jobId)) {
            return
        }
        publishLockRef.current.add(jobId)

        void (async () => {
            try {
                const jRes = await getMarketplaceJobWithBidsAction(jobId)
                if (!jRes.ok) {
                    return
                }
                const body = { job: jRes.job }
                if (body.job?.acpJobId) {
                    return
                }

                if (!publicClient || !walletReady) {
                    return
                }

                if (chainId !== KITE_TESTNET_CHAIN_ID) {
                    await switchChain({ chainId: KITE_TESTNET_CHAIN_ID })
                }

                const commerce = getAddress(onChain.commerceAddress)
                const hashCreate = await sendTransaction({
                    to: commerce,
                    data: onChain.createJobData,
                    chainId: KITE_TESTNET_CHAIN_ID,
                })
                await publicClient.waitForTransactionReceipt({
                    hash: hashCreate,
                })

                const counter = await publicClient.readContract({
                    address: commerce,
                    abi: agenticCommerceAbi,
                    functionName: "jobCounter",
                })

                const zero = BigInt(0)
                const candidates =
                    counter > zero ? [counter, counter - BigInt(1)] : [counter]

                let resolved: bigint | null = null
                let lastErr = "Could not link Job ID"
                for (const candidate of candidates) {
                    if (!address) {
                        break
                    }
                    const res = await linkJobToAcpAction({
                        jobId,
                        acpJobId: candidate.toString(),
                        clientWalletAddress: getAddress(
                            address as `0x${string}`
                        ),
                    })
                    if (res.ok) {
                        resolved = candidate
                        break
                    }
                    lastErr = res.error
                }

                if (resolved === null) {
                    throw new Error(lastErr)
                }

                const budgetData = encodeAcpSetBudget({
                    jobId: resolved,
                    amount: BigInt(onChain.initialBudgetAmount),
                })
                const hashBudget = await sendTransaction({
                    to: commerce,
                    data: budgetData,
                    chainId: KITE_TESTNET_CHAIN_ID,
                })
                await publicClient.waitForTransactionReceipt({
                    hash: hashBudget,
                })

                const syncRes = await syncMarketplaceJobFromChainAction(jobId)
                if (!syncRes.ok) {
                    throw new Error(syncRes.error ?? "Sync failed")
                }
            } catch (e) {
                console.error("[auto-publish job_create]", e)
            } finally {
                publishLockRef.current.delete(jobId)
            }
        })()
    }, [
        jobCreateOnChain,
        publicClient,
        walletReady,
        chainId,
        switchChain,
        sendTransaction,
        address,
    ])

    React.useEffect(() => {
        if (!onChainSteps) {
            return
        }

        const key = stepsRunKey(onChainSteps)
        if (stepsCompletedKeysRef.current.has(key)) {
            return
        }
        if (stepsInFlightRef.current.has(key)) {
            return
        }
        stepsInFlightRef.current.add(key)

        void (async () => {
            try {
                if (!publicClient || !walletReady) {
                    return
                }

                const { bundle, jobId } = onChainSteps
                const toolName = onChainSteps.toolName

                const preflightTools = new Set([
                    "bid_accept",
                    "job_complete",
                    "job_submit",
                    "job_reject",
                    "job_claim_refund",
                ])
                if (preflightTools.has(toolName)) {
                    const jRes = await getMarketplaceJobWithBidsAction(jobId)
                    if (jRes.ok) {
                        const body = { job: jRes.job }
                        const rawId = body.job?.acpJobId?.trim() ?? ""
                        if (/^\d+$/.test(rawId)) {
                            const commerce = getAddress(bundle.commerceAddress)
                            const chainJob = await publicClient.readContract({
                                address: commerce,
                                abi: agenticCommerceAbi,
                                functionName: "getJob",
                                args: [BigInt(rawId)],
                            })
                            const st = chainJobStatusNum(chainJob.status)
                            const budget =
                                typeof chainJob.budget === "bigint"
                                    ? chainJob.budget
                                    : BigInt(
                                          String(chainJob.budget)
                                      )

                            /** Fund path done or past (EIP-8183). */
                            const skipBidAccept =
                                toolName === "bid_accept" &&
                                st >= AcpJobStatus.Funded

                            /** Only evaluator complete() while Submitted. */
                            const skipComplete =
                                toolName === "job_complete" &&
                                st !== AcpJobStatus.Submitted

                            /**
                             * submit() allowed when Funded or (Open with zero budget); see ERC-8183 reference.
                             */
                            const canSubmit =
                                st === AcpJobStatus.Funded ||
                                (st === AcpJobStatus.Open &&
                                    budget === BigInt(0))
                            const skipSubmit =
                                toolName === "job_submit" && !canSubmit

                            /**
                             * reject() allowed for Open (client) or Funded/Submitted (evaluator); see ERC-8183 reference.
                             */
                            const canReject =
                                st === AcpJobStatus.Open ||
                                st === AcpJobStatus.Funded ||
                                st === AcpJobStatus.Submitted
                            const skipReject =
                                toolName === "job_reject" && !canReject

                            /** claimRefund after expiry: funded or submitted, not terminal. */
                            const canClaimRefund =
                                st === AcpJobStatus.Funded ||
                                st === AcpJobStatus.Submitted
                            const skipClaimRefund =
                                toolName === "job_claim_refund" &&
                                (st === AcpJobStatus.Expired ||
                                    st === AcpJobStatus.Completed ||
                                    st === AcpJobStatus.Rejected ||
                                    !canClaimRefund)

                            if (
                                skipBidAccept ||
                                skipComplete ||
                                skipSubmit ||
                                skipReject ||
                                skipClaimRefund
                            ) {
                                stepsCompletedKeysRef.current.add(key)
                                await syncMarketplaceJobFromChainAction(jobId)
                                return
                            }
                        }
                    }
                }

                if (chainId !== bundle.chainId) {
                    await switchChain({ chainId: bundle.chainId })
                }

                for (const step of bundle.steps) {
                    const hash = await sendTransaction({
                        to: getAddress(step.to),
                        data: step.data,
                        chainId: bundle.chainId,
                    })
                    await publicClient.waitForTransactionReceipt({
                        hash,
                    })
                }

                const syncRes = await syncMarketplaceJobFromChainAction(jobId)
                if (!syncRes.ok) {
                    throw new Error(syncRes.error ?? "Sync failed")
                }
                stepsCompletedKeysRef.current.add(key)
            } catch (e) {
                console.error("[auto on-chain steps]", onChainSteps.toolName, e)
            } finally {
                stepsInFlightRef.current.delete(key)
            }
        })()
    }, [
        onChainSteps,
        publicClient,
        walletReady,
        chainId,
        switchChain,
        sendTransaction,
    ])
}

export default useAgentChatOnchainEffects

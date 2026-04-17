"use client"

import * as React from "react"
import type { UIMessage } from "ai"

import { fetchPayToViewWithWallet } from "@/lib/agents/pay-to-view-fetch"
import { assertLinkedWalletReadyForPayToView } from "@/lib/agents/pay-to-view-wallet-guard"
import { buildPayToViewSettledAutomationMessage } from "@/lib/agents/pay-to-view-automation"
import { findPayToViewInLastAssistantMessage } from "@/lib/agents/pay-to-view-tool"

const AUTOMATION_ATTEMPTS = 3

const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })

const runWithRetries = async <T,>(
    label: string,
    fn: () => Promise<T>
): Promise<T> => {
    let last: unknown
    for (let attempt = 0; attempt < AUTOMATION_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
            await sleep(600 * attempt)
        }
        try {
            return await fn()
        } catch (e) {
            last = e
        }
    }
    throw last instanceof Error
        ? last
        : new Error(
              `${label} failed after ${AUTOMATION_ATTEMPTS} attempts: ${String(last)}`
          )
}

export type PayToViewFallbackState = {
    assistantMessageId: string
    lastError: string
}

type UseAgentsPayToViewOrchestrationArgs = {
    messages: UIMessage[]
    status: string
    conversationLoading: boolean
    hasApiKey: boolean
    sendMessage: (input: { text: string }) => Promise<void>
}

export const useAgentsPayToViewOrchestration = ({
    messages,
    status,
    conversationLoading,
    hasApiKey,
    sendMessage,
}: UseAgentsPayToViewOrchestrationArgs) => {
    const [fallback, setFallback] =
        React.useState<PayToViewFallbackState | null>(null)
    const fallbackRef = React.useRef<PayToViewFallbackState | null>(null)
    fallbackRef.current = fallback

    const orchestrationDoneJobIdsRef = React.useRef<Set<string>>(new Set())
    const inFlightRef = React.useRef(false)

    const runPayThenAutomate = React.useCallback(
        async (input: {
            payPath: string
            jobId: string
        }) => {
            if (!hasApiKey) {
                throw new Error(
                    "Add your Vercel AI Gateway API key in Settings before continuing."
                )
            }
            await assertLinkedWalletReadyForPayToView()
            const res = await fetchPayToViewWithWallet(input.payPath)
            if (!res.ok) {
                const t = await res.text()
                throw new Error(t || `Payment failed (${res.status})`)
            }
            await sendMessage({
                text: buildPayToViewSettledAutomationMessage(input.jobId),
            })
            orchestrationDoneJobIdsRef.current.add(input.jobId)
            setFallback(null)
        },
        [hasApiKey, sendMessage]
    )

    React.useEffect(() => {
        if (!hasApiKey || conversationLoading) {
            return
        }
        if (status === "submitted" || status === "streaming") {
            return
        }
        if (inFlightRef.current) {
            return
        }

        const found = findPayToViewInLastAssistantMessage(messages)
        if (!found) {
            return
        }

        const { payload, message: assistantMessage } = found
        if (!payload.paymentRequired || !payload.payPath) {
            return
        }
        const jobId = payload.jobId?.trim()
        if (!jobId) {
            return
        }

        if (orchestrationDoneJobIdsRef.current.has(jobId)) {
            return
        }

        const fb = fallbackRef.current
        if (
            fb &&
            fb.assistantMessageId === assistantMessage.id
        ) {
            return
        }

        const ac = new AbortController()

        inFlightRef.current = true

        void (async () => {
            try {
                const jobRes = await fetch(`/api/marketplace/jobs/${jobId}`)
                if (ac.signal.aborted) {
                    return
                }
                if (!jobRes.ok) {
                    throw new Error("Could not load job status.")
                }
                const body = (await jobRes.json()) as {
                    job?: { paymentStatus?: string }
                }
                if (body.job?.paymentStatus === "settled") {
                    await runWithRetries("Automation message", async () => {
                        await sendMessage({
                            text: buildPayToViewSettledAutomationMessage(jobId),
                        })
                    })
                    if (ac.signal.aborted) {
                        return
                    }
                    orchestrationDoneJobIdsRef.current.add(jobId)
                    return
                }

                await runWithRetries("Pay-to-view", async () => {
                    await runPayThenAutomate({
                        payPath: payload.payPath,
                        jobId,
                    })
                })
            } catch (e) {
                if (ac.signal.aborted) {
                    return
                }
                const msg =
                    e instanceof Error ? e.message : "Payment step failed"
                setFallback({
                    assistantMessageId: assistantMessage.id,
                    lastError: msg,
                })
            } finally {
                if (!ac.signal.aborted) {
                    inFlightRef.current = false
                }
            }
        })()

        return () => {
            ac.abort()
            inFlightRef.current = false
        }
    }, [
        conversationLoading,
        hasApiKey,
        messages,
        runPayThenAutomate,
        sendMessage,
        status,
    ])

    return { fallback }
}

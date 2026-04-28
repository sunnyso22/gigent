"use client"

import * as React from "react"
import { useConnection, useConnect } from "wagmi"

import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading"

export const HeaderConnectWalletButton = () => {
    const { address, status } = useConnection()
    const { connectAsync, isPending: connectPending, connectors } = useConnect()

    const [err, setErr] = React.useState<string | null>(null)

    const connector = React.useMemo(
        () => connectors.find((c) => c.id === "injected") ?? connectors[0],
        [connectors]
    )

    const isConnected = status === "connected" && Boolean(address)
    const isReconnecting = status === "reconnecting"

    if (isConnected) {
        return null
    }

    const runConnect = async () => {
        setErr(null)
        if (!connector) {
            setErr("No wallet in this browser (try MetaMask).")
            return
        }
        try {
            await connectAsync({ connector })
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Connect failed")
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none text-xs"
                disabled={
                    connectPending || isReconnecting || !connector
                }
                onClick={() => {
                    void runConnect()
                }}
            >
                {connectPending ? (
                    <>
                        <LoadingSpinner data-icon="inline-start" />
                        Connecting…
                    </>
                ) : (
                    "Connect wallet"
                )}
            </Button>
            {err ? (
                <p className="max-w-[220px] text-right text-[10px] text-destructive">
                    {err}
                </p>
            ) : null}
        </div>
    )
}

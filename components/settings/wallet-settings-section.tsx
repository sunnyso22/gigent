"use client"

import * as React from "react"
import { useConnection, useConnect, useDisconnect } from "wagmi"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"

export const WalletSettingsSection = () => {
    const { address, status, chainId } = useConnection()
    const { connectAsync, isPending: connectPending, connectors } = useConnect()
    const { disconnectAsync, isPending: disconnectPending } = useDisconnect()

    const [err, setErr] = React.useState<string | null>(null)

    const connector = React.useMemo(
        () => connectors.find((c) => c.id === "injected") ?? connectors[0],
        [connectors]
    )

    const connectWallet = async () => {
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

    const disconnectWallet = async () => {
        setErr(null)
        try {
            await disconnectAsync()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Disconnect failed")
        }
    }

    const busy = connectPending || disconnectPending
    const isInitialLoading = status === "reconnecting"
    const isConnected = status === "connected" && Boolean(address)

    return (
        <Card className="rounded-none border-border">
            <CardHeader className="space-y-1">
                <CardTitle className="font-heading text-base">Wallet</CardTitle>
                <CardDescription className="text-xs">
                    Connect your browser wallet on Kite Testnet (chain 2368) when
                    you use Agents or the marketplace for contract signing. This wallet is
                    only stored in the browser session—not saved to your Gigent
                    account.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {isInitialLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LoadingSpinner className="size-3" />
                        Loading…
                    </div>
                ) : isConnected && address ? (
                    <div className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">
                            Connected address
                        </span>
                        <span className="font-mono break-all text-foreground">
                            {address}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {chainId != null ? `Chain: ${chainId}` : ""}
                        </span>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        No wallet connected in this browser.
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    {isConnected ? (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busy || isInitialLoading}
                            onClick={() => void disconnectWallet()}
                            className="rounded-none text-xs"
                        >
                            {disconnectPending ? (
                                <>
                                    <LoadingSpinner data-icon="inline-start" />
                                    Disconnecting…
                                </>
                            ) : (
                                "Disconnect wallet"
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy || isInitialLoading || !connector}
                            onClick={() => void connectWallet()}
                            className="rounded-none text-xs"
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
                    )}
                </div>
                {err ? <p className="text-xs text-destructive">{err}</p> : null}
            </CardContent>
        </Card>
    )
}

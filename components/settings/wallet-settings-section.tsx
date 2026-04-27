"use client"

import * as React from "react"
import { getAddress } from "viem"
import {
    useConnection,
    useConnect,
    useDisconnect,
    useSignMessage,
} from "wagmi"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"
import { WALLET_UPDATED_EVENT } from "@/lib/wallet/wallet-events"
import { formatShortWalletAddress } from "@/lib/wallet/format-address"

type WalletMeOk = {
    linked: true
    address: string
    chainId: string
}
type WalletMeNone = {
    linked: false
}

const sameAddress = (a: string, b: string) =>
    getAddress(a as `0x${string}`) === getAddress(b as `0x${string}`)

export const WalletSettingsSection = () => {
    const { address, status, chainId } = useConnection()
    const { connectAsync, isPending: connectPending, connectors } = useConnect()
    const { disconnectAsync, isPending: disconnectPending } = useDisconnect()
    const { signMessageAsync } = useSignMessage()

    const [err, setErr] = React.useState<string | null>(null)
    const [serverWallet, setServerWallet] = React.useState<
        WalletMeOk | WalletMeNone | null
    >(null)
    const [serverLoading, setServerLoading] = React.useState(true)
    const [linkBusy, setLinkBusy] = React.useState(false)

    const refreshServerWallet = React.useCallback(async () => {
        const res = await fetch("/api/wallet/me", { credentials: "include" })
        if (!res.ok) {
            setServerWallet(null)
            return
        }
        setServerWallet((await res.json()) as WalletMeOk | WalletMeNone)
    }, [])

    React.useEffect(() => {
        let cancelled = false
        setServerLoading(true)
        void refreshServerWallet().finally(() => {
            if (!cancelled) setServerLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [refreshServerWallet])

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

    const linkToAccount = async () => {
        setErr(null)
        if (!address) return
        setLinkBusy(true)
        try {
            const prep = await fetch("/api/wallet/prepare", {
                method: "POST",
                credentials: "include",
            })
            if (!prep.ok) {
                throw new Error("Could not start wallet link")
            }
            const { message } = (await prep.json()) as { message: string }

            const signature = (await signMessageAsync({
                message,
            })) as `0x${string}`

            const verify = await fetch("/api/wallet/verify", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    signature,
                }),
            })
            if (!verify.ok) {
                const j = (await verify.json()) as { error?: string }
                throw new Error(j.error ?? "Verification failed")
            }
            await refreshServerWallet()
            window.dispatchEvent(new Event(WALLET_UPDATED_EVENT))
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Link failed")
        } finally {
            setLinkBusy(false)
        }
    }

    const busy =
        connectPending || disconnectPending || linkBusy || serverLoading
    const isInitialLoading = status === "reconnecting"
    const isConnected = status === "connected" && Boolean(address)

    const linkedMatchesConnected =
        isConnected &&
        address &&
        serverWallet?.linked &&
        sameAddress(serverWallet.address, address)

    const showLinkButton =
        isConnected &&
        address &&
        !linkedMatchesConnected &&
        !serverLoading

    return (
        <Card className="rounded-none border-border">
            <CardHeader className="space-y-1">
                <CardTitle className="font-heading text-base">Wallet</CardTitle>
                <CardDescription className="text-xs">
                    Connect your browser wallet on Kite Testnet (chain 2368),
                    then link it to this Gigent account (signature) for ERC-8183
                    Agentic Commerce (USDT escrow).
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

                {isConnected && address ? (
                    <div className="border-border border-t pt-3">
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Account link
                        </p>
                        {serverLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoadingSpinner className="size-3" />
                                Checking link status…
                            </div>
                        ) : linkedMatchesConnected ? (
                            <p className="text-xs text-muted-foreground">
                                This address is linked to your logged-in account.
                            </p>
                        ) : serverWallet?.linked ? (
                            <p className="text-xs text-muted-foreground">
                                Your account is linked to{" "}
                                <span className="font-mono">
                                    {formatShortWalletAddress(
                                        serverWallet.address
                                    )}
                                </span>
                                . You can link your connected address instead
                                (this replaces the previous link).
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Not linked to your Gigent account yet—use the
                                button below and approve the signature in your
                                wallet.
                            </p>
                        )}
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                    {isConnected ? (
                        <>
                            {showLinkButton ? (
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    disabled={
                                        busy ||
                                        isInitialLoading ||
                                        linkBusy
                                    }
                                    onClick={() => void linkToAccount()}
                                    className="rounded-none text-xs"
                                >
                                    {linkBusy ? (
                                        <>
                                            <LoadingSpinner data-icon="inline-start" />
                                            Sign to link…
                                        </>
                                    ) : (
                                        "Link to account"
                                    )}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                    busy ||
                                    isInitialLoading ||
                                    linkBusy
                                }
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
                        </>
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

"use client"

import * as React from "react"
import { getAddress } from "viem"

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

export const WalletSettingsSection = () => {
    const [me, setMe] = React.useState<WalletMeOk | WalletMeNone | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [err, setErr] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        const res = await fetch("/api/wallet/me", { credentials: "include" })
        if (!res.ok) {
            setMe(null)
            return
        }
        setMe((await res.json()) as WalletMeOk | WalletMeNone)
    }, [])

    React.useEffect(() => {
        void refresh()
    }, [refresh])

    const linkWallet = async () => {
        setErr(null)
        const eth = typeof window !== "undefined" ? window.ethereum : undefined
        if (!eth?.request) {
            setErr("No wallet in this browser (try MetaMask).")
            return
        }
        setBusy(true)
        try {
            const prep = await fetch("/api/wallet/prepare", {
                method: "POST",
                credentials: "include",
            })
            if (!prep.ok) {
                throw new Error("Could not start wallet link")
            }
            const { message } = (await prep.json()) as { message: string }

            const accounts = (await eth.request({
                method: "eth_requestAccounts",
            })) as string[]
            const addr = accounts[0]
            if (!addr) {
                throw new Error("No account from wallet")
            }

            const signature = (await eth.request({
                method: "personal_sign",
                params: [message, addr],
            })) as `0x${string}`

            const verify = await fetch("/api/wallet/verify", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address: addr,
                    signature,
                }),
            })
            if (!verify.ok) {
                const j = (await verify.json()) as { error?: string }
                throw new Error(j.error ?? "Verification failed")
            }
            await refresh()
            window.dispatchEvent(new Event(WALLET_UPDATED_EVENT))
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Link failed")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card className="rounded-none border-border">
            <CardHeader className="space-y-1">
                <CardTitle className="font-heading text-base">
                    Wallet (Base Sepolia)
                </CardTitle>
                <CardDescription className="text-xs">
                    Link an address for marketplace payouts and x402 pay-to-view.
                    You will sign a short message to prove ownership.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {me === null ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LoadingSpinner className="size-3" />
                        Loading…
                    </div>
                ) : me.linked ? (
                    <div className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Linked address</span>
                        <span className="break-all font-mono text-foreground">
                            {getAddress(me.address as `0x${string}`)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            Short: {formatShortWalletAddress(me.address)} ·{" "}
                            {me.chainId}
                        </span>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        No wallet linked yet.
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || me === null}
                        onClick={() => void linkWallet()}
                        className="rounded-none text-xs"
                    >
                        {busy ? (
                            <>
                                <LoadingSpinner data-icon="inline-start" />
                                Signing…
                            </>
                        ) : me?.linked ? (
                            "Relink wallet"
                        ) : (
                            "Link wallet"
                        )}
                    </Button>
                </div>
                {err ? (
                    <p className="text-xs text-destructive">{err}</p>
                ) : null}
            </CardContent>
        </Card>
    )
}

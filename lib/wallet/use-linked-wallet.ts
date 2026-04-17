"use client"

import * as React from "react"

import { authClient } from "@/lib/auth/client"
import { WALLET_UPDATED_EVENT } from "@/lib/wallet/wallet-events"

/** `undefined` while loading or logged out; `null` if no wallet; else checksummed address. */
export const useLinkedWalletAddress = () => {
    const { data: session } = authClient.useSession()
    const [walletAddress, setWalletAddress] = React.useState<
        string | null | undefined
    >(undefined)

    const refresh = React.useCallback(() => {
        void (async () => {
            const res = await fetch("/api/wallet/me", { credentials: "include" })
            if (!res.ok) {
                setWalletAddress(null)
                return
            }
            const j = (await res.json()) as {
                linked?: boolean
                address?: string
            }
            setWalletAddress(j.linked && j.address ? j.address : null)
        })()
    }, [])

    React.useEffect(() => {
        if (!session?.user) {
            setWalletAddress(undefined)
            return
        }
        refresh()
    }, [session?.user?.id, refresh])

    React.useEffect(() => {
        const onWalletUpdated = () => refresh()
        window.addEventListener(WALLET_UPDATED_EVENT, onWalletUpdated)
        return () =>
            window.removeEventListener(WALLET_UPDATED_EVENT, onWalletUpdated)
    }, [refresh])

    return walletAddress
}

import { getAddress } from "viem"

type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export const assertLinkedWalletReadyForPayToView = async () => {
    const eth = (
        typeof window !== "undefined" ? window.ethereum : undefined
    ) as EthereumProvider | undefined
    if (!eth?.request) {
        throw new Error("Connect a wallet first.")
    }
    const accounts = (await eth.request({
        method: "eth_requestAccounts",
    })) as string[]
    const active = accounts[0]
    if (!active) {
        throw new Error("No wallet account selected.")
    }
    const resMe = await fetch("/api/wallet/me")
    const me = (await resMe.json()) as {
        linked?: boolean
        address?: string
    }
    if (!me.linked || !me.address) {
        throw new Error(
            "Link your wallet in Settings before paying (Base Sepolia)."
        )
    }
    if (
        getAddress(active as `0x${string}`) !==
        getAddress(me.address as `0x${string}`)
    ) {
        throw new Error(
            "Connected wallet must match your linked Gigent address."
        )
    }
}

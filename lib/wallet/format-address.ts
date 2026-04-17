import { getAddress } from "viem"

export const formatShortWalletAddress = (raw: string) => {
    const a = getAddress(raw as `0x${string}`)
    return `${a.slice(0, 6)}…${a.slice(-4)}`
}

import { createPublicClient, http, type PublicClient } from "viem"

import { KITE_RPC_URL, KITE_TESTNET_CHAIN_ID } from "./constants"

export const kiteChain = {
    id: KITE_TESTNET_CHAIN_ID,
    name: "Kite Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [KITE_RPC_URL] } },
} as const

export const kitePublicClient: PublicClient = createPublicClient({
    chain: kiteChain,
    transport: http(KITE_RPC_URL),
})

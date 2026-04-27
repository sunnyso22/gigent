import { createConfig, http, injected } from "wagmi"
import { mainnet, sepolia } from "wagmi/chains"
import { defineChain } from "viem"

import { KITE_RPC_URL, KITE_TESTNET_CHAIN_ID } from "@/lib/acp/constants"

export const kiteTestnet = defineChain({
    id: KITE_TESTNET_CHAIN_ID,
    name: "Kite Testnet",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: {
        default: { http: [KITE_RPC_URL] },
    },
})

export const config = createConfig({
    chains: [kiteTestnet, mainnet, sepolia],
    connectors: [injected()],
    transports: {
        [kiteTestnet.id]: http(KITE_RPC_URL),
        [mainnet.id]: http(),
        [sepolia.id]: http(),
    },
})

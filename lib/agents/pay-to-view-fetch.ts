import { x402Client } from "@x402/core/client"
import { wrapFetchWithPayment } from "@x402/fetch"
import { ExactEvmScheme } from "@x402/evm/exact/client"
import { toClientEvmSigner } from "@x402/evm"
import { createPublicClient, createWalletClient, custom, http } from "viem"
import { baseSepolia } from "viem/chains"

type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

const baseSepoliaChainIdHex = `0x${(84532).toString(16)}` as const

const ensureBaseSepolia = async (eth: EthereumProvider) => {
    try {
        await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: baseSepoliaChainIdHex }],
        })
    } catch (e: unknown) {
        const code = (e as { code?: number }).code
        if (code === 4902) {
            await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                        chainId: baseSepoliaChainIdHex,
                        chainName: "Base Sepolia",
                        nativeCurrency: {
                            name: "Ethereum",
                            symbol: "ETH",
                            decimals: 18,
                        },
                        rpcUrls: ["https://sepolia.base.org"],
                        blockExplorerUrls: ["https://sepolia.basescan.org"],
                    },
                ],
            })
            return
        }
        throw e
    }
}

export const fetchPayToViewWithWallet = async (payPath: string) => {
    const w = typeof window !== "undefined" ? window : undefined
    const eth = w?.ethereum as EthereumProvider | undefined
    if (!eth?.request) {
        throw new Error(
            "No wallet found. Install MetaMask (or another wallet) and refresh."
        )
    }

    await ensureBaseSepolia(eth)

    const transport = custom(eth)
    const base = createWalletClient({
        chain: baseSepolia,
        transport,
    })
    const [account] = await base.getAddresses()
    if (!account) {
        throw new Error("Unlock your wallet and connect an account.")
    }

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport,
    })

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
    })

    const signer = toClientEvmSigner(
        {
            address: account,
            signTypedData: async (message) =>
                walletClient.signTypedData({
                    account,
                    domain: message.domain,
                    types: message.types,
                    primaryType: message.primaryType,
                    message: message.message,
                }),
        },
        publicClient
    )
    const client = new x402Client()
    client.register("eip155:*", new ExactEvmScheme(signer))
    const fetchWithPayment = wrapFetchWithPayment(fetch, client)
    const url = `${window.location.origin}${payPath}`
    return fetchWithPayment(url, { method: "GET" })
}

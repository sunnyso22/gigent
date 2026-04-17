import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"

const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
})

export const marketplaceX402Server = new x402ResourceServer(facilitatorClient)

marketplaceX402Server.register("eip155:*", new ExactEvmScheme())

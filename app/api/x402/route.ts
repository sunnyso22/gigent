import { NextRequest, NextResponse } from "next/server"
import { withX402 } from "@x402/next"
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server"
import { ExactEvmScheme } from "@x402/evm/exact/server"

export const evmAddress = "0x04f9A1C45aE5f7fB0A85baEd3F42be0dB2342192"

const facilitatorClient = new HTTPFacilitatorClient({
    url: "https://x402.org/facilitator",
})

export const server = new x402ResourceServer(facilitatorClient)
server.register("eip155:*", new ExactEvmScheme())

const handler = async (_: NextRequest) => {
    return NextResponse.json(
        {
            report: {
                weather: "sunny",
                temperature: 72,
            },
        },
        { status: 200 }
    )
}

export const GET = withX402(
    handler,
    {
        accepts: [
            {
                scheme: "exact",
                price: "$0.01",
                network: "eip155:84532", // Base Sepolia
                payTo: evmAddress,
            },
        ],
        description: "Access to weather API",
        mimeType: "application/json",
    },
    server
)

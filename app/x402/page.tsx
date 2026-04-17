import { wrapFetchWithPayment } from "@x402/fetch"
import { ExactEvmScheme } from "@x402/evm/exact/client"
import { x402Client, x402HTTPClient } from "@x402/core/client"
import { privateKeyToAccount } from "viem/accounts"

const X402Page = async () => {
    // Create a signer from private key (use environment variable)
    const signer = privateKeyToAccount(
        process.env.EVM_PRIVATE_KEY as `0x${string}`
    )

    // Create x402 client and register EVM scheme
    const client = new x402Client()
    client.register("eip155:*", new ExactEvmScheme(signer))

    // Wrap fetch with payment handling
    const fetchWithPayment = wrapFetchWithPayment(fetch, client)

    // Make request - payment is handled automatically
    const response = await fetchWithPayment("http://localhost:3000/api/x402", {
        method: "GET",
    })

    const data = await response.json()
    console.log("Response:", data)

    // Get payment receipt from response headers
    if (response.ok) {
        const httpClient = new x402HTTPClient(client)
        const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
            response.headers.get(name)
        )
        console.log("Payment settled:", paymentResponse)
    }

    return <div>X402</div>
}

export default X402Page

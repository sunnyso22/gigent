/** Formats bid amount for x402 `accepts.price` (e.g. "$12.50"). */
export const formatUsdcPriceForX402 = (amountDecimalString: string): string => {
    const n = Number.parseFloat(amountDecimalString.trim())
    if (!Number.isFinite(n) || n < 0) {
        throw new Error("Invalid USDC amount")
    }
    return `$${n.toFixed(2)}`
}

import { formatUnits } from "viem"

import { KITE_USDT_DECIMALS } from "./constants"

/**
 * Map a user-entered USDT string to the uint256 string stored on-chain / in `acp_budget`.
 * Only **whole** USDT are allowed (10 → `"10"`); fractional values are rejected.
 */
export const usdtDecimalToWei = (decimal: string): string => {
    const raw = decimal.trim()
    if (raw === "") {
        throw new Error("Empty budget amount")
    }
    if (!/^\d+(\.\d*)?$/.test(raw)) {
        throw new Error("Invalid USDT amount")
    }
    const [whole, frac = ""] = raw.split(".")
    const trimmedFrac = frac.replace(/0+$/, "")
    if (trimmedFrac !== "") {
        throw new Error(
            "USDT amount must be a whole number (on-chain budget is 1:1 USDT, not ERC-20 decimals)."
        )
    }
    const w = whole === "" ? "0" : whole
    return BigInt(w).toString()
}

/** Format stored on-chain budget for display (whole USDT when `KITE_USDT_DECIMALS` is 0). */
export const formatUsdtWei = (stored: string): string => {
    const w = stored.trim()
    if (w === "" || w === "0") {
        return "0"
    }
    return formatUnits(BigInt(w), KITE_USDT_DECIMALS)
}

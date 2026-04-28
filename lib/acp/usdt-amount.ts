import { formatUnits, parseUnits } from "viem"

import { KITE_USDT_DECIMALS } from "./constants"

/**
 * Map a user-entered whole USDT string to base units (`acp_budget`, `approve`, `setBudget`).
 * Only whole USDT are allowed; fractional values are rejected.
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
            "USDT amount must be a whole number (token uses standard ERC-20 decimals on Kite)."
        )
    }
    const w = whole === "" ? "0" : whole
    return parseUnits(w, KITE_USDT_DECIMALS).toString()
}

/** Format stored base units for display as USDT. */
export const formatUsdtWei = (stored: string): string => {
    const w = stored.trim()
    if (w === "" || w === "0") {
        return "0"
    }
    return formatUnits(BigInt(w), KITE_USDT_DECIMALS)
}

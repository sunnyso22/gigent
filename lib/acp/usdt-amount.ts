import { formatUnits, parseUnits } from "viem"

import { KITE_USDT_DECIMALS } from "./constants"

/** Strip redundant fractional zeros ("12.34000" → "12.34", "12.000" → "12"). */
const compactDecimalString = (raw: string): string => {
    if (!raw.includes(".")) {
        return raw
    }
    const [whole, frac = ""] = raw.split(".")
    const trimmedFrac = frac.replace(/0+$/, "")
    return trimmedFrac === "" ? whole : `${whole}.${trimmedFrac}`
}

/**
 * Map a user-entered USDT decimal string to payment-token base units (`acp_budget`, `approve`, `setBudget`).
 * Supports fractional amounts up to {@link KITE_USDT_DECIMALS} places (e.g. "0.5", "1.23").
 */
export const usdtDecimalToWei = (decimal: string): string => {
    let raw = decimal.trim()
    if (raw === "") {
        throw new Error("Empty budget amount")
    }
    if (raw.startsWith(".")) {
        raw = `0${raw}`
    }
    if (!/^\d+(\.\d*)?$/.test(raw)) {
        throw new Error("Invalid USDT amount")
    }
    const compact = compactDecimalString(raw)
    const dot = compact.indexOf(".")
    if (dot !== -1) {
        const frac = compact.slice(dot + 1)
        if (frac.length > KITE_USDT_DECIMALS) {
            throw new Error(
                `USDT amount supports at most ${KITE_USDT_DECIMALS} digits after the decimal point`
            )
        }
    }
    try {
        return parseUnits(compact, KITE_USDT_DECIMALS).toString()
    } catch {
        throw new Error("Invalid USDT amount")
    }
}

/** Format stored base units for display as USDT. */
export const formatUsdtWei = (stored: string): string => {
    const w = stored.trim()
    if (w === "" || w === "0") {
        return "0"
    }
    return formatUnits(BigInt(w), KITE_USDT_DECIMALS)
}

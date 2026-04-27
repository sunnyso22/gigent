/** Kite Testnet — ERC-8183 Agentic Commerce deployment. */

export const KITE_TESTNET_CHAIN_ID = 2368

/** CAIP-2 chain id for wallet linking / SIWE message. */
export const KITE_CAIP2_NETWORK = `eip155:${KITE_TESTNET_CHAIN_ID}` as const

export const KITE_RPC_URL =
    process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/"

/** ERC-8183 Agentic Commerce on Kite Testnet (`setBudget`: client or provider). */
export const AGENTIC_COMMERCE_ADDRESS =
    "0xd7162D661F8FA3175BFD49dd48604AC47f316296" as const

/** USDT on Kite Testnet (from `paymentToken()` on the commerce contract). */
export const KITE_USDT_ADDRESS =
    "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63" as const

/**
 * Display / DB numeric scale for mirrored `acp_budget` and `setBudget` amounts.
 * Agentic Commerce on Kite uses **whole USDT units** (10 USDT → uint256 `10`), not token wei.
 */
export const KITE_USDT_DECIMALS = 0

/** Default `createJob.expiredAt` when omitted — now + 7 days (seconds). */
export const DEFAULT_JOB_EXPIRY_SECONDS = 7 * 24 * 60 * 60

/** `JobStatus` enum order from AgenticCommerce (uint8). */
export const AcpJobStatus = {
    Open: 0,
    Funded: 1,
    Submitted: 2,
    Completed: 3,
    Rejected: 4,
    Expired: 5,
} as const

export type AcpJobStatusKey = keyof typeof AcpJobStatus

export const acpStatusNumberToLabel = (n: number): string => {
    const entry = Object.entries(AcpJobStatus).find(([, v]) => v === n)
    return entry ? entry[0].toLowerCase() : "unknown"
}

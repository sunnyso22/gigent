import { keccak256, stringToBytes } from "viem"

import type { JobDeliveryPayload } from "@/lib/agent-jobs/delivery/payload"

const stableStringify = (v: unknown): string => {
    if (v === null || typeof v !== "object") {
        return JSON.stringify(v)
    }
    if (Array.isArray(v)) {
        return `[${v.map((x) => stableStringify(x)).join(",")}]`
    }
    const o = v as Record<string, unknown>
    const keys = Object.keys(o).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`
}

/** `bytes32` commitment for `submit` — must match client-side calldata. */
export const deliverableCommitmentBytes32 = (
    payload: JobDeliveryPayload
): `0x${string}` => keccak256(stringToBytes(stableStringify(payload)))

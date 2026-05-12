import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import { getAddress, type Address } from "viem"

const pkRegex = /^0x[0-9a-fA-F]{64}$/

/** Parses `EVALUATOR_PRIVATE_KEY` (0x + 64 hex) for custodial complete/reject on Kite. */
export const parseEvaluatorPrivateKey = (
    raw: string | undefined
): `0x${string}` | null => {
    if (raw == null) {
        return null
    }
    const t = raw.trim()
    if (!t) {
        return null
    }
    const hex = (t.startsWith("0x") ? t : `0x${t}`) as string
    if (!pkRegex.test(hex)) {
        return null
    }
    return hex as `0x${string}`
}

let cachedAccount: PrivateKeyAccount | null | undefined

/** Account derived from env, or null if unset/invalid (legacy client-as-evaluator mode). */
export const getEvaluatorAccount = (): PrivateKeyAccount | null => {
    if (cachedAccount !== undefined) {
        return cachedAccount
    }
    const pk = parseEvaluatorPrivateKey(process.env.EVALUATOR_PRIVATE_KEY)
    if (!pk) {
        cachedAccount = null
        return null
    }
    cachedAccount = privateKeyToAccount(pk)
    return cachedAccount
}

export const getConfiguredEvaluatorAddress = (): Address | null => {
    const a = getEvaluatorAccount()
    return a ? getAddress(a.address) : null
}

/** Job mirrors platform evaluator after chain sync (`acp_evaluator_address`). */
export const jobUsesPlatformEvaluator = (job: {
    acpEvaluatorAddress?: string | null
}): boolean => {
    const platform = getConfiguredEvaluatorAddress()
    const ev = job.acpEvaluatorAddress?.trim().toLowerCase() ?? ""
    if (!platform || !ev) {
        return false
    }
    return ev === platform.toLowerCase()
}

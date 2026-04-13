import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes,
} from "crypto"

const ALGO = "aes-256-gcm" as const
const IV_LEN = 12

/** Domain-separated HKDF info so this key is never reused for auth tokens. */
const HKDF_INFO = "gigent:ai-gateway-user-key-v1"
const HKDF_INFO_LEGACY = "agents-marketplace:ai-gateway-user-key-v1"

const keyFromExplicitSecret = (raw: string): Buffer => {
    const t = raw.trim()
    if (/^[0-9a-fA-F]{64}$/.test(t)) {
        return Buffer.from(t, "hex")
    }
    const b = Buffer.from(t, "base64")
    if (b.length !== 32) {
        throw new Error(
            "AI_GATEWAY_USER_KEY_SECRET must be 64 hex chars or base64 decoding to 32 bytes"
        )
    }
    return b
}

const keyFromBetterAuthSecret = (info: string): Buffer => {
    const auth = process.env.BETTER_AUTH_SECRET?.trim()
    if (!auth) {
        throw new Error(
            "Set BETTER_AUTH_SECRET in the environment (or optional AI_GATEWAY_USER_KEY_SECRET) so user gateway keys can be encrypted at rest."
        )
    }
    return Buffer.from(
        hkdfSync(
            "sha256",
            Buffer.from(auth, "utf8"),
            Buffer.alloc(0),
            Buffer.from(info, "utf8"),
            32
        )
    )
}

/**
 * Prefer optional `AI_GATEWAY_USER_KEY_SECRET` when set (separate rotation).
 * Otherwise derive a 32-byte key from `BETTER_AUTH_SECRET` via HKDF.
 */
const getEncryptionKey = (): Buffer => {
    const explicit = process.env.AI_GATEWAY_USER_KEY_SECRET?.trim()
    if (explicit) {
        return keyFromExplicitSecret(explicit)
    }
    return keyFromBetterAuthSecret(HKDF_INFO)
}

const getDecryptionKeys = (): Buffer[] => {
    const explicit = process.env.AI_GATEWAY_USER_KEY_SECRET?.trim()
    if (explicit) {
        return [keyFromExplicitSecret(explicit)]
    }
    return [
        keyFromBetterAuthSecret(HKDF_INFO),
        keyFromBetterAuthSecret(HKDF_INFO_LEGACY),
    ]
}

const decryptWithKey = (key: Buffer, blob: string): string => {
    const parts = blob.split(":")
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted key format")
    }
    const [ivHex, tagHex, ctHex] = parts
    const decipher = createDecipheriv(
        ALGO,
        key,
        Buffer.from(ivHex!, "hex")
    )
    decipher.setAuthTag(Buffer.from(tagHex!, "hex"))
    return Buffer.concat([
        decipher.update(Buffer.from(ctHex!, "hex")),
        decipher.final(),
    ]).toString("utf8")
}

export const encryptAiGatewayApiKey = (plaintext: string): string => {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, key, iv)
    const enc = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(
        ":"
    )
}

export const decryptAiGatewayApiKey = (blob: string): string => {
    const keys = getDecryptionKeys()
    let last: unknown
    for (const key of keys) {
        try {
            return decryptWithKey(key, blob)
        } catch (e) {
            last = e
        }
    }
    throw last instanceof Error
        ? last
        : new Error("Failed to decrypt AI Gateway API key")
}

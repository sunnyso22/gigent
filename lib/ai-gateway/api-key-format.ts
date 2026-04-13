/** Vercel AI Gateway keys look like: vck_<opaque token> (URL-safe characters). */
const AI_GATEWAY_API_KEY_RE = /^vck_[A-Za-z0-9_-]{20,}$/

export const isValidAiGatewayApiKeyFormat = (raw: string): boolean => {
    const key = raw.trim()
    return key.length > 0 && AI_GATEWAY_API_KEY_RE.test(key)
}

export const AI_GATEWAY_API_KEY_FORMAT_HINT =
    "Use a key that starts with vck_ followed by the secret."

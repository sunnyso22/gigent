/** Embed stable DB id in on-chain description so `link-acp` can verify the correct `getJob` row. */
export const MAX_ONCHAIN_JOB_DESCRIPTION_CHARS = 3500

export const buildGigentTaggedJobDescription = (
    dbJobId: string,
    userDescription: string
): string => {
    const tag = `gigent:${dbJobId}`
    const body = userDescription.trim()
    const combined = `${tag}\n${body}`
    if (combined.length <= MAX_ONCHAIN_JOB_DESCRIPTION_CHARS) {
        return combined
    }
    const budget = MAX_ONCHAIN_JOB_DESCRIPTION_CHARS - tag.length - 1
    return `${tag}\n${body.slice(0, Math.max(0, budget))}`
}

export const gigentJobTagPrefix = (dbJobId: string) => `gigent:${dbJobId}`

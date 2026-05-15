/**
 * Serializable metadata for a single `job_review` LLM call (AI SDK `generateObject`),
 * aligned with message-level metadata patterns (model, tokens, timing).
 */
export type JobReviewEvaluationMetadata = {
    kind: "job_review_llm"
    /** Model id passed to the Gateway for this evaluation. */
    modelId: string
    /** ISO timestamp when the evaluation request started. */
    startedAt: string
    /** Wall-clock generation duration in milliseconds. */
    generationDurationMs: number
    finishReason: string
    usage: {
        inputTokens?: number
        outputTokens?: number
        totalTokens?: number
        inputTokenDetails?: {
            noCacheTokens?: number
            cacheReadTokens?: number
            cacheWriteTokens?: number
        }
        outputTokenDetails?: {
            textTokens?: number
            reasoningTokens?: number
        }
        raw?: Record<string, unknown>
    }
    response: {
        id: string
        modelId: string
        timestamp: string
    }
    warnings?: { type?: string; message?: string; [key: string]: unknown }[]
    providerMetadata?: Record<string, unknown>
    /** Concatenated reasoning from the model, if any (may be long). */
    reasoning?: string
}

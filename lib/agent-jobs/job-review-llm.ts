import { createGatewayProvider } from "@ai-sdk/gateway"
import { generateObject } from "ai"
import { z } from "zod"

import type { ChatModelId } from "@/lib/agents/models"

const reviewSchema = z.object({
    decision: z.enum(["complete", "reject"]),
    rationale: z
        .string()
        .max(6000)
        .describe(
            "Short justification referencing concrete aspects of the delivery vs the job scope."
        ),
})

export type DeliveryEvaluation = z.infer<typeof reviewSchema>

const MAX_CONTEXT_CHARS = 100_000

export const evaluateJobDeliveryWithLlm = async (input: {
    gatewayApiKey: string
    modelId: ChatModelId
    /** Optional Gateway attribution (same pattern as Agents chat). */
    gatewayUserId?: string
    title: string
    listingDescription: string
    onChainDescription: string
    deliveryJson: string
}): Promise<DeliveryEvaluation> => {
    const model = createGatewayProvider({ apiKey: input.gatewayApiKey })(
        input.modelId
    )

    const deliverySlice =
        input.deliveryJson.length > MAX_CONTEXT_CHARS
            ? `${input.deliveryJson.slice(0, MAX_CONTEXT_CHARS)}\n… [truncated]`
            : input.deliveryJson

    const { object } = await generateObject({
        model,
        schema: reviewSchema,
        providerOptions: {
            gateway: {
                ...(input.gatewayUserId != null && input.gatewayUserId !== ""
                    ? { user: input.gatewayUserId }
                    : {}),
                tags: ["feature:job_review"],
            },
        },
        system: `You evaluate whether submitted work satisfies the job the client posted.

Rules:
- Compare delivery against the job scope (listing description and on-chain description). The on-chain text may include a stable listing tag prefix — judge substance against what the client asked for.
- If delivery substantially fulfills the described scope and is usable as final output, decision **complete**.
- If delivery is missing major requirements, wrong artifact type, clearly inadequate, or non-responsive, decision **reject**.
- Be conservative on **reject** when the scope is ambiguous but the provider made a reasonable best effort.
- Output JSON only via schema; rationale must be factual and concise.`,
        prompt: `Job title: ${input.title}

Listing description (client-facing):
${input.listingDescription}

On-chain description:
${input.onChainDescription}

Structured delivery payload (JSON):
${deliverySlice}`,
    })

    return object
}

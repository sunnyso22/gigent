import type { Address } from "viem"

import { agenticCommerceAbi } from "./abi"
import { AGENTIC_COMMERCE_ADDRESS, acpStatusNumberToLabel } from "./constants"
import { kitePublicClient } from "./public-client"

export type AcpJobView = {
    id: bigint
    client: Address
    provider: Address
    evaluator: Address
    description: string
    budget: bigint
    expiredAt: bigint
    status: number
    acpStatusLabel: string
    hook: Address
}

export const readAcpJob = async (jobId: bigint): Promise<AcpJobView> => {
    const j = await kitePublicClient.readContract({
        address: AGENTIC_COMMERCE_ADDRESS,
        abi: agenticCommerceAbi,
        functionName: "getJob",
        args: [jobId],
    })
    return {
        id: j.id,
        client: j.client,
        provider: j.provider,
        evaluator: j.evaluator,
        description: j.description,
        budget: j.budget,
        expiredAt: j.expiredAt,
        status: j.status,
        acpStatusLabel: acpStatusNumberToLabel(j.status),
        hook: j.hook,
    }
}

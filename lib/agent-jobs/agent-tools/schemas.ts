import { z } from "zod"

import {
    AGENT_JOB_STATUS_VALUES,
    type AgentJobStatus,
} from "@/lib/agent-jobs/service"

export const rewardCurrencySchema = z.enum(["USDC", "ETH"])

export const singleJobStatusSchema = z.enum(
    AGENT_JOB_STATUS_VALUES as unknown as [
        AgentJobStatus,
        ...AgentJobStatus[],
    ]
)

export const keywordModeSchema = z.enum(["any", "all"])

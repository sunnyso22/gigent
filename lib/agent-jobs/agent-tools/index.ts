import { createBidsTools } from "./bids"
import { createJobsTools } from "./jobs"
import type { AgentJobToolsContext } from "./types"

export type { AgentJobToolsContext } from "./types"

/** AI SDK tools for Agent Jobs: `job_*` (listings, search, submit, review, complete) + `bid_*`. */
export const createAgentJobTools = (
    userId: string,
    ctx: AgentJobToolsContext = {}
) => ({
    ...createJobsTools(userId, ctx),
    ...createBidsTools(userId, ctx),
})

export { createBidsTools } from "./bids"
export { createJobsTools } from "./jobs"

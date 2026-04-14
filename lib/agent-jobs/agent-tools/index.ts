import { createBidsTools } from "./bids"
import { createJobsTools } from "./jobs"

/** AI SDK tools for Agent Jobs: `job_*` (listings, search, submit, review, complete) + `bid_*`. */
export const createAgentJobTools = (userId: string) => ({
    ...createJobsTools(userId),
    ...createBidsTools(userId),
})

export { createBidsTools } from "./bids"
export { createJobsTools } from "./jobs"

import { createBidsTools } from "./bids"
import { createJobsTools } from "./jobs"

/** All marketplace AI tools: jobs (listings, search, delivery) + bids. */
export const createMarketplaceTools = (userId: string) => ({
    ...createJobsTools(userId),
    ...createBidsTools(userId),
})

export { createBidsTools } from "./bids"
export { createJobsTools } from "./jobs"

# Gigent — Client & Provider flow

---

## Client Flow

1. **Open jobs** — Ask agents to create a job (title, description, budget, expiry date). The app stores the listing, then your wallet signs **publish** steps (create the on-chain job and set initial budget).
2. **List bids** — Ask agents to list bids on a job, and inspect details.
3. **Accept a bid** — Accept a bid you want and assign the job to that provider. That triggers wallet steps (for example token approval and funding the escrow).
4. **Close out** — After the provider has submitted on-chain, you review the delivery. You **complete** or **reject** the job.

---

## Provider Flow

1. **Find jobs** — Ask agents to search jobs, and inspect details.
2. **Place bids** — Place a bid through agents. Update or withdraw while your bid is still pending.
3. **Check status** — Check bid status and job status through agents.
4. **Deliver and submission** — When your bid is accepted and the job is **funded**, submit delivery through chat (off-chain payload plus commitment). Your wallet signs the on-chain **submit** step when applicable.



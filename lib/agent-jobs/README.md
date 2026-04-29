# Agent Jobs — AI SDK tools

`createAgentJobTools` in `[agent-tools/](agent-tools/)` registers `**job_***` and `**bid_***` tools (AI SDK `tool()` + Zod). They drive the same Agentic Commerce (ERC-8183) flow as the marketplace UI on **Kite Testnet** (chain **2368**). Calldata is built in `[lib/acp/encode-calls.ts](../acp/encode-calls.ts)`; step bundles live in `[onchain-tx-payloads.ts](onchain-tx-payloads.ts)`.

**How on-chain steps show up:** when a tool needs a wallet, it returns structured payloads (e.g. `onChain`, `onChain.steps`) that the Agents UI turns into transactions—see `[use-agent-chat-onchain-effects.ts](../../components/agents/use-agent-chat-onchain-effects.tsx)`. After a tx, call `**job_sync_chain`** so Postgres mirrors `**getJob`** again.

---

## Tools and contract functions


| Tool             | What it’s for                                                                                                                                                                                            | Contract / token                     | Function(s)                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `job_create`     | New listing: title, description, model, USDT budget, optional on-chain expiry. Persists in DB, then exposes calldata when a wallet is available.                                                         | Agentic Commerce                     | `**createJob`**, then `**setBudget**` (UI links `acp_job_id`, then sync). |
| `job_update`     | Edit listing **only while there is no `acp_job_id`** (pre-publish). After the job exists on-chain, mirrored fields are immutable here—response explains `**job_reject**` / new `**job_create**` instead. | —                                    | No contract call.                                                         |
| `job_reject`     | Client rejects or aligns terminal state: may resolve in DB only, or returns `**reject**` calldata + wallet flow, then sync.                                                                              | Agentic Commerce                     | `**reject**` when on-chain reject is still required.                      |
| `job_sync_chain` | Refresh mirrored `acp_*` fields from chain.                                                                                                                                                              | Agentic Commerce                     | `**getJob**` (read).                                                      |
| `job_submit`     | Provider uploads delivery; stores payload + `deliverableCommitment`; returns `**submit**` steps.                                                                                                         | Agentic Commerce                     | `**submit**`.                                                             |
| `job_complete`   | Client aligns app with chain; if not yet completed on-chain, returns `**complete**` steps, then sync.                                                                                                    | Agentic Commerce                     | `**complete**`.                                                           |
| `bid_accept`     | Client accepts a bid after `**acp_job_id**` exists; DB → funded; returns wallet bundle.                                                                                                                  | USDT (ERC-20), then Agentic Commerce | `**approve**`, then `**setProvider**`, `**setBudget**`, `**fund**`.       |


**Read-side sync (no user-signed tx by default):** `**job_get`** and `**job_review`** call the same chain sync helper as `job_sync_chain` (conceptually `**getJob`**) before returning role-scoped job + delivery data.

---

## Tools with no contract calls


| Tool               | Usage                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| `job_search`       | Filters: keywords, status, model, client name, USDT budget range.              |
| `job_list_mine`    | Client’s posted jobs.                                                          |
| `job_get`          | One job by id; role-scoped fields; delivery visibility follows app rules.      |
| `job_review`       | Same read path as `job_get` with review-oriented copy in the tool description. |
| `bid_place`        | Place/update USDT bid (requires connected Kite wallet for payout address).     |
| `bid_update`       | Change pending bid amount / payout address.                                    |
| `bid_withdraw`     | Withdraw pending bid.                                                          |
| `bid_list_for_job` | List bids on a job (client).                                                   |
| `bid_list_mine`    | Current user’s bids.                                                           |
| `bid_status`       | Bid status rows; optional `jobId` filter.                                      |


---

## Quick reference

- **Constants / addresses:** `[lib/acp/constants.ts](../acp/constants.ts)` (`AGENTIC_COMMERCE_ADDRESS`, USDT on Kite testnet).
- **HTTP surface (non-chat):** routes under `/api/marketplace/` mirror much of this domain; chat wiring lives in `[app/api/chat/route.ts](../../app/api/chat/route.ts)`.
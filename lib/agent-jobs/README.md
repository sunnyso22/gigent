# Agent Jobs (`lib/agent-jobs`)

Domain code for **Agent Jobs**: Postgres (`agent_job`, `agent_job_bid` in `[lib/db/agent-job-schema.ts](../db/agent-job-schema.ts)`), **Supabase Storage** for delivery files, REST handlers under `app/api/marketplace/`, **ERC-8183** mirroring and **calldata helpers** in `[lib/acp/](../acp/)` (see `[encode-calls.ts](../acp/encode-calls.ts)`), and **AI SDK tools** in `[agent-tools/](agent-tools/)`. The **Marketplace** route name is kept for URLs (`/marketplace`).

---

## Roles and network


| Role         | Who                              | Goals                                                                                                                                               |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**   | Job creator / on-chain evaluator | `createJob`, `setBudget`, `setProvider`, `fund`, `complete` / `reject` on **Kite Testnet** (chain **2368**, CAIP-2 `eip155:2368`), **USDT** escrow. |
| **Provider** | Bidder / assignee                | Off-chain bids; after the job is **funded**, deliver and `submit` on-chain with `deliverableCommitment`.                                            |
| **Agent**    | LLM + tools in **Agents**        | Same actions via `job_*` and `bid_*` tools.                                                                                                         |


Wallet link and marketplace payouts use `**user_wallet`** for `**eip155:2368`**.

### Job lifecycle (app `status`)


| Status      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`      | Accepting bids. `**job_create`** writes the listing to Postgres **before** Kite has a job id: until `**acp_job_id`** is stored (after wallet `**createJob**` + link), `**job_update**` may change fields **in Postgres only**—there is no on-chain row yet. Once `**acp_job_id`** exists, committed listing fields are **on the contract**; `**job_update` cannot** keep DB and chain in sync for those fields (they are immutable on-chain). |
| `funded`    | A bid was accepted; provider works toward delivery (aligns with on-chain Funded when synced).                                                                                                                                                                                                                                                                                                                                                 |
| `submitted` | Provider saved off-chain delivery; client reviews after on-chain `submit`.                                                                                                                                                                                                                                                                                                                                                                    |
| `completed` | On-chain **completed** (synced); client accepted work.                                                                                                                                                                                                                                                                                                                                                                                        |
| `rejected`  | Terminal reject (off-chain abandon pre-chain, or synced from contract).                                                                                                                                                                                                                                                                                                                                                                       |
| `expired`   | Terminal expiry from chain.                                                                                                                                                                                                                                                                                                                                                                                                                   |


`**job_update` policy:** If `**acp_job_id` is null**, the listing is not published on Kite yet, so `**job_update`** may patch the Postgres row. If `**acp_job_id` is set**, the chain job exists and listing fields mirrored from the contract are **not editable** via this tool—there is no path to change the same data in DB and on-chain together; the tool returns immutability guidance and `**job_reject`** (when allowed) + `**job_create**`.

**Delivery visibility:** Client sees payload only when `**acp_status`** is `**submitted**` or terminal (or provider always sees own submission when allowed). See `[delivery/visibility.ts](delivery/visibility.ts)`.

---

## AI SDK tools → Kite contracts (ERC-8183)

On **Kite Testnet** (chain **2368**), the Agentic Commerce address is `**AGENTIC_COMMERCE_ADDRESS`** in `[lib/acp/constants.ts](../acp/constants.ts)`. Calldata is built in `[lib/acp/encode-calls.ts](../acp/encode-calls.ts)`; bundles in `[onchain-tx-payloads.ts](onchain-tx-payloads.ts)`.

### Contract reads (server, no wallet)


| Tool             | Contract         | Function                    | Purpose                                                                      |
| ---------------- | ---------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `job_sync_chain` | Agentic Commerce | `**getJob(uint256 jobId)`** | Refresh mirrored `acp_*` fields in Postgres (`syncAgentJobFromChainByDbId`). |


### Wallet transactions (calldata from tools + Agents UI)

The **Agents** chat client (`[use-agent-chat-onchain-effects.ts](../../components/agents/use-agent-chat-onchain-effects.tsx)`) submits transactions when the latest assistant message includes `onChain.steps` (or the `job_create` publish path). Order matters for multi-step bundles.


| Tool           | Token / contract  | Contract function(s)                           | Order / notes                                                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job_create`   | Agentic Commerce  | `**createJob`**, then `**setBudget`**          | Tool output includes `createJob` calldata + listing budget; UI sends `**createJob**`, links `acp_job_id`, then `**setBudget**`, then `sync-chain`. |
| `bid_accept`   | **USDT** (ERC-20) | `**approve`**                                  | First tx: USDT → commerce spender.                                                                                                                 |
| `bid_accept`   | Agentic Commerce  | `**setProvider`**, `**setBudget`**, `**fund**` | After approve, in that order; then `sync-chain`.                                                                                                   |
| `job_submit`   | Agentic Commerce  | `**submit**`                                   | Provider; passes `deliverableCommitment` as `deliverable` (`bytes32`).                                                                             |
| `job_complete` | Agentic Commerce  | `**complete**`                                 | Client / on-chain **evaluator**; tool returns this when DB cannot finalize until chain is completed.                                               |
| `job_reject`   | Agentic Commerce  | `**reject`**                                   | Only if the tool returns `onChain` (job has `acp_job_id` and DB-only reject did not apply).                                                        |


### Tools with no contract calls

These touch **Postgres**, **storage**, or search only:

- **Jobs:** `job_update`, `job_search`, `job_list_mine`, `job_get`, `job_review`
- **Bids:** `bid_place`, `bid_update`, `bid_withdraw`, `bid_list_for_job`, `bid_list_mine`, `bid_status` (amounts in **USDT**)

---

## AI tool catalog (behavior)


| Tool                     | Purpose                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job_create`             | New job; USDT `budgetAmount`; optional `expiresAtUnix` (default off-chain hint: now + 7 days). Returns on-chain `**createJob`** calldata; UI completes `**setBudget`** after link. |
| `job_update`             | Postgres-only edits **while `acp_job_id` is null** (pre-publish). After link, on-chain listing fields are immutable—tool returns guidance, not a dual DB+chain update.             |
| `job_reject`             | DB-only reject when allowed, or returns `**reject`** calldata + wallet flow, then sync.                                                                                            |
| `job_sync_chain`         | `**getJob`** → refresh `acp_*` mirrors.                                                                                                                                            |
| `job_search`             | Keywords, status, model, client name, USDT budget range.                                                                                                                           |
| `job_list_mine`          | Client’s jobs.                                                                                                                                                                     |
| `job_get` / `job_review` | Role-scoped job + delivery.                                                                                                                                                        |
| `job_submit`             | Provider delivery + `**deliverableCommitment`**; returns `**submit`** calldata.                                                                                                    |
| `job_complete`           | Aligns app with chain; may return `**complete**` calldata until on-chain is terminal **completed**.                                                                                |


**Bids:** `bid_place`, `bid_update`, `bid_withdraw`, `bid_list_for_job`, `bid_list_mine`, `bid_accept` (wallet bundle: **approve** + `**setProvider`** + `**setBudget`** + `**fund`**), `bid_status`.

---

## Package layout


| Path                             | Role                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `[service.ts](service.ts)`       | CRUD, search, bids, delivery, `getJobForViewer`, `confirmJobCompletion` / `rejectAgentJobAsClient`, chain sync re-export. |
| `[job-status.ts](job-status.ts)` | Status values and URL filters.                                                                                            |
| `[delivery/](delivery/)`         | Payload schema, storage, image generation, visibility, signed URLs.                                                       |
| `[agent-tools/](agent-tools/)`   | `createAgentJobTools`, Zod schemas.                                                                                       |


---

## HTTP API

- `GET/POST /api/marketplace/jobs` — list / create (`budgetAmount`, optional `expiresAtUnix`).
- `GET/PATCH /api/marketplace/jobs/[jobId]` — detail / DB-only patch (see service rules).
- `POST /api/marketplace/jobs/[jobId]/sync-chain` — refresh from chain (client or provider).
- `POST /api/marketplace/jobs/[jobId]/delivery` — same payload as `job_submit` (if implemented).

### Environment

- **Supabase Storage:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_STORAGE_BUCKET`.
- **Kite RPC:** optional `KITE_RPC_URL` (default `https://rpc-testnet.gokite.ai/`).
- **Chat:** `[app/api/chat/route.ts](../../app/api/chat/route.ts)` registers tools and system instructions for ERC-8183.


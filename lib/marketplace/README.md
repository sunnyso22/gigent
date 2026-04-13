# Marketplace (`lib/marketplace`)

Agent Jobs: listings, bids, delivery payloads, and AI agent tools. Data lives in Postgres (`agent_job`, `agent_job_bid`); delivery **files** are stored in **Supabase Storage**; `delivery_payload` JSON holds **text** and **file** block metadata plus **https** URLs.

## Folder layout

| Path | Role |
|------|------|
| [`service.ts`](service.ts) | Core domain: create/update jobs, search, bids, accept, **submit delivery**, confirm completion, `getAgentJobById`, upload guard (`assertJobDeliveryUploadAllowed`). |
| [`job-status.ts`](job-status.ts) | Job lifecycle status values and filters for search. |
| [`delivery/`](delivery/) | Everything specific to **delivery**: payload schema, upload rules, Supabase upload, UTF-8 files, image generation, PDF generation. |
| [`delivery/payload.ts`](delivery/payload.ts) | Zod schema for `delivery_payload` (`text` + `file` blocks), parse helpers for DB/API. |
| [`delivery/upload-rules.ts`](delivery/upload-rules.ts) | Max upload size, allowed MIME list, safe filename helper. |
| [`delivery/storage.ts`](delivery/storage.ts) | `uploadDeliveryFileBytes` → Supabase (shared by API route and tools). |
| [`delivery/text-file.ts`](delivery/text-file.ts) | UTF-8 **text/code** uploads (html, css, js, md, json, svg, xml, …) without base64. |
| [`delivery/image-gen.ts`](delivery/image-gen.ts) | Raster **image** via AI Gateway `generateImage` + upload. |
| [`delivery/pdf-gen.ts`](delivery/pdf-gen.ts) | Simple **PDF** from plain title/body (`pdf-lib`) + upload. |
| [`jbs/index.ts`](jbs/index.ts) | **`createMarketplaceTools(userId)`** — merges jobs + bids; re-exports **`createJobsTools`**, **`createBidsTools`**. |
| [`jbs/jobs.ts`](jbs/jobs.ts) | Job listings, search, delivery upload/generate/submit, poster confirm completion. |
| [`jbs/bids.ts`](jbs/bids.ts) | Place, withdraw, list, accept bids; my bid status. |
| [`jbs/schemas.ts`](jbs/schemas.ts) | Shared Zod helpers for job search/create (currency, status, keywords, aspect ratio). |

Imports:

- App / API: `@/lib/marketplace/service`, `@/lib/marketplace/job-status`, `@/lib/marketplace/delivery/...`, `@/lib/marketplace/jbs`.
- Inside `delivery/`, prefer relative imports (`./storage`, `./upload-rules`) and `@/lib/marketplace/service` for the shared service layer.

---

## Agent tools (`createMarketplaceTools`)

All tools run **as the logged-in user** (`userId`). Jobs and bids enforce poster/bidder/assignee rules in [`service.ts`](service.ts).

### Jobs (`createJobsTools` — [`jbs/jobs.ts`](jbs/jobs.ts))

| Tool | Purpose |
|------|---------|
| `marketplace_createJob` | Create a new open job (title, description, required model id, reward). |
| `marketplace_updateJob` | Edit **your** job while status is `open`. |
| `marketplace_searchJobs` | Search/list jobs with filters (keywords, status, model, poster, reward range). |
| `marketplace_listMyPostedJobs` | Jobs you posted. |

### Bids (`createBidsTools` — [`jbs/bids.ts`](jbs/bids.ts))

| Tool | Purpose |
|------|---------|
| `marketplace_placeBid` | Bid on an open job (one pending bid per job per user). |
| `marketplace_withdrawBid` | Withdraw **your** pending bid on an open job. |
| `marketplace_listBidsOnJob` | List bids on a job (e.g. poster reviewing offers). |
| `marketplace_listMyBids` | Your bids and related job status. |
| `marketplace_myBidStatus` | Bid status, optional filter by `jobId`. |
| `marketplace_acceptBid` | **Poster**: accept one bid → job `assigned`, other bids rejected. |

### Delivery (assignee must be you; job usually `assigned`)

Build **https** URLs for file blocks, then call **`marketplace_submitDelivery`**.

| Tool | When to use |
|------|-------------|
| `marketplace_uploadDeliveryTextFile` | **UTF-8 text/code** files: `.html`, `.css`, `.js`, `.md`, `.json`, `.svg`, etc. Pass **`content`** as the raw string (no base64). |
| `marketplace_uploadDeliveryFile` | **Any binary**: pass **`base64`** (optional `data:...;base64,` prefix stripped). Use for zips, pre-built PDF bytes, PNG/JPEG bytes, etc. |
| `marketplace_generateDeliveryImage` | **Raster image** from a **text prompt** only (AI Gateway image model → upload). Not for code or PDF. |
| `marketplace_generateDeliveryPdf` | **Simple PDF** from optional **title** + **body** text (plain layout). For complex PDFs, generate bytes elsewhere and use `marketplace_uploadDeliveryFile`. |
| `marketplace_submitDelivery` | Submit final **`deliveryPayload`**: `{ blocks: [ { type: "text", body }, { type: "file", name, mimeType, url } ] }`. Sets job to **`pending_review`**. URLs must be **https**. |

### Poster

| Tool | Purpose |
|------|---------|
| `marketplace_confirmCompletion` | After reviewing delivery: mark job **completed**. |

### Typical assignee flow

1. Resolve `jobId` (e.g. `marketplace_myBidStatus` with status `assigned`).
2. Produce files: `marketplace_uploadDeliveryTextFile` / `marketplace_generateDeliveryImage` / `marketplace_generateDeliveryPdf` / `marketplace_uploadDeliveryFile` as needed.
3. `marketplace_submitDelivery` with text and/or file blocks referencing returned URLs.
4. Poster uses the Marketplace UI to review and `marketplace_confirmCompletion` (or the equivalent UI action).

### Environment

- **Supabase Storage:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_STORAGE_BUCKET` (default `job-deliveries`).
- **Image tool:** optional `MARKETPLACE_DELIVERY_IMAGE_MODEL_ID` (default `openai/gpt-image-1`); requires user AI Gateway API key in settings.
- **Chat API:** [`app/api/chat/route.ts`](../app/api/chat/route.ts) registers these tools and sets system instructions.

---

## HTTP API (non-agent)

- `POST /api/marketplace/jobs/[jobId]/delivery` — JSON body `{ deliveryPayload }` (same schema as submit tool).
- `POST /api/marketplace/jobs/[jobId]/delivery/upload` — multipart **`file`** (browser uploads); uses [`delivery/storage.ts`](delivery/storage.ts) internally.

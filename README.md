# Gigent

**Gigent** is a web application where users explore **Agent Jobs** on a marketplace, negotiate through **bids**, and complete work using **Agentic Commerce** (ERC-8183) on **Kite Testnet**—with an **Agents** workspace that pairs multi-model chat (Vercel AI SDK) with **tool calling** against the same domain logic.

---

## Table of contents

1. [Background](#background)
2. [Features](#features)
3. [Usage guideline](#usage-guideline)
4. [Install & setup](#install--setup)
5. [License](#license)

---

## Background

Traditional freelance-style flows mix **off-chain coordination** (listings, delivery artifacts, chat) with **on-chain escrow** so commitments are enforceable where it matters. Gigent connects:

- **Marketplace** — browse and publish agent jobs backed by Postgres.
- **Agents** — an AI-assisted surface that invokes `job_*` and `bid_*` tools so models can search listings, drive bids, and prepare wallet steps aligned with the Agentic Commerce contract.

The stack is **Next.js (App Router)**, **Better Auth**, **Drizzle ORM** over **PostgreSQL**, optional **Supabase Storage** for delivery files, and **wagmi/viem** for Kite wallet flows. Chat inference uses the **Vercel AI Gateway** with user-supplied API keys stored encrypted server-side.

For tool-level mapping between AI SDK tools and contract functions, see [`lib/agent-jobs/README.md`](lib/agent-jobs/README.md).

---

## Features

| Area | Notes |
| --- | --- |
| **Marketplace** | Search and filter agent jobs (`/marketplace`), job detail pages, status aligned with app + chain sync. |
| **Agents chat** | Streaming chat with selectable models; server tools for jobs and bids; wallet-connected flows for on-chain steps. |
| **Authentication** | Better Auth with OAuth providers (e.g. GitHub, Google—see `lib/auth.ts`). |
| **Agent jobs domain** | CRUD-style operations, bids, delivery payloads, mirroring contract state (`lib/agent-jobs/`). |
| **On-chain (Kite)** | Agentic Commerce + USDT-style escrow flows on testnet (addresses and encoding under `lib/acp/`). |
| **AI Gateway keys** | Users can save a Vercel AI Gateway API key in Settings for Agents (encrypted storage). |

---

## Usage guideline

1. **Sign in** via the account menu using your configured OAuth providers.
2. **Marketplace** — Browse `/marketplace`; open a job to see detail and participant actions appropriate to your role.
3. **Agents** — Go to `/agents`. You need:
   - A **connected Kite wallet** (header) so the chat API can associate chain actions with your session.
   - A valid **Vercel AI Gateway API key** in **Settings** so the server can call models through the gateway.
4. **Jobs & bids** — Create or update listings from the UI or via Agents tools; accept bids and complete flows that show wallet prompts follow the contract ordering described in [`lib/agent-jobs/README.md`](lib/agent-jobs/README.md).
5. After on-chain transactions from the Agents UI, use **`job_sync_chain`** (via chat) or marketplace sync controls where exposed so Postgres mirrors **`getJob`** from chain.

---

## Install & setup

### Prerequisites

- [Node.js](https://nodejs.org/) compatible with Next.js 16 (see `package.json` engines if added later).
- [Bun](https://bun.sh/) optional but recommended — this repo includes `bun.lock`.
- PostgreSQL database URL.
- Optional: Supabase project for Storage (`SUPABASE_*`).
- OAuth app credentials for Better Auth providers you enable.

### Clone and install

```bash
git clone <repository-url> gigent
cd gigent
bun install
# or: npm install
```

### Environment variables

Create `.env.local` (loaded after `.env`). Typical variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for Drizzle. |
| `BETTER_AUTH_SECRET` | Secret for Better Auth sessions / crypto helpers. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth (if enabled). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (if enabled). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Storage for job deliveries (optional but needed for full delivery flows). |
| `SUPABASE_STORAGE_BUCKET` | Bucket name override if used. |
| `AI_GATEWAY_USER_KEY_SECRET` | Encrypts stored user AI Gateway keys (see `lib/ai-gateway/crypto.ts`). |
| `KITE_RPC_URL` | Optional RPC override (defaults to Kite testnet RPC in code). |

Exact OAuth env names match [`lib/auth.ts`](lib/auth.ts).

### Database

Schema lives under [`lib/db/`](lib/db/). After `DATABASE_URL` is set:

```bash
bunx drizzle-kit migrate
# or: npx drizzle-kit migrate
```

Apply migrations in [`lib/db/migrations/`](lib/db/migrations/) to match your database.

### Run locally

```bash
bun run dev
# or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

| Script | Command |
| --- | --- |
| Lint | `bun run lint` |
| Production build | `bun run build` |
| Format | `bun run format` |

---

## License

No `LICENSE` file is included in this repository. **`package.json` marks the package as private.** Before redistributing or reusing code, clarify terms with the project owners or add an explicit license file.

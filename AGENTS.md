# AGENTS.md

## Project overview

**Gigent** — Web app for **Agent Jobs**: marketplace listings and bids in Postgres, escrow and lifecycle on **Agentic Commerce (ERC‑8183)** on **Kite Testnet** (chain id **2368**), USDT-style token. The **Agents** workspace is streaming chat (Vercel AI SDK) with `job_*` / `bid_*` tools wired to the same domain as the UI.

## Stack

Next.js 16 (App Router), React 19, Bun, TypeScript, Tailwind CSS 4, shadcn-style `components/ui`. **Better Auth** (Drizzle adapter) → **PostgreSQL**; **Supabase** for delivery storage when configured. **wagmi / viem** for wallet txs. **`ai`** + **`@ai-sdk/*`** and Vercel AI Gateway (user keys in Settings, encrypted server-side). On-chain encoding: `lib/acp/`; job/bid tools: `lib/agent-jobs/`.

## Repo layout

- **`app/`** — Pages: `/`, `/login`, `/marketplace`, `/agents`, `/settings`. **API:** `app/api/auth/[...all]`, `app/api/chat`, `app/api/agents`, `app/api/marketplace/jobs/**`, `app/api/settings/ai-gateway`. Server actions under `app/actions/`.
- **`lib/`** — `db/` (Drizzle schemas: auth, agents, jobs/bids; migrations in `lib/db/migrations`). `auth.ts`, `auth/`, `agent-jobs/` (service, agent tools, delivery), `agents/`, `acp/` (contract/USDT), `ai-gateway/`, `wallet/`, `supabase/`.
- **`components/`** — Feature UI (marketplace, agents, settings, layout) plus shared `components/ui`.
- **`proxy.ts`** — Next.js 16 App Router proxy (request layer before routes): Better Auth session cookie check + `lib/auth/public-paths` for redirects to `/login`.

Deeper tool ↔ contract mapping: `lib/agent-jobs/tools.md` and `lib/agent-jobs/README.md`.

## Code standards

- Use `type` instead of `interface`
- Declare inline props types
- Avoid `useEffect`
- `export default` at the end of the file
- Use arrow functions

## Commands

- `bun install` — dependencies
- `bun run dev` — dev (Turbopack per `package.json`)
- `bun run build` — production build
- `bun run lint` / `bun run format` — ESLint / Prettier
- `bunx drizzle-kit push` — apply schema (`drizzle.config.ts` → `lib/db/schema.ts`, `DATABASE_URL`)

## Environment

`.env` / `.env.local`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, OAuth client ids/secrets as enabled, optional `SUPABASE_*` for delivery Storage, AI gateway encryption-related vars as documented in `README.md`.

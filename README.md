# Gigent

A web app for **Agent Jobs**: post work on a marketplace, get **bids**, and settle payments on **Kite testnet** using escrow. There’s also an **Agents** chat area where you can talk to AI models that help with jobs and bids in the same app.

## What you can do

- **Roles** - You are either the **client** or the **provider** in this app.
   - Client - The person who opens a job and funds escrow.
   - Provider - The bidder who does the work
   - Evaluator - The on-chain custody role in the app which help evaluate all the job deliverables.
- **Sign in** — OAuth by GitHub or Google.
- **Marketplace** — Browse and manage jobs and bids.
- **Agents** — Chat with AI; connect a wallet when the app asks so on-chain steps go to your address.

## Using the app

1. Sign in first.
2. Open **Agents** for chat. You’ll need a **connected wallet to Kite testnet** and a **Vercel AI Gateway API key** in **Settings** so chat and models work.
3. Open **Marketplace** for listings and job details.

### If you are Client

1. **Open jobs** — Ask agents to create a job (title, description, budget, expiry). The app stores the listing; your wallet signs **publish** steps (create the on-chain job and set the initial budget).
2. **List bids** — Ask agents to list bids on a job and inspect details.
3. **Accept a bid** — Accept a bid and assign the job to that provider. That triggers wallet steps (for example token approval and funding the escrow).
4. **Close out** — After the provider has submitted on-chain, you ask the agent (evaluator) to review the job deliverables. Evaluator will choose either **complete** or **reject** the job.

### If you are Provider

1. **Find jobs** — Ask agents to search jobs and inspect details.
2. **Place bids** — Place a bid through agents. Update or withdraw while the bid is still pending.
3. **Check status** — Check bid and job status through agents.
4. **Deliver** — When your bid is accepted and the job is **funded**, submit delivery through chat (off-chain payload plus commitment). Your wallet signs the on-chain **submit** step when applicable.

> If something looks out of date after a wallet transaction, ask the agents to sync the job from chain.

## Local development

**Requirements:** Node or [Bun](https://bun.sh/), a PostgreSQL database, and OAuth credentials for whichever sign-in providers you turn on.

```bash
git clone <repository-url> gigent
cd gigent
bun install
```

Create `.env.local` with at least:

| Variable | What it’s for |
| --- | --- |
| `DATABASE_URL` | Postgres |
| `BETTER_AUTH_SECRET` | Auth sessions |
| `GITHUB_*` / `GOOGLE_*` | OAuth apps you enable |
| `EVALUATOR_PRIVATE_KEY` | Optional. Signs **evaluator** transactions on the server—not the client’s wallet |

Optional: Supabase vars for file delivery storage.

Apply the database schema:

```bash
bunx drizzle-kit push
```

Run the app:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000). Other commands: `bun run lint`, `bun run build`, `bun run format`.

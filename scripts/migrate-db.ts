import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { config } from "dotenv"
import postgres from "postgres"

config({ path: resolve(process.cwd(), ".env.local") })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error("DATABASE_URL is not set (check .env.local)")
}

const migrationPaths = [
    resolve(process.cwd(), "lib/db/migrations/migrate_marketplace.sql"),
    resolve(process.cwd(), "lib/db/migrations/migrate_marketplace_bid_unique.sql"),
    resolve(process.cwd(), "lib/db/migrations/migrate_marketplace_delivery_payload.sql"),
    resolve(process.cwd(), "lib/db/migrations/migrate_marketplace_delivery_text_file_only.sql"),
    resolve(process.cwd(), "lib/db/migrations/migrate_agents.sql"),
]

const sql = postgres(connectionString, { max: 1 })

try {
    for (const migrationPath of migrationPaths) {
        const migration = readFileSync(migrationPath, "utf8")
        await sql.unsafe(migration)
        console.log("Applied migration:", migrationPath)
    }
} finally {
    await sql.end()
}

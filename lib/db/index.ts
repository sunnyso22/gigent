import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

type Db = PostgresJsDatabase<typeof schema>

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
}

const globalForDb = globalThis as unknown as {
    db?: Db
    pg?: ReturnType<typeof postgres>
}

const client =
    globalForDb.pg ??
    postgres(connectionString, {
        max: process.env.NODE_ENV === "production" ? 10 : 1,
        prepare: false,
    })

if (process.env.NODE_ENV !== "production") {
    globalForDb.pg = client
}

export const db: Db = globalForDb.db ?? drizzle({ client, schema })

if (process.env.NODE_ENV !== "production") {
    globalForDb.db = db
}

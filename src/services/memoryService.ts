import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store"
import pg from 'pg'
import { config } from "../config.ts"

const { Pool } = pg

export type MemoryService = {
    checkpointer: PostgresSaver
    store: PostgresStore
}

function requiresSsl(dbUri: string): boolean {
    try {
        const { hostname } = new URL(dbUri)
        return hostname !== 'localhost' && hostname !== '127.0.0.1'
    } catch {
        return false
    }
}

export async function createMemoryService(): Promise<MemoryService> {
    const dbUri = config.memory.dbUri
    const sslConfig = requiresSsl(dbUri) ? { rejectUnauthorized: false } : undefined
    const poolConfig: pg.PoolConfig = { connectionString: dbUri, ssl: sslConfig }

    const checkpointer = new PostgresSaver(new Pool(poolConfig))
    const store = new PostgresStore({ connectionOptions: poolConfig })

    await store.setup()
    await checkpointer.setup()

    console.log(`✅ Memória configurada: PostgreSQL`);
    return {
        checkpointer,
        store,
    }


}
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store"
import pg from 'pg'
import { config } from "../config.ts"

const { Pool } = pg

export type MemoryService = {
    checkpointer: PostgresSaver
    store: PostgresStore
}

export async function createMemoryService(): Promise<MemoryService> {
    const dbUri = config.memory.dbUri
    const sslConfig = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined

    const checkerPool = new Pool({ connectionString: dbUri, ssl: sslConfig })
    const storePool = new Pool({ connectionString: dbUri, ssl: sslConfig })

    const checkpointer = new PostgresSaver(checkerPool)
    const store = new PostgresStore({ connectionOptions: storePool })

    await store.setup()
    await checkpointer.setup()

    console.log(`✅ Memória configurada: PostgreSQL`);
    return {
        checkpointer,
        store,
    }


}
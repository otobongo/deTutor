import type { DocumentData } from 'firebase-admin/firestore';
import { Pool, type PoolConfig } from 'pg';
import type { DocumentStore, StoredCollection, StoredDocument } from './store';

// The self-hosted production store (GT-D2). Firestore stays supported, but a
// VPS deployment needs a store it owns; Postgres is that store. The document
// model is preserved rather than normalised into per-entity tables: the
// converter-validated write path in store.ts hands us whole documents keyed by
// `collectionPath/id`, so one key/JSONB table reproduces Firestore's semantics
// exactly and keeps the seam honest. Normalising would mean teaching this
// adapter every learner schema, which is precisely what the seam exists to
// avoid.

const TABLE = 'documents';

// `list()` returns direct children only, never grandchildren, matching both
// FirestoreStore (a collection query cannot see subcollections) and
// DevFileStore (which filters out keys containing a further slash). Postgres
// does the same with a prefix match that rejects any remaining separator.
const LIST_SQL = `
  SELECT data FROM ${TABLE}
  WHERE key LIKE $1 AND strpos(substr(key, $2), '/') = 0
`;

export interface PostgresStoreOptions {
  readonly connectionString: string;
  readonly ssl?: PoolConfig['ssl'];
}

export class PostgresStore implements DocumentStore {
  private readonly pool: Pool;
  // Schema creation races if several requests arrive before the first
  // completes, so every caller awaits the same promise.
  private ready: Promise<void> | undefined;

  constructor(options: PostgresStoreOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      ssl: options.ssl,
    });
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= this.pool
      .query(`CREATE TABLE IF NOT EXISTS ${TABLE} (key text PRIMARY KEY, data jsonb NOT NULL)`)
      .then(() => undefined);
    return this.ready;
  }

  async list(collectionPath: string): Promise<DocumentData[]> {
    await this.ensureSchema();
    const prefix = `${collectionPath}/`;
    // substr() is 1-indexed, so the offset is the prefix length plus one.
    const result = await this.pool.query<{ data: DocumentData }>(LIST_SQL, [
      `${prefix}%`,
      prefix.length + 1,
    ]);
    return result.rows.map((row) => row.data);
  }

  collection(collectionPath: string): StoredCollection {
    return {
      doc: (id: string): StoredDocument => {
        const key = `${collectionPath}/${id}`;
        return {
          set: async (data: DocumentData) => {
            await this.ensureSchema();
            await this.pool.query(
              `INSERT INTO ${TABLE} (key, data) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
              [key, data],
            );
          },
          get: async () => {
            await this.ensureSchema();
            const result = await this.pool.query<{ data: DocumentData }>(
              `SELECT data FROM ${TABLE} WHERE key = $1`,
              [key],
            );
            return result.rows[0]?.data ?? null;
          },
          // Deleting a missing document is a no-op, never an error (store.ts).
          delete: async () => {
            await this.ensureSchema();
            await this.pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]);
          },
        };
      },
    };
  }

  // Tests own a pool per case; production keeps one for the process lifetime.
  async close(): Promise<void> {
    await this.pool.end();
  }
}

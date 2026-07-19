import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DocumentData } from 'firebase-admin/firestore';
import { getConfig } from '@/lib/config';

// The learner-state store seam (GT-107). Production is Firestore or Postgres
// (GT-D2, for self-hosted deployments); dev-file backs the same
// converter-validated write path with a local JSON file so placeholder mode
// runs end to end before real credentials exist (deviations logged in
// board.md). Flipping stores is one env change.

export interface StoredDocument {
  set(data: DocumentData): Promise<void>;
  get(): Promise<DocumentData | null>;
  // Removing a document is a real operation (un-marking a learned word);
  // deleting a missing document is a no-op, never an error.
  delete(): Promise<void>;
}

export interface StoredCollection {
  doc(id: string): StoredDocument;
}

export interface DocumentStore {
  collection(collectionPath: string): StoredCollection;
  // Lists every document in a collection (GT-214 analytics queries). Fine at
  // single-learner scale; server-side filtering can come with auth (v2.1).
  list(collectionPath: string): Promise<DocumentData[]>;
}

class FirestoreStore implements DocumentStore {
  async list(collectionPath: string): Promise<DocumentData[]> {
    const { getDb } = await import('@/lib/firebase');
    const snapshot = await getDb().collection(collectionPath).get();
    return snapshot.docs.map((doc) => doc.data());
  }

  collection(collectionPath: string): StoredCollection {
    return {
      doc: (id: string) => ({
        set: async (data: DocumentData) => {
          const { getDb } = await import('@/lib/firebase');
          await getDb().collection(collectionPath).doc(id).set(data);
        },
        get: async () => {
          const { getDb } = await import('@/lib/firebase');
          const snapshot = await getDb().collection(collectionPath).doc(id).get();
          return snapshot.exists ? (snapshot.data() ?? null) : null;
        },
        delete: async () => {
          const { getDb } = await import('@/lib/firebase');
          await getDb().collection(collectionPath).doc(id).delete();
        },
      }),
    };
  }
}

export class DevFileStore implements DocumentStore {
  constructor(private readonly file: string = path.join(process.cwd(), getConfig().devStoreFile)) {}

  list(collectionPath: string): Promise<DocumentData[]> {
    const prefix = `${collectionPath}/`;
    const all = this.read();
    return Promise.resolve(
      Object.entries(all)
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map(([, data]) => data),
    );
  }

  private read(): Record<string, DocumentData> {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, DocumentData>;
    } catch {
      return {};
    }
  }

  private write(all: Record<string, DocumentData>): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(all, null, 2));
  }

  collection(collectionPath: string): StoredCollection {
    return {
      doc: (id: string) => {
        const key = `${collectionPath}/${id}`;
        return {
          set: (data: DocumentData) => {
            const all = this.read();
            all[key] = data;
            this.write(all);
            return Promise.resolve();
          },
          get: () => Promise.resolve(this.read()[key] ?? null),
          delete: () => {
            const all = this.read();
            delete all[key];
            this.write(all);
            return Promise.resolve();
          },
        };
      },
    };
  }
}

// Defers loading pg (and opening a pool) until a store call actually happens,
// the same reason FirestoreStore imports firebase-admin dynamically: dev-file
// and firestore deployments must not pay for a driver they never use.
class LazyPostgresStore implements DocumentStore {
  private delegate: Promise<DocumentStore> | undefined;

  constructor(private readonly connectionString: string) {}

  private load(): Promise<DocumentStore> {
    this.delegate ??= import('./postgres-store').then(
      ({ PostgresStore }) => new PostgresStore({ connectionString: this.connectionString }),
    );
    return this.delegate;
  }

  async list(collectionPath: string): Promise<DocumentData[]> {
    return (await this.load()).list(collectionPath);
  }

  collection(collectionPath: string): StoredCollection {
    const load = () => this.load();
    return {
      doc: (id: string): StoredDocument => ({
        set: async (data: DocumentData) =>
          (await load()).collection(collectionPath).doc(id).set(data),
        get: async () => (await load()).collection(collectionPath).doc(id).get(),
        delete: async () => (await load()).collection(collectionPath).doc(id).delete(),
      }),
    };
  }
}

let cachedStore: DocumentStore | undefined;

function createStore(): DocumentStore {
  const config = getConfig();
  switch (config.dataStore) {
    case 'dev-file':
      return new DevFileStore();
    case 'postgres': {
      // Required by the config schema when dataStore is postgres, so a missing
      // URL here is a programming error, not a user misconfiguration.
      const { databaseUrl } = config;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL missing despite DATA_STORE=postgres.');
      }
      return new LazyPostgresStore(databaseUrl);
    }
    case 'firestore':
      return new FirestoreStore();
  }
}

export function getDataStore(): DocumentStore {
  if (typeof window !== 'undefined') {
    throw new Error('getDataStore() must never run in the browser.');
  }
  cachedStore ??= createStore();
  return cachedStore;
}

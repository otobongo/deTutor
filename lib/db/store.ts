import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DocumentData } from 'firebase-admin/firestore';
import { getConfig } from '@/lib/config';

// The learner-state store seam (GT-107). Production is Firestore; dev-file
// backs the same converter-validated write path with a local JSON file so
// placeholder mode runs end to end before real Firebase credentials exist
// (deviation logged in board.md). Flipping stores is one env change.

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

const DEV_STORE_FILE = path.join(process.cwd(), '.dev-data', 'store.json');

export class DevFileStore implements DocumentStore {
  constructor(private readonly file: string = DEV_STORE_FILE) {}

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

let cachedStore: DocumentStore | undefined;

export function getDataStore(): DocumentStore {
  if (typeof window !== 'undefined') {
    throw new Error('getDataStore() must never run in the browser.');
  }
  cachedStore ??= getConfig().dataStore === 'dev-file' ? new DevFileStore() : new FirestoreStore();
  return cachedStore;
}

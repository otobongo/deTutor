import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresStore } from './postgres-store';

// Integration tests against a real Postgres, because the whole point of this
// adapter is SQL behaviour (upsert semantics, the direct-children list filter,
// JSONB round-tripping) that a mocked pool would assert nothing about.
// TEST_DATABASE_URL opts a machine in; without it the suite skips rather than
// failing, so a checkout with no local Postgres still runs green. Read through
// import.meta.env (Vitest's own channel) so lib/config.ts remains the single
// environment reader the CI guard insists on.
// Vitest populates import.meta.env, but its types ship with vite/client, and
// adding those globally would pull Vite's ambient DOM types into a Next.js
// app for the sake of one file. Declaring the single field used keeps the
// change local and avoids `any`.
declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

const connectionString = import.meta.env.TEST_DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb('PostgresStore', () => {
  const store = new PostgresStore({ connectionString: connectionString ?? '' });

  beforeEach(async () => {
    // list() creates the table on first use; deleting through the same seam
    // keeps the test honest about the schema the adapter actually builds.
    await store.list('learners');
    const doc = store.collection('learners').doc('reset-probe');
    await doc.delete();
    for (const id of ['default', 'other', 'gone']) {
      await store.collection('learners').doc(id).delete();
      await store.collection('learners/default/cards').doc(id).delete();
    }
  });

  afterAll(async () => {
    await store.close();
  });

  it('returns null for a document that was never written', async () => {
    expect(await store.collection('learners').doc('default').get()).toBeNull();
  });

  it('round-trips a document through set and get', async () => {
    const profile = { level: 'A1', unitId: 'a1-1', nested: { voice: 'warm-1' } };
    await store.collection('learners').doc('default').set(profile);
    expect(await store.collection('learners').doc('default').get()).toEqual(profile);
  });

  it('overwrites on repeat set rather than erroring on the duplicate key', async () => {
    const doc = store.collection('learners').doc('default');
    await doc.set({ level: 'A1' });
    await doc.set({ level: 'A2' });
    expect(await doc.get()).toEqual({ level: 'A2' });
  });

  it('deletes a document, and treats deleting a missing one as a no-op', async () => {
    const doc = store.collection('learners').doc('gone');
    await doc.set({ level: 'A1' });
    await doc.delete();
    expect(await doc.get()).toBeNull();
    await expect(doc.delete()).resolves.toBeUndefined();
  });

  it('lists direct children only, never documents in nested collections', async () => {
    await store.collection('learners').doc('default').set({ level: 'A1' });
    await store.collection('learners').doc('other').set({ level: 'B1' });
    // A grandchild: learners/default/cards/default must not surface here.
    await store.collection('learners/default/cards').doc('default').set({ wordId: 'tisch' });

    const listed = await store.list('learners');
    expect(listed).toHaveLength(2);
    expect(listed.map((row) => row.level).sort()).toEqual(['A1', 'B1']);
  });

  it('lists the nested collection on its own path', async () => {
    await store.collection('learners/default/cards').doc('default').set({ wordId: 'tisch' });
    expect(await store.list('learners/default/cards')).toEqual([{ wordId: 'tisch' }]);
  });

  it('returns an empty list for a collection with no documents', async () => {
    expect(await store.list('learners/default/nothing-here')).toEqual([]);
  });
});

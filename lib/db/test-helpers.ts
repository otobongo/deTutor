import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Test-only: fakes the one QueryDocumentSnapshot member converters touch.
// The double cast is justified because building a real snapshot requires a
// live Firestore instance, and converters only ever call data().
export function fakeSnapshot(data: DocumentData): QueryDocumentSnapshot {
  return { data: () => data } as unknown as QueryDocumentSnapshot;
}

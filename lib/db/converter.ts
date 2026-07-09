import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { z } from 'zod';

// Every Firestore read and write in the codebase goes through a converter
// built here (Prime Directive 4): writes are validated before they leave the
// process, reads are validated before they reach domain code.

export function zodConverter<Schema extends z.ZodType<DocumentData>>(
  schema: Schema,
): FirestoreDataConverter<z.infer<Schema>> {
  return {
    toFirestore(entity: z.infer<Schema>): DocumentData {
      return schema.parse(entity);
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): z.infer<Schema> {
      return schema.parse(snapshot.data());
    },
  };
}

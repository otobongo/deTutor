import { grammarItemConverter, unitConverter } from '@/lib/db/curriculum';
import { seedGrammarItems, seedUnits } from './units';

// Idempotent curriculum seed (GT-101): documents are keyed by their stable
// ids and written with set(), so re-running overwrites identical data and
// never duplicates. Converter validation runs on every write.

export interface SeedableDocument {
  set(data: FirebaseFirestore.DocumentData): Promise<unknown>;
}

export interface SeedableCollection {
  doc(id: string): SeedableDocument;
}

export interface SeedTarget {
  collection(path: string): SeedableCollection;
}

export interface SeedSummary {
  units: number;
  grammarItems: number;
}

export async function seedCurriculum(db: SeedTarget): Promise<SeedSummary> {
  const unitCollection = db.collection('units');
  for (const unit of seedUnits) {
    await unitCollection.doc(unit.id).set(unitConverter.toFirestore(unit));
  }
  const grammarCollection = db.collection('grammarItems');
  for (const item of seedGrammarItems) {
    await grammarCollection.doc(item.id).set(grammarItemConverter.toFirestore(item));
  }
  return { units: seedUnits.length, grammarItems: seedGrammarItems.length };
}

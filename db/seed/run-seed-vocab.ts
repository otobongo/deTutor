import '@/scripts/load-env';
import { getDb } from '@/lib/firebase';
import { levelSchema } from '@/lib/db/curriculum';
import { seedVocabulary } from './seed-vocab';

// Entry point: npm run seed:vocab [-- --level A2]. Defaults to A1 (day-one
// set); A2/B1 are staged and load only when explicitly requested.

async function main(): Promise<void> {
  const flagIndex = process.argv.indexOf('--level');
  const level = levelSchema.parse(flagIndex === -1 ? 'A1' : process.argv[flagIndex + 1]);
  const count = await seedVocabulary(getDb(), level);
  console.log(`Seeded ${count} ${level} words.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

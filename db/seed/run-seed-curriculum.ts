import '@/scripts/load-env';
import { getDb } from '@/lib/firebase';
import { seedCurriculum } from './seed-curriculum';

// Entry point: npm run seed:curriculum. Requires a configured .env.local
// (real project or emulator); safe to re-run at any time.

async function main(): Promise<void> {
  const summary = await seedCurriculum(getDb());
  console.log(`Seeded ${summary.units} units and ${summary.grammarItems} grammar items.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

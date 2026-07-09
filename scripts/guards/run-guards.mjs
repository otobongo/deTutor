// CI guard suite. Enforces the hard boundaries the engineering strategy makes
// machine-checked: model strings only in lib/config.ts, process.env only in
// lib/config.ts, no server config in client components, and (GT-005) no media
// API access outside lib/media. Exits non-zero with a named violation list.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const SCANNED_DIRS = ['app', 'lib', 'db', 'scripts', 'tests'];
const SELF_DIR = path.join(root, 'scripts', 'guards');
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx']);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (CODE_EXTENSIONS.has(path.extname(full))) {
      yield full;
    }
  }
}

function scan({ name, pattern, allow, describe }) {
  const violations = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(path.join(root, dir))) {
      if (file.startsWith(SELF_DIR)) continue;
      const relative = path.relative(root, file);
      if (allow.some((allowed) => relative === allowed || relative.startsWith(allowed))) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          violations.push(`${relative}:${index + 1}  ${line.trim()}`);
        }
      });
    }
  }
  if (violations.length > 0) {
    console.error(`\nGUARD FAILED [${name}]: ${describe}`);
    for (const violation of violations) console.error(`  ${violation}`);
  }
  return violations.length;
}

const guards = [
  {
    name: 'model-strings',
    pattern: /gemini-[0-9]|gemini-live|nano-banana|imagen-[0-9]/i,
    allow: ['lib/config.ts'],
    describe: 'Model identifiers may only appear in lib/config.ts (Prime Directive 3).',
  },
  {
    name: 'process-env',
    pattern: /process\.env/,
    allow: ['lib/config.ts'],
    describe: 'lib/config.ts is the only reader of process.env.',
  },
  {
    name: 'client-server-config',
    pattern: /from '@\/lib\/(config|firebase)'/,
    allow: [],
    describe: 'Client components must not import server config or Firebase.',
    onlyClientFiles: true,
  },
  {
    name: 'media-adapter',
    pattern:
      /generativelanguage\.googleapis\.com|@google\/genai|from '@\/lib\/media\/(gemini|placeholder)-provider'/,
    // The two batch generation scripts are the PRD 7.6 exception: they call
    // media APIs directly and are never imported by app code.
    allow: ['lib/media/', 'lib/gemini/', 'scripts/generate-images.ts', 'scripts/generate-audio.ts'],
    describe:
      'All media access goes through lib/media (the adapter law). Import from @/lib/media only.',
  },
];

let total = 0;
for (const guard of guards) {
  if (guard.onlyClientFiles) {
    // Restrict the scan to files that declare themselves client components.
    const originalPattern = guard.pattern;
    guard.pattern = {
      test: () => false,
    };
    for (const dir of SCANNED_DIRS) {
      for (const file of walk(path.join(root, dir))) {
        const relative = path.relative(root, file);
        const content = readFileSync(file, 'utf8');
        if (/^\s*['"]use client['"]/m.test(content) && originalPattern.test(content)) {
          console.error(`\nGUARD FAILED [${guard.name}]: ${guard.describe}`);
          console.error(`  ${relative}`);
          total += 1;
        }
      }
    }
    continue;
  }
  total += scan(guard);
}

if (total > 0) {
  console.error(`\n${total} guard violation(s). See above.`);
  process.exit(1);
}
console.log('All guards clean: model-strings, process-env, client-server-config, media-adapter.');

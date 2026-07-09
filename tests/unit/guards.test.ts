import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const guardScript = path.join(root, 'scripts', 'guards', 'run-guards.mjs');
const fixtureDir = path.join(root, 'lib', 'guard-fixture-tmp');

function runGuards(): { ok: boolean; output: string } {
  try {
    const output = execFileSync('node', [guardScript], { encoding: 'utf8' });
    return { ok: true, output };
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failed.stdout ?? ''}${failed.stderr ?? ''}` };
  }
}

function plant(fileName: string, content: string): void {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(path.join(fixtureDir, fileName), content);
}

afterEach(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

// Planted violations are assembled at runtime so this test file itself
// does not trip the static guard scan.
const plantedModelString = ['gemini', '2.5', 'flash'].join('-');
const plantedEnvRead = ['process', 'env', 'SECRET'].join('.');
const plantedMediaImport = ['@/lib/media', 'placeholder-provider'].join('/');

describe('CI guard suite (GT-002, GT-005)', () => {
  it('passes on the clean repository', () => {
    const result = runGuards();
    expect(result.output).toContain('All guards clean');
    expect(result.ok).toBe(true);
  });

  it('fails when a model string appears outside lib/config.ts', () => {
    plant('planted-model.ts', `export const model = '${plantedModelString}';\n`);
    const result = runGuards();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('model-strings');
    expect(result.output).toContain('planted-model.ts');
  });

  it('fails when the raw environment is read outside lib/config.ts', () => {
    plant('planted-env.ts', `export const key = ${plantedEnvRead};\n`);
    const result = runGuards();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('process-env');
  });

  it('fails when a client component imports server config', () => {
    plant(
      'planted-client.tsx',
      `'use client';\nimport { getConfig } from '${['@/lib', 'config'].join('/')}';\n`,
    );
    const result = runGuards();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('client-server-config');
  });

  it('fails when a media provider is imported directly instead of via lib/media', () => {
    plant('planted-media.ts', `import { PlaceholderProvider } from '${plantedMediaImport}';\n`);
    const result = runGuards();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('media-adapter');
  });
});

import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

// A valid environment under the deployed default (postgres, GT-D3). The
// FIREBASE_* values ride along so the firestore-specific cases can select
// that store without rebuilding the fixture.
const validEnv = {
  FIREBASE_PROJECT_ID: 'demo-project',
  FIREBASE_CLIENT_EMAIL: 'sdk@demo-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  GEMINI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/detutor',
};

describe('loadConfig (GT-002)', () => {
  it('throws a ConfigError naming GEMINI_API_KEY when it is missing', () => {
    const env: Record<string, string | undefined> = { ...validEnv, GEMINI_API_KEY: undefined };
    let caught: unknown;
    try {
      loadConfig(env);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect((caught as ConfigError).message).toContain('GEMINI_API_KEY');
  });

  it('lists every missing store credential in one error', () => {
    // GEMINI_API_KEY is supplied so the base schema passes and the
    // store-specific refinement actually runs: zod short-circuits before
    // refinements when a required field is absent, so a truly empty
    // environment reports GEMINI_API_KEY alone.
    let caught: unknown;
    try {
      loadConfig({ GEMINI_API_KEY: 'test-key', DATA_STORE: 'firestore' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const named = (caught as ConfigError).missingOrInvalid;
    expect(named).toContain('FIREBASE_PROJECT_ID');
    expect(named).toContain('FIREBASE_CLIENT_EMAIL');
    expect(named).toContain('FIREBASE_PRIVATE_KEY');
  });

  it('resolves model strings from config defaults without env overrides', () => {
    const config = loadConfig(validEnv);
    expect(config.models.fast.length).toBeGreaterThan(0);
    expect(config.models.deep.length).toBeGreaterThan(0);
    expect(config.models.live.length).toBeGreaterThan(0);
    expect(config.models.image.length).toBeGreaterThan(0);
    expect(config.models.tts.length).toBeGreaterThan(0);
  });

  it('lets env override every model string', () => {
    const config = loadConfig({
      ...validEnv,
      GEMINI_MODEL_FAST: 'override-fast',
      GEMINI_MODEL_DEEP: 'override-deep',
      GEMINI_MODEL_LIVE: 'override-live',
      IMAGE_MODEL: 'override-image',
      GEMINI_MODEL_TTS: 'override-tts',
    });
    expect(config.models).toEqual({
      fast: 'override-fast',
      deep: 'override-deep',
      live: 'override-live',
      image: 'override-image',
      tts: 'override-tts',
    });
  });

  it('defaults MEDIA_PROVIDER to placeholder and rejects unknown providers', () => {
    expect(loadConfig(validEnv).mediaProvider).toBe('placeholder');
    expect(() => loadConfig({ ...validEnv, MEDIA_PROVIDER: 'dalle' })).toThrow(ConfigError);
  });

  it('unescapes newlines in the Firebase private key', () => {
    const config = loadConfig({ ...validEnv, DATA_STORE: 'firestore' });
    expect(config.firebase?.privateKey).toContain('\n');
    expect(config.firebase?.privateKey).not.toContain('\\n');
  });

  it('defaults DATA_STORE to postgres and rejects unknown stores (GT-D3)', () => {
    expect(loadConfig(validEnv).dataStore).toBe('postgres');
    expect(() => loadConfig({ ...validEnv, DATA_STORE: 'mysql' })).toThrow(ConfigError);
  });

  it('requires FIREBASE_* only when the firestore store is selected (GT-D3)', () => {
    const withoutFirebase = {
      GEMINI_API_KEY: validEnv.GEMINI_API_KEY,
      DATA_STORE: 'dev-file',
    };
    expect(loadConfig(withoutFirebase).firebase).toBeUndefined();

    let caught: unknown;
    try {
      loadConfig({ ...withoutFirebase, DATA_STORE: 'firestore' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect((caught as ConfigError).missingOrInvalid).toContain('FIREBASE_PROJECT_ID');
  });

  it('leaves firebase undefined under postgres rather than empty strings (GT-D3)', () => {
    const config = loadConfig({
      GEMINI_API_KEY: validEnv.GEMINI_API_KEY,
      DATA_STORE: 'postgres',
      DATABASE_URL: 'postgresql://user:pw@localhost:5432/detutor',
    });
    expect(config.firebase).toBeUndefined();
  });

  it('accepts postgres with a DATABASE_URL (GT-D2)', () => {
    const config = loadConfig({
      ...validEnv,
      DATA_STORE: 'postgres',
      DATABASE_URL: 'postgresql://user:pw@localhost:5432/detutor',
    });
    expect(config.dataStore).toBe('postgres');
    expect(config.databaseUrl).toBe('postgresql://user:pw@localhost:5432/detutor');
  });

  it('rejects postgres without a DATABASE_URL rather than failing at first write (GT-D2)', () => {
    let caught: unknown;
    try {
      loadConfig({ ...validEnv, DATA_STORE: 'postgres', DATABASE_URL: undefined });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect((caught as ConfigError).missingOrInvalid).toContain('DATABASE_URL');
  });

  it('leaves DATABASE_URL optional for the other stores (GT-D2)', () => {
    const config = loadConfig({ ...validEnv, DATA_STORE: 'dev-file', DATABASE_URL: undefined });
    expect(config.databaseUrl).toBeUndefined();
  });
});

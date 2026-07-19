import { z } from 'zod';

// The only reader of process.env in the codebase, and the only home of model
// strings (Prime Directive 3). Everything else imports typed config from here.

export const MEDIA_PROVIDERS = ['placeholder', 'gemini'] as const;
export type MediaProviderName = (typeof MEDIA_PROVIDERS)[number];

// dev-file backs learner state with a local JSON file for credential-less
// placeholder-mode development and e2e; firestore and postgres are production
// (postgres for self-hosted deployments that own their data, GT-D2). Same
// typed, converter-validated write path either way (deviations in board.md).
export const DATA_STORES = ['firestore', 'postgres', 'dev-file'] as const;
export type DataStoreName = (typeof DATA_STORES)[number];

// Named once so the schema and its refinement cannot drift apart.
const FIREBASE_KEYS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

// Verified live 2026-07-09 against the models API, env-overridable.
// gemini-2.5-flash began returning intermittent sunset 404s mid-batch, so
// fast pins the newest GA flash and deep tracks the pro alias (no GA
// gemini-3 pro exists yet; the alias survives the 2.5-pro sunset).
// TODO(GT-501): verify the Nano Banana 2 identifier when image generation is wired.
const DEFAULT_MODEL_FAST = 'gemini-3.5-flash';
const DEFAULT_MODEL_DEEP = 'gemini-pro-latest';
const DEFAULT_MODEL_LIVE = 'gemini-2.5-flash-native-audio-latest';
// The PRD's "Nano Banana 2" maps to the current GA flash image model; the
// pro/4K tier is explicitly out of scope (PRD Section 8).
const DEFAULT_MODEL_IMAGE = 'gemini-3.1-flash-image';
const DEFAULT_MODEL_TTS = 'gemini-3.1-flash-tts-preview';

const envSchema = z
  .object({
    // Only read when DATA_STORE=firestore, so they are optional here and
    // required by the refinement below. A postgres or dev-file deployment
    // that carried three mandatory placeholder secrets invited the habit of
    // inventing fake credentials to satisfy a schema (GT-D3).
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
    FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
    FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1),
    MEDIA_PROVIDER: z.enum(MEDIA_PROVIDERS).default('placeholder'),
    // Postgres is the deployed default (Coolify/VPS, GT-D3); firestore stays
    // fully supported for anyone pointing at a Firebase project instead.
    DATA_STORE: z.enum(DATA_STORES).default('postgres'),
    // The dev-file store's backing file. e2e points this at its own file so
    // test runs never touch (or wipe) the owner's local learner data.
    DEV_STORE_FILE: z.string().min(1).default('.dev-data/store.json'),
    // Required only when DATA_STORE=postgres; see the refinement below.
    DATABASE_URL: z.string().min(1).optional(),
    GEMINI_MODEL_FAST: z.string().min(1).default(DEFAULT_MODEL_FAST),
    GEMINI_MODEL_DEEP: z.string().min(1).default(DEFAULT_MODEL_DEEP),
    GEMINI_MODEL_LIVE: z.string().min(1).default(DEFAULT_MODEL_LIVE),
    IMAGE_MODEL: z.string().min(1).default(DEFAULT_MODEL_IMAGE),
    GEMINI_MODEL_TTS: z.string().min(1).default(DEFAULT_MODEL_TTS),
  })
  // Each store's credentials are required only when that store is selected.
  // Either way the failure lands at config load rather than deep inside a
  // request on first write.
  .superRefine((env, ctx) => {
    if (env.DATA_STORE === 'postgres' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DATA_STORE=postgres.',
      });
    }
    if (env.DATA_STORE === 'firestore') {
      for (const key of FIREBASE_KEYS) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when DATA_STORE=firestore.`,
          });
        }
      }
    }
  });

export interface AppConfig {
  // Present only when dataStore is 'firestore'; the schema guarantees it.
  // Optional on purpose, so a postgres deployment cannot silently hand
  // Firebase a set of empty-string credentials (GT-D3).
  readonly firebase:
    | {
        readonly projectId: string;
        readonly clientEmail: string;
        readonly privateKey: string;
      }
    | undefined;
  readonly geminiApiKey: string;
  readonly mediaProvider: MediaProviderName;
  readonly dataStore: DataStoreName;
  readonly devStoreFile: string;
  // Present whenever dataStore is 'postgres'; the schema guarantees it.
  readonly databaseUrl: string | undefined;
  readonly models: {
    readonly fast: string;
    readonly deep: string;
    readonly live: string;
    readonly image: string;
    readonly tts: string;
  };
}

export class ConfigError extends Error {
  constructor(readonly missingOrInvalid: readonly string[]) {
    super(
      `Invalid environment configuration. Missing or invalid: ${missingOrInvalid.join(', ')}. ` +
        'Copy .env.example to .env.local and fill in every value.',
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const vars = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigError(vars);
  }
  const e = parsed.data;
  const firebase =
    e.FIREBASE_PROJECT_ID && e.FIREBASE_CLIENT_EMAIL && e.FIREBASE_PRIVATE_KEY
      ? {
          projectId: e.FIREBASE_PROJECT_ID,
          clientEmail: e.FIREBASE_CLIENT_EMAIL,
          // .env files store the PEM newlines escaped; restore them for the SDK.
          privateKey: e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
      : undefined;
  return {
    firebase,
    geminiApiKey: e.GEMINI_API_KEY,
    mediaProvider: e.MEDIA_PROVIDER,
    dataStore: e.DATA_STORE,
    devStoreFile: e.DEV_STORE_FILE,
    databaseUrl: e.DATABASE_URL,
    models: {
      fast: e.GEMINI_MODEL_FAST,
      deep: e.GEMINI_MODEL_DEEP,
      live: e.GEMINI_MODEL_LIVE,
      image: e.IMAGE_MODEL,
      tts: e.GEMINI_MODEL_TTS,
    },
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (typeof window !== 'undefined') {
    throw new ConfigError(['getConfig() must never run in the browser']);
  }
  cached ??= loadConfig(process.env);
  return cached;
}

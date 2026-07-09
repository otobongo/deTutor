import { z } from 'zod';

// The only reader of process.env in the codebase, and the only home of model
// strings (Prime Directive 3). Everything else imports typed config from here.

export const MEDIA_PROVIDERS = ['placeholder', 'gemini'] as const;
export type MediaProviderName = (typeof MEDIA_PROVIDERS)[number];

// dev-file backs learner state with a local JSON file for credential-less
// placeholder-mode development and e2e; firestore is production. Same typed,
// converter-validated write path either way (deviation logged in board.md).
export const DATA_STORES = ['firestore', 'dev-file'] as const;
export type DataStoreName = (typeof DATA_STORES)[number];

// Verified live 2026-07-09 against the models API, env-overridable.
// gemini-2.5-flash began returning intermittent sunset 404s mid-batch, so
// fast pins the newest GA flash and deep tracks the pro alias (no GA
// gemini-3 pro exists yet; the alias survives the 2.5-pro sunset).
// TODO(GT-501): verify the Nano Banana 2 identifier when image generation is wired.
const DEFAULT_MODEL_FAST = 'gemini-3.5-flash';
const DEFAULT_MODEL_DEEP = 'gemini-pro-latest';
const DEFAULT_MODEL_LIVE = 'gemini-live-2.5-flash-preview';
const DEFAULT_MODEL_IMAGE = 'nano-banana-2';

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  MEDIA_PROVIDER: z.enum(MEDIA_PROVIDERS).default('placeholder'),
  DATA_STORE: z.enum(DATA_STORES).default('firestore'),
  GEMINI_MODEL_FAST: z.string().min(1).default(DEFAULT_MODEL_FAST),
  GEMINI_MODEL_DEEP: z.string().min(1).default(DEFAULT_MODEL_DEEP),
  GEMINI_MODEL_LIVE: z.string().min(1).default(DEFAULT_MODEL_LIVE),
  IMAGE_MODEL: z.string().min(1).default(DEFAULT_MODEL_IMAGE),
});

export interface AppConfig {
  readonly firebase: {
    readonly projectId: string;
    readonly clientEmail: string;
    readonly privateKey: string;
  };
  readonly geminiApiKey: string;
  readonly mediaProvider: MediaProviderName;
  readonly dataStore: DataStoreName;
  readonly models: {
    readonly fast: string;
    readonly deep: string;
    readonly live: string;
    readonly image: string;
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
  return {
    firebase: {
      projectId: e.FIREBASE_PROJECT_ID,
      clientEmail: e.FIREBASE_CLIENT_EMAIL,
      // .env files store the PEM newlines escaped; restore them for the SDK.
      privateKey: e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    geminiApiKey: e.GEMINI_API_KEY,
    mediaProvider: e.MEDIA_PROVIDER,
    dataStore: e.DATA_STORE,
    models: {
      fast: e.GEMINI_MODEL_FAST,
      deep: e.GEMINI_MODEL_DEEP,
      live: e.GEMINI_MODEL_LIVE,
      image: e.IMAGE_MODEL,
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

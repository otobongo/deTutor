import { GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import { getConfig } from '@/lib/config';
import { TUTOR_SYSTEM_PROMPT } from '@/lib/prompts/tutor-system-prompt';

// The single Gemini text door (Prime Directive 2): every text call in the app
// goes through this client, and every call carries the canonical system
// prompt. Feature behavior is injected as scenario context via
// options.context, never by forking the prompt.

export type GeminiErrorCategory = 'rate-limit' | 'safety-block' | 'parse-failure' | 'network';

export class GeminiError extends Error {
  constructor(
    readonly category: GeminiErrorCategory,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface ChatMessage {
  readonly role: 'learner' | 'tutor';
  readonly text: string;
}

export type GeminiTier = 'fast' | 'deep';

// Every Gemini call names its call site; the escalation map below is the ONLY
// path to the deep tier (GT-110). Adding a deep call site means adding it
// here with a justification, nowhere else.
export type GeminiCallSite =
  | 'scenario-turn'
  | 'echo-assessment'
  | 'reading-generation'
  | 'dialogue-generation'
  | 'listening-evaluation'
  | 'listening-nuance-b1'
  | 'writing-correction'
  | 'remediation-generation'
  | 'unit-test-generation'
  | 'b1-exam-generation'
  | 'weekly-summary'
  | 'vocab-enrichment';

export const ESCALATION_MAP: Readonly<Record<GeminiCallSite, GeminiTier>> = {
  'scenario-turn': 'fast',
  'echo-assessment': 'fast',
  'reading-generation': 'fast',
  // Dialogue-lab conversations are envelope-checked in code like reading.
  'dialogue-generation': 'fast',
  'listening-evaluation': 'fast',
  // B1 nuance explanation weighs idiom, register, and implied meaning (GT-206).
  'listening-nuance-b1': 'deep',
  // Categorized correction quality drives the grammar log and weighting (GT-213).
  'writing-correction': 'deep',
  'remediation-generation': 'fast',
  // Generated tests must be valid, balanced, and answer-keyed (GT-301).
  'unit-test-generation': 'deep',
  // The exit exam decides the certificate simulation; validity over speed.
  'b1-exam-generation': 'deep',
  // Weekly pattern synthesis across the full error log (GT-309).
  'weekly-summary': 'deep',
  // Build-time batch filling IPA and example sentences (GT-D1).
  'vocab-enrichment': 'fast',
};

export interface GeminiCallLogEntry {
  readonly callSite: GeminiCallSite;
  readonly tier: GeminiTier;
  readonly model: string;
  readonly jsonMode: boolean;
}

export type GeminiCallLogger = (entry: GeminiCallLogEntry) => void;

export interface ChatOptions {
  readonly callSite: GeminiCallSite;
  // Scenario/context layer appended to the canonical prompt (never replacing it).
  readonly context?: string;
}

export interface GeminiClient {
  chat(messages: readonly ChatMessage[], options: ChatOptions): Promise<string>;
  generateJson<Schema extends z.ZodType>(
    messages: readonly ChatMessage[],
    schema: Schema,
    options: ChatOptions,
  ): Promise<z.infer<Schema>>;
}

// The transport seam: production uses the @google/genai SDK; tests inject a
// fake. Everything above the transport (prompt attachment, JSON validation,
// retry, error taxonomy) is identical in both.
export interface GeminiTransport {
  generate(request: {
    model: string;
    systemInstruction: string;
    messages: readonly ChatMessage[];
    jsonMode: boolean;
  }): Promise<string>;
}

function systemInstructionWith(context: string | undefined): string {
  return context
    ? `${TUTOR_SYSTEM_PROMPT}\n\n---\n\n## SCENARIO CONTEXT\n\n${context}`
    : TUTOR_SYSTEM_PROMPT;
}

function categorize(error: unknown): GeminiError {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  if (status === 429 || /quota|rate.?limit/i.test(message)) {
    return new GeminiError('rate-limit', 'Gemini rate limit reached; retry later.', error);
  }
  if (/safety|blocked|prohibited/i.test(message)) {
    return new GeminiError('safety-block', 'Gemini blocked the request or response.', error);
  }
  return new GeminiError('network', `Gemini call failed: ${message}`, error);
}

export interface GeminiModelPair {
  readonly fast: string;
  readonly deep: string;
}

const defaultLogger: GeminiCallLogger = (entry) => {
  // Structured line for cost observability; one entry per transport call.
  console.info(
    `[gemini] site=${entry.callSite} tier=${entry.tier} model=${entry.model} json=${entry.jsonMode}`,
  );
};

export function createGeminiClient(
  transport: GeminiTransport,
  models: GeminiModelPair,
  logger: GeminiCallLogger = defaultLogger,
): GeminiClient {
  async function callOnce(
    messages: readonly ChatMessage[],
    options: ChatOptions,
    jsonMode: boolean,
  ): Promise<string> {
    const tier = ESCALATION_MAP[options.callSite];
    const model = models[tier];
    logger({ callSite: options.callSite, tier, model, jsonMode });
    try {
      return await transport.generate({
        model,
        systemInstruction: systemInstructionWith(options.context),
        messages,
        jsonMode,
      });
    } catch (error) {
      throw error instanceof GeminiError ? error : categorize(error);
    }
  }

  return {
    chat: (messages, options) => callOnce(messages, options, false),

    // Schema or it did not happen: parse, validate, one retry on failure,
    // then a categorized parse-failure error. Never regex a model response.
    async generateJson(messages, schema, options) {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const raw = await callOnce(messages, options, true);
        try {
          return schema.parse(JSON.parse(raw));
        } catch (error) {
          lastError = error;
        }
      }
      throw new GeminiError(
        'parse-failure',
        'Gemini returned JSON that failed schema validation twice.',
        lastError,
      );
    },
  };
}

function sdkTransport(apiKey: string): GeminiTransport {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generate({ model, systemInstruction, messages, jsonMode }) {
      const response = await ai.models.generateContent({
        model,
        contents: messages.map((message) => ({
          role: message.role === 'learner' ? 'user' : 'model',
          parts: [{ text: message.text }],
        })),
        config: {
          systemInstruction,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      });
      const text = response.text;
      if (text === undefined || text.length === 0) {
        throw new GeminiError('safety-block', 'Gemini returned an empty response.');
      }
      return text;
    },
  };
}

let cachedClient: GeminiClient | undefined;

export function getGeminiClient(): GeminiClient {
  if (typeof window !== 'undefined') {
    throw new GeminiError('network', 'The Gemini client must never run in the browser.');
  }
  if (!cachedClient) {
    const config = getConfig();
    cachedClient = createGeminiClient(sdkTransport(config.geminiApiKey), {
      fast: config.models.fast,
      deep: config.models.deep,
    });
  }
  return cachedClient;
}

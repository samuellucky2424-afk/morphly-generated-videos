import { env } from './env.ts';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_TIMEOUT_MS = 20_000;

const PROMPT_ENHANCEMENT_INSTRUCTIONS = `You are an expert prompt engineer for the LTX 2.3 video generation model.
Enhance the user's video prompt for accurate results, focusing on strict character consistency and vivid descriptive details.
Describe exactly what happens within a maximum 10-second window.
Do not change the core subject or action, and do not invent character details that contradict the user's input.
Add useful cinematic, lighting, camera, motion, and consistency details.
Respond with only the enhanced prompt text.`;

type GeminiErrorCode =
  | 'not_configured'
  | 'provider_error'
  | 'rate_limited'
  | 'invalid_response';

type GeminiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
};

type GeminiEnhancementOptions = {
  apiKey?: string;
  fetchImpl?: GeminiFetch;
  model?: string;
};

export class GeminiEnhancementError extends Error {
  readonly code: GeminiErrorCode;
  readonly providerStatus?: number;

  constructor(
    code: GeminiErrorCode,
    message: string,
    providerStatus?: number,
  ) {
    super(message);
    this.name = 'GeminiEnhancementError';
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

function configuredApiKey() {
  return (env.GEMINI_API_KEY || env.GEMINI_KEY || '').trim();
}

function configuredModel() {
  return (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
}

export function isPromptEnhancerConfigured() {
  return configuredApiKey().length > 0;
}

export async function enhanceVideoPrompt(
  originalPrompt: string,
  options: GeminiEnhancementOptions = {},
): Promise<string> {
  const apiKey =
    options.apiKey === undefined ? configuredApiKey() : options.apiKey.trim();
  const model =
    options.model === undefined ? configuredModel() : options.model.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    throw new GeminiEnhancementError(
      'not_configured',
      'The Gemini API key is not configured.',
    );
  }

  if (!model) {
    throw new GeminiEnhancementError(
      'not_configured',
      'The Gemini model is not configured.',
    );
  }

  let response: Response;

  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: PROMPT_ENHANCEMENT_INSTRUCTIONS }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: originalPrompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 512,
            thinkingConfig: {
              thinkingLevel: 'low',
            },
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error('Gemini prompt enhancement request failed:', error);
    throw new GeminiEnhancementError(
      'provider_error',
      'Gemini could not be reached.',
    );
  }

  let data: GeminiResponse = {};

  try {
    data = (await response.json()) as GeminiResponse;
  } catch {
    // A non-JSON provider response is handled as an invalid response below.
  }

  if (!response.ok) {
    console.warn('Gemini prompt enhancement was rejected:', {
      model,
      providerMessage: data.error?.message,
      providerStatus: response.status,
      providerStatusText: data.error?.status,
    });
    throw new GeminiEnhancementError(
      response.status === 429 ? 'rate_limited' : 'provider_error',
      'Gemini rejected the prompt enhancement request.',
      response.status,
    );
  }

  const enhanced = data.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!enhanced) {
    console.warn('Gemini returned no enhanced prompt:', {
      blockReason: data.promptFeedback?.blockReason,
      finishReason: data.candidates?.[0]?.finishReason,
      model,
    });
    throw new GeminiEnhancementError(
      'invalid_response',
      'Gemini returned no enhanced prompt.',
    );
  }

  return enhanced;
}

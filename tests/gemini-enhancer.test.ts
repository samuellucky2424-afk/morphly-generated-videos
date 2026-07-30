import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enhanceVideoPrompt,
  GeminiEnhancementError,
} from '../src/lib/gemini-enhancer.ts';

test('prompt enhancement uses the current Gemini REST contract', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  const enhanced = await enhanceVideoPrompt('A fox runs through a forest.', {
    apiKey: 'test-api-key',
    fetchImpl: async (input, init) => {
      requestUrl = input.toString();
      requestInit = init;
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: 'A red fox races between mossy trees as the camera tracks beside it.' },
              ],
            },
          },
        ],
      });
    },
    model: 'gemini-3.6-flash',
  });

  assert.equal(
    requestUrl,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
  );
  assert.equal(new Headers(requestInit?.headers).get('x-goog-api-key'), 'test-api-key');
  assert.equal(requestUrl.includes('test-api-key'), false);

  const body = JSON.parse(String(requestInit?.body)) as {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: {
      thinkingConfig: { thinkingLevel: string };
    };
    systemInstruction: { parts: Array<{ text: string }> };
  };
  assert.equal(body.contents[0]?.parts[0]?.text, 'A fox runs through a forest.');
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.match(body.systemInstruction.parts[0]?.text ?? '', /maximum 10-second window/);
  assert.equal(
    enhanced,
    'A red fox races between mossy trees as the camera tracks beside it.',
  );
});

test('prompt enhancement surfaces provider failures for the route to refund', async () => {
  await assert.rejects(
    enhanceVideoPrompt('A fox runs through a forest.', {
      apiKey: 'test-api-key',
      fetchImpl: async () =>
        Response.json(
          {
            error: {
              message: 'The requested model was not found.',
              status: 'NOT_FOUND',
            },
          },
          { status: 404 },
        ),
      model: 'retired-model',
    }),
    (error: unknown) => {
      assert.ok(error instanceof GeminiEnhancementError);
      assert.equal(error.code, 'provider_error');
      assert.equal(error.providerStatus, 404);
      return true;
    },
  );
});

test('prompt enhancement rejects a missing API key before calling Gemini', async () => {
  let called = false;

  await assert.rejects(
    enhanceVideoPrompt('A fox runs through a forest.', {
      apiKey: '',
      fetchImpl: async () => {
        called = true;
        return Response.json({});
      },
      model: 'gemini-3.6-flash',
    }),
    (error: unknown) => {
      assert.ok(error instanceof GeminiEnhancementError);
      assert.equal(error.code, 'not_configured');
      return true;
    },
  );

  assert.equal(called, false);
});

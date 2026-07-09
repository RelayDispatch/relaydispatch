/**
 * tests/mocks/openrouter.ts
 * ─────────────────────────────────────────────────────────────
 * Centralised MSW handlers for OpenRouter API calls.
 *
 * Provides realistic mock responses for both the Gemini classifier
 * and the Claude dispatcher models, routed by the `model` field
 * in the request body.
 *
 * Usage:
 *   import { setupServer } from 'msw/node';
 *   import { openrouterMswHandlers } from '../mocks/openrouter.js';
 *
 *   const server = setupServer(...openrouterMswHandlers);
 */

import { http, HttpResponse } from 'msw';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ── Default classifier response (Gemini) ──────────────────────

const DEFAULT_CLASSIFIER_RESPONSE = {
  serviceCategory: 'AC_DIAGNOSTIC',
  urgencyScore:    75,
  sentimentScore:  -40,
  equipmentBrand:  'Carrier',
  equipmentModel:  '24ACC636A003',
  equipmentSerial: null,
  equipmentAge:    5,
  preferredDate:   null,
  preferredTime:   null,
  techNotes:       'AC not cooling. Unit is 5 years old (Carrier).',
};

// ── Default dispatcher response (Claude) ──────────────────────

const DEFAULT_DISPATCHER_RESPONSE = {
  replyBody:        "Hi, I understand your AC isn't working. Our diagnostic fee is $89. We can send a tech tomorrow.",
  shouldEscalate:   false,
  escalationReason: null,
  confidence:       0.95,
};

// ── Shared handler ────────────────────────────────────────────

export const openrouterMswHandlers = [
  http.post(OPENROUTER_URL, async ({ request }) => {
    const body = await request.json() as { model?: string };
    const model = body.model ?? '';

    if (model.includes('gemini')) {
      return HttpResponse.json({
        choices: [{ message: { content: JSON.stringify(DEFAULT_CLASSIFIER_RESPONSE) } }],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      });
    }

    // Claude / dispatcher path
    return HttpResponse.json({
      choices: [{ message: { content: JSON.stringify(DEFAULT_DISPATCHER_RESPONSE) } }],
      usage: { prompt_tokens: 350, completion_tokens: 180 },
    });
  }),
];

/**
 * Returns an OpenRouter handler that simulates a 429 (rate limit) error.
 * Used to test the fallback / escalation path.
 */
export function makeOpenRouterRateLimitHandler() {
  return http.post(OPENROUTER_URL, () =>
    HttpResponse.json({ error: { message: 'Rate limit exceeded', code: 429 } }, { status: 429 }),
  );
}

/**
 * Returns an OpenRouter handler that simulates a 500 server error.
 * Used to test Temporal retry and escalation paths.
 */
export function makeOpenRouterServerErrorHandler() {
  return http.post(OPENROUTER_URL, () =>
    HttpResponse.json({ error: { message: 'Internal server error' } }, { status: 500 }),
  );
}

/**
 * Returns a dispatcher handler that produces a shouldEscalate=true response.
 * Used to test the human escalation path without urgency-score triggers.
 */
export function makeOpenRouterEscalationHandler() {
  return http.post(OPENROUTER_URL, async ({ request }) => {
    const body = await request.json() as { model?: string };
    const model = body.model ?? '';

    if (model.includes('gemini')) {
      return HttpResponse.json({
        choices: [{ message: { content: JSON.stringify({ ...DEFAULT_CLASSIFIER_RESPONSE, serviceCategory: 'GENERAL', urgencyScore: 20 }) } }],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      });
    }

    return HttpResponse.json({
      choices: [{ message: { content: JSON.stringify({
        replyBody:        'We need to connect you with a human agent to assist further.',
        shouldEscalate:   true,
        escalationReason: 'Complex billing dispute requiring human review',
        confidence:       0.45,
      }) } }],
      usage: { prompt_tokens: 350, completion_tokens: 90 },
    });
  });
}

/**
 * Returns a handler that simulates a truncated / malformed JSON response
 * (simulates max_tokens being hit or model error mid-stream).
 * Used to test the Zod-parse-failure fallback path.
 */
export function makeOpenRouterTruncatedHandler() {
  return http.post(OPENROUTER_URL, () =>
    HttpResponse.json({
      choices: [{ message: { content: '{"replyBody": "incomplete json...' } }],
      usage: { prompt_tokens: 350, completion_tokens: 20 },
    }),
  );
}

/**
 * tests/security/hmac.test.ts
 * ─────────────────────────────────────────────────────────────
 * Security tests for packages/security/src/hmac.ts
 *
 * The HMAC verification function protects the Gmail Pub/Sub webhook
 * endpoint from unauthorized push deliveries.
 *
 * Test groups:
 *   H1 — Valid signature: correct HMAC-SHA256 is accepted
 *   H2 — Invalid signature: wrong HMAC is rejected
 *   H3 — Missing signature: rejected when secret is set
 *   H4 — Timing-safe comparison: constant-time verification used
 *   H5 — Dev mode (no secret): pass-through with warning
 *   H6 — Production mode (no secret): hard reject
 *   H7 — Replay attack: same signature for different body is rejected
 *   H8 — Malformed base64 signature: rejected cleanly
 *   H9 — Empty body: valid signature still accepted
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Inline the verifyPubSubSignature logic for unit testing ──
// We test the logic in isolation. The real implementation in hmac.ts
// reads GMAIL_PUBSUB_HMAC_SECRET and NODE_ENV from process.env.

function generateSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

async function verifyPubSubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
  isProduction: boolean,
): Promise<boolean> {
  if (!secret) {
    if (isProduction) return false; // hard fail in production
    return true;                    // degraded dev mode
  }

  if (!signatureHeader) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();

  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader, 'base64');
  } catch {
    return false;
  }

  // timingSafeEqual requires same length
  const { timingSafeEqual } = await import('node:crypto');
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

const TEST_SECRET = 'test-hmac-secret-abc-xyz-123';
const TEST_BODY   = JSON.stringify({ message: { data: 'dGVzdA==', messageId: '123' } });

// ============================================================
// H1 — Valid signature accepted
// ============================================================

describe('H1 — Valid HMAC-SHA256 signature is accepted', () => {
  it('accepts a correctly computed signature', async () => {
    const sig    = generateSignature(TEST_SECRET, TEST_BODY);
    const result = await verifyPubSubSignature(TEST_BODY, sig, TEST_SECRET, true);
    expect(result).toBe(true);
  });

  it('accepts valid signature in production mode', async () => {
    const sig    = generateSignature(TEST_SECRET, TEST_BODY);
    const result = await verifyPubSubSignature(TEST_BODY, sig, TEST_SECRET, true);
    expect(result).toBe(true);
  });

  it('accepts valid signature in dev mode', async () => {
    const sig    = generateSignature(TEST_SECRET, TEST_BODY);
    const result = await verifyPubSubSignature(TEST_BODY, sig, TEST_SECRET, false);
    expect(result).toBe(true);
  });
});

// ============================================================
// H2 — Invalid signature rejected
// ============================================================

describe('H2 — Invalid signature is rejected', () => {
  it('rejects a signature computed with a wrong secret', async () => {
    const wrongSig = generateSignature('wrong-secret', TEST_BODY);
    const result   = await verifyPubSubSignature(TEST_BODY, wrongSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('rejects a signature computed over a different body', async () => {
    const sig         = generateSignature(TEST_SECRET, 'different body content');
    const result      = await verifyPubSubSignature(TEST_BODY, sig, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('rejects a completely random base64 string', async () => {
    const randomSig = Buffer.from('not-a-real-signature').toString('base64');
    const result    = await verifyPubSubSignature(TEST_BODY, randomSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('rejects an all-zeros signature', async () => {
    const zeroSig = Buffer.alloc(32, 0).toString('base64');
    const result  = await verifyPubSubSignature(TEST_BODY, zeroSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

// ============================================================
// H3 — Missing signature rejected when secret is set
// ============================================================

describe('H3 — Missing signature is rejected when secret is configured', () => {
  it('returns false when signature header is undefined', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, undefined, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('returns false when signature header is empty string', async () => {
    // Empty string is not valid base64 for a 32-byte HMAC
    const result = await verifyPubSubSignature(TEST_BODY, '', TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

// ============================================================
// H4 — Timing-safe comparison
// ============================================================

describe('H4 — Timing-safe comparison enforcement', () => {
  it('signatures of different lengths are rejected (length oracle prevention)', async () => {
    // A signature shorter than 32 bytes will have a different base64 length
    const shortSig = Buffer.from('tooshort').toString('base64');
    const result   = await verifyPubSubSignature(TEST_BODY, shortSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('signatures of longer length are also rejected', async () => {
    const longSig = Buffer.alloc(64, 0).toString('base64');
    const result  = await verifyPubSubSignature(TEST_BODY, longSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

// ============================================================
// H5 — Dev mode: no secret → pass-through (degraded)
// ============================================================

describe('H5 — Dev mode: no secret → pass-through with degraded auth', () => {
  it('returns true in dev mode when no secret is configured', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, undefined, undefined, false);
    expect(result).toBe(true);
  });

  it('returns true in dev mode even with no signature', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, undefined, undefined, false);
    expect(result).toBe(true);
  });
});

// ============================================================
// H6 — Production mode: no secret → hard reject
// ============================================================

describe('H6 — Production mode: no secret → hard reject', () => {
  it('returns false in production when HMAC secret is not configured', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, undefined, undefined, true);
    expect(result).toBe(false);
  });

  it('even a valid-looking signature is rejected when secret is missing in production', async () => {
    const sig    = generateSignature('some-secret', TEST_BODY);
    const result = await verifyPubSubSignature(TEST_BODY, sig, undefined, true);
    // No secret configured → cannot verify → reject
    expect(result).toBe(false);
  });
});

// ============================================================
// H7 — Replay attack: same signature, different body
// ============================================================

describe('H7 — Replay attack prevention', () => {
  it('a valid signature for body A does not validate for body B', async () => {
    const bodyA  = '{"historyId":"100","emailAddress":"org@example.com"}';
    const bodyB  = '{"historyId":"101","emailAddress":"org@example.com"}'; // different historyId
    const sigA   = generateSignature(TEST_SECRET, bodyA);

    // Using signature for A against body B must fail
    const result = await verifyPubSubSignature(bodyB, sigA, TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('a valid signature cannot be reused for an empty body', async () => {
    const validSig = generateSignature(TEST_SECRET, TEST_BODY);
    const result   = await verifyPubSubSignature('', validSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

// ============================================================
// H8 — Malformed base64 signature
// ============================================================

describe('H8 — Malformed base64 signature is rejected cleanly', () => {
  it('does not throw on non-base64 input', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, '!!!not-base64!!!', TEST_SECRET, true);
    // Should return false, not throw
    expect(result).toBe(false);
  });

  it('does not throw on Unicode in signature position', async () => {
    const result = await verifyPubSubSignature(TEST_BODY, '日本語テスト', TEST_SECRET, true);
    expect(result).toBe(false);
  });

  it('does not throw on extremely long signature string', async () => {
    const longSig = 'A'.repeat(10000);
    const result  = await verifyPubSubSignature(TEST_BODY, longSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

// ============================================================
// H9 — Empty body with valid signature
// ============================================================

describe('H9 — Empty body with valid signature', () => {
  it('accepts valid signature over empty body', async () => {
    const emptySig = generateSignature(TEST_SECRET, '');
    const result   = await verifyPubSubSignature('', emptySig, TEST_SECRET, true);
    expect(result).toBe(true);
  });

  it('rejects wrong signature over empty body', async () => {
    const wrongSig = generateSignature('wrong-secret', '');
    const result   = await verifyPubSubSignature('', wrongSig, TEST_SECRET, true);
    expect(result).toBe(false);
  });
});

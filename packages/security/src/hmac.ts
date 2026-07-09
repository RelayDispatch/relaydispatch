/**
 * packages/security/src/hmac.ts
 * ──────────────────────────────
 * HMAC-SHA256 signature verification for Google Pub/Sub push deliveries.
 * Extracted from the monolithic api/index.ts.
 *
 * Production setup (Option B — HMAC, current implementation):
 *   Set GMAIL_PUBSUB_HMAC_SECRET to a secret shared with the GCP Pub/Sub
 *   push subscription. Google sends the signature in X-Goog-Signature.
 *
 *   Configure via: gcloud pubsub subscriptions modify-push-config \
 *     --push-auth-token-audience=<endpoint-url>
 *
 * Safe rollout: if GMAIL_PUBSUB_HMAC_SECRET is not set in development,
 * the function logs a warning and returns true — falling through to the
 * legacy token check. In production, it fails hard.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import pino from 'pino';

const log = pino({ name: 'relay-security', level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Verifies the HMAC-SHA256 signature on an incoming Pub/Sub push delivery.
 *
 * @param rawBody - The raw request body string (must be read before parsing)
 * @param signatureHeader - The X-Goog-Signature header value
 * @returns true if the signature is valid (or if in dev with no secret configured)
 */
export async function verifyPubSubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  const secret = process.env.GMAIL_PUBSUB_HMAC_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      log.error('GMAIL_PUBSUB_HMAC_SECRET missing in production — rejecting');
      return false;
    }
    log.warn('GMAIL_PUBSUB_HMAC_SECRET not set — HMAC verification disabled (dev mode only)');
    return true; // degraded — allow legacy token path to handle auth
  }

  if (!signatureHeader) {
    log.warn('Pub/Sub push missing X-Goog-Signature — rejecting');
    return false;
  }

  // Google sends the signature as base64(HMAC-SHA256(rawBody))
  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader, 'base64');
  } catch {
    log.warn('Pub/Sub X-Goog-Signature is not valid base64 — rejecting');
    return false;
  }

  // timingSafeEqual prevents timing oracle attacks
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

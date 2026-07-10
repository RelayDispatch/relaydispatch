/**
 * backend/workflows/activities/shared.ts
 * ─────────────────────────────────────────────────────────────
 * Shared infrastructure for all workflow activities:
 *   - Module-level service clients (supabase, nylas, openrouter)
 *   - Vault encryption / decryption (AES-256-GCM)
 *   - Activity idempotency guard (completed_activity_keys table)
 *   - Pure helper utilities (stripHtmlTags, categoryToLabel)
 *   - OpenRouter model cost table
 *
 * All exports here are available to every domain activity file.
 * Clients are instantiated once per worker process (ES module singleton).
 */

import { createClient }   from '@supabase/supabase-js';
import OpenAI             from 'openai';
import Nylas              from 'nylas';
import pino               from 'pino';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { convert }        from 'html-to-text';
import type { Database }  from '../../../../packages/database/src/database.types.js';

// ── Compatibility shim for Nylas CommonJS default export ────────────────────
const NylasClient = (Nylas as any).default || Nylas;

// ============================================================
// MODULE-LEVEL SINGLETONS  (one per Temporal worker process)
// ============================================================

export const log = pino({ name: 'activities', level: process.env.LOG_LEVEL ?? 'info' });

// Service-role Supabase client — worker-side only, NEVER exposed to Hono API
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Nylas v3
export const nylas = new NylasClient({
  apiKey: process.env.NYLAS_API_KEY!,
  apiUri: process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com',
});

// OpenRouter client (vendor-neutral AI gateway)
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_BASE_URL ?? 'https://relaydispatch.org',
    'X-Title':      `${process.env.AGENT_BRAND ?? 'RelayDispatch'} Worker`,
  },
});

// ============================================================
// OPENROUTER MODEL COST TABLE
// Cost per 1,000,000 tokens in USD. Updated: 2026-05
// Source: https://openrouter.ai/models
// ============================================================

const OPENROUTER_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'google/gemini-3.1-flash-lite-preview': { inputPer1M: 0.075,  outputPer1M: 0.30  },
  'anthropic/claude-sonnet-4.6':          { inputPer1M: 3.00,   outputPer1M: 15.00 },
  'openai/gpt-5.5':                       { inputPer1M: 2.00,   outputPer1M: 8.00  },
};

export function calcOpenRouterCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = OPENROUTER_COSTS[model];
  if (!pricing) return 0;
  return ((promptTokens * pricing.inputPer1M) + (completionTokens * pricing.outputPer1M)) / 1_000_000;
}

// ============================================================
// VAULT ENCRYPTION (AES-256-GCM)
// ============================================================
// The vault contains real PII values. It must never be stored in
// plaintext in Temporal workflow history (visible to any Temporal
// operator via tctl or Web UI).
//
// Key source: VAULT_ENCRYPTION_KEY env var (32-byte hex — 64 hex chars)
// Each vault is encrypted with a unique IV per serialization.
// Format: <iv_hex>:<tag_hex>:<ciphertext_hex>

function getVaultKey(): Buffer {
  const keyHex = process.env.VAULT_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'VAULT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptVault(vaultJson: string): string {
  const key  = getVaultKey();
  const iv   = randomBytes(12); // 96-bit IV for GCM
  const cipher    = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(vaultJson, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// AES-256-GCM ciphertext format: <24-hex IV>:<32-hex tag>:<hex ciphertext>
const ENCRYPTED_VAULT_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

function decryptWithKey(encrypted: string, keyHex: string): string {
  const colonIdx1     = encrypted.indexOf(':');
  const colonIdx2     = encrypted.indexOf(':', colonIdx1 + 1);
  const ivHex         = encrypted.slice(0, colonIdx1);
  const tagHex        = encrypted.slice(colonIdx1 + 1, colonIdx2);
  const ciphertextHex = encrypted.slice(colonIdx2 + 1);

  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error('decryptVault: malformed ciphertext segments');
  }

  const key      = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ciphertextHex, 'hex')) + decipher.final('utf8');
}

export function decryptVault(encrypted: string): string {
  // Legacy detection: plaintext vaults (pre-encryption migration)
  if (!ENCRYPTED_VAULT_RE.test(encrypted)) {
    return encrypted;
  }

  const primaryKeyHex = process.env.VAULT_ENCRYPTION_KEY;
  if (!primaryKeyHex || primaryKeyHex.length !== 64) {
    throw new Error('VAULT_ENCRYPTION_KEY must be set to decrypt a vault');
  }

  // Try primary key first; fall back to rotation key if provided
  try {
    return decryptWithKey(encrypted, primaryKeyHex);
  } catch (primaryErr) {
    const rotationKeyHex = process.env.VAULT_ENCRYPTION_KEY_OLD;
    if (rotationKeyHex && rotationKeyHex.length === 64) {
      try {
        return decryptWithKey(encrypted, rotationKeyHex);
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

// ============================================================
// ACTIVITY IDEMPOTENCY GUARD
// ============================================================
// Temporal may retry any activity. External side effects (email send,
// CRM job create, Slack notify) MUST be idempotent.
// Strategy: record a `completed_activity_keys` entry in the DB before
// the side effect. On retry, detect the existing record and skip.
//
// Key format: `<activityName>:<threadId>:<turn>`

export async function isActivityAlreadyCompleted(key: string): Promise<boolean> {
  const { data } = await supabase
    .from('completed_activity_keys' as never)
    .select('key')
    .eq('key', key)
    .maybeSingle();
  return data !== null;
}

export async function markActivityCompleted(key: string, meta?: Record<string, unknown>): Promise<void> {
  const insertPayload = {
    key,
    completed_at: new Date().toISOString(),
    ...(meta != null ? { meta } : {}),
  };
  await (supabase as any)
    .from('completed_activity_keys')
    .insert(insertPayload);
}

// ============================================================
// PURE HELPERS
// ============================================================

export function stripHtmlTags(html: string): string {
  if (!html) return '';
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      { selector: 'h4', options: { uppercase: false } },
      { selector: 'h5', options: { uppercase: false } },
      { selector: 'h6', options: { uppercase: false } }
    ]
  });
  return text.replace(/\u00a0/g, ' ').trim();
}

export function categoryToLabel(category: string): string {
  const map: Record<string, string> = {
    AC_DIAGNOSTIC:      'AC System Diagnostic',
    AC_REPAIR:          'AC Repair',
    FURNACE_DIAGNOSTIC: 'Furnace Diagnostic',
    FURNACE_REPAIR:     'Furnace Repair',
    MAINTENANCE:        'Maintenance Service',
    FILTER_REPLACE:     'Filter Replacement',
    INSTALLATION:       'Equipment Installation',
    EMERGENCY:          'Emergency Service',
    GENERAL:            'General HVAC Service',
  };
  return map[category] ?? 'HVAC Service';
}


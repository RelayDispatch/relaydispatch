/**
 * packages/security/src/orgSecrets.ts
 * AES-256-GCM encryption for org-scoped integration secrets at rest.
 * Uses the same key material as the PII vault (VAULT_ENCRYPTION_KEY).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENCRYPTED_ORG_SECRET_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export const ORG_SECRET_FIELD_PAIRS = [
  { plain: 'twilio_auth_token', enc: 'twilio_auth_token_enc' },
  { plain: 'mail_access_token', enc: 'mail_access_token_enc' },
  { plain: 'mail_refresh_token', enc: 'mail_refresh_token_enc' },
  { plain: 'jobber_access_token', enc: 'jobber_access_token_enc' },
  { plain: 'jobber_refresh_token', enc: 'jobber_refresh_token_enc' },
  { plain: 'servicetitan_client_secret', enc: 'servicetitan_client_secret_enc' },
  { plain: 'servicetitan_access_token', enc: 'servicetitan_access_token_enc' },
  { plain: 'housecall_access_token', enc: 'housecall_access_token_enc' },
  { plain: 'housecall_refresh_token', enc: 'housecall_refresh_token_enc' },
] as const;

export type OrgSecretPlainField = (typeof ORG_SECRET_FIELD_PAIRS)[number]['plain'];
export type OrgSecretEncField = (typeof ORG_SECRET_FIELD_PAIRS)[number]['enc'];

function getVaultKeyHex(): string {
  const keyHex = process.env.VAULT_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'VAULT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) to encrypt org secrets.',
    );
  }
  return keyHex;
}

export function isEncryptedOrgSecret(value: string): boolean {
  return ENCRYPTED_ORG_SECRET_RE.test(value);
}

export function encryptOrgSecret(plaintext: string): string {
  const key = Buffer.from(getVaultKeyHex(), 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptWithKeyHex(encrypted: string, keyHex: string): string {
  const colonIdx1 = encrypted.indexOf(':');
  const colonIdx2 = encrypted.indexOf(':', colonIdx1 + 1);
  const ivHex = encrypted.slice(0, colonIdx1);
  const tagHex = encrypted.slice(colonIdx1 + 1, colonIdx2);
  const ciphertextHex = encrypted.slice(colonIdx2 + 1);

  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ciphertextHex, 'hex')) + decipher.final('utf8');
}

/**
 * Decrypts an org secret column value. Returns legacy plaintext unchanged
 * during cutover (before plaintext columns are dropped).
 */
export function decryptOrgSecret(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;
  if (!isEncryptedOrgSecret(stored)) return stored;

  const primaryKeyHex = getVaultKeyHex();
  try {
    return decryptWithKeyHex(stored, primaryKeyHex);
  } catch {
    const rotationKeyHex = process.env.VAULT_ENCRYPTION_KEY_OLD;
    if (rotationKeyHex && rotationKeyHex.length === 64) {
      return decryptWithKeyHex(stored, rotationKeyHex);
    }
    throw new Error('decryptOrgSecret: failed to decrypt with current or rotation key');
  }
}

export function readOrgSecret(
  row: Record<string, string | null | undefined> | null | undefined,
  plainField: OrgSecretPlainField,
): string | null {
  if (!row) return null;
  const pair = ORG_SECRET_FIELD_PAIRS.find((p) => p.plain === plainField);
  if (!pair) return null;
  const encValue = row[pair.enc];
  if (encValue) return decryptOrgSecret(encValue);
  return row[pair.plain] ?? null;
}

export function isOrgSecretConfigured(
  row: Record<string, string | null | undefined> | null | undefined,
  plainField: OrgSecretPlainField,
): boolean {
  if (!row) return false;
  const pair = ORG_SECRET_FIELD_PAIRS.find((p) => p.plain === plainField);
  if (!pair) return false;
  return !!(row[pair.enc] || row[pair.plain]);
}

/** Build a DB update payload: encrypted column set, plaintext column cleared. */
export function writeOrgSecretField(
  plainField: OrgSecretPlainField,
  plaintext: string | null | undefined,
): Record<string, string | null> {
  const pair = ORG_SECRET_FIELD_PAIRS.find((p) => p.plain === plainField);
  if (!pair) return {};
  if (plaintext == null || plaintext === '') {
    return { [pair.enc]: null, [pair.plain]: null };
  }
  return {
    [pair.enc]: encryptOrgSecret(plaintext),
    [pair.plain]: null,
  };
}

export function mergeOrgSecretWrites(
  writes: Record<string, string | null | undefined>,
): Record<string, string | null> {
  const merged: Record<string, string | null> = {};
  for (const pair of ORG_SECRET_FIELD_PAIRS) {
    if (pair.plain in writes) {
      Object.assign(merged, writeOrgSecretField(pair.plain, writes[pair.plain]));
    }
  }
  return merged;
}

export function orgSecretSelectColumns(): string {
  return ORG_SECRET_FIELD_PAIRS.flatMap((p) => [p.plain, p.enc]).join(', ');
}

export function orgSecretEncColumns(): readonly OrgSecretEncField[] {
  return ORG_SECRET_FIELD_PAIRS.map((p) => p.enc);
}

export function orgSecretPlainColumns(): readonly OrgSecretPlainField[] {
  return ORG_SECRET_FIELD_PAIRS.map((p) => p.plain);
}

/** Attach decrypted plaintext secret fields onto a DB row (in-memory only). */
export function hydrateOrgSecretFields<T extends Record<string, unknown>>(row: T): T {
  const hydrated = { ...row } as T;
  for (const { plain } of ORG_SECRET_FIELD_PAIRS) {
    (hydrated as Record<string, unknown>)[plain] = readOrgSecret(
      row as Record<string, string | null | undefined>,
      plain,
    );
  }
  return hydrated;
}

/** True when encrypted column is set (does not decrypt). */
export function hasOrgSecretEnc(
  row: Record<string, string | null | undefined> | null | undefined,
  plainField: OrgSecretPlainField,
): boolean {
  if (!row) return false;
  const pair = ORG_SECRET_FIELD_PAIRS.find((p) => p.plain === plainField);
  return !!(pair && row[pair.enc]);
}

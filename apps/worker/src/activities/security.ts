/**
 * backend/workflows/activities/security.ts
 * PII redaction activity — must run BEFORE any text reaches an LLM.
 */

import {
  log,
  encryptVault,
  decryptVault,
} from './shared.js';
import {
  redact,
  serializeVault,
  deserializeVault,
} from '../../../../packages/security/src/redactor.js';

// ============================================================
// ACTIVITY: redactInboundActivity
// ============================================================

export async function redactInboundActivity(params: {
  rawText:                  string;
  existingVaultSerialized?: string;
}): Promise<{ redactedText: string; vaultSerialized: string; matchCount: number }> {

  const existingVault = params.existingVaultSerialized
    ? deserializeVault(decryptVault(params.existingVaultSerialized))
    : undefined;

  const { redactedText, vault, matchCount, typesDetected } = redact(params.rawText, existingVault);

  if (matchCount > 0) {
    log.info({ matchCount, typesDetected }, 'redactInbound: PII detected and masked');
  }

  return {
    redactedText,
    vaultSerialized: encryptVault(serializeVault(vault)), // PII encrypted before entering Temporal state
    matchCount,
  };
}


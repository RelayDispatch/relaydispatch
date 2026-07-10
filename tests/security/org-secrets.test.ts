import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptOrgSecret,
  decryptOrgSecret,
  isEncryptedOrgSecret,
  readOrgSecret,
  writeOrgSecretField,
  isOrgSecretConfigured,
  hydrateOrgSecretFields,
} from '../../packages/security/src/orgSecrets.ts';

const TEST_KEY = 'cc2df5bd177d37b8e2f3c20c54278818d4071bee82f7c704322ca863224155b2';

describe('orgSecrets', () => {
  beforeEach(() => {
    process.env.VAULT_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.VAULT_ENCRYPTION_KEY_OLD;
  });

  it('encrypts and decrypts round-trip', () => {
    const enc = encryptOrgSecret('my-secret-token');
    expect(isEncryptedOrgSecret(enc)).toBe(true);
    expect(decryptOrgSecret(enc)).toBe('my-secret-token');
  });

  it('passes through legacy plaintext during cutover', () => {
    expect(decryptOrgSecret('legacy-plaintext-token')).toBe('legacy-plaintext-token');
  });

  it('readOrgSecret prefers encrypted shadow column', () => {
    const enc = encryptOrgSecret('from-enc');
    const row = {
      twilio_auth_token: 'from-plain',
      twilio_auth_token_enc: enc,
    };
    expect(readOrgSecret(row, 'twilio_auth_token')).toBe('from-enc');
  });

  it('writeOrgSecretField stores encrypted value and clears plaintext', () => {
    const update = writeOrgSecretField('mail_access_token', 'oauth-access');
    expect(update.mail_access_token).toBeNull();
    expect(isEncryptedOrgSecret(update.mail_access_token_enc!)).toBe(true);
    expect(decryptOrgSecret(update.mail_access_token_enc)).toBe('oauth-access');
  });

  it('isOrgSecretConfigured detects enc without decrypting', () => {
    const enc = encryptOrgSecret('x');
    expect(isOrgSecretConfigured({ twilio_auth_token_enc: enc }, 'twilio_auth_token')).toBe(true);
    expect(isOrgSecretConfigured({}, 'twilio_auth_token')).toBe(false);
  });

  it('hydrateOrgSecretFields attaches decrypted plaintext fields in memory', () => {
    const enc = encryptOrgSecret('hydrated');
    const hydrated = hydrateOrgSecretFields({
      id: 'org-1',
      jobber_access_token_enc: enc,
    });
    expect(hydrated.jobber_access_token).toBe('hydrated');
  });
});

#!/usr/bin/env node
/**
 * Encrypt org integration secrets into shadow *_enc columns and clear plaintext.
 *
 * Run after applying 20260710120000_org_secrets_shadow_columns.sql:
 *   node scripts/migrate-org-secrets-cutover.mjs
 *
 * Idempotent: skips rows where enc is already set or plaintext is null.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  ORG_SECRET_FIELD_PAIRS,
  encryptOrgSecret,
  isEncryptedOrgSecret,
} from '../packages/security/src/orgSecrets.ts';

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const selectCols = [
  'id',
  'name',
  'org_secrets_cutover_completed_at',
  ...ORG_SECRET_FIELD_PAIRS.flatMap((p) => [p.plain, p.enc]),
].join(', ');

async function main() {
  const { data: orgs, error } = await sb.from('organizations').select(selectCols);
  if (error) throw error;

  let migrated = 0;
  let skipped = 0;

  for (const org of orgs ?? []) {
    const updates = {};
    let changed = false;

    for (const { plain, enc } of ORG_SECRET_FIELD_PAIRS) {
      const plaintext = org[plain];
      const existingEnc = org[enc];

      if (!plaintext) continue;
      if (existingEnc && isEncryptedOrgSecret(existingEnc)) continue;

      updates[enc] = encryptOrgSecret(plaintext);
      updates[plain] = null;
      changed = true;
    }

    if (!changed) {
      skipped++;
      if (!org.org_secrets_cutover_completed_at) {
        await sb
          .from('organizations')
          .update({ org_secrets_cutover_completed_at: new Date().toISOString() })
          .eq('id', org.id);
      }
      continue;
    }

    updates.org_secrets_cutover_completed_at = new Date().toISOString();
    updates.updated_at = new Date().toISOString();

    const { error: updateErr } = await sb.from('organizations').update(updates).eq('id', org.id);
    if (updateErr) {
      console.error(`Failed to migrate org ${org.id} (${org.name}):`, updateErr.message);
      process.exit(1);
    }

    migrated++;
    console.log(`✅ Migrated secrets for org ${org.id} (${org.name})`);
  }

  console.log(`\nCutover complete. Migrated: ${migrated}, already done: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

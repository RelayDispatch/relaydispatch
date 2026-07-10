#!/usr/bin/env node
/**
 * Apply manual migration to drop plaintext org secret columns.
 *
 * Requires explicit confirmation flag — never runs automatically.
 *
 *   node scripts/drop-org-secrets-plaintext-columns.mjs \
 *     --confirm-drop-plaintext-secrets I_UNDERSTAND_THIS_IS_IRREVERSIBLE
 *
 * Requires `psql` on PATH and DATABASE_URL (or SUPABASE_DB_URL).
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM_FLAG = 'I_UNDERSTAND_THIS_IS_IRREVERSIBLE';
const SQL_PATH = path.join(
  __dirname,
  '../supabase/migrations/manual/20260710120100_org_secrets_drop_plaintext_columns.sql',
);

function parseArgs(argv) {
  const idx = argv.indexOf('--confirm-drop-plaintext-secrets');
  return idx >= 0 ? argv[idx + 1] : null;
}

function main() {
  const confirmation = parseArgs(process.argv.slice(2));
  if (confirmation !== CONFIRM_FLAG) {
    console.error(
      'Refusing to run. Pass --confirm-drop-plaintext-secrets I_UNDERSTAND_THIS_IS_IRREVERSIBLE',
    );
    process.exit(1);
  }

  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.SUPABASE_DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      'DATABASE_URL (or SUPABASE_DB_URL) is required to apply the drop migration.',
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const tmpFile = path.join(__dirname, '../.tmp-drop-org-secrets.sql');
  fs.writeFileSync(tmpFile, sql);

  try {
    console.log('Applying manual drop migration via psql...');
    execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${tmpFile}"`, {
      stdio: 'inherit',
      shell: true,
    });
    console.log('✅ Plaintext org secret columns dropped successfully.');
  } catch (err) {
    console.error('Failed to apply drop migration. Ensure psql is installed and DATABASE_URL is correct.');
    process.exit(1);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

main();

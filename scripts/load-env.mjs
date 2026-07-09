// Tiny helper — loads .env before any other import in .mjs scripts
// (dotenv/config is CJS; in ESM modules we use this shim instead)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function createDotenv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key   = trimmed.slice(0, eqIdx).trim();
      // Strip trailing inline comment (e.g. value  # comment)
      const rawVal = trimmed.slice(eqIdx + 1).trim();
      const val    = rawVal.split(/\s+#/)[0].trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on actual environment
  }
}

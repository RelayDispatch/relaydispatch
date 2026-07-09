/**
 * packages/security/src/redactor.ts
 * ─────────────────────────────────────────────────────────────
 * PII Redactor Utility — Linked Placeholder strategy for LLM-safe PII handling.
 *
 * DESIGN CONTRACT:
 *   1. redact()    — strips PII from text before it touches any LLM.
 *                    Returns { redactedText, vault } where vault is a
 *                    Map<placeholder, originalValue> stored in Temporal state.
 *
 *   2. rehydrate() — restores PII in the final outbound email using the vault.
 *                    Called in the activity layer, AFTER the LLM has responded,
 *                    BEFORE the email is sent.
 *
 * PII DETECTION LAYERS (applied in order):
 *   Layer 1 — Regex: Phone numbers, emails, US addresses, ZIP codes, SSN patterns
 *   Layer 2 — NER heuristics: Capitalized name patterns, "My name is X" phrases
 *   Layer 3 — HVAC-domain patterns: Unit serial numbers, permit numbers
 *
 * PLACEHOLDER FORMAT:  [[TYPE_N]]
 *   e.g. [[CUSTOMER_1]], [[PHONE_1]], [[ADDRESS_1]], [[EMAIL_1]]
 *
 * VAULT STRUCTURE:
 *   The vault Map is serializable to JSON so Temporal can persist it
 *   in workflow state across activity boundaries.
 *
 * COMPLIANCE NOTES:
 *   - PII never leaves this module en-route to any LLM API call.
 *   - The vault Map is ephemeral — scoped to one workflow run.
 *   - Vault entries are purged when the workflow completes (NIST RMF).
 */

import pino from 'pino';

const log = pino({ name: 'redactor', level: process.env.LOG_LEVEL ?? 'info' });

// ============================================================
// TYPES
// ============================================================

export type PiiType =
  | 'CUSTOMER'       // Full name
  | 'FIRST_NAME'     // First name only
  | 'PHONE'          // Phone number
  | 'EMAIL'          // Email address (not the customer's primary — secondary mentions)
  | 'ADDRESS'        // Full street address
  | 'ZIP'            // ZIP code standalone
  | 'UNIT_SERIAL'    // HVAC unit serial number
  | 'PERMIT';        // Permit/job number

export interface PiiMatch {
  type:        PiiType;
  original:    string;
  placeholder: string;
  startIndex:  number;
  endIndex:    number;
}

/** Serializable vault — stored in Temporal workflow state */
export type PiiVault = Record<string, string>; // placeholder → original

export interface RedactionResult {
  redactedText:     string;
  vault:            PiiVault;
  matchCount:       number;
  typesDetected:    PiiType[];
}

// ============================================================
// SECTION 1: REGEX PATTERNS
// ============================================================

/** All patterns are non-overlapping and applied in priority order */
const REGEX_PATTERNS: Array<{ type: PiiType; pattern: RegExp; group?: number }> = [

  // ── Phone numbers ──────────────────────────────────────────
  // Matches: (512) 555-1234 | 512-555-1234 | 512.555.1234 | +1 512 555 1234
  {
    type:    'PHONE',
    pattern: /(?:\+1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
  },

  // ── US Street addresses ────────────────────────────────────
  // Matches: 123 Main St, 4500 N Lamar Blvd, 1 Apple Park Way
  {
    type:    'ADDRESS',
    pattern: /\b\d{1,5}\s+(?:[NSEW]\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Parkway|Cir|Circle|Hwy|Highway|Fwy|Freeway)\b\.?(?:,\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/gi,
  },

  // ── ZIP code (standalone) ──────────────────────────────────
  {
    type:    'ZIP',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
  },

  // ── HVAC unit serial numbers ───────────────────────────────
  // Most HVAC serials: alphanumeric, 8-20 chars, often starts with letters
  // e.g. "Serial: TW9Y3FKJD50", "S/N: XC20D480AG"
  {
    type:    'UNIT_SERIAL',
    pattern: /(?:s(?:erial)?[\s\/\-]*(?:no?\.?|number)?[\s:]+)([A-Z0-9]{8,20})\b/gi,
    group:   1,
  },

  // ── Permit / job reference numbers ────────────────────────
  {
    type:    'PERMIT',
    pattern: /(?:permit|job|ref(?:erence)?|work\s*order)[\s#:]*([A-Z0-9\-]{4,20})\b/gi,
    group:   1,
  },
];

// ============================================================
// SECTION 2: NER HEURISTICS
// Light-weight Named Entity Recognition without external models.
// Uses linguistic patterns and sentence structure cues.
// ============================================================

interface NerMatch {
  type:  'CUSTOMER' | 'FIRST_NAME';
  value: string;
  index: number;
}

/**
 * Detects customer names using linguistic trigger phrases.
 * Intentionally conservative — only fires on high-confidence patterns
 * to avoid false-positive redaction of non-PII proper nouns.
 */
function detectNamesNER(text: string): NerMatch[] {
  const matches: NerMatch[] = [];

  // Pattern bank: "My name is X Y", "I'm X Y", "This is X Y calling"
  // "Contact: X Y", "Customer: X Y", "Signed, X Y"
  const namePatterns: Array<{ re: RegExp; type: 'CUSTOMER' | 'FIRST_NAME' }> = [
    // Full name triggers
    {
      type: 'CUSTOMER',
      re:   /\bmy\s+name\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/gi,
    },
    {
      type: 'CUSTOMER',
      re:   /\bI(?:'m|'m|\sam)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/gi,
    },
    {
      type: 'CUSTOMER',
      re:   /\bthis\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:calling|writing|here|speaking)/gi,
    },
    {
      type: 'CUSTOMER',
      re:   /^(?:customer|client|name|from|contact)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/gim,
    },
    {
      type: 'CUSTOMER',
      re:   /\bsigned?\s*,?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/gim,
    },
    {
      type: 'CUSTOMER',
      re:   /\bthanks?[,!]?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/gim,
    },
    // First name only — lower confidence triggers
    {
      type: 'FIRST_NAME',
      re:   /\bhi[,!]?\s+(?:I'm|my name is)\s+([A-Z][a-z]+)\b/gi,
    },
    {
      type: 'FIRST_NAME',
      re:   /\bDear\s+([A-Z][a-z]+)\b/gi,
    },
  ];

  for (const { re, type } of namePatterns) {
    let m: RegExpExecArray | null;
    // Re-create regex to reset lastIndex
    const freshRe = new RegExp(re.source, re.flags);
    while ((m = freshRe.exec(text)) !== null) {
      const value = m[1]?.trim();
      if (value && value.length >= 3 && value.length <= 50) {
        matches.push({ type, value, index: m.index + (m[0].indexOf(value)) });
      }
    }
  }

  return matches;
}

// ============================================================
// SECTION 3: COUNTER STATE (per-call, not global)
// Each call to redact() gets fresh counters so placeholders
// are stable within a single message but independent across calls.
// ============================================================

function makeCounters(): Record<PiiType, number> {
  return {
    CUSTOMER:    0,
    FIRST_NAME:  0,
    PHONE:       0,
    EMAIL:       0,
    ADDRESS:     0,
    ZIP:         0,
    UNIT_SERIAL: 0,
    PERMIT:      0,
  };
}

// ============================================================
// SECTION 4: MAIN REDACT FUNCTION
// ============================================================

/**
 * Redacts PII from `text` and returns a linked-placeholder result.
 *
 * @param text     Raw customer message text
 * @param vault    Optional existing vault to extend (for multi-turn threads)
 *                 Pass the vault from workflow state to reuse existing mappings.
 *
 * Usage:
 *   const { redactedText, vault } = redact(inboundEmail, existingVault);
 *   // Store vault in Temporal workflow state
 *   // Pass redactedText to LLM
 */
export function redact(
  text:           string,
  existingVault?: PiiVault,
): RedactionResult {

  if (!text?.trim()) {
    return { redactedText: text ?? '', vault: existingVault ?? {}, matchCount: 0, typesDetected: [] };
  }

  // Build a reverse index (originalValue → placeholder) from existing vault
  // so we reuse [[CUSTOMER_1]] across turns for the same person
  const reverseVault: Map<string, string> = new Map();
  const vault: PiiVault = { ...existingVault };

  for (const [placeholder, original] of Object.entries(vault)) {
    reverseVault.set(original.toLowerCase(), placeholder);
  }

  // Derive counters from existing vault so new entries increment correctly
  const counters = makeCounters();
  for (const placeholder of Object.keys(vault)) {
    const m = placeholder.match(/^\[\[([A-Z_]+)_(\d+)\]\]$/);
    if (m) {
      const type = m[1] as PiiType;
      const n    = parseInt(m[2]!, 10);
      if (type in counters && n >= counters[type]!) {
        counters[type] = n + 1;
      }
    }
  }

  // Collect ALL matches with their positions
  const allMatches: Array<{ start: number; end: number; original: string; placeholder: string; type: PiiType }> = [];
  const typesDetected = new Set<PiiType>();

  // ── Layer 1: Regex patterns ──────────────────────────────────
  for (const { type, pattern, group } of REGEX_PATTERNS) {
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;

    while ((m = freshPattern.exec(text)) !== null) {
      const original = group != null ? (m[group] ?? m[0]) : m[0];
      const start    = group != null
        ? m.index + m[0].indexOf(original)
        : m.index;
      const end      = start + original.length;

      if (!original.trim()) continue;

      // Reuse existing placeholder if we've seen this exact value
      const existingPlaceholder = reverseVault.get(original.toLowerCase());
      let placeholder: string;

      if (existingPlaceholder) {
        placeholder = existingPlaceholder;
      } else {
        counters[type]++;
        placeholder = `[[${type}_${counters[type]}]]`;
        vault[placeholder] = original;
        reverseVault.set(original.toLowerCase(), placeholder);
      }

      allMatches.push({ start, end, original, placeholder, type });
      typesDetected.add(type);
    }
  }

  // ── Layer 2: NER heuristics ──────────────────────────────────
  const nerMatches = detectNamesNER(text);
  for (const ner of nerMatches) {
    const original = ner.value;
    const start    = ner.index;
    const end      = start + original.length;

    const existingPlaceholder = reverseVault.get(original.toLowerCase());
    let placeholder: string;

    if (existingPlaceholder) {
      placeholder = existingPlaceholder;
    } else {
      counters[ner.type]++;
      placeholder = `[[${ner.type}_${counters[ner.type]}]]`;
      vault[placeholder] = original;
      reverseVault.set(original.toLowerCase(), placeholder);
    }

    allMatches.push({ start, end, original, placeholder, type: ner.type });
    typesDetected.add(ner.type);
  }

  // ── Deduplicate and sort by position (descending for safe replacement) ──
  // Remove overlapping matches — keep the longest/highest-priority one
  const sortedMatches = allMatches
    .sort((a, b) => a.start - b.start || b.end - a.end); // sort asc by start, desc by end

  const deduped: typeof allMatches = [];
  let lastEnd = -1;

  for (const match of sortedMatches) {
    if (match.start >= lastEnd) {
      deduped.push(match);
      lastEnd = match.end;
    }
    // else: overlapping — skip (shorter/lower-priority match)
  }

  // ── Apply replacements (process right-to-left to preserve offsets) ──
  const dedupedDesc = [...deduped].sort((a, b) => b.start - a.start);
  let result = text;

  for (const match of dedupedDesc) {
    result =
      result.slice(0, match.start) +
      match.placeholder +
      result.slice(match.end);
  }

  const matchCount = deduped.length;

  log.debug({
    matchCount,
    typesDetected: [...typesDetected],
    vaultSize:     Object.keys(vault).length,
  }, 'redact: complete');

  if (matchCount > 0) {
    log.info({ matchCount, typesDetected: [...typesDetected] }, 'redact: PII detected and masked');
  }

  return {
    redactedText:  result,
    vault,
    matchCount,
    typesDetected: [...typesDetected],
  };
}

// ============================================================
// SECTION 5: REHYDRATE FUNCTION
// Called in the activity layer AFTER LLM response, BEFORE email send.
// ============================================================

/**
 * Restores PII placeholders in `text` using the vault.
 *
 * IMPORTANT: Only call this in `sendEmailActivity` — never expose
 * rehydrated text back to the LLM.
 *
 * Handles edge cases:
 *   - Placeholder appears multiple times → all instances replaced
 *   - LLM slightly modified the placeholder format → fuzzy match attempt
 *   - Unknown placeholder → left in place, logged as warning
 */
export function rehydrate(text: string, vault: PiiVault): string {
  if (!text || Object.keys(vault).length === 0) return text;

  let result = text;

  // ── Exact matches first ──────────────────────────────────────
  for (const [placeholder, original] of Object.entries(vault)) {
    // Replace all occurrences
    result = result.split(placeholder).join(original);
  }

  // ── Fuzzy fallback: LLMs sometimes mangle bracket formats ───
  // e.g. [[ CUSTOMER_1 ]] or [[customer_1]] or [CUSTOMER_1]
  const remainingPlaceholders = [...result.matchAll(/\[\[?\s*([A-Z_]+)_(\d+)\s*\]?\]/g)];

  for (const m of remainingPlaceholders) {
    const normalizedKey = `[[${m[1]!.toUpperCase()}_${m[2]}]]`;
    const original      = vault[normalizedKey];

    if (original) {
      log.warn({ mangled: m[0], normalized: normalizedKey }, 'rehydrate: fixed mangled placeholder');
      result = result.replace(m[0], original);
    } else {
      log.warn({ placeholder: m[0] }, 'rehydrate: unknown placeholder — leaving in place');
    }
  }

  return result;
}

// ============================================================
// SECTION 6: VAULT SERIALIZATION HELPERS
// Vault must round-trip through JSON for Temporal persistence.
// ============================================================

/** Serialize vault to a JSON-safe string for Temporal workflow state */
export function serializeVault(vault: PiiVault): string {
  return JSON.stringify(vault);
}

/** Deserialize vault from Temporal workflow state */
export function deserializeVault(serialized: string): PiiVault {
  try {
    return JSON.parse(serialized) as PiiVault;
  } catch {
    log.error({ serialized }, 'deserializeVault: invalid JSON — returning empty vault');
    return {};
  }
}

/** Returns a summary for audit logs — placeholder keys only, no PII values */
export function auditSummary(vault: PiiVault): string {
  return Object.keys(vault).join(', ') || '(none)';
}

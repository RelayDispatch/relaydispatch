/**
 * packages/ai/librarian/src/index.ts
 * ─────────────────────────────────────────────────────────────
 * RelayDispatch — Librarian Agent ("The Context Compaction Engine")
 *
 * Responsibilities:
 *   1. Maintain a token-aware conversation history for each thread.
 *   2. Trigger compaction when the total thread history exceeds 150,000 tokens.
 *   3. Produce a "Current State Summary" using Gemini 3.1 Flash-Lite.
 *   4. Return a CompactedContext to the Dispatcher: the summary + last 3 raw turns.
 *
 * COMPACTION STRATEGY:
 *   Full history:     [T1, T2, T3, T4, T5, T6, T7, T8]
 *   After compaction: [SUMMARY(T1-T5), T6, T7, T8]  ← always keep last 3
 *
 * TOKEN COUNTING:
 *   Uses a fast approximation (chars / 4) to avoid a round-trip to a tokenizer
 *   API for every message. The 150k threshold has a 10% safety margin baked in
 *   (effective trigger: 135k) to account for approximation variance.
 *
 * COMPACTION PROMPT DESIGN:
 *   The summarizer is instructed to preserve:
 *     - Equipment details (brand, model, serial, age)
 *     - Customer sentiment arc (started frustrated → now cooperative)
 *     - Commitments made (quote given: $89 diagnostic)
 *     - Open questions / unresolved issues
 *     - PII placeholder references (e.g. [[CUSTOMER_1]]) — NOT original PII
 *
 * COMPLIANCE:
 *   All text passed to Gemini has already been redacted by redactor.ts.
 *   The Librarian receives and returns redacted text ONLY.
 */

import OpenAI from 'openai';
import pino from 'pino';

const log = pino({ name: 'agent:librarian', level: process.env.LOG_LEVEL ?? 'info' });

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_BASE_URL ?? 'https://relaydispatch.org',
    'X-Title':      `${process.env.AGENT_BRAND ?? 'RelayDispatch'} Librarian`,
  },
});

// ============================================================
// TYPES
// ============================================================

export interface RawTurn {
  role:       'customer' | 'dispatcher_ai' | 'human_agent';
  content:    string;             // Always redacted (PII replaced with placeholders)
  timestamp:  string;
  messageId?: string;
  tokenCount?: number;            // Cached approximate token count
}

export interface CompactedHistory {
  /** Gemini-generated high-density summary of early turns */
  summary:              string | null;
  /** ISO timestamp of the last turn included in the summary */
  summaryCoversUntil:   string | null;
  /** Number of turns compacted into the summary */
  summarizedTurnCount:  number;
  /** The last N raw turns (always preserved verbatim) */
  rawTailTurns:         RawTurn[];
  /** Total approximate tokens in current context window */
  totalTokens:          number;
  /** Whether compaction has been triggered at least once */
  wasCompacted:         boolean;
  /** How many times compaction has run (for audit) */
  compactionCount:      number;
}

export interface CompactedContext {
  /**
   * What the Dispatcher receives — ready to inject directly into
   * the Claude system prompt as conversation history.
   */
  systemContextBlock: string;

  /** Last 3 raw turns as structured objects (for message array building) */
  tailTurns: RawTurn[];

  /** Metadata for audit logging */
  meta: {
    wasCompacted:    boolean;
    totalTokens:     number;
    compactionCount: number;
    summaryTokens:   number;
    tailTokens:      number;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

const TOKEN_LIMIT          = 150_000;
const COMPACTION_THRESHOLD = TOKEN_LIMIT * 0.9;  // 135,000 tokens
const RAW_TAIL_SIZE        = 3;
const CHARS_PER_TOKEN      = 4;

// ============================================================
// SECTION 1: TOKEN ESTIMATION
// ============================================================

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function totalHistoryTokens(turns: RawTurn[]): number {
  return turns.reduce((sum, turn) => {
    const tokens = turn.tokenCount ?? estimateTokens(turn.content);
    return sum + tokens;
  }, 0);
}

// ============================================================
// SECTION 2: COMPACTION PROMPT
// ============================================================

function buildCompactionPrompt(
  turnsToSummarize: RawTurn[],
  orgName:          string,
  serviceCategory:  string,
): string {
  const conversationText = turnsToSummarize
    .map((t) => {
      const label =
        t.role === 'customer'      ? '👤 CUSTOMER'     :
        t.role === 'dispatcher_ai' ? '🤖 AI DISPATCHER' :
        '👷 HUMAN AGENT';
      return `[${new Date(t.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' })}] ${label}:\n${t.content}`;
    })
    .join('\n\n---\n\n');

  return `You are a technical summarizer for ${orgName}, an HVAC service company.
Condense the following customer service conversation into a HIGH-DENSITY "Current State Summary."

SERVICE CATEGORY: ${serviceCategory}

CRITICAL INSTRUCTIONS:
1. PRESERVE all equipment details: brand, model number, serial number, age, symptoms.
2. PRESERVE all PII placeholders EXACTLY as written (e.g. [[CUSTOMER_1]], [[PHONE_1]], [[ADDRESS_1]]). Do NOT expand or alter them.
3. PRESERVE all commitments made: prices quoted, appointments scheduled, technicians assigned.
4. PRESERVE the customer's sentiment arc: e.g. "Started frustrated, became cooperative after quote."
5. PRESERVE all open questions / unresolved issues.
6. FORMAT: Use structured markdown with these exact sections:
   ## Equipment
   ## Issue Description
   ## Actions Taken & Commitments
   ## Customer Sentiment
   ## Open Items
7. Be DENSE — maximize information per token. No filler phrases.
8. Target length: 400-600 words.

CONVERSATION TO SUMMARIZE:
────────────────────────────────────────
${conversationText}
────────────────────────────────────────

Return ONLY the summary. No preamble, no "Here is the summary", no markdown fences.`;
}

// ============================================================
// SECTION 3: CORE COMPACTION ENGINE
// ============================================================

export async function processNewTurn(
  history:         CompactedHistory,
  newTurn:         RawTurn,
  orgName:         string,
  serviceCategory: string,
): Promise<CompactedHistory> {

  const annotatedTurn: RawTurn = {
    ...newTurn,
    tokenCount: estimateTokens(newTurn.content),
  };

  const updatedTail    = [...history.rawTailTurns, annotatedTurn];
  const summaryTokens  = history.summary ? estimateTokens(history.summary) : 0;
  const tailTokens     = totalHistoryTokens(updatedTail);
  const totalTokens    = summaryTokens + tailTokens;

  log.debug({
    totalTokens,
    threshold:    COMPACTION_THRESHOLD,
    tailLength:   updatedTail.length,
    wasCompacted: history.wasCompacted,
  }, 'librarian: token budget check');

  if (totalTokens < COMPACTION_THRESHOLD) {
    return { ...history, rawTailTurns: updatedTail, totalTokens };
  }

  log.info({
    totalTokens,
    threshold:       COMPACTION_THRESHOLD,
    tailLength:      updatedTail.length,
    compactionCount: history.compactionCount + 1,
  }, '🗜️  librarian: COMPACTION TRIGGERED');

  const turnsToSummarize = updatedTail.slice(0, -RAW_TAIL_SIZE);
  const newRawTail       = updatedTail.slice(-RAW_TAIL_SIZE);

  if (turnsToSummarize.length === 0) {
    log.warn('librarian: cannot compact — all turns are in protected tail');
    return { ...history, rawTailTurns: updatedTail, totalTokens };
  }

  const summarizeSubject: RawTurn[] = history.summary
    ? [
        {
          role:       'dispatcher_ai',
          content:    `[PREVIOUS SUMMARY (covers turns before ${history.summaryCoversUntil})]\n${history.summary}`,
          timestamp:  history.summaryCoversUntil ?? new Date().toISOString(),
          tokenCount: summaryTokens,
        },
        ...turnsToSummarize,
      ]
    : turnsToSummarize;

  let newSummary: string;
  const compactionStart = Date.now();

  try {
    const prompt   = buildCompactionPrompt(summarizeSubject, orgName, serviceCategory);
    const response = await openrouter.chat.completions.create({
      model:       'google/gemini-3.1-flash-lite-preview',
      max_tokens:  250,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });
    newSummary = response.choices[0]?.message?.content?.trim() ?? '';

    if (!newSummary) {
      throw new Error('Empty summary returned from Gemini');
    }
  } catch (err) {
    log.error({ err }, 'librarian: Gemini compaction failed — keeping raw history');
    return { ...history, rawTailTurns: updatedTail, totalTokens };
  }

  const compactionMs    = Date.now() - compactionStart;
  const newSummaryTokens = estimateTokens(newSummary);
  const newTailTokens   = totalHistoryTokens(newRawTail);

  log.info({
    compactionMs,
    summarizedTurns:  turnsToSummarize.length,
    oldSummaryTokens: summaryTokens,
    newSummaryTokens,
    compressionRatio: `${((summaryTokens + totalHistoryTokens(turnsToSummarize)) / newSummaryTokens).toFixed(1)}x`,
    newTailTokens,
    newTotalTokens:   newSummaryTokens + newTailTokens,
  }, '✅ librarian: compaction complete');

  const lastSummarizedTurn = turnsToSummarize[turnsToSummarize.length - 1];

  return {
    summary:             newSummary,
    summaryCoversUntil:  lastSummarizedTurn?.timestamp ?? null,
    summarizedTurnCount: history.summarizedTurnCount + turnsToSummarize.length,
    rawTailTurns:        newRawTail,
    totalTokens:         newSummaryTokens + newTailTokens,
    wasCompacted:        true,
    compactionCount:     history.compactionCount + 1,
  };
}

// ============================================================
// SECTION 4: CONTEXT BUILDER — output fed to Dispatcher
// ============================================================

export function buildDispatcherContext(history: CompactedHistory): CompactedContext {
  const sections: string[] = [];

  if (history.summary && history.wasCompacted) {
    sections.push(
      `╔══ COMPACTED HISTORY SUMMARY ══════════════════════════════╗`,
      `  (Covers ${history.summarizedTurnCount} earlier turns through ${history.summaryCoversUntil ? new Date(history.summaryCoversUntil).toLocaleDateString() : 'N/A'})`,
      `╚═══════════════════════════════════════════════════════════╝`,
      '',
      history.summary,
      '',
    );
  }

  if (history.rawTailTurns.length > 0) {
    const label = history.wasCompacted
      ? `╔══ RECENT RAW TURNS (last ${history.rawTailTurns.length}) ════════════════════════════════╗`
      : `╔══ CONVERSATION HISTORY ════════════════════════════════════╗`;

    sections.push(label, '');

    for (const turn of history.rawTailTurns) {
      const roleLabel =
        turn.role === 'customer'      ? 'CUSTOMER'      :
        turn.role === 'dispatcher_ai' ? 'AI DISPATCHER' :
        'HUMAN AGENT';
      const ts = new Date(turn.timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      sections.push(`[${ts}] ${roleLabel}:`);
      sections.push(turn.content);
      sections.push('');
    }

    sections.push(`╚═══════════════════════════════════════════════════════════╝`);
  }

  const systemContextBlock = sections.join('\n');
  const summaryTokens      = history.summary ? estimateTokens(history.summary) : 0;
  const tailTokens         = totalHistoryTokens(history.rawTailTurns);

  return {
    systemContextBlock,
    tailTurns: history.rawTailTurns,
    meta: {
      wasCompacted:    history.wasCompacted,
      totalTokens:     history.totalTokens,
      compactionCount: history.compactionCount,
      summaryTokens,
      tailTokens,
    },
  };
}

// ============================================================
// SECTION 5: INITIAL HISTORY FACTORY
// ============================================================

export function createInitialHistory(): CompactedHistory {
  return {
    summary:             null,
    summaryCoversUntil:  null,
    summarizedTurnCount: 0,
    rawTailTurns:        [],
    totalTokens:         0,
    wasCompacted:        false,
    compactionCount:     0,
  };
}

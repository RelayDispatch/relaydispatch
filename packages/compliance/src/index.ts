/**
 * packages/compliance/src/index.ts
 * ──────────────────────────────────
 * AI bot disclosure utilities (SB 243 / California BOT Act / EU AI Act Article 52 / NIST RMF).
 *
 * This module is the single source of truth for AI disclosure text.
 * It must be called on every outbound message — never inline the footer string.
 *
 * Agent identity is fully configurable via environment variables:
 *   AGENT_NAME  — name of the AI agent (default: "Dispatch")
 *   AGENT_BRAND — brand name in disclosure (default: "RelayDispatch")
 *
 * Per-org custom disclosure text is passed in from the organizations table
 * (sb243_footer column). The env var defaults are used when no per-org text is set.
 *
 * Note: "SB 243" is used internally as shorthand for bot disclosure requirements.
 */

/** Default disclosure text. Overridden per-org via organizations.sb243_footer. */
function buildDefaultDisclosure(): string {
  const agentName  = process.env.AGENT_NAME  ?? 'Dispatch';
  const agentBrand = process.env.AGENT_BRAND ?? 'RelayDispatch';
  return `${agentName} is an AI Service Coordinator — Powered by ${agentBrand}`;
}

/**
 * Returns the plain-text SB 243 footer line.
 * Used in: email plain-text body, SMS messages, API responses.
 */
export function buildComplianceFooter(
  customText?: string,
): string {
  return customText ?? buildDefaultDisclosure();
}

/**
 * Returns a plain-text disclosure header block.
 * Used at the TOP of every outbound email.
 */
export function buildComplianceHeader(
  customText?: string,
): string {
  const text = customText ?? buildDefaultDisclosure();
  return [
    '─'.repeat(60),
    `⚠ AI DISCLOSURE: ${text}`,
    '─'.repeat(60),
  ].join('\n');
}

/**
 * Wraps a message body with the full SB 243 header + footer.
 * This is the canonical way to produce a compliant email.
 */
export function wrapWithCompliance(
  body: string,
  customText?: string,
): { plainText: string; htmlWrapper: string } {
  const text = customText ?? buildDefaultDisclosure();

  const plainText = [
    buildComplianceHeader(text),
    '',
    body.trim(),
    '',
    buildComplianceFooter(text),
  ].join('\n');

  const htmlWrapper = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- AI DISCLOSURE HEADER — Required by SB 243 / NIST RMF — DO NOT REMOVE -->
  <div style="
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    padding: 10px 14px;
    margin-bottom: 20px;
    border-radius: 0 4px 4px 0;
  ">
    <p style="margin: 0; font-size: 12px; color: #1e40af; font-weight: 500;">
      ℹ️ AI Disclosure: ${text}
    </p>
  </div>

  <!-- MESSAGE BODY -->
  <div style="color: #1e293b; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">
${body.trim()}
  </div>

  <!-- AI DISCLOSURE FOOTER — Required by SB 243 / NIST RMF — DO NOT REMOVE -->
  <div style="
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
  ">
    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
      ${text}
    </p>
  </div>
</div>`.trim();

  return { plainText, htmlWrapper };
}

/**
 * Validates that a message body contains the required AI disclosure text.
 * Used in pre-send checks to catch compliance regressions.
 */
export function validateDisclosurePresence(
  messageBody: string,
  customText?: string,
): { compliant: boolean; missing: string[] } {
  const text = customText ?? buildDefaultDisclosure();
  const missing: string[] = [];

  if (!messageBody.toLowerCase().includes('ai')) {
    missing.push('Missing AI identification');
  }
  if (!messageBody.includes(text)) {
    missing.push(`Missing full disclosure text: "${text}"`);
  }

  return { compliant: missing.length === 0, missing };
}

/**
 * Generates a NIST RMF audit entry string for structured logging.
 */
export function buildNistAuditEntry(params: {
  agent: string;
  action: string;
  modelId: string;
  threadId: string;
  orgId: string;
  decision: string;
  confidence: number;
  flags: string[];
}): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    nist_control: 'GOVERN-1.1 / MANAGE-1.2',
    ...params,
  });
}

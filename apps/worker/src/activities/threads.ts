/**
 * backend/workflows/activities/threads.ts
 * Thread and contact management activities.
 */

import {
  log,
  supabase,
  decryptVault,
} from './shared.js';
import {
  redact,
  deserializeVault,
} from '../../../../packages/security/src/redactor.js';

// ============================================================
// ACTIVITY: updateThreadStatusActivity
// ============================================================

export async function updateThreadStatusActivity(
  threadId: string,
  status:   string,
  extras?:  Record<string, unknown>,
): Promise<void> {
  const dbPayload: Record<string, unknown> = { status, ...extras };

  // Map camelCase to snake_case for PostgreSQL
  if (extras) {
    if ('sentimentScore'    in extras) { dbPayload.sentiment_score    = extras.sentimentScore;    delete dbPayload.sentimentScore;    }
    if ('urgencyScore'      in extras) { dbPayload.urgency_score      = extras.urgencyScore;      delete dbPayload.urgencyScore;      }
    if ('serviceCategory'   in extras) { dbPayload.service_category   = extras.serviceCategory;   delete dbPayload.serviceCategory;   }
    if ('escalationReason'  in extras) { dbPayload.escalation_reason  = extras.escalationReason;  delete dbPayload.escalationReason;  }
  }

  const { data, error } = await supabase
    .from('threads')
    .update(dbPayload as any)
    .eq('id', threadId)
    .select('id');

  if (error) {
    throw new Error(`updateThreadStatus failed for ${threadId}: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`updateThreadStatus failed: Thread ${threadId} not found (zero rows updated)`);
  }
}

// ============================================================
// ACTIVITY: createOrUpdateContactActivity
// ============================================================

export async function createOrUpdateContactActivity(params: {
  orgId:    string;
  email:    string;
  name?:    string;
  threadId: string;
  existingVaultSerialized?: string;
}): Promise<void> {

  // Redact name before storing — contacts table has no erasure path.
  let firstName: string | undefined;
  let lastName:  string | undefined;

  if (params.name) {
    const existingVault = params.existingVaultSerialized
      ? deserializeVault(decryptVault(params.existingVaultSerialized))
      : undefined;

    const { redactedText } = redact(params.name, existingVault);
    const parts = redactedText.split(' ');
    firstName   = parts[0];
    lastName    = parts.slice(1).join(' ') || undefined;
  }

  const contactUpsertData = {
    org_id: params.orgId,
    email:  params.email,
    ...(firstName != null ? { first_name: firstName } : {}),
    ...(lastName  != null ? { last_name:  lastName  } : {}),
  };

  await supabase.from('contacts').upsert(
    contactUpsertData,
    { onConflict: 'org_id,email' },
  );

  const { data: contact } = await supabase
    .from('contacts').select('id')
    .eq('org_id', params.orgId).eq('email', params.email).single();

  if (contact) {
    await supabase.from('threads').update({ contact_id: contact.id }).eq('id', params.threadId);
  }
}

// ============================================================
// ACTIVITY: validateThreadExistsActivity
// Must be the FIRST activity in any workflow.
// Throws a non-retryable error if the thread is phantom —
// prevents LLM calls, email sends, and CRM jobs for bad webhooks.
// ============================================================

export async function validateThreadExistsActivity(threadId: string, orgId: string): Promise<void> {
  const { data, error } = await supabase
    .from('threads')
    .select('id, status')
    .eq('id', threadId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`validateThreadExists: DB error for thread ${threadId}: ${error.message}`);
  }

  if (!data) {
    const err = new Error(
      `PHANTOM_THREAD: Thread ${threadId} does not exist in org ${orgId}. ` +
      `Aborting workflow — no LLM call, no email sent, no cost incurred.`,
    );
    (err as any).type = 'PHANTOM_THREAD';
    log.error(
      { threadId, orgId, event: 'phantom_thread_detected' },
      'validateThreadExists: phantom thread — workflow aborted before any LLM call',
    );
    throw err;
  }

  log.info({ threadId, orgId, status: data.status }, 'validateThreadExists: thread confirmed');
}


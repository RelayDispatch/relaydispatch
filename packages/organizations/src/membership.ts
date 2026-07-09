/**
 * packages/organizations/src/membership.ts
 * ─────────────────────────────────────────
 * Organization membership resolution.
 * Extracted from the monolithic api/index.ts getUserOrgId().
 *
 * This module is responsible for resolving which organization a user belongs to,
 * with automatic bootstrapping for first-time users.
 */

import { createServiceSupabase } from '../../database/src/client.js';
import pino from 'pino';

const log = pino({ name: 'relay-orgs', level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Resolves the organization ID for a given Supabase user.
 *
 * Strategy:
 * 1. Look up org_members for this user → return org_id if found
 * 2. If no membership, find or create a default organization
 * 3. Insert an 'owner' membership row for this user
 *
 * This bootstrapping path exists for new self-hosted installations where
 * the first user has no org yet.
 *
 * @throws {Error} if membership cannot be resolved or created
 */
export async function getUserOrgId(user: { id: string }): Promise<string> {
  const serviceDb = createServiceSupabase();

  // 1. Look for existing membership
  const { data: membership, error: memErr } = await serviceDb
    .from('org_members' as never)
    .select('org_id')
    .eq('user_id' as never, user.id)
    .maybeSingle() as any;

  if (memErr) {
    log.error({ memErr, userId: user.id }, 'Failed to query org_members');
  }

  if (membership?.org_id) {
    return membership.org_id;
  }

  log.info({ userId: user.id }, 'No org membership found — bootstrapping user');

  // 2. Find or create a default organization
  const defaultOrgId = '00000000-0000-0000-0000-000000000001';
  const { data: defaultOrg } = await serviceDb
    .from('organizations' as never)
    .select('id')
    .eq('id', defaultOrgId)
    .maybeSingle() as any;

  let targetOrgId = defaultOrg?.id;

  if (!targetOrgId) {
    // Try any existing org first
    const { data: anyOrg } = await serviceDb
      .from('organizations' as never)
      .select('id')
      .limit(1)
      .maybeSingle() as any;

    if (anyOrg?.id) {
      targetOrgId = anyOrg.id;
    } else {
      // Create the default organization
      log.info('Creating default organization');
      const { data: newOrg, error: newOrgErr } = await serviceDb
        .from('organizations' as never)
        .insert({ id: defaultOrgId, name: 'Default Organization' } as never)
        .select('id')
        .single() as any;

      if (newOrgErr) {
        log.error({ newOrgErr }, 'Failed to bootstrap default organization');
        throw new Error('Failed to bootstrap default organization: ' + newOrgErr.message);
      }
      targetOrgId = newOrg.id;
    }
  }

  // 3. Insert owner membership for this user
  log.info({ targetOrgId, userId: user.id }, 'Inserting owner membership');
  const { error: insertErr } = await serviceDb
    .from('org_members' as never)
    .insert({ user_id: user.id, org_id: targetOrgId, role: 'owner' } as never) as any;

  if (insertErr && insertErr.code !== '23505') {
    // 23505 = unique_violation (race condition — another process created the row)
    log.error({ insertErr, userId: user.id, targetOrgId }, 'Failed to create org membership');
    throw new Error('Failed to create org membership: ' + insertErr.message);
  }

  return targetOrgId;
}

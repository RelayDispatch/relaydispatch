/**
 * apps/api/src/schemas/thread.schemas.ts
 * ────────────────────────────────────────
 * Zod schemas for thread management endpoints.
 * Extracted from the monolithic api/index.ts.
 */

import { z } from 'zod';

export const UpdateThreadSchema = z.object({
  status: z.enum([
    'new', 'triaged', 'quoted', 'scheduled',
    'in_progress', 'completed', 'escalated', 'closed',
  ]).optional(),
  priority:          z.enum(['low', 'normal', 'urgent', 'emergency']).optional(),
  assigned_to:       z.string().uuid().optional(),
  escalation_reason: z.string().max(500).optional(),
});

export const TakeoverSchema = z.object({
  agent_id:   z.string().uuid(),
  agent_name: z.string().min(1).max(100),
  reason:     z.string().min(1).max(500),
});

export const ResolveSchema = z.object({
  resolved_by:     z.string(),
  resolution_note: z.string().max(1000).optional(),
});

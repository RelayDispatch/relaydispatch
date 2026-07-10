/**
 * apps/api/src/schemas/intake.schemas.ts
 * ────────────────────────────────────────
 * Zod schemas for the email intake endpoints.
 * Extracted from the monolithic api/index.ts.
 */

import { z } from 'zod';

export const GmailPubSubSchema = z.object({
  message: z.object({
    data:        z.string(),
    messageId:   z.string(),
    publishTime: z.string(),
    attributes:  z.record(z.string()).optional(),
  }),
  subscription: z.string(),
});

export const GmailNotificationDataSchema = z.object({
  emailAddress: z.string().email(),
  historyId:    z.string(),
});

export const DirectIntakeSchema = z.object({
  from_email:  z.string().email(),
  from_name:   z.string().optional(),
  subject:     z.string().min(1).max(500),
  body_text:   z.string().min(1).max(50_000),
  body_html:   z.string().optional(),
  channel:     z.enum(['email', 'sms', 'web_form']).default('email'),
  phone:       z.string().optional(),
  external_id: z.string().optional(),
});

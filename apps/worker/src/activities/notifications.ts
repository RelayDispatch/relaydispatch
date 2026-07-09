/**
 * backend/workflows/activities/notifications.ts
 * Human escalation notification activity (Slack webhook).
 */

import {
  log,
  supabase,
  isActivityAlreadyCompleted,
  markActivityCompleted,
} from './shared.js';

// ============================================================
// ACTIVITY: notifyHumanAgentActivity
// ============================================================

export async function notifyHumanAgentActivity(params: {
  threadId:            string;
  orgId:               string;
  escalationReason:    string;
  customerEmail:       string;
  urgencyScore:        number;
  conversationSummary: string;
}): Promise<void> {
  log.warn(params, '🚨 ESCALATION: human agent notification');

  // @ts-ignore
  await supabase.from('threads').update({
    // @ts-ignore
    status:            'escalated',
    escalation_reason: params.escalationReason,
  }).eq('id', params.threadId);

  // ── Slack webhook — idempotency guarded ─────────────────────
  const slackKey = `slackNotify:${params.threadId}`;
  if (await isActivityAlreadyCompleted(slackKey)) {
    log.warn({ threadId: params.threadId }, 'notifyHumanAgent: Slack already sent — skipping duplicate');
    return;
  }

  const webhookUrl = process.env.SLACK_ESCALATION_WEBHOOK_URL;
  if (webhookUrl) {
    const isEmergency = params.urgencyScore >= 80;
    const emoji       = isEmergency ? '🚨' : '⚠️';
    const channel     = isEmergency ? '#escalations-emergency' : '#escalations';

    const slackPayload = {
      text:    `${emoji} *RelayDispatch Escalation* — Urgency ${params.urgencyScore}/100`,
      channel,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} AI Escalation — Action Required` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Thread ID:*\n${params.threadId}` },
            { type: 'mrkdwn', text: `*Urgency Score:*\n${params.urgencyScore}/100` },
            { type: 'mrkdwn', text: `*Customer:*\n${params.customerEmail}` },
            { type: 'mrkdwn', text: `*Reason:*\n${params.escalationReason}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Conversation Summary:*\n${params.conversationSummary.slice(0, 400)}`,
          },
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(slackPayload),
      });
      if (!res.ok) {
        log.warn({ status: res.status }, 'notifyHumanAgent: Slack webhook returned non-OK');
      } else {
        await markActivityCompleted(slackKey);
        log.info({ channel, urgencyScore: params.urgencyScore }, 'notifyHumanAgent: Slack notification sent');
      }
    } catch (slackErr) {
      // Non-fatal — Slack outage should not block the escalation itself
      log.error({ slackErr }, 'notifyHumanAgent: Slack webhook failed (non-fatal)');
    }
  } else {
    log.warn('notifyHumanAgent: SLACK_ESCALATION_WEBHOOK_URL not set — skipping Slack notification');
  }
}


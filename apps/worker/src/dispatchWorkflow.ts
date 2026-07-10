/**
 * Dispatch AI — Dispatch Workflow | RelayDispatch
 * ────────────────────────────────────────────────────────────
 * Temporal.io Durable Workflow v1.11.x
 *
 * This workflow manages the FULL lifecycle of a customer service
 * thread — from first email intake through scheduling, quoting,
 * and final resolution. It survives server restarts, crashes,
 * and network failures via Temporal's event-sourced execution.
 *
 * Architecture:
 *   Signals  → push inbound customer turns into the workflow
 *   Queries  → read current state without side effects
 *   Activities → all I/O (DB, LLM, Gmail, Twilio) — never in workflow code
 *
 * Compliance:
 *   - Every state transition is durably logged (NIST RMF audit trail)
 *   - SB 243 footer injection happens in the activity layer
 *   - Pricing is fetched in the activity layer — never in workflow deterministic code
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  workflowInfo,
  log as wfLog,
  ApplicationFailure,
  patched,          // Version guard — safe schema evolution for in-flight workflows
  continueAsNew,    // Temporal Continue-As-New — prevents history overflow in long runs
} from '@temporalio/workflow';

import type {
  ClassifiedRequest,
  DispatcherResult,
} from '../../../packages/ai/dispatcher/src/index.js';

// ============================================================
// ACTIVITY PROXIES
// All I/O must go through activities (Temporal's async boundary).
// ============================================================

// Import activity type shapes only — implementations live in activities.ts
import type * as Activities from './activities/index.js';

const {
  fetchEmailContent,
  classifyInboundRequest,
  runDispatcherActivity,
  sendReplyActivity,
  updateThreadStatusActivity,
  fetchOrgConfigActivity,
  fetchAvailableTechniciansActivity,
  createOrUpdateContactActivity,
  notifyHumanAgentActivity,
  redactInboundActivity,
  validateThreadExistsActivity,
  createJobActivity,
  dispatchJobActivity,
  emergencyPreFilterActivity,
  sendSmsAlertActivity,
  fetchDirectIntakeMessageActivity,
} = proxyActivities<typeof Activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    nonRetryableErrorTypes: [
      'COMPLIANCE_VIOLATION',
      'ORG_NOT_FOUND',
      'PHANTOM_THREAD',
    ],
  },
});

// ============================================================
// WORKFLOW NAME (used by API to start the workflow)
// ============================================================

export const DISPATCH_WORKFLOW_NAME = 'relayDispatchWorkflow';

/** @deprecated Use DISPATCH_WORKFLOW_NAME. Kept for backward compatibility during migration. */
export const LEGACY_DISPATCH_WORKFLOW_NAME = 'ethanDispatchWorkflow';

// ============================================================
// SIGNALS — Inbound events that push new turns into the workflow
// ============================================================

/** Customer sends a follow-up email/SMS turn */
export const customerReplySignal = defineSignal<[CustomerReplyPayload]>('customerReply');

/** Human agent overrides AI and takes control of the thread */
export const humanTakeoverSignal = defineSignal<[HumanTakeoverPayload]>('humanTakeover');

/** Jobber confirms a job was booked */
export const jobberJobBookedSignal = defineSignal<[JobberJobPayload]>('jobberJobBooked');

/** Human agent resolves / closes the thread */
export const resolveThreadSignal = defineSignal<[ResolvePayload]>('resolveThread');

/** Human agent approves a shadowed dispatch */
export const approveDispatchSignal = defineSignal<[]>('approveDispatch');

/** Human agent rejects a shadowed dispatch */
export const rejectDispatchSignal = defineSignal<[]>('rejectDispatch');

// ============================================================
// QUERIES — Read current state (non-mutating, synchronous)
// ============================================================

export const getThreadStateQuery = defineQuery<ThreadState>('getThreadState');
export const getConversationHistoryQuery = defineQuery<ConversationTurn[]>('getConversationHistory');

// ============================================================
// TYPES
// ============================================================

export interface DispatchWorkflowInput {
  threadId: string;
  orgId: string;
  emailAddress: string;        // Customer email address
  historyId: string | null; // Gmail historyId (null for direct intake)
  nylasGrantId?: string | null;
  sb243Footer: string;
  timezone: string;
  /**
   * Continuation state — present when this run was started via Continue-As-New
   * from a previous run of the same thread. Allows long-running conversations
   * to avoid Temporal's 50K event history limit without losing state.
   */
  continuationState?: ContinuationState | null;
}

/**
 * State carried across Continue-As-New boundaries.
 * All fields must be JSON-serializable (Temporal serializes input as JSON).
 */
export interface ContinuationState {
  /** Turn count from the concluded run (cumulative across all CAN boundaries) */
  priorTurnCount: number;
  /** Serialized PII vault (encrypted) from the concluded run */
  vaultSerialized: string;
  /** Nylas thread ID (if established) — needed to thread email replies correctly */
  nylasThreadId: string | null;
  /** Service category determined during initial classification */
  serviceCategory: string | undefined;
  /** Urgency score from initial classification */
  urgencyScore: number | undefined;
  /** Sentiment score from initial classification */
  sentimentScore: number | undefined;
  /** Redacted conversation history tail (last 5 turns) for context continuity */
  conversationHistoryTail: ConversationTurn[];
  /** Jobber job ID if a job was dispatched in a prior run */
  jobberJobId: string | undefined;
  /** Internal RelayDispatch job ID */
  relaydispatchJobId: string | undefined;
}

export interface CustomerReplyPayload {
  messageId: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: string;
}

export interface HumanTakeoverPayload {
  agentId: string;
  agentName: string;
  reason: string;
}

export interface JobberJobPayload {
  jobberJobId: string;
  scheduledDate: string;
  technicianName?: string;
}

export interface ResolvePayload {
  resolvedBy: string;
  resolutionNote: string;
}

export interface ConversationTurn {
  role: 'customer' | 'dispatcher_ai' | 'human_agent';
  content: string;
  timestamp: string;
  messageId?: string;
}

export type WorkflowPhase =
  | 'INITIALIZING'
  | 'FETCHING_EMAIL'
  | 'CLASSIFYING'
  | 'JOB_CREATED'
  | 'GENERATING_REPLY'
  | 'PENDING_APPROVAL'
  | 'AWAITING_CUSTOMER'
  | 'ESCALATED_TO_HUMAN'
  | 'SCHEDULING_JOB'
  | 'JOB_BOOKED'
  | 'COMPLETED'
  | 'FAILED';

export interface ThreadState {
  threadId: string;
  orgId: string;
  phase: WorkflowPhase;
  serviceCategory?: string | undefined;
  urgencyScore?: number | undefined;
  sentimentScore?: number | undefined;
  turnCount: number;
  lastCustomerTurnAt?: string | undefined;
  escalated: boolean;
  escalationReason?: string | undefined;
  jobberJobId?: string | undefined;
  jobId?: string | undefined;
  lastError?: string | undefined;
  workflowId: string;
  runId: string;
}

// ============================================================
// MAIN WORKFLOW
// ============================================================

export async function relayDispatchWorkflow(
  input: DispatchWorkflowInput,
): Promise<ThreadState> {

  const { workflowId, runId } = workflowInfo();

  // ============================================================
  // WORKFLOW VERSION GUARD
  // ============================================================
  // patched() is a Temporal versioning primitive. Workflows already in
  // flight when this code is deployed will NOT enter the patched block
  // (they replay the old path). New workflows always enter it.
  //
  // Current patch: 'vault-and-nylas-thread-v1'
  //   Adds: vaultSerialized, nylasThreadId to workflow state.
  //   Old in-flight workflows (pre-patch) will use empty vault —
  //   acceptable: they were started before PII redaction was wired.
  //
  // When adding future state variables, create a new patch ID.
  // NEVER change existing patch IDs once deployed.
  const hasVaultState = patched('vault-and-nylas-thread-v1');

  // ── Mutable workflow state (event-sourced by Temporal) ─────
  let phase: WorkflowPhase = 'INITIALIZING';
  let conversationHistory: ConversationTurn[] = [];
  let serviceCategory: string | undefined;
  let urgencyScore: number | undefined;
  let sentimentScore: number | undefined;
  // Turn count is cumulative across all Continue-As-New boundaries.
  // Initialized from continuation state if this is a resumed run.
  let turnCount = input.continuationState?.priorTurnCount ?? 0;
  let escalated = false;
  let escalationReason: string | undefined;
  let jobberJobId: string | undefined = input.continuationState?.jobberJobId;
  let humanAgent: HumanTakeoverPayload | undefined;
  let pendingReply: CustomerReplyPayload | undefined;
  let jobBooked: JobberJobPayload | undefined;
  let resolved: ResolvePayload | undefined;
  let lastCustomerTurnAt: string | undefined;
  // Vault + Nylas thread ID — only present in post-patch workflows
  let vaultSerialized = hasVaultState
    ? (input.continuationState?.vaultSerialized ?? '{}')
    : '{}';
  let nylasThreadId: string | null = input.continuationState?.nylasThreadId ?? null;
  let relaydispatchJobId: string | undefined = input.continuationState?.relaydispatchJobId;

  // Restore state from a previous Continue-As-New run if present
  if (input.continuationState) {
    serviceCategory = input.continuationState.serviceCategory;
    urgencyScore    = input.continuationState.urgencyScore;
    sentimentScore  = input.continuationState.sentimentScore;
    conversationHistory = [...(input.continuationState.conversationHistoryTail ?? [])];
    wfLog.info('Workflow resumed via Continue-As-New', {
      priorTurnCount: input.continuationState.priorTurnCount,
      vaultKeys: Object.keys(JSON.parse(vaultSerialized)).length,
    });
  }

  // ── Signal handlers ─────────────────────────────────────────
  setHandler(customerReplySignal, (payload) => {
    pendingReply = payload;
    lastCustomerTurnAt = payload.receivedAt;
  });

  setHandler(humanTakeoverSignal, (payload) => {
    humanAgent = payload;
    escalated = true;
    escalationReason = payload.reason;
  });

  setHandler(jobberJobBookedSignal, (payload) => {
    jobBooked = payload;
    jobberJobId = payload.jobberJobId;
  });

  let shadowApproved = false;
  let shadowRejected = false;

  setHandler(approveDispatchSignal, () => {
    shadowApproved = true;
  });

  setHandler(rejectDispatchSignal, () => {
    shadowRejected = true;
  });

  setHandler(resolveThreadSignal, (payload) => {
    resolved = payload;
  });

  // ── Query handlers ──────────────────────────────────────────
  setHandler(getThreadStateQuery, (): ThreadState => ({
    threadId: input.threadId,
    orgId: input.orgId,
    phase,
    serviceCategory,
    urgencyScore,
    sentimentScore,
    turnCount,
    lastCustomerTurnAt,
    escalated,
    escalationReason,
    jobberJobId,
    jobId: relaydispatchJobId,
    workflowId,
    runId,
  }));

  setHandler(getConversationHistoryQuery, () => [...conversationHistory]);

  // ============================================================
  // PHASE 1: FETCH ORG CONFIG
  // ============================================================

  wfLog.info('Phase: INITIALIZING');
  phase = 'INITIALIZING';

  // ── Fix A: Validate thread exists BEFORE any other work ──────
  // If the thread was deleted between webhook receipt and workflow start
  // (phantom webhook), this throws PHANTOM_THREAD (non-retryable).
  // Temporal marks workflow FAILED immediately — zero LLM cost, zero emails.
  await validateThreadExistsActivity(input.threadId, input.orgId);

  const orgConfig = await fetchOrgConfigActivity(input.orgId);
  if (!orgConfig) {
    throw ApplicationFailure.create({
      message: `Organization ${input.orgId} not found or inactive`,
      type: 'ORG_NOT_FOUND',
      nonRetryable: true,
    });
  }

  // ============================================================
  // PHASE 2: FETCH EMAIL CONTENT (via Nylas/Gmail API)
  // ============================================================

  wfLog.info('Phase: FETCHING_EMAIL');
  phase = 'FETCHING_EMAIL';

  await updateThreadStatusActivity(input.threadId, 'new');

  let initialEmail: { subject: string; bodyText: string; fromEmail: string; fromName?: string } | null = null;

  if (input.historyId) {
    initialEmail = await fetchEmailContent({
      nylasGrantId: input.nylasGrantId ?? null,
      historyId: input.historyId,
      emailAddress: input.emailAddress,
    });
  }

  if (!initialEmail) {
    // Direct intake — message already in DB; pull it from messages table
    wfLog.info('No historyId — proceeding with direct intake message from DB');
    initialEmail = await fetchDirectIntakeMessageActivity({ threadId: input.threadId });
  }

  // ── P0 FIX: Derive true customer email from fetched message ──────────────
  // input.emailAddress is the org's *monitored inbox* (e.g. info@business.com)
  // which Pub/Sub delivers as the subscription emailAddress. The real customer
  // address lives in the From header of the inbound email, now returned as
  // initialEmail.fromEmail by fetchEmailContent (fixed to use History API).
  // For direct intake (no historyId), input.emailAddress is the customer's
  // address submitted via the app — safe to use directly.
  const customerEmail: string = initialEmail?.fromEmail ?? input.emailAddress;

  wfLog.info('Resolved customer email for thread', { customerEmail, orgEmail: input.emailAddress });

  // ── Subscription/Trial Gating Check ──
  const now = new Date();
  const isPro = orgConfig.plan === 'pro' || orgConfig.planTier === 'pro' || orgConfig.plan === 'enterprise' || orgConfig.planTier === 'enterprise';
  const trialEnds = orgConfig.trialEndsAt ? new Date(orgConfig.trialEndsAt) : null;
  
  if (!isPro && trialEnds && trialEnds < now) {
    wfLog.info('Subscription: trial expired, escalating to human', { orgId: input.orgId, trialEndsAt: orgConfig.trialEndsAt });
    phase = 'ESCALATED_TO_HUMAN';
    await notifyHumanAgentActivity({
      orgId: input.orgId,
      threadId: input.threadId,
      escalationReason: 'Trial expired. AI dispatcher suspended.',
      customerEmail: customerEmail,
      urgencyScore: 50,
      conversationSummary: 'System Escalation: Organization 14-day trial expired. Please upgrade to Pro to resume automated dispatching.',
    });
    return {
      threadId: input.threadId,
      orgId: input.orgId,
      phase: 'ESCALATED_TO_HUMAN',
      turnCount: 0,
      escalated: true,
      escalationReason: 'Trial expired. AI dispatcher suspended.',
      workflowId,
      runId,
    };
  }

  // NOTE: createOrUpdateContactActivity is called AFTER redactInboundActivity,
  // so vaultSerialized is populated. The activity redacts the name before storage.
  await createOrUpdateContactActivity({
    orgId:    input.orgId,
    email:    customerEmail,
    threadId: input.threadId,
    ...(initialEmail?.fromName ? { name: initialEmail.fromName } : {}),
    existingVaultSerialized: vaultSerialized,
  });

  // ============================================================
  // PHASE 3: CLASSIFY INBOUND REQUEST (Gemini 3.1 Flash-Lite)
  // ============================================================

  wfLog.info('Phase: CLASSIFYING');
  phase = 'CLASSIFYING';

  // ── P0-5: Redact PII before ANY LLM call ─────────────────────
  const rawBodyForClassify = initialEmail?.bodyText ?? '';
  
  const filterResult = await emergencyPreFilterActivity(rawBodyForClassify);
  let isEmergencyFlag = filterResult.isEmergency;

  const redactionResult = await redactInboundActivity({
    rawText: rawBodyForClassify,
    existingVaultSerialized: vaultSerialized,
  });
  vaultSerialized = redactionResult.vaultSerialized;
  const redactedBodyText = redactionResult.redactedText;
  const redactedSubject  = initialEmail?.subject ?? '(no subject)';

  if (isEmergencyFlag) {
    wfLog.warn('🚨 Emergency Pre-Filter triggered', { threadId: input.threadId });
    await sendSmsAlertActivity({
      threadId: input.threadId,
      orgId: input.orgId,
      message: `Emergency detected for customer ${customerEmail}`
    });
    const emergencyReply = "If you smell gas or suspect a fire, evacuate immediately and call 911.";
    await sendReplyActivity({
      threadId: input.threadId,
      orgId: input.orgId,
      toEmail: customerEmail,
      subject: `Re: ${initialEmail?.subject ?? 'Emergency Notification'}`,
      bodyText: emergencyReply,
      bodyHtml: `<div style="font-family:sans-serif; color:red; font-weight:bold;">${emergencyReply}</div>`,
      nylasGrantId: input.nylasGrantId ?? null,
      nylasThreadId,
      vaultSerialized,
      sb243Applied: true,
      modelUsed: 'regex-pre-filter',
      promptTokens: 0,
      completionTokens: 0,
      turnIndex: turnCount + 1,
    });
    await updateThreadStatusActivity(input.threadId, 'escalated', {
      escalationReason: 'EMERGENCY_ESCALATED',
    });
    escalated = true;
    escalationReason = 'Life-Safety Emergency Detected via Regex';
    phase = 'ESCALATED_TO_HUMAN';
  } else {
    const classification = await classifyInboundRequest({
      orgId: input.orgId,
      threadId: input.threadId,
      subject: redactedSubject,
      bodyText: redactedBodyText,
    });
    serviceCategory = classification.serviceCategory;
    urgencyScore = classification.urgencyScore;
    sentimentScore = classification.sentimentScore;
  }

  if (!isEmergencyFlag) {
    await updateThreadStatusActivity(input.threadId, 'triaged', {
      serviceCategory,
      urgencyScore,
      sentimentScore,
    });

    // ============================================================
    // PHASE 3b: CREATE JOB RECORD (after classification)
    // ============================================================

    wfLog.info('Phase: JOB_CREATED');
    phase = 'JOB_CREATED';

    const jobResult = await createJobActivity({
      orgId:        input.orgId,
      threadId:     input.threadId,
      contactId:    null,           // contact resolved by createOrUpdateContactActivity earlier
      serviceType:  serviceCategory ?? 'GENERAL',
      contactEmail: customerEmail,
      notes:        `Urgency: ${urgencyScore ?? 'N/A'} | Sentiment: ${sentimentScore ?? 'N/A'}`,
    });
    relaydispatchJobId = jobResult.jobId;
    wfLog.info(`Job created — jobId=${relaydispatchJobId} externalId=${jobResult.externalId ?? 'none'}`);

    // ============================================================
    // PHASE 4: GENERATE & SEND FIRST REPLY (Claude Opus 4.6)
    // ============================================================

    wfLog.info('Phase: GENERATING_REPLY (turn 1)');
    const availableTechnicians = await fetchAvailableTechniciansActivity(input.orgId);

    const classifiedRequest: ClassifiedRequest = {
      threadId: input.threadId,
      orgId: input.orgId,
      contactEmail: customerEmail,
      ...(initialEmail?.fromName ? { contactName: initialEmail.fromName } : {}),
      subject: redactedSubject,
      bodyText: redactedBodyText,  // redacted — safe for LLM
      serviceCategory: serviceCategory ?? 'GENERAL',
      urgencyScore: urgencyScore ?? 0,
      sentimentScore: sentimentScore ?? 0,
      conversationHistory: [],
      availableTechnicians,
    };

    let dispatchResult: DispatcherResult = await runDispatcherActivity(
      classifiedRequest,
      orgConfig.name,
      orgConfig.sb243Footer,
      orgConfig.timezone,
    );

    if (dispatchResult.assignedTechnicianId && relaydispatchJobId) {
      wfLog.info('Autonomous dispatch triggered by AI', { technicianId: dispatchResult.assignedTechnicianId });
      
      let proceed = true;
      if (orgConfig.dispatchMode === 'shadow') {
        wfLog.info('Shadow mode active: requesting approval');
        phase = 'PENDING_APPROVAL';
        await updateThreadStatusActivity(input.threadId, 'pending_approval');
        shadowApproved = false;
        shadowRejected = false;
        await condition(() => shadowApproved || shadowRejected || escalated, '48 hours');
        
        if (shadowRejected) {
          escalationReason = 'Shadow mode dispatch rejected by human';
          escalated = true;
          proceed = false;
        } else if (!shadowApproved && !escalated) {
          escalationReason = 'Shadow mode dispatch timed out waiting for approval';
          escalated = true;
          proceed = false;
        }
      }

      if (proceed) {
        try {
          await dispatchJobActivity({
            jobId: relaydispatchJobId,
            technicianId: dispatchResult.assignedTechnicianId,
            scheduledAt: dispatchResult.scheduledAt ?? new Date().toISOString(),
          });
          jobberJobId = `dispatched-by-ai`; // Real Jobber sync handled by API layer
          phase = 'JOB_BOOKED';
        } catch (err: any) {
        if (err.type === 'DOUBLE_BOOKING') {
          wfLog.warn('Double booking detected. Attempting compensating transaction...', { failedTechnician: dispatchResult.assignedTechnicianId });
          
          const currentAvailableTechnicians = await fetchAvailableTechniciansActivity(input.orgId);
          const filteredTechnicians = currentAvailableTechnicians.filter((t: { id: string }) => t.id !== dispatchResult.assignedTechnicianId);
          classifiedRequest.availableTechnicians = filteredTechnicians;
          
          dispatchResult = await runDispatcherActivity(
            classifiedRequest,
            orgConfig.name,
            orgConfig.sb243Footer,
            orgConfig.timezone,
          );
          
          if (dispatchResult.assignedTechnicianId) {
            try {
              await dispatchJobActivity({
                jobId: relaydispatchJobId,
                technicianId: dispatchResult.assignedTechnicianId,
                scheduledAt: dispatchResult.scheduledAt ?? new Date().toISOString(),
              });
              jobberJobId = `dispatched-by-ai`;
              phase = 'JOB_BOOKED';
              wfLog.info('Compensating transaction successful', { newTechnicianId: dispatchResult.assignedTechnicianId });
            } catch (retryErr: any) {
              wfLog.warn('Autonomous dispatch failed on retry', { error: retryErr.message });
              escalationReason = `AI attempted to schedule but failed twice: ${retryErr.message}`;
              escalated = true;
            }
          } else {
             wfLog.warn('No alternative technician assigned on retry');
             escalationReason = `Double booked and no alternative technician found.`;
             escalated = true;
          }
        } else {
          wfLog.warn('Autonomous dispatch failed', { error: err.message });
          escalationReason = `AI attempted to schedule but failed: ${err.message}`;
          escalated = true;
        }
        }
      }
    }

    // Record AI turn in local conversation history (MUST use redacted text — never raw PII)
    conversationHistory.push({
      role: 'customer',
      content: redactedBodyText, // redacted: all PII replaced with [[PLACEHOLDERS]]
      timestamp: new Date().toISOString(),
    });

    conversationHistory.push({
      role: 'dispatcher_ai',
      content: dispatchResult.draftReplyPlainText,
      timestamp: new Date().toISOString(),
    });

    turnCount++;

    // Handle escalation from first reply
    if (dispatchResult.shouldEscalate) {
      if (urgencyScore !== undefined && urgencyScore >= 80) {
        escalationReason = `High urgency input (${urgencyScore}/100)`;
        wfLog.warn('Escalation triggered on first reply', { escalationReason });
        escalated = true;
      }
    }

    // Send reply via Nylas/Gmail — pass vault so rehydration restores real PII
    const sendResult = await sendReplyActivity({
      threadId: input.threadId,
      orgId: input.orgId,
      toEmail: customerEmail,
      subject: `Re: ${initialEmail?.subject ?? 'Your Service Request'}`,
      bodyText: dispatchResult.draftReplyPlainText,
      bodyHtml: dispatchResult.draftReply,
      nylasGrantId: input.nylasGrantId ?? null,
      nylasThreadId,
      vaultSerialized,
      sb243Applied: true,
      modelUsed: dispatchResult.modelUsed,
      promptTokens: dispatchResult.promptTokens,
      completionTokens: dispatchResult.completionTokens,
      turnIndex: turnCount,
    });
    if (sendResult.nylasMessageId) {
      nylasThreadId = sendResult.nylasThreadId ?? nylasThreadId;
    }

    await updateThreadStatusActivity(input.threadId, 'quoted');

    if (escalated) {
      phase = 'ESCALATED_TO_HUMAN';
      await updateThreadStatusActivity(input.threadId, 'escalated', { escalationReason });
      await notifyHumanAgentActivity({
        threadId: input.threadId,
        orgId: input.orgId,
        escalationReason: escalationReason!,
        customerEmail: customerEmail,
        urgencyScore: urgencyScore ?? 0,
        conversationSummary: dispatchResult.draftReplyPlainText.slice(0, 500),
      });
    }
  }

  // ============================================================
  // PHASE 5: MULTI-TURN CONVERSATION LOOP
  // Waits for customer replies (via Signal) for up to 7 days.
  // Each reply triggers a new AI response turn.
  // ============================================================

  // ============================================================
  // PHASE 5: MULTI-TURN CONVERSATION LOOP
  // Waits for customer replies (via Signal) for up to 7 days.
  // Each reply triggers a new AI response turn.
  //
  // Continue-As-New (CAN) guard: before processing turn 8 we check
  // the Temporal event history depth. At ~8 turns with retries, most
  // workflows approach 3,000–6,000 events. We CAN at turn 8 to ensure
  // we never approach the 50K hard limit, even under retry pressure.
  // The new run picks up seamlessly via continuationState.
  // ============================================================

  phase = 'AWAITING_CUSTOMER';
  wfLog.info('Phase: AWAITING_CUSTOMER', { phase: 'AWAITING_CUSTOMER' });

  const MAX_TURNS          = 10;
  const CAN_TURN_THRESHOLD = 8;  // Trigger CAN before MAX_TURNS to prevent history overflow
  const INACTIVITY_TIMEOUT = '7 days';

  while (turnCount < MAX_TURNS && !resolved) {

    // ── Wait for a signal (customer reply, human takeover, job booked, resolve) ──
    const gotSignal = await condition(
      () => Boolean(pendingReply || humanAgent || jobBooked || resolved),
      INACTIVITY_TIMEOUT,
    );

    // ── Inactivity timeout: thread goes dormant ────────────────
    if (!gotSignal) {
      if (pendingReply === undefined && humanAgent === undefined && resolved === undefined) {
        wfLog.info('Thread timed out — no customer response in 7 days', { turnCount });
        await updateThreadStatusActivity(input.threadId, 'closed');
        phase = 'COMPLETED';
        break;
      }
    }

    // ── Continue-As-New guard (prevents Temporal history overflow) ────────────
    // Trigger before MAX_TURNS so we never approach the 50K event limit.
    // CAN carries all essential state into the resumed run.
    if (turnCount >= CAN_TURN_THRESHOLD && !resolved && !escalated) {
      wfLog.info('Triggering Continue-As-New for long-running conversation', { turnCount, threshold: CAN_TURN_THRESHOLD });
      const continuationState: ContinuationState = {
        priorTurnCount:          turnCount,
        vaultSerialized,
        nylasThreadId,
        serviceCategory,
        urgencyScore,
        sentimentScore,
        // Keep the last 5 turns for context continuity — older turns are in the DB
        conversationHistoryTail: conversationHistory.slice(-5),
        jobberJobId,
        relaydispatchJobId,
      };
      // continueAsNew re-schedules this workflow with fresh history.
      // The new run will skip Phase 1–4 and resume at the awaiting-customer loop
      // because continuationState is present.
      await continueAsNew<typeof relayDispatchWorkflow>({
        ...input,
        // historyId is null for continuations — the initial email was already fetched
        historyId:         null,
        continuationState,
      });
    }

    // ── Human takeover signal ──────────────────────────────────
    if (humanAgent) {
      wfLog.info('Human agent took over thread', { agentName: humanAgent.agentName });
      escalationReason = `Manual takeover by ${humanAgent.agentName}`;
      escalated = true;
      phase = 'ESCALATED_TO_HUMAN';

      conversationHistory.push({
        role: 'human_agent',
        content: `[Taken over by ${humanAgent.agentName}: ${humanAgent.reason}]`,
        timestamp: new Date().toISOString(),
      });

      await updateThreadStatusActivity(input.threadId, 'escalated', {
        escalationReason: humanAgent.reason,
        assignedTo: humanAgent.agentId,
      });

      // Wait for human to resolve
      await condition(() => Boolean(resolved), '30 days');
      break;
    }

    // ── Jobber job booked ──────────────────────────────────────
    if (jobBooked) {
      wfLog.info('Jobber job confirmed', { jobberJobId: jobBooked.jobberJobId });
      jobberJobId = jobBooked.jobberJobId;
      phase = 'JOB_BOOKED';
      
      conversationHistory.push({
        role: 'dispatcher_ai',
        content: `[Job scheduled: ${jobberJobId} on ${(jobBooked as any)?.scheduledDate ?? 'TBD'}]`,
        timestamp: new Date().toISOString(),
      });

      await updateThreadStatusActivity(input.threadId, 'scheduled', { jobberJobId });
      jobBooked = undefined;
      phase = 'AWAITING_CUSTOMER';
      continue;
    }

    // ── Customer reply signal ──────────────────────────────────
    if (pendingReply) {
      const reply = pendingReply;
      pendingReply = undefined;

      wfLog.info('Processing customer reply', { turnCount: turnCount + 1 });
      phase = 'GENERATING_REPLY';

      // ── EMERGENCY PRE-FILTER ───────────────────────────────────
      const replyFilter = await emergencyPreFilterActivity(reply.bodyText);
      if (replyFilter.isEmergency) {
        wfLog.warn('🚨 Emergency Pre-Filter triggered on reply', { threadId: input.threadId });
        await sendSmsAlertActivity({
          threadId: input.threadId,
          orgId: input.orgId,
          message: `Emergency detected for customer ${customerEmail}`
        });
        const emergencyReply = "If you smell gas or suspect a fire, evacuate immediately and call 911.";
        await sendReplyActivity({
          threadId: input.threadId,
          orgId: input.orgId,
          toEmail: customerEmail,
          subject: `Re: ${initialEmail?.subject ?? 'Emergency Notification'}`,
          bodyText: emergencyReply,
          bodyHtml: `<div style="font-family:sans-serif; color:red; font-weight:bold;">${emergencyReply}</div>`,
          nylasGrantId: input.nylasGrantId ?? null,
          nylasThreadId,
          vaultSerialized,
          sb243Applied: true,
          modelUsed: 'regex-pre-filter',
          promptTokens: 0,
          completionTokens: 0,
          turnIndex: turnCount + 1,
        });
        await updateThreadStatusActivity(input.threadId, 'escalated', {
          escalationReason: 'EMERGENCY_ESCALATED',
        });
        escalated = true;
        escalationReason = 'Life-Safety Emergency Detected via Regex';
        phase = 'ESCALATED_TO_HUMAN';
        continue; // Skip LLM generation
      }

      // Redact the customer reply before LLM processing
      const replyRedaction = await redactInboundActivity({
        rawText: reply.bodyText,
        existingVaultSerialized: vaultSerialized,
      });
      vaultSerialized = replyRedaction.vaultSerialized;

      conversationHistory.push({
        role: 'customer',
        content: replyRedaction.redactedText, // redacted
        timestamp: reply.receivedAt,
        messageId: reply.messageId,
      });

      // Refresh technicians for the follow-up turn in case availability changed
      const currentAvailableTechnicians = await fetchAvailableTechniciansActivity(input.orgId);

      const followUpRequest: ClassifiedRequest = {
        threadId: input.threadId,
        orgId: input.orgId,
        contactEmail: customerEmail,
        ...(initialEmail?.fromName ? { contactName: initialEmail.fromName } : {}),
        subject: redactedSubject,
        serviceCategory: serviceCategory ?? 'GENERAL',
        urgencyScore: urgencyScore ?? 0,
        sentimentScore: sentimentScore ?? 0,
        bodyText: replyRedaction.redactedText,
        conversationHistory: conversationHistory.map((t) => ({
          role: t.role,
          content: t.content,
        })),
        availableTechnicians: currentAvailableTechnicians,
      };

      let followUpResult = await runDispatcherActivity(
        followUpRequest,
        orgConfig.name,
        orgConfig.sb243Footer,
        orgConfig.timezone,
      );

      if (followUpResult.assignedTechnicianId && relaydispatchJobId && !jobberJobId) {
        wfLog.info('Autonomous dispatch triggered by AI on follow-up', { technicianId: followUpResult.assignedTechnicianId });
        
        let proceed = true;
        if (orgConfig.dispatchMode === 'shadow') {
          wfLog.info('Shadow mode active: requesting approval');
          phase = 'PENDING_APPROVAL';
          await updateThreadStatusActivity(input.threadId, 'pending_approval');
          shadowApproved = false;
          shadowRejected = false;
          await condition(() => shadowApproved || shadowRejected || escalated, '48 hours');
          
          if (shadowRejected) {
            escalationReason = 'Shadow mode dispatch rejected by human';
            escalated = true;
            proceed = false;
          } else if (!shadowApproved && !escalated) {
            escalationReason = 'Shadow mode dispatch timed out waiting for approval';
            escalated = true;
            proceed = false;
          }
        }

        if (proceed) {
          try {
            await dispatchJobActivity({
              jobId: relaydispatchJobId,
              technicianId: followUpResult.assignedTechnicianId,
              scheduledAt: followUpResult.scheduledAt ?? new Date().toISOString(),
            });
            jobberJobId = `dispatched-by-ai`; 
            phase = 'JOB_BOOKED';
          } catch (err: any) {
            if (err.type === 'DOUBLE_BOOKING') {
            wfLog.warn('Double booking detected on follow-up. Attempting compensating transaction...', { failedTechnician: followUpResult.assignedTechnicianId });
            
            const freshAvailableTechnicians = await fetchAvailableTechniciansActivity(input.orgId);
            const filteredTechnicians = freshAvailableTechnicians.filter((t: { id: string }) => t.id !== followUpResult.assignedTechnicianId);
            followUpRequest.availableTechnicians = filteredTechnicians;
            
            followUpResult = await runDispatcherActivity(
              followUpRequest,
              orgConfig.name,
              orgConfig.sb243Footer,
              orgConfig.timezone,
            );
            
            if (followUpResult.assignedTechnicianId) {
              try {
                await dispatchJobActivity({
                  jobId: relaydispatchJobId,
                  technicianId: followUpResult.assignedTechnicianId,
                  scheduledAt: followUpResult.scheduledAt ?? new Date().toISOString(),
                });
                jobberJobId = `dispatched-by-ai`;
                phase = 'JOB_BOOKED';
                wfLog.info('Compensating transaction successful on follow-up', { newTechnicianId: followUpResult.assignedTechnicianId });
              } catch (retryErr: any) {
                wfLog.warn('Autonomous dispatch failed on retry', { error: retryErr.message });
                escalationReason = `AI attempted to schedule but failed twice: ${retryErr.message}`;
                escalated = true;
              }
            } else {
               wfLog.warn('No alternative technician assigned on retry');
               escalationReason = `Double booked and no alternative technician found.`;
               escalated = true;
            }
          } else {
            wfLog.warn('Autonomous dispatch failed on follow-up', { error: err.message });
            escalationReason = `AI attempted to schedule but failed: ${err.message}`;
            escalated = true;
          }
          }
        }
      }

      conversationHistory.push({
        role: 'dispatcher_ai',
        content: followUpResult.draftReplyPlainText,
        timestamp: new Date().toISOString(),
      });

      turnCount++;

      if (followUpResult.shouldEscalate && !escalated) {
        escalated = true;
        escalationReason = followUpResult.escalationReason;
        phase = 'ESCALATED_TO_HUMAN';

        await notifyHumanAgentActivity({
          threadId: input.threadId,
          orgId: input.orgId,
          escalationReason: escalationReason!,
          customerEmail: customerEmail,
          urgencyScore: urgencyScore ?? 0,
          conversationSummary: followUpResult.draftReplyPlainText.slice(0, 500),
        });
      }

      await sendReplyActivity({
        threadId: input.threadId,
        orgId: input.orgId,
        toEmail: customerEmail,
        subject: `Re: ${initialEmail?.subject ?? 'Your Service Request'}`,
        bodyText: followUpResult.draftReplyPlainText,
        bodyHtml: followUpResult.draftReply,
        nylasGrantId: input.nylasGrantId ?? null,
        nylasThreadId,
        vaultSerialized,
        sb243Applied: true,
        modelUsed: followUpResult.modelUsed,
        promptTokens: followUpResult.promptTokens,
        completionTokens: followUpResult.completionTokens,
        turnIndex: turnCount,
      });

      phase = escalated ? 'ESCALATED_TO_HUMAN' : 'AWAITING_CUSTOMER';
    }
  }

  // ── Max turns reached — escalate gracefully ────────────────
  if (turnCount >= 10) {
    wfLog.warn('Max turns reached — escalating to human', { turnCount });
    escalated = true;
    escalationReason = 'Max automated turns reached (10)';
    phase = 'ESCALATED_TO_HUMAN';

    await notifyHumanAgentActivity({
      threadId: input.threadId,
      orgId: input.orgId,
      escalationReason: escalationReason,
      customerEmail: customerEmail,
      urgencyScore: urgencyScore ?? 0,
      conversationSummary: `Thread exceeded ${MAX_TURNS} turns. Human review required.`,
    });

    await updateThreadStatusActivity(input.threadId, 'escalated', { escalationReason });
  }

  // ── Resolution ─────────────────────────────────────────────
  if (resolved) {
    wfLog.info('Thread resolved', { resolvedBy: resolved.resolvedBy });
    phase = 'COMPLETED';
    await updateThreadStatusActivity(input.threadId, 'completed');
  }

  // ── Final state snapshot ───────────────────────────────────
  const finalState: ThreadState = {
    threadId: input.threadId,
    orgId: input.orgId,
    phase,
    serviceCategory,
    urgencyScore,
    sentimentScore,
    turnCount,
    lastCustomerTurnAt,
    escalated,
    escalationReason,
    jobberJobId,
    jobId: relaydispatchJobId,
    workflowId,
    runId,
  };

  wfLog.info('Dispatch workflow complete', { finalState });
  return finalState;
}



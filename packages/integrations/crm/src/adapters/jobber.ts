/**
 * packages/integrations/crm/src/adapters/jobber.ts
 * ─────────────────────────────────────────────────────────────
 * Jobber v2 GraphQL CRM Adapter.
 *
 * Endpoints:
 *   - createDraftJob()        — Creates a Draft Job from AI-extracted data
 *   - upsertJobberClient()    — Finds or creates a Jobber Client record
 *   - getJobberJob()          — Fetches job status for webhook reconciliation
 *   - updateJobberJob()       — Updates job notes
 *   - assignJobToTechnician() — Assigns technician and schedule to a visit
 *   - refreshJobberToken()    — OAuth 2.0 token refresh (per-tenant)
 *   - isTokenExpired()        — Token expiry check helper
 *
 * Auth: Jobber uses OAuth 2.0 per tenant. Each org has its own
 *       access_token / refresh_token stored in the organizations table.
 *
 * GraphQL: Jobber v2 API — https://developer.getjobber.com/docs
 *          All mutations include the userError pattern for safe error handling.
 *
 * Rate limits: Jobber enforces 60 requests/minute per OAuth token.
 *              The activity layer handles retry with Temporal's backoff.
 */

import pino from 'pino';

const log = pino({ name: 'jobber-client', level: process.env.LOG_LEVEL ?? 'info' });

// ── Constants ─────────────────────────────────────────────────

const JOBBER_API_URL     = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL   = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_API_VERSION = '2024-11-15';  // Pinned version header

// ── Types ─────────────────────────────────────────────────────

export interface JobberTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // Unix ms timestamp
}

export interface ExtractedJobData {
  serviceCategory:  string;
  serviceLabel:     string;
  equipmentBrand?:  string;
  equipmentModel?:  string;
  equipmentSerial?: string;
  equipmentAge?:    number;
  preferredDate?:   string;
  preferredTime?:   string;
  urgencyScore:     number;
  lineItemPrice?:   number;
  lineItemLabel?:   string;
  techNotes?:       string;
}

export interface JobberClientInput {
  firstName:  string;
  lastName?:  string;
  email:      string;
  phone?:     string;
  street?:    string;
  city?:      string;
  state?:     string;
  zip?:       string;
}

export interface CreateDraftJobResult {
  jobId:     string;
  jobNumber: string;
  status:    string;
  clientId:  string;
  jobUrl:    string;
}

export interface UpsertClientResult {
  clientId: string;
  isNew:    boolean;
}

interface GqlResponse<T> {
  data?:   T;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
}

interface UserError {
  message: string;
  path?:   string[];
}

// ── Core HTTP client ──────────────────────────────────────────

async function jobberGql<T = unknown>(
  accessToken: string,
  query:       string,
  variables?:  Record<string, unknown>,
): Promise<T> {
  const response = await fetch(JOBBER_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':            'application/json',
      'Authorization':           `Bearer ${accessToken}`,
      'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');
    log.error({ status: response.status, body }, 'jobberGql: HTTP error');
    throw new Error(`Jobber API HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as GqlResponse<T>;

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    log.error({ errors: json.errors }, 'jobberGql: GraphQL errors');
    throw new Error(`Jobber GraphQL error: ${msg}`);
  }

  return json.data as T;
}

// ── OAuth token refresh ───────────────────────────────────────

export async function refreshJobberToken(
  refreshToken:  string,
  clientId?:     string,
  clientSecret?: string,
): Promise<JobberTokens> {
  const id     = clientId     ?? process.env.JOBBER_CLIENT_ID!;
  const secret = clientSecret ?? process.env.JOBBER_CLIENT_SECRET!;

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     id,
    client_secret: secret,
    refresh_token: refreshToken,
  });

  const response = await fetch(JOBBER_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Jobber token refresh failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  log.info('jobber: OAuth token refreshed successfully');

  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    Date.now() + json.expires_in * 1000,
  };
}

// ── Upsert client ─────────────────────────────────────────────

const CLIENT_SEARCH_QUERY = `
  query FindClientByEmail($email: String!) {
    clients(filter: { email: $email }) {
      nodes {
        id
        name
        emails {
          address
          primary
        }
      }
    }
  }
`;

const CREATE_CLIENT_MUTATION = `
  mutation CreateClient($input: ClientCreateInput!) {
    clientCreate(input: $input) {
      client {
        id
        name
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function upsertJobberClient(
  accessToken: string,
  client:      JobberClientInput,
): Promise<UpsertClientResult> {
  const searchResult = await jobberGql<{
    clients: { nodes: Array<{ id: string; name: string }> };
  }>(accessToken, CLIENT_SEARCH_QUERY, { email: client.email });

  const existing = searchResult.clients.nodes[0];
  if (existing) {
    log.info({ clientId: existing.id }, 'jobber: existing client found');
    return { clientId: existing.id, isNew: false };
  }

  const addressInput = (client.street || client.city) ? {
    street1:    client.street ?? '',
    city:       client.city ?? '',
    province:   client.state ?? '',
    postalCode: client.zip ?? '',
    country:    'US',
  } : undefined;

  const createResult = await jobberGql<{
    clientCreate: {
      client:     { id: string; name: string } | null;
      userErrors: UserError[];
    };
  }>(accessToken, CREATE_CLIENT_MUTATION, {
    input: {
      firstName:      client.firstName,
      lastName:       client.lastName ?? '',
      emails:         [{ address: client.email, primary: true }],
      phones:         client.phone ? [{ number: client.phone, primary: true }] : [],
      billingAddress: addressInput,
    },
  });

  const { client: newClient, userErrors } = createResult.clientCreate;

  if (userErrors.length > 0) {
    const msg = userErrors.map((e) => e.message).join('; ');
    throw new Error(`Jobber clientCreate userError: ${msg}`);
  }

  if (!newClient) {
    throw new Error('Jobber clientCreate returned null client with no errors');
  }

  log.info({ clientId: newClient.id }, 'jobber: new client created');
  return { clientId: newClient.id, isNew: true };
}

// ── Create draft job ──────────────────────────────────────────

const CREATE_JOB_MUTATION = `
  mutation CreateDraftJob($input: JobCreateInput!) {
    jobCreate(input: $input) {
      job {
        id
        jobNumber
        title
        jobStatus
        client {
          id
        }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function createDraftJob(
  accessToken: string,
  clientId:    string,
  jobData:     ExtractedJobData,
  threadId:    string,
): Promise<CreateDraftJobResult> {
  const equipmentDesc = [jobData.equipmentBrand, jobData.equipmentModel]
    .filter(Boolean)
    .join(' ');
  const title = equipmentDesc
    ? `${jobData.serviceLabel} — ${equipmentDesc}`
    : jobData.serviceLabel;

  const internalNote = [
    `RelayDispatch Thread ID: ${threadId}`,
    jobData.equipmentBrand  ? `Brand: ${jobData.equipmentBrand}`         : null,
    jobData.equipmentModel  ? `Model: ${jobData.equipmentModel}`         : null,
    jobData.equipmentSerial ? `Serial: ${jobData.equipmentSerial}`       : null,
    jobData.equipmentAge    ? `Unit Age: ~${jobData.equipmentAge} years` : null,
    `Urgency Score: ${jobData.urgencyScore}/100`,
    jobData.techNotes       ? `\nTech Notes:\n${jobData.techNotes}`      : null,
  ].filter(Boolean).join('\n');

  const lineItems = jobData.lineItemPrice ? [{
    name:      jobData.lineItemLabel ?? jobData.serviceLabel,
    quantity:  1,
    unitPrice: jobData.lineItemPrice,
  }] : [];

  const scheduledStart = jobData.preferredDate
    ? buildScheduledTime(jobData.preferredDate, jobData.preferredTime ?? '09:00')
    : undefined;

  const jobPriority =
    jobData.urgencyScore >= 90 ? 'URGENT' :
    jobData.urgencyScore >= 70 ? 'HIGH'   : undefined;

  const result = await jobberGql<{
    jobCreate: {
      job: {
        id:        string;
        jobNumber: string;
        title:     string;
        jobStatus: string;
        client:    { id: string };
      } | null;
      userErrors: UserError[];
    };
  }>(accessToken, CREATE_JOB_MUTATION, {
    input: {
      clientId,
      title,
      jobStatus:    'DRAFT',
      instructions: internalNote,
      lineItems:    lineItems.length ? lineItems : undefined,
      startAt:      scheduledStart,
      ...(jobPriority ? { priority: jobPriority } : {}),
    },
  });

  const { job, userErrors } = result.jobCreate;

  if (userErrors.length > 0) {
    const msg = userErrors.map((e) => e.message).join('; ');
    throw new Error(`Jobber jobCreate userError: ${msg}`);
  }

  if (!job) {
    throw new Error('Jobber jobCreate returned null job with no errors');
  }

  const jobUrl = `https://secure.getjobber.com/work_orders/${job.id}`;

  log.info({ jobId: job.id, jobNumber: job.jobNumber, clientId, title }, 'jobber: draft job created');

  return {
    jobId:     job.id,
    jobNumber: job.jobNumber,
    status:    job.jobStatus,
    clientId:  job.client.id,
    jobUrl,
  };
}

// ── Get job by ID ─────────────────────────────────────────────

const GET_JOB_QUERY = `
  query GetJob($id: EncodedId!) {
    job(id: $id) {
      id
      jobNumber
      jobStatus
      title
      startAt
      client {
        id
        name
      }
    }
  }
`;

export async function getJobberJob(
  accessToken: string,
  jobId:       string,
): Promise<{ id: string; jobNumber: string; status: string; title: string } | null> {
  const result = await jobberGql<{
    job: { id: string; jobNumber: string; jobStatus: string; title: string } | null;
  }>(accessToken, GET_JOB_QUERY, { id: jobId });

  if (!result.job) return null;

  return {
    id:        result.job.id,
    jobNumber: result.job.jobNumber,
    status:    result.job.jobStatus,
    title:     result.job.title,
  };
}

// ── Update job notes ──────────────────────────────────────────

export async function updateJobberJob(
  accessToken: string,
  jobId:       string,
  notes:       string,
): Promise<boolean> {
  const UPDATE_JOB_MUTATION = `
    mutation UpdateJob($id: EncodedId!, $input: JobEditInput!) {
      jobEdit(id: $id, input: $input) {
        job { id }
        userErrors { message }
      }
    }
  `;
  const result = await jobberGql<{
    jobEdit: {
      job: { id: string } | null;
      userErrors: UserError[];
    };
  }>(accessToken, UPDATE_JOB_MUTATION, {
    id: jobId,
    input: { description: notes },
  });

  if (result.jobEdit.userErrors?.length > 0) return false;
  return !!result.jobEdit.job;
}

// ── Assign technician to job ──────────────────────────────────

const GET_JOB_VISITS_QUERY = `
  query GetJobVisits($id: EncodedId!) {
    job(id: $id) {
      visits(first: 10) {
        nodes {
          id
        }
      }
    }
  }
`;

const GET_TEAM_MEMBERS_QUERY = `
  query GetTeamMembers {
    users(first: 50) {
      nodes {
        id
        firstName
        lastName
      }
    }
  }
`;

const VISIT_UPDATE_MUTATION = `
  mutation VisitUpdate($id: EncodedId!, $input: VisitUpdateInput!) {
    visitUpdate(id: $id, input: $input) {
      visit {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function assignJobToTechnician(
  accessToken:    string,
  jobberJobId:    string,
  technicianName: string,
  scheduledAt:    string,
): Promise<boolean> {
  try {
    const visitsData = await jobberGql<{
      job: { visits: { nodes: Array<{ id: string }> } } | null;
    }>(accessToken, GET_JOB_VISITS_QUERY, { id: jobberJobId });

    const visits = visitsData?.job?.visits?.nodes || [];
    const firstVisit = visits[0];
    if (!firstVisit) {
      log.warn({ jobberJobId }, 'jobber: assignJobToTechnician: no visits found for job');
      return false;
    }

    const usersData = await jobberGql<{
      users: { nodes: Array<{ id: string; firstName: string; lastName: string }> };
    }>(accessToken, GET_TEAM_MEMBERS_QUERY);

    const users = usersData?.users?.nodes || [];
    const normalizedTargetName = technicianName.trim().toLowerCase();
    const matchedUser = users.find(u => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
      return fullName === normalizedTargetName || u.firstName.trim().toLowerCase() === normalizedTargetName;
    });

    if (!matchedUser) {
      log.warn({ technicianName }, 'jobber: assignJobToTechnician: could not find team member matching name');
      return false;
    }

    const startAt = scheduledAt;
    const endAt   = new Date(new Date(scheduledAt).getTime() + 2 * 60 * 60 * 1000).toISOString();

    const updateResult = await jobberGql<{
      visitUpdate: {
        visit: { id: string } | null;
        userErrors: Array<{ message: string }>;
      };
    }>(accessToken, VISIT_UPDATE_MUTATION, {
      id: firstVisit.id,
      input: {
        startAt,
        endAt,
        assignedUserIds: [matchedUser.id],
      },
    });

    const { visit, userErrors } = updateResult.visitUpdate;

    if (userErrors && userErrors.length > 0) {
      log.error({ visitId: firstVisit.id, msg: userErrors.map(e => e.message).join('; ') }, 'jobber: visitUpdate userErrors');
      return false;
    }

    if (!visit) {
      log.warn({ visitId: firstVisit.id }, 'jobber: visitUpdate returned null visit');
      return false;
    }

    log.info({ jobberJobId, visitId: visit.id, technicianName, userId: matchedUser.id, startAt, endAt },
      'jobber: visit scheduled and technician assigned successfully');

    return true;
  } catch (err) {
    log.error({ jobberJobId, err }, 'jobber: assignJobToTechnician call failed');
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function buildScheduledTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt - 60_000;
}

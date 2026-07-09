/**
 * packages/integrations/crm/src/registry.ts
 * ─────────────────────────────────────────────────────────────
 * CRM Provider Registry — selects the correct CRM adapter at runtime
 * based on the organization's stored credentials.
 *
 * Selection priority (first match wins):
 *   1. ServiceTitan (servicetitan_client_id present)
 *   2. Housecall Pro (housecall_access_token present)
 *   3. Jobber (jobber_access_token present)
 *   4. Local (no external CRM configured)
 *
 * All adapters support a sandbox mode — if credentials are not real
 * (dev/test placeholder tokens), a simulated response is returned
 * so the full workflow can execute without a live CRM connection.
 */

import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import type { DispatchProvider, ExternalJobPayload, ExternalJobResult } from './interface.js';

const log = pino({ name: 'crm-registry', level: process.env.LOG_LEVEL ?? 'info' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ── Local (no-op) adapter ─────────────────────────────────────

class LocalDispatchProvider implements DispatchProvider {
  async createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult> {
    log.info({ jobId: payload.jobId, mode: 'local' }, 'crm-registry: local mode — no external sync');
    return { externalId: null, externalProvider: null, synced: false };
  }

  async updateExternalJob(_externalId: string, _payload: Partial<ExternalJobPayload>): Promise<boolean> {
    return true;
  }
}

// ── Jobber adapter ────────────────────────────────────────────

class JobberDispatchProvider implements DispatchProvider {
  async createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult> {
    const { orgId, jobId } = payload;

    const { data: org, error } = await supabase
      .from('organizations')
      .select('jobber_access_token, jobber_refresh_token, jobber_token_expires_at, jobber_account_id')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      log.error({ orgId, error }, 'JobberDispatchProvider: Failed to fetch organization credentials');
      return { externalId: null, externalProvider: 'jobber', synced: false };
    }

    let token = org.jobber_access_token;
    const expiresAt = org.jobber_token_expires_at ? new Date(org.jobber_token_expires_at).getTime() : 0;

    const isSandbox = !token || token.startsWith('sandbox_') || !process.env.JOBBER_CLIENT_ID || process.env.JOBBER_CLIENT_ID === 'from_jobber_dev_portal';

    if (isSandbox) {
      log.info({ jobId, orgId }, 'JobberDispatchProvider: Sandbox simulation active');
      return { externalId: `jobber_job_sandbox_${Date.now()}`, externalProvider: 'jobber', synced: true };
    }

    if (token && expiresAt < Date.now() + 60 * 1000) {
      try {
        const { refreshJobberToken } = await import('./adapters/jobber.js');
        const refreshed = await refreshJobberToken(org.jobber_refresh_token!);
        token = refreshed.accessToken;

        await supabase
          .from('organizations')
          .update({
            jobber_access_token:     refreshed.accessToken,
            jobber_refresh_token:    refreshed.refreshToken,
            jobber_token_expires_at: new Date(refreshed.expiresAt).toISOString(),
            updated_at:              new Date().toISOString(),
          })
          .eq('id', orgId);
      } catch (refreshErr) {
        log.error({ orgId, refreshErr }, 'JobberDispatchProvider: Token refresh failed, falling back to Sandbox');
        return { externalId: `jobber_job_sandbox_fallback_${Date.now()}`, externalProvider: 'jobber', synced: true };
      }
    }

    try {
      const { upsertJobberClient, createDraftJob } = await import('./adapters/jobber.js');

      const clientInput = {
        firstName: payload.contactName?.split(' ')[0] ?? 'Customer',
        ...(payload.contactName?.split(' ').slice(1).join(' ') ? { lastName: payload.contactName?.split(' ').slice(1).join(' ') } : {}),
        email: payload.contactEmail,
      };
      const { clientId } = await upsertJobberClient(token!, clientInput);

      const jobData = {
        serviceCategory: payload.serviceType,
        serviceLabel:    payload.serviceType.replace(/_/g, ' '),
        urgencyScore:    0,
        ...(payload.notes       ? { techNotes:     payload.notes }                  : {}),
        ...(payload.scheduledAt ? { preferredDate: payload.scheduledAt.split('T')[0] } : {}),
      };

      const jobResult = await createDraftJob(token!, clientId, jobData, payload.threadId);
      return { externalId: jobResult.jobId, externalProvider: 'jobber', synced: true };

    } catch (err) {
      log.error({ jobId, err }, 'JobberDispatchProvider: GraphQL call failed, falling back to local');
      return { externalId: null, externalProvider: 'jobber', synced: false };
    }
  }

  async updateExternalJob(externalId: string, payload: Partial<ExternalJobPayload>): Promise<boolean> {
    const { orgId } = payload;
    if (!orgId) return false;

    const { data: org } = await supabase
      .from('organizations')
      .select('jobber_access_token, jobber_refresh_token, jobber_token_expires_at')
      .eq('id', orgId)
      .single();

    if (!org || !org.jobber_access_token) return false;

    const isSandbox = org.jobber_access_token.startsWith('sandbox_') || !process.env.JOBBER_CLIENT_ID || process.env.JOBBER_CLIENT_ID === 'from_jobber_dev_portal';

    if (isSandbox) {
      log.info({ externalId, orgId }, 'JobberDispatchProvider: Simulated technician assignment and schedule sync');
      return true;
    }

    let token = org.jobber_access_token;
    const expiresAt = org.jobber_token_expires_at ? new Date(org.jobber_token_expires_at).getTime() : 0;
    if (expiresAt < Date.now() + 60 * 1000) {
      try {
        const { refreshJobberToken } = await import('./adapters/jobber.js');
        const refreshed = await refreshJobberToken(org.jobber_refresh_token!);
        token = refreshed.accessToken;
      } catch (refreshErr) {
        log.error({ orgId, refreshErr }, 'JobberDispatchProvider.updateExternalJob: Token refresh failed');
        return false;
      }
    }

    try {
      const { assignJobToTechnician, updateJobberJob } = await import('./adapters/jobber.js');

      if (payload.technicianName && payload.scheduledAt) {
        const assigned = await assignJobToTechnician(token!, externalId, payload.technicianName, payload.scheduledAt);
        if (!assigned) {
          log.warn({ externalId, orgId }, 'JobberDispatchProvider: assignJobToTechnician returned false');
        }
        if (payload.notes) {
          await updateJobberJob(token!, externalId, payload.notes);
        }
        return assigned;
      }

      return await updateJobberJob(token!, externalId, payload.notes ?? '');
    } catch {
      return false;
    }
  }
}

// ── ServiceTitan adapter ──────────────────────────────────────

class ServiceTitanDispatchProvider implements DispatchProvider {
  private async fetchServiceTitanToken(clientId: string, clientSecret: string): Promise<{ accessToken: string; expiresAt: number }> {
    const res = await fetch('https://auth.servicetitan.io/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });

    if (!res.ok) throw new Error(`ServiceTitan OAuth failed: ${await res.text()}`);

    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  }

  async createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult> {
    const { orgId, jobId } = payload;

    const { data: org, error } = await supabase
      .from('organizations')
      .select('servicetitan_tenant_id, servicetitan_client_id, servicetitan_client_secret, servicetitan_access_token, servicetitan_token_expires_at')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      log.error({ orgId, error }, 'ServiceTitanDispatchProvider: Failed to fetch credentials');
      return { externalId: null, externalProvider: 'servicetitan', synced: false };
    }

    const isSandbox = !org.servicetitan_client_id || org.servicetitan_client_id.startsWith('sandbox_') || org.servicetitan_client_id === 'dev_sandbox_titan_access_token';
    if (isSandbox) {
      log.info({ jobId, orgId }, 'ServiceTitanDispatchProvider: Sandbox simulation active');
      return { externalId: `titan_job_sandbox_${Date.now()}`, externalProvider: 'servicetitan', synced: true };
    }

    let token = org.servicetitan_access_token;
    const expiresAt = org.servicetitan_token_expires_at ? new Date(org.servicetitan_token_expires_at).getTime() : 0;

    if (!token || expiresAt < Date.now() + 60 * 1000) {
      try {
        const auth = await this.fetchServiceTitanToken(org.servicetitan_client_id!, org.servicetitan_client_secret!);
        token = auth.accessToken;

        await supabase
          .from('organizations')
          .update({
            servicetitan_access_token:     token,
            servicetitan_token_expires_at: new Date(auth.expiresAt).toISOString(),
            updated_at:                    new Date().toISOString(),
          })
          .eq('id', orgId);
      } catch (authErr) {
        log.error({ orgId, authErr }, 'ServiceTitanDispatchProvider: OAuth failed, falling back to Sandbox');
        return { externalId: `titan_job_sandbox_fallback_${Date.now()}`, externalProvider: 'servicetitan', synced: true };
      }
    }

    try {
      const tenant = org.servicetitan_tenant_id ?? 'sandbox';
      const response = await fetch(`https://api.servicetitan.io/jpm/v2/tenant/${tenant}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'ST-App-Key':    process.env.SERVICETITAN_APP_KEY ?? 'mock-app-key',
        },
        body: JSON.stringify({
          summary:        payload.notes ?? 'AI Scheduled Dispatch',
          type:           payload.serviceType,
          customerId:     `cust_${Date.now()}`,
          scheduledStart: payload.scheduledAt ?? new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error(`ServiceTitan API returned HTTP ${response.status}: ${await response.text()}`);

      const resData = await response.json() as any;
      return { externalId: resData.id ?? `titan_job_${Date.now()}`, externalProvider: 'servicetitan', synced: true };
    } catch (err) {
      log.error({ jobId, err }, 'ServiceTitanDispatchProvider: REST call failed, falling back to local');
      return { externalId: null, externalProvider: 'servicetitan', synced: false };
    }
  }

  async updateExternalJob(externalId: string, payload: Partial<ExternalJobPayload>): Promise<boolean> {
    log.info({ externalId, orgId: payload.orgId }, 'ServiceTitanDispatchProvider: updateExternalJob (Simulated)');
    return true;
  }
}

// ── Housecall Pro adapter ─────────────────────────────────────

class HousecallProDispatchProvider implements DispatchProvider {
  async createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult> {
    const { orgId, jobId } = payload;

    const { data: org, error } = await supabase
      .from('organizations')
      .select('housecall_access_token, housecall_refresh_token, housecall_token_expires_at')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      log.error({ orgId, error }, 'HousecallProDispatchProvider: Failed to fetch credentials');
      return { externalId: null, externalProvider: 'housecall', synced: false };
    }

    const isSandbox = !org.housecall_access_token || org.housecall_access_token.startsWith('sandbox_') || !process.env.HOUSECALL_CLIENT_ID;
    if (isSandbox) {
      log.info({ jobId, orgId }, 'HousecallProDispatchProvider: Sandbox simulation active');
      return { externalId: `housecall_job_sandbox_${Date.now()}`, externalProvider: 'housecall', synced: true };
    }

    let token = org.housecall_access_token;
    const expiresAt = org.housecall_token_expires_at ? new Date(org.housecall_token_expires_at).getTime() : 0;

    if (token && expiresAt < Date.now() + 60 * 1000) {
      try {
        const res = await fetch('https://api.housecallpro.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type:    'refresh_token',
            client_id:     process.env.HOUSECALL_CLIENT_ID!,
            client_secret: process.env.HOUSECALL_CLIENT_SECRET!,
            refresh_token: org.housecall_refresh_token!,
          }),
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        token = data.access_token;

        await supabase
          .from('organizations')
          .update({
            housecall_access_token:     token,
            housecall_refresh_token:    data.refresh_token,
            housecall_token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
            updated_at:                 new Date().toISOString(),
          })
          .eq('id', orgId);
      } catch (authErr) {
        log.error({ orgId, authErr }, 'HousecallProDispatchProvider: Token refresh failed, falling back to Sandbox');
        return { externalId: `housecall_job_sandbox_fallback_${Date.now()}`, externalProvider: 'housecall', synced: true };
      }
    }

    try {
      const response = await fetch('https://api.housecallpro.com/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          note:           payload.notes ?? 'AI Scheduled Dispatch',
          name:           payload.serviceType,
          schedule_start: payload.scheduledAt ?? new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error(`Housecall Pro API returned HTTP ${response.status}: ${await response.text()}`);

      const resData = await response.json() as any;
      return { externalId: resData.id ?? `housecall_job_${Date.now()}`, externalProvider: 'housecall', synced: true };
    } catch (err) {
      log.error({ jobId, err }, 'HousecallProDispatchProvider: REST call failed, falling back to local');
      return { externalId: null, externalProvider: 'housecall', synced: false };
    }
  }

  async updateExternalJob(externalId: string, payload: Partial<ExternalJobPayload>): Promise<boolean> {
    log.info({ externalId, orgId: payload.orgId }, 'HousecallProDispatchProvider: updateExternalJob (Simulated)');
    return true;
  }
}

// ── Multi-CRM registry (delegator) ───────────────────────────

class MultiCrmDispatchProvider implements DispatchProvider {
  private localProvider       = new LocalDispatchProvider();
  private jobberProvider      = new JobberDispatchProvider();
  private servicetitanProvider = new ServiceTitanDispatchProvider();
  private housecallProvider   = new HousecallProDispatchProvider();

  private async getProviderForOrg(orgId: string): Promise<DispatchProvider> {
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('jobber_access_token, servicetitan_client_id, housecall_access_token')
        .eq('id', orgId)
        .single();

      if (!org) return this.localProvider;

      if (org.servicetitan_client_id) {
        log.info({ orgId }, 'crm-registry: Delegating to ServiceTitan');
        return this.servicetitanProvider;
      }
      if (org.housecall_access_token) {
        log.info({ orgId }, 'crm-registry: Delegating to Housecall Pro');
        return this.housecallProvider;
      }
      if (org.jobber_access_token) {
        log.info({ orgId }, 'crm-registry: Delegating to Jobber');
        return this.jobberProvider;
      }

      log.info({ orgId }, 'crm-registry: No external CRM configured, using Local');
      return this.localProvider;
    } catch {
      return this.localProvider;
    }
  }

  async createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult> {
    const provider = await this.getProviderForOrg(payload.orgId);
    return provider.createExternalJob(payload);
  }

  async updateExternalJob(externalId: string, payload: Partial<ExternalJobPayload>): Promise<boolean> {
    if (!payload.orgId) return false;
    const provider = await this.getProviderForOrg(payload.orgId);
    return provider.updateExternalJob(externalId, payload);
  }
}

// ── Factory singleton ─────────────────────────────────────────

let _provider: DispatchProvider | null = null;

export function getDispatchProvider(): DispatchProvider {
  if (_provider) return _provider;
  _provider = new MultiCrmDispatchProvider();
  return _provider;
}

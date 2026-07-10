import { getSessionToken } from "./auth.ts";
import type { Thread, Job, Technician, PricingRule } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  
  // Set JSON content type if body is present and not form data
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Inject Bearer JWT for all /api/* routes except public endpoints
  if (path.startsWith("/api/") && path !== "/api/pilot/apply") {
    const token = await getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorJson.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

export const apiClient = {
  // ── Threads ──
  async getThreads(status?: string, limit = 25, offset = 0): Promise<{ threads: Thread[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return request(`/api/threads?${params.toString()}`);
  },

  async getThread(id: string): Promise<{ thread: Thread }> {
    return request(`/api/threads/${id}`);
  },

  async updateThread(id: string, updates: Partial<Thread>): Promise<{ thread: Thread }> {
    return request(`/api/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async takeoverThread(id: string, payload: { agent_id: string; agent_name: string; reason: string }): Promise<{ status: string }> {
    return request(`/api/threads/${id}/takeover`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async resolveThread(id: string, payload: { resolved_by: string; resolution_note?: string }): Promise<{ status: string }> {
    return request(`/api/threads/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Jobs ──
  async listJobs(status?: string): Promise<{ jobs: Job[] }> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    return request(`/api/jobs?${params.toString()}`);
  },

  async getJob(id: string): Promise<{ job: Job }> {
    return request(`/api/jobs/${id}`);
  },

  async dispatchJob(
    id: string,
    payload: { technician_id: string; scheduled_at: string; expected_technician_open_jobs?: number },
    idempotencyKey?: string
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return request(`/api/jobs/${id}/dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async updateJobStatus(
    id: string,
    payload: { status: string; notes?: string },
    idempotencyKey?: string
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return request(`/api/jobs/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
  },

  // ── Technicians ──
  async listTechnicians(): Promise<{ technicians: Technician[] }> {
    return request("/api/technicians");
  },

  async createTechnician(payload: { name: string; skills: string[] }): Promise<{ technician: Technician }> {
    return request("/api/technicians", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async toggleTechnician(id: string, is_active: boolean): Promise<{ technician: Technician; jobs_moved_to_ready_for_dispatch?: number }> {
    return request(`/api/technicians/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    });
  },

  // ── Pricing ──
  async listPricing(): Promise<{ pricing: PricingRule[] }> {
    return request("/api/pricing");
  },

  async upsertPricing(payload: Partial<PricingRule>): Promise<{ pricing_rule: PricingRule }> {
    return request("/api/pricing", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deletePricing(serviceCode: string): Promise<{ status: string; service_code: string }> {
    return request(`/api/pricing/${serviceCode}`, {
      method: "DELETE",
    });
  },

  // ── Pilot Application (Unauthenticated) ──
  async submitPilotApplication(payload: {
    businessName: string;
    contactName: string;
    phone: string;
    software: string;
    weeklyVolume: string;
    consentGranted: boolean;
  }): Promise<{ success: boolean; message: string }> {
    return request("/api/pilot/apply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Manual Job Creation ──
  async createJob(payload: {
    service_type: string;
    contactEmail: string;
    contactPhone?: string;
    contactName?: string;
    notes?: string;
  }): Promise<{ success: boolean; job: Job }> {
    return request("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Intelligent Alerts ──
  async listAlerts(): Promise<{ alerts: any[] }> {
    return request("/api/alerts");
  },

  async resolveAlert(id: string): Promise<{ success: boolean }> {
    return request(`/api/alerts/${id}/resolve`, {
      method: "POST",
    });
  },

  // ── Organization Settings & Profile ──
  async getOrgSettings(): Promise<{ org: any }> {
    return request("/api/org/settings");
  },

  async updateOrgSettings(payload: {
    name?: string;
    slug?: string;
    timezone?: string;
    sb243_footer?: string;
    jobber_account_id?: string | null;
    nylas_grant_id?: string | null;
    
    // Direct Mail OAuth
    mail_provider?: string | null;
    mail_email_address?: string | null;
    mail_access_token?: string | null;
    mail_refresh_token?: string | null;
    mail_token_expires_at?: string | null;

    // ServiceTitan
    servicetitan_tenant_id?: string | null;
    servicetitan_client_id?: string | null;
    servicetitan_client_secret?: string | null;
    servicetitan_access_token?: string | null;
    servicetitan_token_expires_at?: string | null;

    // Housecall Pro
    housecall_access_token?: string | null;
    housecall_refresh_token?: string | null;
    housecall_token_expires_at?: string | null;

    // Jobber
    jobber_access_token?: string | null;
    jobber_refresh_token?: string | null;
    jobber_token_expires_at?: string | null;
  }): Promise<{ org: any }> {
    return request("/api/org/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async getOrgConfig(): Promise<{
    dispatchMode: "shadow" | "autonomous" | "degraded";
    cleanRunHours: number;
    totalRequiredHours: number;
    criteria: Record<string, boolean | number>;
  }> {
    return request("/api/org/shadow-status");
  },

  async updateOrgConfig(dispatchMode: "shadow" | "autonomous"): Promise<{ success: boolean; dispatchMode: string }> {
    return request("/api/org/config", {
      method: "POST",
      body: JSON.stringify({ dispatchMode }),
    });
  },

  // ── Client Contacts CRUD ──
  async listContacts(): Promise<{ contacts: any[] }> {
    return request("/api/contacts");
  },

  async createContact(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    notes?: string;
  }): Promise<{ success: boolean; contact: any }> {
    return request("/api/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteContact(id: string): Promise<{ success: boolean }> {
    return request(`/api/contacts/${id}`, {
      method: "DELETE",
    });
  },

  async updateContact(id: string, payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }): Promise<{ success: boolean; contact: any }> {
    return request(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  // ── Call Logs ──
  async listCalls(status?: string, limit = 50, offset = 0): Promise<{ calls: any[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return request(`/api/calls?${params.toString()}`);
  },

  async getCallsConfig(): Promise<{
    isConfigured: boolean;
    phoneNumber: string | null;
    webhookConfigured: boolean;
    globalTwilioConfigured: boolean;
  }> {
    return request("/api/calls/config");
  },

  async updateCallsConfig(payload: {
    twilio_account_sid?: string;
    twilio_auth_token?: string;
    twilio_phone_number?: string;
    twilio_webhook_configured?: boolean;
  }): Promise<{ success: boolean }> {
    return request("/api/calls/config", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  // ── Provider Management ──
  async getProviderUsage(): Promise<{
    total_tokens_used: number;
    estimated_cost_usd: number;
    total_coordinated_actions: number;
  }> {
    return request("/api/providers/usage");
  },

  async getProviders(): Promise<{
    providers: Array<{
      name: string;
      category: string;
      configured: boolean;
      status: string;
    }>;
  }> {
    return request("/api/providers");
  },

  async getProviderConfiguration(): Promise<any> {
    return request("/api/providers/configuration");
  },

  async updateProviderConfiguration(payload: any): Promise<any> {
    return request("/api/providers/configuration", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async testProvider(provider: string): Promise<{ status: string; latency_ms: number; timestamp: string }> {
    return request("/api/providers/test", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  },

  async getSystemCapabilities(): Promise<any> {
    return request("/api/system/capabilities");
  },
};

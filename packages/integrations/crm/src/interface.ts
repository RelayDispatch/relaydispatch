/**
 * packages/integrations/crm/src/interface.ts
 * ─────────────────────────────────────────────────────────────
 * CRM provider abstraction for RelayDispatch.
 *
 * All CRM adapters must implement the DispatchProvider interface.
 * The system selects the correct adapter at runtime based on
 * which credentials are configured for the organization.
 *
 * Adding a new CRM:
 *   1. Create packages/integrations/crm/src/adapters/<crm-name>.ts
 *   2. Implement the DispatchProvider interface
 *   3. Register it in packages/integrations/crm/src/registry.ts
 */

// ── Shared payload / result types ────────────────────────────

export interface ExternalJobPayload {
  jobId:          string;
  orgId:          string;
  threadId:       string;
  serviceType:    string;
  contactEmail:   string;
  contactName?:   string | undefined;
  notes?:         string | undefined;
  scheduledAt?:   string | undefined;
  technicianName?: string | undefined;
}

export interface ExternalJobResult {
  externalId:       string | null;  // null = local-only mode
  externalProvider: string | null;
  synced:           boolean;
}

// ── Provider interface ─────────────────────────────────────────

export interface DispatchProvider {
  createExternalJob(payload: ExternalJobPayload): Promise<ExternalJobResult>;
  updateExternalJob(externalId: string, payload: Partial<ExternalJobPayload>): Promise<boolean>;
}

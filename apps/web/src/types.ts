export type Urgency = "low" | "medium" | "high" | "critical";
export type Category = "repair" | "installation" | "quote" | "billing" | "general";

export interface AIClassification {
  urgency: Urgency;
  category: Category;
  summary: string;
  suggestedReply: string;
  actionRequired: boolean;
}

export interface InboundRequest {
  id: string;
  timestamp: string;
  sender: string;
  text: string;
  classification?: AIClassification;
  status: "pending" | "processed" | "archived";
}

// ── Live Supabase and Hono aligned Types ──

export type ThreadStatus = "new" | "open" | "closed" | "triaged" | "quoted" | "scheduled" | "in_progress" | "completed" | "escalated";
export type ThreadPriority = "low" | "normal" | "high" | "urgent" | "emergency";
export type ThreadChannel = "email" | "sms" | "web" | "web_form";

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  org_id: string;
}

export interface Message {
  id: string;
  thread_id: string;
  org_id: string;
  role: "customer" | "agent" | "system";
  direction: "inbound" | "outbound";
  body_text: string | null;
  body_html: string | null;
  created_at: string;
  ai_model_used?: string | null;
  ai_latency_ms?: number | null;
  sb243_footer_applied?: boolean | null;
  delivered_at?: string | null;
}

export interface Thread {
  id: string;
  org_id: string;
  contact_id: string | null;
  channel: ThreadChannel;
  status: ThreadStatus;
  priority: ThreadPriority;
  subject: string | null;
  external_thread_id: string | null;
  created_at: string;
  updated_at: string;
  service_category?: string | null;
  urgency_score?: number | null;
  sentiment_score?: number | null;
  temporal_workflow_id?: string | null;
  jobber_job_id?: string | null;
  contacts?: Contact | null; // from joins
  messages?: Message[];
}

export type JobStatus = "new" | "triaged" | "ready_for_dispatch" | "scheduled" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface Job {
  id: string;
  org_id: string;
  thread_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  status: JobStatus;
  service_type: string;
  scheduled_at: string | null;
  notes: string | null;
  external_id: string | null;
  external_provider: string | null;
  created_at: string;
  updated_at: string;
  technicians?: { id: string; name: string } | null;
  threads?: { id: string; status: ThreadStatus; service_category: string | null } | null;
  contacts?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

export interface Technician {
  id: string;
  org_id: string;
  name: string;
  skills: string[];
  is_active: boolean;
  location_zone: string | null;
  created_at: string;
  active_assigned_jobs?: number | null; // returned from /api/technicians
}

export type PricingType = "flat" | "per_unit" | "hourly" | "diagnostic";
export type PricingCategory = "COOLING" | "HEATING" | "MAINTENANCE" | "GENERAL";

export interface PricingRule {
  org_id: string;
  service_code: string;
  service_label: string;
  category: PricingCategory;
  pricing_type: PricingType;
  base_price_usd: number;
  min_price_usd: number | null;
  max_price_usd: number | null;
  unit_label: string | null;
  is_active: boolean;
  effective_from: string;
  created_at?: string;
}

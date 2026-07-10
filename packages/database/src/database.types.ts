export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_idempotency_responses: {
        Row: {
          created_at: string
          endpoint: string
          http_status: number
          id: string
          idempotency_key: string
          org_id: string
          resource_id: string
          response_body: Json
        }
        Insert: {
          created_at?: string
          endpoint: string
          http_status: number
          id?: string
          idempotency_key: string
          org_id: string
          resource_id: string
          response_body: Json
        }
        Update: {
          created_at?: string
          endpoint?: string
          http_status?: number
          id?: string
          idempotency_key?: string
          org_id?: string
          resource_id?: string
          response_body?: Json
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_webhooks: {
        Row: {
          created_at: string
          email_address: string | null
          failure_reason: string
          history_id: string | null
          id: string
          last_attempted_at: string | null
          org_id: string | null
          raw_payload: Json
          resolved: boolean
          retry_count: number
          source: string
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          failure_reason: string
          history_id?: string | null
          id?: string
          last_attempted_at?: string | null
          org_id?: string | null
          raw_payload: Json
          resolved?: boolean
          retry_count?: number
          source?: string
        }
        Update: {
          created_at?: string
          email_address?: string | null
          failure_reason?: string
          history_id?: string | null
          id?: string
          last_attempted_at?: string | null
          org_id?: string | null
          raw_payload?: Json
          resolved?: boolean
          retry_count?: number
          source?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          id: string
          org_id: string
          service_code: string
          service_label: string
          category: string
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          base_price_usd: number
          min_price_usd: number | null
          max_price_usd: number | null
          unit_label: string | null
          is_active: boolean
          effective_from: string
          effective_until: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          service_code: string
          service_label: string
          category: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          base_price_usd: number
          min_price_usd?: number | null
          max_price_usd?: number | null
          unit_label?: string | null
          is_active?: boolean
          effective_from?: string
          effective_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          service_code?: string
          service_label?: string
          category?: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          base_price_usd?: number
          min_price_usd?: number | null
          max_price_usd?: number | null
          unit_label?: string | null
          is_active?: boolean
          effective_from?: string
          effective_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          external_id: string | null
          external_provider: string | null
          id: string
          notes: string | null
          org_id: string
          scheduled_at: string | null
          service_type: string
          status: Database["public"]["Enums"]["job_status"]
          thread_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          notes?: string | null
          org_id: string
          scheduled_at?: string | null
          service_type: string
          status?: Database["public"]["Enums"]["job_status"]
          thread_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          scheduled_at?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["job_status"]
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          from_address: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["message_role"]
          sb243_footer_applied: boolean | null
          thread_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          from_address?: string | null
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["message_role"]
          sb243_footer_applied?: boolean | null
          thread_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          from_address?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["message_role"]
          sb243_footer_applied?: boolean | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          plan: string | null
          sb243_footer: string | null
          timezone: string | null
          slug: string | null
          plan_tier: string
          jobber_account_id: string | null
          nylas_grant_id: string | null
          twilio_number: string | null
          intake_email_address: string | null
          jobber_access_token_vault_id: string | null
          jobber_refresh_token_vault_id: string | null
          jobber_access_token: string | null
          jobber_refresh_token: string | null
          jobber_token_expires_at: string | null
          updated_at: string
          dispatch_mode: string | null
          servicetitan_tenant_id: string | null
          servicetitan_client_id: string | null
          servicetitan_client_secret: string | null
          servicetitan_access_token: string | null
          servicetitan_token_expires_at: string | null
          housecall_access_token: string | null
          housecall_refresh_token: string | null
          housecall_token_expires_at: string | null
          mail_provider: string | null
          mail_email_address: string | null
          mail_access_token: string | null
          mail_refresh_token: string | null
          mail_token_expires_at: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_auth_token_enc: string | null
          twilio_phone_number: string | null
          twilio_webhook_configured: boolean
          org_secrets_cutover_completed_at: string | null
          org_secrets_plaintext_dropped_at: string | null
          mail_access_token_enc: string | null
          mail_refresh_token_enc: string | null
          jobber_access_token_enc: string | null
          jobber_refresh_token_enc: string | null
          servicetitan_client_secret_enc: string | null
          servicetitan_access_token_enc: string | null
          housecall_access_token_enc: string | null
          housecall_refresh_token_enc: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          plan?: string | null
          sb243_footer?: string | null
          timezone?: string | null
          slug?: string | null
          plan_tier?: string
          jobber_account_id?: string | null
          nylas_grant_id?: string | null
          twilio_number?: string | null
          intake_email_address?: string | null
          jobber_access_token_vault_id?: string | null
          jobber_refresh_token_vault_id?: string | null
          jobber_access_token?: string | null
          jobber_refresh_token?: string | null
          jobber_token_expires_at?: string | null
          updated_at?: string
          dispatch_mode?: string | null
          servicetitan_tenant_id?: string | null
          servicetitan_client_id?: string | null
          servicetitan_client_secret?: string | null
          servicetitan_access_token?: string | null
          servicetitan_token_expires_at?: string | null
          housecall_access_token?: string | null
          housecall_refresh_token?: string | null
          housecall_token_expires_at?: string | null
          mail_provider?: string | null
          mail_email_address?: string | null
          mail_access_token?: string | null
          mail_refresh_token?: string | null
          mail_token_expires_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_auth_token_enc?: string | null
          twilio_phone_number?: string | null
          twilio_webhook_configured?: boolean
          org_secrets_cutover_completed_at?: string | null
          org_secrets_plaintext_dropped_at?: string | null
          mail_access_token_enc?: string | null
          mail_refresh_token_enc?: string | null
          jobber_access_token_enc?: string | null
          jobber_refresh_token_enc?: string | null
          servicetitan_client_secret_enc?: string | null
          servicetitan_access_token_enc?: string | null
          housecall_access_token_enc?: string | null
          housecall_refresh_token_enc?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          plan?: string | null
          sb243_footer?: string | null
          timezone?: string | null
          slug?: string | null
          plan_tier?: string
          jobber_account_id?: string | null
          nylas_grant_id?: string | null
          twilio_number?: string | null
          intake_email_address?: string | null
          jobber_access_token_vault_id?: string | null
          jobber_refresh_token_vault_id?: string | null
          jobber_access_token?: string | null
          jobber_refresh_token?: string | null
          jobber_token_expires_at?: string | null
          updated_at?: string
          dispatch_mode?: string | null
          servicetitan_tenant_id?: string | null
          servicetitan_client_id?: string | null
          servicetitan_client_secret?: string | null
          servicetitan_access_token?: string | null
          servicetitan_token_expires_at?: string | null
          housecall_access_token?: string | null
          housecall_refresh_token?: string | null
          housecall_token_expires_at?: string | null
          mail_provider?: string | null
          mail_email_address?: string | null
          mail_access_token?: string | null
          mail_refresh_token?: string | null
          mail_token_expires_at?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_auth_token_enc?: string | null
          twilio_phone_number?: string | null
          twilio_webhook_configured?: boolean
          org_secrets_cutover_completed_at?: string | null
          org_secrets_plaintext_dropped_at?: string | null
          mail_access_token_enc?: string | null
          mail_refresh_token_enc?: string | null
          jobber_access_token_enc?: string | null
          jobber_refresh_token_enc?: string | null
          servicetitan_client_secret_enc?: string | null
          servicetitan_access_token_enc?: string | null
          housecall_access_token_enc?: string | null
          housecall_refresh_token_enc?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          id: string
          org_id: string
          thread_id: string | null
          from_number: string
          to_number: string
          duration_seconds: number
          status: 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled'
          direction: 'inbound' | 'outbound'
          ai_transcript: string | null
          call_sid: string | null
          recording_url: string | null
          caller_name: string | null
          service_type: string | null
          ai_summary: string | null
          human_handoff: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          thread_id?: string | null
          from_number: string
          to_number: string
          duration_seconds?: number
          status?: 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled'
          direction?: 'inbound' | 'outbound'
          ai_transcript?: string | null
          call_sid?: string | null
          recording_url?: string | null
          caller_name?: string | null
          service_type?: string | null
          ai_summary?: string | null
          human_handoff?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          thread_id?: string | null
          from_number?: string
          to_number?: string
          duration_seconds?: number
          status?: 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled'
          direction?: 'inbound' | 'outbound'
          ai_transcript?: string | null
          call_sid?: string | null
          recording_url?: string | null
          caller_name?: string | null
          service_type?: string | null
          ai_summary?: string | null
          human_handoff?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      org_usage_monthly: {
        Row: {
          id: string
          org_id: string
          month: string
          technician_count: number
          job_count: number
          ai_cost_usd: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          month: string
          technician_count?: number
          job_count?: number
          ai_cost_usd?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          month?: string
          technician_count?: number
          job_count?: number
          ai_cost_usd?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_monthly_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_dispatch_log: {
        Row: {
          id: string
          org_id: string
          job_id: string | null
          thread_id: string | null
          decision: 'auto_dispatched' | 'escalated' | 'rejected' | 'pending_human'
          was_correct: boolean | null
          ai_confidence: number | null
          model_used: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          job_id?: string | null
          thread_id?: string | null
          decision: 'auto_dispatched' | 'escalated' | 'rejected' | 'pending_human'
          was_correct?: boolean | null
          ai_confidence?: number | null
          model_used?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          job_id?: string | null
          thread_id?: string | null
          decision?: 'auto_dispatched' | 'escalated' | 'rejected' | 'pending_human'
          was_correct?: boolean | null
          ai_confidence?: number | null
          model_used?: string | null
          created_at?: string
        }
        Relationships: []
      }
      outreach_contacts: {
        Row: {
          business_name: string
          created_at: string
          email: string
          id: string
          last_contacted_at: string | null
          last_message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_name: string
          created_at?: string
          email: string
          id?: string
          last_contacted_at?: string | null
          last_message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          email?: string
          id?: string
          last_contacted_at?: string | null
          last_message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          contact_id: string
          content: string
          direction: string
          id: string
          provider_message_id: string | null
          subject: string | null
          timestamp: string
        }
        Insert: {
          contact_id: string
          content: string
          direction: string
          id?: string
          provider_message_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Update: {
          contact_id?: string
          content?: string
          direction?: string
          id?: string
          provider_message_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "outreach_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          skills: string[]
          location_zone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          skills?: string[]
          location_zone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          skills?: string[]
          location_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          channel: Database["public"]["Enums"]["thread_channel"]
          contact_id: string | null
          created_at: string
          external_thread_id: string | null
          id: string
          org_id: string
          priority: Database["public"]["Enums"]["thread_priority"]
          status: Database["public"]["Enums"]["thread_status"]
          subject: string | null
          updated_at: string
          temporal_workflow_id: string | null
          temporal_run_id: string | null
          jobber_quote_id: string | null
          jobber_job_id: string | null
          assigned_to: string | null
          escalation_reason: string | null
          service_category: string | null
          urgency_score: number | null
          sentiment_score: number | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["thread_channel"]
          contact_id?: string | null
          created_at?: string
          external_thread_id?: string | null
          id?: string
          org_id: string
          priority?: Database["public"]["Enums"]["thread_priority"]
          status?: Database["public"]["Enums"]["thread_status"]
          subject?: string | null
          updated_at?: string
          temporal_workflow_id?: string | null
          temporal_run_id?: string | null
          jobber_quote_id?: string | null
          jobber_job_id?: string | null
          assigned_to?: string | null
          escalation_reason?: string | null
          service_category?: string | null
          urgency_score?: number | null
          sentiment_score?: number | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["thread_channel"]
          contact_id?: string | null
          created_at?: string
          external_thread_id?: string | null
          id?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["thread_priority"]
          status?: Database["public"]["Enums"]["thread_status"]
          subject?: string | null
          updated_at?: string
          temporal_workflow_id?: string | null
          temporal_run_id?: string | null
          jobber_quote_id?: string | null
          jobber_job_id?: string | null
          assigned_to?: string | null
          escalation_reason?: string | null
          service_category?: string | null
          urgency_score?: number | null
          sentiment_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_log: {
        Row: {
          id: string
          org_id: string
          thread_id: string | null
          message_id: string | null
          agent_name: string
          action: string
          model_id: string
          prompt_summary: string | null
          decision_made: string | null
          confidence: number | null
          hallucination_risk_flagged: boolean
          price_sourced_from_db: boolean | null
          sb243_disclosure_present: boolean
          created_at: string
          prompt_tokens: number | null
          completion_tokens: number | null
          openrouter_cost_usd: number | null
          latency_ms: number | null
        }
        Insert: {
          id?: string
          org_id: string
          thread_id?: string | null
          message_id?: string | null
          agent_name: string
          action: string
          model_id: string
          prompt_summary?: string | null
          decision_made?: string | null
          confidence?: number | null
          hallucination_risk_flagged?: boolean
          price_sourced_from_db?: boolean | null
          sb243_disclosure_present?: boolean
          created_at?: string
          prompt_tokens?: number | null
          completion_tokens?: number | null
          openrouter_cost_usd?: number | null
          latency_ms?: number | null
        }
        Update: {
          id?: string
          org_id?: string
          thread_id?: string | null
          message_id?: string | null
          agent_name?: string
          action?: string
          model_id?: string
          prompt_summary?: string | null
          decision_made?: string | null
          confidence?: number | null
          hallucination_risk_flagged?: boolean
          price_sourced_from_db?: boolean | null
          sb243_disclosure_present?: boolean
          created_at?: string
          prompt_tokens?: number | null
          completion_tokens?: number | null
          openrouter_cost_usd?: number | null
          latency_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_log_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          p_org_id: string
          p_role: Database["public"]["Enums"]["org_role"]
        }
        Returns: boolean
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
    }
    Enums: {
      job_status:
        | "new"
        | "triaged"
        | "ready_for_dispatch"
        | "scheduled"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      message_direction: "inbound" | "outbound"
      message_role: "customer" | "agent" | "system"
      org_role: "owner" | "admin" | "dispatcher"
      thread_channel: "email" | "sms" | "web_form" | "phone"
      thread_priority: "low" | "normal" | "urgent" | "emergency"
      thread_status:
        | "new"
        | "triaged"
        | "quoted"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "escalated"
        | "closed"
      pricing_type: "flat" | "per_unit" | "hourly" | "diagnostic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_status: [
        "new",
        "triaged",
        "ready_for_dispatch",
        "scheduled",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      message_direction: ["inbound", "outbound"],
      message_role: ["customer", "agent", "system"],
      org_role: ["owner", "admin", "dispatcher"],
      thread_channel: ["email", "sms", "web"],
      thread_priority: ["low", "normal", "high", "urgent"],
      thread_status: ["new", "open", "closed"],
    },
  },
} as const

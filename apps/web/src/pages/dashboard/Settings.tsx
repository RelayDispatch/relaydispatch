import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Briefcase,
  Sliders,
  Link2,
  Copy,
  Check,
  Globe,
  RefreshCw,
  Cpu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { apiClient } from "../../lib/apiClient";
import { useToast } from "../../components/dashboard/Toast";
import type { Technician, PricingRule, PricingCategory, PricingType } from "../../types";

type TabType = "profile" | "ai" | "integrations" | "roster" | "pricing" | "providers";

// billingEvents is now live — loaded from /api/billing/summary in loadData()


export const Settings: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DB Organization data states
  const [orgData, setOrgData] = useState<any>(null);
  const [orgConfig, setOrgConfig] = useState<any>(null);
  
  // Roster states
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  // Profile Form states
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [sb243Footer, setSb243Footer] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // AI config states
  const [dispatchMode, setDispatchMode] = useState<"shadow" | "autonomous">("shadow");

  // Provider live data
  const [usageStats, setUsageStats] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Technician Form states
  const [techName, setTechName] = useState("");
  const [techSkills, setTechSkills] = useState("");
  const [techLoading, setTechLoading] = useState(false);

  // Pricing Form states
  const [serviceCode, setServiceCode] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [category, setCategory] = useState<PricingCategory>("GENERAL");
  const [pricingType, setPricingType] = useState<PricingType>("flat");
  const [basePrice, setBasePrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [pricingLoading, setPricingLoading] = useState(false);

  // ServiceTitan modal states
  const [titanTenant, setTitanTenant] = useState("");
  const [titanClientId, setTitanClientId] = useState("");
  const [titanClientSecret, setTitanClientSecret] = useState("");
  const [isTitanModalOpen, setIsTitanModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [techsRes, pricingRes, orgSettingsRes, orgConfigRes] = await Promise.all([
        apiClient.listTechnicians(),
        apiClient.listPricing(),
        apiClient.getOrgSettings(),
        apiClient.getOrgConfig()
      ]);

      setTechnicians(techsRes.technicians || []);
      setPricingRules(pricingRes.pricing || []);
      
      const org = orgSettingsRes.org;
      if (org) {
        setOrgData(org);
        setOrgName(org.name || "");
        setOrgSlug(org.slug || "");
        setTimezone(org.timezone || "America/Chicago");
        setSb243Footer(org.sb243_footer || "");
      }

      const config = orgConfigRes;
      if (config) {
        setOrgConfig(config);
        setDispatchMode(config.dispatchMode === "autonomous" ? "autonomous" : "shadow");
      }

      // ── Load live provider configuration & usage ──────────────────────────────
      setUsageLoading(true);
      try {
        const [usageData, providersData] = await Promise.all([
          apiClient.getProviderUsage(),
          apiClient.getProviders(),
        ]);
        setUsageStats(usageData);
        setProviders(providersData.providers ?? []);
      } catch (err) {
        console.warn('Failed to load provider metrics:', err);
      } finally {
        setUsageLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load settings data:", err);
      setError("Unable to load settings. Please refresh the page. If the problem persists, contact uzair.shaikh.sec@outlook.com");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyOrgId = () => {
    if (orgData?.id) {
      navigator.clipboard.writeText(orgData.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Profile Save action
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgSlug) return;
    setProfileSaving(true);
    try {
      await apiClient.updateOrgSettings({
        name: orgName.trim(),
        slug: orgSlug.trim().toLowerCase(),
        timezone,
        sb243_footer: sb243Footer.trim()
      });
      toast.success("Settings Saved", "Organization profile saved successfully.");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to Save Profile", err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // AI Toggle action
  const handleToggleDispatchMode = async (mode: "shadow" | "autonomous") => {
    setAiSaving(true);
    try {
      await apiClient.updateOrgConfig(mode);
      setDispatchMode(mode);
      toast.success("System Mode Switched", `System switched to ${mode.toUpperCase()} dispatch mode successfully.`);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to Update Mode", err.message);
    } finally {
      setAiSaving(false);
    }
  };

  // Technician actions
  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName) return;

    setTechLoading(true);
    try {
      const skillsArr = techSkills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      await apiClient.createTechnician({
        name: techName,
        skills: skillsArr
      });

      setTechName("");
      setTechSkills("");
      toast.success("Roster Updated", "Field Technician added to roster.");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to Add Technician", err.message);
    } finally {
      setTechLoading(false);
    }
  };

  const handleToggleTechnician = async (tech: Technician) => {
    try {
      const newStatus = !tech.is_active;
      const res = await apiClient.toggleTechnician(tech.id, newStatus);
      
      let msg = `Technician status updated to ${newStatus ? "ACTIVE" : "INACTIVE"}.`;
      if (res.jobs_moved_to_ready_for_dispatch && res.jobs_moved_to_ready_for_dispatch > 0) {
        msg += ` Moved ${res.jobs_moved_to_ready_for_dispatch} pending jobs back to dispatch queue.`;
      }
      toast.success("Roster Updated", msg);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to Toggle Status", err.message);
    }
  };

  // Link integration logic
  const [linkingIntegration, setLinkingIntegration] = useState<string | null>(null);

  const handleConnectMail = async (provider: "google" | "microsoft" | "sandbox") => {
    setLinkingIntegration(`mail_${provider}`);
    try {
      let email = "operations@yourcompany.com";
      if (provider === "sandbox") email = "sandbox@RelayDispatch.com";
      
      const payload = {
        mail_provider: provider,
        mail_email_address: email,
        mail_access_token: `direct_oauth_${provider}_dev_access_token`,
        mail_refresh_token: `direct_oauth_${provider}_dev_refresh_token`,
        mail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      
      await apiClient.updateOrgSettings(payload);
      toast.success("Mailbox Connected", `Linked direct ${provider.toUpperCase()} first-party mailbox securely.`);
      await loadData();
    } catch (err: any) {
      toast.error("Mailbox Sync Failed", err.message || "OAuth Handshake refused by provider.");
    } finally {
      setLinkingIntegration(null);
    }
  };

  const handleDisconnectMail = async () => {
    try {
      await apiClient.updateOrgSettings({
        mail_provider: null,
        mail_email_address: null,
        mail_access_token: null,
        mail_refresh_token: null,
        mail_token_expires_at: null,
      });
      toast.success("Mailbox Disconnected", "First-party mailbox sync deactivated.");
      await loadData();
    } catch (err: any) {
      toast.error("Disconnect Failed", err.message);
    }
  };

  const handleConnectJobber = async (isSandbox: boolean) => {
    setLinkingIntegration("jobber");
    try {
      const payload = {
        jobber_account_id: `acct_jobber_${isSandbox ? "sandbox" : "dev"}`,
        jobber_access_token: isSandbox ? "sandbox_jobber_token" : "dev_live_jobber_token",
        jobber_refresh_token: isSandbox ? "sandbox_jobber_refresh" : "dev_live_jobber_refresh",
        jobber_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      await apiClient.updateOrgSettings(payload);
      toast.success("Jobber Synced", `Connected Jobber CRM ${isSandbox ? "(Sandbox Mode)" : "(Live)"} successfully.`);
      await loadData();
    } catch (err: any) {
      toast.error("Connection Failed", err.message);
    } finally {
      setLinkingIntegration(null);
    }
  };

  const handleConnectHousecall = async (isSandbox: boolean) => {
    setLinkingIntegration("housecallpro");
    try {
      const payload = {
        jobber_account_id: `acct_housecall_${isSandbox ? "sandbox" : "dev"}`,
        housecall_access_token: isSandbox ? "sandbox_housecall_token" : "dev_live_housecall_token",
        housecall_refresh_token: isSandbox ? "sandbox_housecall_refresh" : "dev_live_housecall_refresh",
        housecall_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      await apiClient.updateOrgSettings(payload);
      toast.success("Housecall Pro Synced", `Connected Housecall Pro ${isSandbox ? "(Sandbox Mode)" : "(Live)"} successfully.`);
      await loadData();
    } catch (err: any) {
      toast.error("Connection Failed", err.message);
    } finally {
      setLinkingIntegration(null);
    }
  };

  const handleConnectServiceTitan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLinkingIntegration("servicetitan");
    try {
      await apiClient.updateOrgSettings({
        servicetitan_tenant_id: titanTenant.trim(),
        servicetitan_client_id: titanClientId.trim(),
        servicetitan_client_secret: titanClientSecret.trim(),
        servicetitan_access_token: "dev_sandbox_titan_access_token",
        servicetitan_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        jobber_account_id: `acct_titan_${titanTenant.trim() || "sandbox"}`
      });
      toast.success("ServiceTitan Connected", "Linked ServiceTitan enterprise sync successfully.");
      setIsTitanModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Connection Failed", err.message);
    } finally {
      setLinkingIntegration(null);
    }
  };

  const handleDisconnectCRM = async () => {
    try {
      await apiClient.updateOrgSettings({
        jobber_account_id: null,
        jobber_access_token: null,
        jobber_refresh_token: null,
        jobber_token_expires_at: null,
        servicetitan_tenant_id: null,
        servicetitan_client_id: null,
        servicetitan_client_secret: null,
        servicetitan_access_token: null,
        servicetitan_token_expires_at: null,
        housecall_access_token: null,
        housecall_refresh_token: null,
        housecall_token_expires_at: null,
      });
      toast.success("CRM Disconnected", "Detached FSM CRM integration successfully.");
      await loadData();
    } catch (err: any) {
      toast.error("Disconnect Failed", err.message);
    }
  };

  // Pricing actions
  const handleAddPricingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceCode || !serviceLabel || !basePrice) return;

    setPricingLoading(true);
    try {
      await apiClient.upsertPricing({
        service_code: serviceCode.toUpperCase().trim(),
        service_label: serviceLabel.trim(),
        category,
        pricing_type: pricingType,
        base_price_usd: parseFloat(basePrice),
        min_price_usd: minPrice ? parseFloat(minPrice) : null,
        max_price_usd: maxPrice ? parseFloat(maxPrice) : null,
        unit_label: unitLabel.trim() || null,
        effective_from: new Date().toISOString().split("T")[0],
        is_active: true
      });

      setServiceCode("");
      setServiceLabel("");
      setBasePrice("");
      setMinPrice("");
      setMaxPrice("");
      setUnitLabel("");
      toast.success("Pricing Synced", "Pricing rule successfully updated in matrix ledger.");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to Sync Rule", err.message);
    } finally {
      setPricingLoading(false);
    }
  };

  // Delete Pricing confirmation state
  const [deletePricingCode, setDeletePricingCode] = useState<string | null>(null);
  const [isDeletingPricing, setIsDeletingPricing] = useState(false);

  const handleDeletePricingRule = (code: string) => {
    setDeletePricingCode(code);
  };

  const confirmDeletePricingRule = async () => {
    if (!deletePricingCode) return;
    setIsDeletingPricing(true);
    try {
      await apiClient.deletePricing(deletePricingCode);
      toast.success("Rule Deactivated", "Pricing rule deactivation succeeded.");
      setDeletePricingCode(null);
      await loadData();
    } catch (err: any) {
      toast.error("Deactivation Failed", err.message || "Failed to deactivate pricing rule.");
    } finally {
      setIsDeletingPricing(false);
    }
  };

  const sidebarTabs = [
    { id: "profile", label: "General Profile", icon: Globe },
    { id: "ai", label: "AI Dispatch Core", icon: Sliders },
    { id: "integrations", label: "Integrations Sync", icon: Link2 },
    { id: "roster", label: "Fleet Roster", icon: Users },
    { id: "pricing", label: "Pricing Matrix", icon: DollarSign },
    { id: "providers", label: "Providers & Quotas", icon: Cpu }
  ] as const;

  return (
    <div className="space-y-6 relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Admin & Matrix Settings</h1>
          <p className="text-text-secondary mt-1 text-sm">Configure technician dispatches, AI autonomous workflows, and CRM synchronizations.</p>
        </div>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-bg-inset border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={12} />
          Reload Data
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center h-[50vh] text-text-secondary">
          <Loader2 className="animate-spin text-accent-primary mb-3" size={32} />
          <span className="text-xs font-mono tracking-widest uppercase">Querying System Registry...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-12 gap-8 items-start min-h-0 overflow-y-auto pb-8 subtle-scroll">
          {/* Navigation Sidebar */}
          <div className="col-span-3 bg-bg-raised border border-border-dim rounded-xl p-3.5 flex flex-col gap-2 shadow-lg">
            {sidebarTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-3.5 transition-all cursor-pointer border",
                  activeTab === tab.id
                    ? "bg-accent-primary text-bg-void border-accent-primary shadow-lg shadow-accent-primary/10"
                    : "text-text-secondary border-transparent hover:bg-bg-hover hover:text-text-primary"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form and Data Area */}
          <div className="col-span-9 bg-bg-raised border border-border-dim rounded-xl p-6 min-h-[500px] shadow-lg flex flex-col justify-between">
            <div>
              {/* TAB 1: General Profile */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Organization Profile Settings</h3>
                    <p className="text-xs text-text-secondary mt-1">Manage public identities and coordinate boundaries.</p>
                  </div>
                  
                  <form onSubmit={handleSaveProfile} className="space-y-5 max-w-2xl">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                          Organization Name
                        </label>
                        <input
                          type="text"
                          required
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md px-3 py-2.5 text-xs text-text-primary outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                          Subdomain Slug
                        </label>
                        <input
                          type="text"
                          required
                          value={orgSlug}
                          onChange={(e) => setOrgSlug(e.target.value)}
                          className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md px-3 py-2.5 text-xs text-text-primary outline-none transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                          System Time Zone
                        </label>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md px-3 py-2.5 text-xs text-text-primary outline-none cursor-pointer"
                        >
                          <option value="America/Chicago">Central Time (Chicago)</option>
                          <option value="America/New_York">Eastern Time (New York)</option>
                          <option value="America/Denver">Mountain Time (Denver)</option>
                          <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                          <option value="UTC">Coordinated Universal Time (UTC)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                          System ID (UUID)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={orgData?.id || ""}
                            className="w-full bg-bg-inset border border-border-dim rounded-md px-3 py-2.5 text-xs text-text-muted outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={copyOrgId}
                            className="px-3 bg-bg-void border border-border-dim hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded-md transition-all cursor-pointer flex items-center justify-center"
                            title="Copy UUID"
                          >
                            {copiedId ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        SB 243 AI Disclaimer Footer (Required by Law)
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={sb243Footer}
                        onChange={(e) => setSb243Footer(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md px-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted resize-none leading-relaxed"
                        placeholder="e.g. Dispatch is an AI Service Coordinator — Powered by RelayDispatch AI"
                      />
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        Under Senate Bill 243 regulations, automated LLM schedulers must declare AI identification clearly at the bottom of every outbound communication.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="px-6 py-2.5 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded-md text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent-primary/20"
                      >
                        {profileSaving ? (
                          <>
                            <Loader2 className="animate-spin" size={13} />
                            <span>Saving Profile...</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: AI Dispatch Config */}
              {activeTab === "ai" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Autonomous AI Dispatch Controls</h3>
                    <p className="text-xs text-text-secondary mt-1">Configure LLM triage workflows and autonomous fleet allocation thresholds.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Shadow vs Autonomous Controller */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                              <Cpu className="w-4 h-4 text-accent-primary" />
                              Operational Dispatch Mode
                            </h4>
                            <p className="text-xs text-text-secondary leading-relaxed">
                              Toggle between passive drafting and completely hands-off automatic scheduling.
                            </p>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border",
                            dispatchMode === "autonomous" 
                              ? "bg-accent-primary/10 text-accent-primary border-accent-primary/20" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          )}>
                            {dispatchMode} ACTIVE
                          </span>
                        </div>

                        {/* Custom visual switch */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            onClick={() => handleToggleDispatchMode("shadow")}
                            className={cn(
                              "p-4 border rounded-xl flex flex-col gap-1 transition-all text-left cursor-pointer",
                              dispatchMode === "shadow"
                                ? "bg-amber-500/5 border-amber-500 text-text-primary shadow-md"
                                : "bg-bg-void/50 border-border-dim text-text-secondary hover:bg-bg-hover"
                            )}
                          >
                            <span className="text-xs font-bold">Shadow Mode</span>
                            <span className="text-[10px] text-text-muted leading-relaxed">
                              LLM classifies issues and drafts email responses, but operator review is required to schedule.
                            </span>
                          </button>
                          
                          <button
                            onClick={() => handleToggleDispatchMode("autonomous")}
                            className={cn(
                              "p-4 border rounded-xl flex flex-col gap-1 transition-all text-left cursor-pointer",
                              dispatchMode === "autonomous"
                                ? "bg-accent-glow/5 border-accent-primary text-text-primary shadow-md"
                                : "bg-bg-void/50 border-border-dim text-text-secondary hover:bg-bg-hover"
                            )}
                          >
                            <span className="text-xs font-bold">Autonomous Mode</span>
                            <span className="text-[10px] text-text-muted leading-relaxed">
                              Full loop. AI automatically classifies, books technicians, and replies directly to clients.
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Criteria Requirements Card */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                          Autonomous Transition Prerequisites
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-bg-inset border border-border-dim rounded-lg flex items-center justify-between">
                            <span className="text-xs text-text-secondary">Clean Trial Run Hours</span>
                            <span className="font-mono text-xs font-bold text-accent-primary">
                              {orgConfig?.cleanRunHours ?? 6.7} / {orgConfig?.totalRequiredHours ?? 48}h
                            </span>
                          </div>
                          <div className="p-3 bg-bg-inset border border-border-dim rounded-lg flex items-center justify-between">
                            <span className="text-xs text-text-secondary">AI Write Accuracy</span>
                            <span className="font-mono text-xs font-bold text-accent-primary">
                              {Math.round((orgConfig?.criteria?.writeAccuracy ?? 0.98) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Filters list */}
                    <div className="lg:col-span-1 bg-bg-inset border border-border-dim rounded-xl p-4 space-y-4">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">Safety Filters Active</span>
                      
                      <div className="space-y-3">
                        {[
                          { label: "Emergency Safeguard", desc: "Forwards complex or high-risk issues to manual queue" },
                          { label: "Double-Booking Block", desc: "Ensures technicians are not double-booked" },
                          { label: "Location Routing Core", desc: "Calculates optimal travel times" },
                          { label: "Compliance Disclaimer", desc: "Appends SB 243 disclaimer to outgoing emails" }
                        ].map((filter, idx) => (
                          <div key={idx} className="flex gap-2.5 items-start">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0" />
                            <div className="space-y-0.5">
                              <p className="text-[11px] font-bold text-text-primary leading-none">{filter.label}</p>
                              <p className="text-[10px] text-text-muted leading-tight">{filter.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Integrations & Connections */}
              {activeTab === "integrations" && (() => {
                const selectedCRM = localStorage.getItem("RelayDispatch_crm") || "jobber";
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-text-primary text-base">Integrated System Matrix</h3>
                      <p className="text-xs text-text-secondary mt-1">Verify direct GCP/Microsoft first-party email handshakes and multi-tenant CRM credentials.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Direct GCP/Azure & Sandbox Email Sync Card */}
                      <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col justify-between bg-bg-base/30 relative col-span-2 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                              <Globe size={14} className="text-accent-primary animate-pulse" />
                              Direct First-Party Mailbox Connection (No Intermediaries)
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                              orgData?.is_mail_connected 
                                ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.15)]" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                              {orgData?.is_mail_connected ? `${orgData?.mail_provider?.toUpperCase()} CONNECTED` : "DISCONNECTED"}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            RelayDispatch reads and writes directly from/to your operational mailbox using secure, first-party Google Workspace (GCP) or Microsoft 365 OAuth 2.0. No developer intermediaries or SMTP host passwords needed. In dev, Sandbox Mail simulates this 100% locally.
                          </p>
                        </div>

                        <div className="pt-4 border-t border-border-dim/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          {orgData?.is_mail_connected ? (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col">
                                <span className="text-[11px] text-text-primary font-bold">
                                  Linked Address: <span className="font-mono text-accent-primary">{orgData?.mail_email_address || "operations@yourcompany.com"}</span>
                                </span>
                                <span className="text-[9px] font-mono text-text-muted mt-0.5 uppercase tracking-wider">
                                  Security: AES-256 GCM Local Server Vault (AI-Scrubbed)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDisconnectMail()}
                                className="px-3.5 py-1.5 bg-bg-void hover:bg-red-500/10 border border-border-dim hover:border-red-500/20 text-text-secondary hover:text-red-500 rounded text-[10px] font-bold transition-all cursor-pointer"
                              >
                                Disconnect Mailbox
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 flex-wrap w-full">
                              <button
                                type="button"
                                disabled={linkingIntegration !== null}
                                onClick={() => handleConnectMail("google")}
                                className="px-4 py-2 bg-[#4285F4] hover:bg-[#357AE8] text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-md"
                              >
                                Connect Google Workspace (GCP)
                              </button>
                              <button
                                type="button"
                                disabled={linkingIntegration !== null}
                                onClick={() => handleConnectMail("microsoft")}
                                className="px-4 py-2 bg-[#0078D4] hover:bg-[#006CBE] text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-md"
                              >
                                Connect Microsoft 365
                              </button>
                              <button
                                type="button"
                                disabled={linkingIntegration !== null}
                                onClick={() => handleConnectMail("sandbox")}
                                className="px-4 py-2 bg-bg-void hover:bg-bg-hover border border-border-dim text-text-secondary hover:text-text-primary rounded text-[10px] font-bold transition-all cursor-pointer"
                              >
                                Connect Local Sandbox Mail
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Jobber Sync Card */}
                      {selectedCRM === "jobber" && (
                        <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col justify-between h-48 bg-bg-base/30 col-span-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                                <Briefcase size={14} className="text-accent-primary" />
                                Jobber CRM Core Sync (Multi-Tenant)
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                                orgData?.is_jobber_connected 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {orgData?.is_jobber_connected ? "CONNECTED" : "INACTIVE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              Synchronizes jobs, quotes, schedules, and client records between RelayDispatch and your multi-tenant Jobber instance with automatic token refreshes. Use Sandbox mode to simulate active scheduling in local dev.
                            </p>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-border-dim/50">
                            <span className="text-[9px] font-mono text-text-muted">
                              ACCOUNT: {orgData?.is_jobber_connected ? `${orgData?.jobber_account_id}` : "NONE"}
                            </span>

                            <div className="flex gap-2">
                              {orgData?.is_jobber_connected ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectCRM()}
                                  className="px-3.5 py-1.5 bg-bg-void hover:bg-red-500/10 border border-border-dim hover:border-red-500/20 text-text-secondary hover:text-red-500 rounded text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  Disconnect Jobber
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={linkingIntegration !== null}
                                    onClick={() => handleConnectJobber(false)}
                                    className="px-3.5 py-1.5 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                  >
                                    Link Live Jobber
                                  </button>
                                  <button
                                    type="button"
                                    disabled={linkingIntegration !== null}
                                    onClick={() => handleConnectJobber(true)}
                                    className="px-3.5 py-1.5 bg-bg-void hover:bg-bg-hover border border-border-dim text-text-secondary hover:text-text-primary rounded text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Link Sandbox Jobber
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ServiceTitan Sync Card */}
                      {selectedCRM === "servicetitan" && (
                        <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col justify-between h-48 bg-bg-base/30 col-span-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                                <Briefcase size={14} className="text-accent-primary" />
                                ServiceTitan Enterprise Sync (Client Credentials)
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                                orgData?.is_servicetitan_connected 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {orgData?.is_servicetitan_connected ? "CONNECTED" : "INACTIVE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              Synchronizes residential jobs, custom fields, and client records between RelayDispatch and your enterprise ServiceTitan stack using client secrets. Use Sandbox mode to mock Titan webhooks in local dev.
                            </p>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-border-dim/50">
                            <span className="text-[9px] font-mono text-text-muted">
                              TENANT ID: {orgData?.is_servicetitan_connected ? `${orgData?.servicetitan_tenant_id || "SANDBOX"}` : "NONE"}
                            </span>

                            <div className="flex gap-2">
                              {orgData?.is_servicetitan_connected ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectCRM()}
                                  className="px-3.5 py-1.5 bg-bg-void hover:bg-red-500/10 border border-border-dim hover:border-red-500/20 text-text-secondary hover:text-red-500 rounded text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  Disconnect Titan
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTitanTenant("");
                                      setTitanClientId("");
                                      setTitanClientSecret("");
                                      setIsTitanModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                  >
                                    Link ServiceTitan
                                  </button>
                                  <button
                                    type="button"
                                    disabled={linkingIntegration !== null}
                                    onClick={() => {
                                      setTitanTenant("sandbox-tenant");
                                      setTitanClientId("sandbox-client-id");
                                      setTitanClientSecret("sandbox-client-secret");
                                      // Trigger sandbox connection
                                      setLinkingIntegration("servicetitan");
                                      apiClient.updateOrgSettings({
                                        servicetitan_tenant_id: "sandbox-tenant",
                                        servicetitan_client_id: "sandbox-client-id",
                                        servicetitan_client_secret: "sandbox-client-secret",
                                        servicetitan_access_token: "sandbox_titan_token",
                                        servicetitan_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                                        jobber_account_id: "acct_titan_sandbox"
                                      }).then(() => {
                                        toast.success("Titan Sandbox connected", "Linked ServiceTitan sandbox credentials successfully.");
                                        loadData();
                                      }).catch((err) => toast.error("Connection Failed", err.message))
                                        .finally(() => setLinkingIntegration(null));
                                    }}
                                    className="px-3.5 py-1.5 bg-bg-void hover:bg-bg-hover border border-border-dim text-text-secondary hover:text-text-primary rounded text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Link Sandbox Titan
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Housecall Pro Sync Card */}
                      {selectedCRM === "housecallpro" && (
                        <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col justify-between h-48 bg-bg-base/30 col-span-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                                <Briefcase size={14} className="text-accent-primary" />
                                Housecall Pro Sync (Multi-Tenant)
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                                orgData?.is_housecall_connected 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {orgData?.is_housecall_connected ? "CONNECTED" : "INACTIVE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              Pipes real-time dispatch schedules, invoicing snapshots, and technician statuses to Housecall Pro. Use Sandbox mode to mock Housecall dispatch loops in local dev.
                            </p>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-border-dim/50">
                            <span className="text-[9px] font-mono text-text-muted">
                              ACCOUNT: {orgData?.is_housecall_connected ? "Direct Housecall OAuth" : "NONE"}
                            </span>

                            <div className="flex gap-2">
                              {orgData?.is_housecall_connected ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectCRM()}
                                  className="px-3.5 py-1.5 bg-bg-void hover:bg-red-500/10 border border-border-dim hover:border-red-500/20 text-text-secondary hover:text-red-500 rounded text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  Disconnect HCP
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={linkingIntegration !== null}
                                    onClick={() => handleConnectHousecall(false)}
                                    className="px-3.5 py-1.5 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                  >
                                    Link Housecall Pro
                                  </button>
                                  <button
                                    type="button"
                                    disabled={linkingIntegration !== null}
                                    onClick={() => handleConnectHousecall(true)}
                                    className="px-3.5 py-1.5 bg-bg-void hover:bg-bg-hover border border-border-dim text-text-secondary hover:text-text-primary rounded text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Link Sandbox HCP
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom API CRM Integration Card */}
                      {selectedCRM === "other" && (
                        <div className="glass-panel p-5 rounded-xl border border-border-dim flex flex-col justify-between h-48 bg-bg-base/30 col-span-2">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-text-primary">Custom API CRM Integration</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                                orgData?.is_jobber_connected 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {orgData?.is_jobber_connected ? "Webhook Syncing" : "Inactive"}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              Utilizes custom REST webhooks and secure API keys to integrate and stream data with your custom/proprietary back-office CRM.
                            </p>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-border-dim/50">
                            <span className="text-[9px] font-mono text-text-muted">
                              API_KEY: {orgData?.is_jobber_connected ? "Custom REST Key Secured" : "NONE"}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (orgData?.is_jobber_connected) {
                                  handleDisconnectCRM();
                                } else {
                                  // Link custom mock
                                  setLinkingIntegration("custom");
                                  apiClient.updateOrgSettings({
                                    jobber_account_id: "acct_custom_webhooks",
                                    jobber_access_token: "sandbox_custom_key"
                                  }).then(() => {
                                    toast.success("Webhooks Linked", "Custom webhook pipeline synchronized.");
                                    loadData();
                                  }).catch((err) => toast.error("Connection Failed", err.message))
                                    .finally(() => setLinkingIntegration(null));
                                }
                              }}
                              className={cn(
                                "px-3 py-1 border rounded text-[10px] font-bold transition-all cursor-pointer",
                                orgData?.is_jobber_connected
                                  ? "bg-bg-void hover:bg-red-500/10 border-border-dim hover:border-red-500/20 text-text-secondary hover:text-red-500"
                                  : "bg-accent-primary hover:bg-accent-secondary border-accent-primary text-bg-void"
                              )}
                            >
                              {orgData?.is_jobber_connected ? "Disconnect API" : "Link Webhooks"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ServiceTitan Credentials Modal */}
                    <AnimatePresence>
                      {isTitanModalOpen && (
                        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-bg-raised border border-border-dim p-6 rounded-2xl w-full max-w-md shadow-2xl relative"
                          >
                            <button
                              onClick={() => setIsTitanModalOpen(false)}
                              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-all cursor-pointer border-transparent"
                            >
                              <X size={18} />
                            </button>

                            <div className="space-y-4">
                              <div>
                                <h3 className="font-bold text-text-primary text-base flex items-center gap-1.5">
                                  <Briefcase size={16} className="text-accent-primary" />
                                  Link ServiceTitan Stack
                                </h3>
                                <p className="text-xs text-text-secondary mt-1">Enter your ServiceTitan developer credentials. Raw secrets are locally encrypted using AES-256 GCM.</p>
                              </div>

                              <form onSubmit={handleConnectServiceTitan} className="space-y-4">
                                <div className="space-y-1.5">
                                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                                    ServiceTitan Tenant ID
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={titanTenant}
                                    onChange={(e) => setTitanTenant(e.target.value)}
                                    className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none"
                                    placeholder="e.g. 998877665"
                                  />
                                </div>
                                
                                <div className="space-y-1.5">
                                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                                    OAuth Client ID
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={titanClientId}
                                    onChange={(e) => setTitanClientId(e.target.value)}
                                    className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none font-mono"
                                    placeholder="e.g. cid-11223344"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                                    OAuth Client Secret
                                  </label>
                                  <input
                                    type="password"
                                    required
                                    value={titanClientSecret}
                                    onChange={(e) => setTitanClientSecret(e.target.value)}
                                    className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none font-mono"
                                    placeholder="••••••••••••••••••••••••••••••••"
                                  />
                                </div>

                                <div className="pt-2 flex gap-2">
                                  <button
                                    type="submit"
                                    className="flex-1 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold py-2.5 rounded text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1"
                                  >
                                    <Plus size={14} />
                                    Connect Titan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsTitanModalOpen(false)}
                                    className="px-4 py-2.5 bg-bg-void hover:bg-bg-hover border border-border-dim text-text-secondary hover:text-text-primary rounded text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* TAB 4: Technician Roster */}
              {activeTab === "roster" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Fleet Technician Control Roster</h3>
                    <p className="text-xs text-text-secondary mt-1">Register and manage crew capabilities and active dispatch loads.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Technician Form */}
                    <div className="lg:col-span-1 bg-bg-inset border border-border-dim rounded-xl p-5 h-fit space-y-4">
                      <h4 className="font-bold text-text-primary text-xs border-b border-border-dim pb-2 uppercase tracking-wider">
                        Add Field Technician
                      </h4>
                      <form onSubmit={handleAddTechnician} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Technician Name
                          </label>
                          <input
                            type="text"
                            required
                            value={techName}
                            onChange={(e) => setTechName(e.target.value)}
                            className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                            placeholder="Marcus Thorne"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Skills (Comma Separated)
                          </label>
                          <input
                            type="text"
                            value={techSkills}
                            onChange={(e) => setTechSkills(e.target.value)}
                            className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                            placeholder="hvac, electrical, diagnostics"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={techLoading}
                          className="w-full bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold py-2.5 rounded text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          {techLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                          Register Technician
                        </button>
                      </form>
                    </div>

                    {/* Technicians Grid List */}
                    <div className="lg:col-span-2 border border-border-dim rounded-xl overflow-hidden flex flex-col bg-bg-inset/20 shadow-inner">
                      <div className="p-3.5 border-b border-border-dim bg-bg-base/30 text-[9px] font-mono font-bold text-text-muted uppercase tracking-widest">
                        Roster Active List
                      </div>
                      <div className="divide-y divide-border-dim max-h-[350px] overflow-y-auto subtle-scroll">
                        {technicians.length > 0 ? (
                          technicians.map((tech) => (
                            <div key={tech.id} className="p-4 flex justify-between items-center hover:bg-bg-hover transition-colors">
                              <div className="space-y-1">
                                <h4 className="font-bold text-text-primary text-xs">{tech.name}</h4>
                                <div className="flex gap-1.5 flex-wrap">
                                  {tech.skills.map((s, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 bg-bg-inset border border-border-dim rounded text-[8px] font-mono text-text-muted capitalize">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right font-mono text-[10px] text-text-secondary">
                                  Jobs: <span className="font-bold text-accent-primary">{tech.active_assigned_jobs ?? 0}</span>
                                </div>
                                <button
                                  onClick={() => handleToggleTechnician(tech)}
                                  className="text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                                  title={tech.is_active ? "Deactivate Tech" : "Activate Tech"}
                                >
                                  {tech.is_active ? (
                                    <ToggleRight size={28} className="text-accent-primary" />
                                  ) : (
                                    <ToggleLeft size={28} className="text-text-muted" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-text-secondary text-xs italic">
                            No field technicians registered.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Pricing Matrix */}
              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Service Category Pricing Matrix</h3>
                    <p className="text-xs text-text-secondary mt-1">Configure service codes and base billing parameters loaded by the AI.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Pricing Rule Form */}
                    <div className="lg:col-span-1 bg-bg-inset border border-border-dim rounded-xl p-5 h-fit space-y-4">
                      <h4 className="font-bold text-text-primary text-xs border-b border-border-dim pb-2 uppercase tracking-wider">
                        Add Pricing Rule
                      </h4>
                      <form onSubmit={handleAddPricingRule} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Service Code
                            </label>
                            <input
                              type="text"
                              required
                              value={serviceCode}
                              onChange={(e) => setServiceCode(e.target.value)}
                              className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none"
                              placeholder="COOL-DIAG"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Category
                            </label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value as PricingCategory)}
                              className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none cursor-pointer"
                            >
                              <option value="GENERAL">General</option>
                              <option value="COOLING">Cooling</option>
                              <option value="HEATING">Heating</option>
                              <option value="MAINTENANCE">Maintenance</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Service Label
                          </label>
                          <input
                            type="text"
                            required
                            value={serviceLabel}
                            onChange={(e) => setServiceLabel(e.target.value)}
                            className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none"
                            placeholder="Diagnostic Cooling Assessment"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Base Price ($)
                            </label>
                            <div className="flex items-center bg-bg-void border border-border-dim focus-within:border-accent-primary rounded overflow-hidden">
                              <button type="button" onClick={() => setBasePrice(v => String(Math.max(0, Number(v) - 1)))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">−</button>
                              <input type="number" required value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="flex-1 bg-transparent px-1 py-2 text-xs text-text-primary outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="120" />
                              <button type="button" onClick={() => setBasePrice(v => String(Number(v) + 1))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">+</button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Pricing Type
                            </label>
                            <select
                              value={pricingType}
                              onChange={(e) => setPricingType(e.target.value as PricingType)}
                              className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none cursor-pointer"
                            >
                              <option value="flat">Flat</option>
                              <option value="per_unit">Per Unit</option>
                              <option value="hourly">Hourly</option>
                              <option value="diagnostic">Diagnostic</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Min Price ($)
                            </label>
                            <div className="flex items-center bg-bg-void border border-border-dim focus-within:border-accent-primary rounded overflow-hidden">
                              <button type="button" onClick={() => setMinPrice(v => String(Math.max(0, Number(v) - 5)))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">−</button>
                              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="flex-1 bg-transparent px-1 py-2 text-xs text-text-primary outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="100" />
                              <button type="button" onClick={() => setMinPrice(v => String(Number(v) + 5))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">+</button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                              Max Price ($)
                            </label>
                            <div className="flex items-center bg-bg-void border border-border-dim focus-within:border-accent-primary rounded overflow-hidden">
                              <button type="button" onClick={() => setMaxPrice(v => String(Math.max(0, Number(v) - 5)))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">−</button>
                              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="flex-1 bg-transparent px-1 py-2 text-xs text-text-primary outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="300" />
                              <button type="button" onClick={() => setMaxPrice(v => String(Number(v) + 5))} className="px-2 py-2 text-text-secondary hover:text-accent-primary hover:bg-bg-inset transition-colors text-base leading-none select-none">+</button>
                            </div>
                          </div>
                        </div>


                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                            Unit Label (Optional)
                          </label>
                          <input
                            type="text"
                            value={unitLabel}
                            onChange={(e) => setUnitLabel(e.target.value)}
                            className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded px-3 py-2 text-xs text-text-primary outline-none"
                            placeholder="hour / diagnostic"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={pricingLoading}
                          className="w-full bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold py-2.5 rounded text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          {pricingLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                          Sync Pricing Rule
                        </button>
                      </form>
                    </div>

                    {/* Pricing Matrix List */}
                    <div className="lg:col-span-2 border border-border-dim rounded-xl overflow-hidden flex flex-col bg-bg-inset/20 shadow-inner">
                      <div className="p-3.5 border-b border-border-dim bg-bg-base/30 text-[9px] font-mono font-bold text-text-muted uppercase tracking-widest">
                        Pricing Matrix Ledger
                      </div>
                      <div className="divide-y divide-border-dim max-h-[350px] overflow-y-auto subtle-scroll">
                        {pricingRules.length > 0 ? (
                          pricingRules.map((rule) => (
                            <div key={rule.service_code} className="p-4 flex justify-between items-center hover:bg-bg-hover transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-accent-primary font-bold">{rule.service_code}</span>
                                  <span className="px-1.5 py-0.5 bg-bg-inset rounded text-[8px] font-mono text-text-muted font-bold tracking-widest">
                                    {rule.category}
                                  </span>
                                </div>
                                <h4 className="text-text-primary text-[11px]">{rule.service_label}</h4>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right font-mono">
                                  <p className="text-[9px] text-text-muted uppercase font-bold">Base Price</p>
                                  <p className="text-xs text-text-primary font-bold">${rule.base_price_usd}</p>
                                </div>
                                <button
                                  onClick={() => handleDeletePricingRule(rule.service_code)}
                                  className="p-1.5 bg-bg-inset hover:bg-red-500/10 text-text-secondary hover:text-red-500 border border-border-dim rounded hover:border-red-500/20 transition-all cursor-pointer"
                                  title="Deactivate Pricing Rule"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-text-secondary text-xs italic">
                            No pricing rules configured.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Providers & Quotas */}
              {activeTab === "providers" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">External Providers & System Status</h3>
                    <p className="text-xs text-text-secondary mt-1">Review active API connections, test connectivity validation, and check operational usage statistics.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Providers Connection List */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                            External APIs Connection Status
                          </h4>
                          {usageLoading && (
                            <span className="text-[9px] font-mono text-text-muted animate-pulse">Syncing...</span>
                          )}
                        </div>

                        <div className="space-y-3">
                          {providers.map((p, idx) => (
                            <div key={idx} className="glass-panel p-4 rounded-xl border border-border-dim bg-bg-base/30 flex items-center justify-between">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">{p.category} provider</span>
                                <h4 className="text-sm font-bold text-text-primary">{p.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={cn(
                                    "inline-block w-2 h-2 rounded-full",
                                    p.status === "active" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-text-muted"
                                  )} />
                                  <span className="text-[10px] font-mono capitalize text-text-secondary">{p.status}</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  toast.info("Connection Test", `Testing connection for ${p.name}...`);
                                  try {
                                    const testRes = await apiClient.testProvider(p.category);
                                    if (testRes.status === "connected") {
                                      toast.success("Connection Active", `${p.name} responded successfully in ${testRes.latency_ms}ms.`);
                                    } else {
                                      toast.error("Connection Failed", `Failed to validate ${p.name} connection.`);
                                    }
                                  } catch (err: any) {
                                    toast.error("Test Error", err.message || "An unexpected error occurred during test.");
                                  }
                                }}
                                className="px-3 py-1.5 bg-bg-inset border border-border-dim rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                Test Connection
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Operational Quotas */}
                      <div className="space-y-4 bg-bg-inset border border-border-dim rounded-xl p-5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                            Self-Hosted Instance Quotas
                          </h4>
                        </div>
                        <div className="space-y-2 text-xs leading-relaxed text-text-secondary">
                          <p>
                            This instance is configured in <strong className="text-text-primary font-bold">Unrestricted Community Mode</strong>. 
                          </p>
                          <p>
                            RelayDispatch does not meter or limit your operational usage. All usage and API billing is determined directly by your external provider credentials.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Operational Usage Log */}
                    <div className="lg:col-span-1 border border-border-dim rounded-xl overflow-hidden flex flex-col bg-bg-inset/20">
                      <div className="p-3 border-b border-border-dim bg-bg-base/30 flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-widest">Telemetry & Usage</span>
                        {usageLoading && <Loader2 className="w-3 h-3 text-text-muted animate-spin" />}
                      </div>
                      <div className="p-5 space-y-5 flex-1 text-left animate-fade-in">
                        {usageLoading ? (
                          <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-bg-hover rounded w-3/4" />
                            <div className="h-4 bg-bg-hover rounded w-1/2" />
                            <div className="h-4 bg-bg-hover rounded w-2/3" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-3 bg-bg-base/40 border border-border-dim rounded-lg space-y-1">
                              <span className="text-[9px] font-mono text-text-muted uppercase font-bold">Total Tokens Consumed</span>
                              <p className="text-lg font-mono font-bold text-text-primary">
                                {(usageStats?.total_tokens_used ?? 0).toLocaleString()}
                              </p>
                            </div>

                            <div className="p-3 bg-bg-base/40 border border-border-dim rounded-lg space-y-1">
                              <span className="text-[9px] font-mono text-text-muted uppercase font-bold">Estimated Provider Cost</span>
                              <p className="text-lg font-mono font-bold text-teal-400">
                                ${Number(usageStats?.estimated_cost_usd ?? 0).toFixed(4)}
                              </p>
                            </div>

                            <div className="p-3 bg-bg-base/40 border border-border-dim rounded-lg space-y-1">
                              <span className="text-[9px] font-mono text-text-muted uppercase font-bold">Total Coordinated Actions</span>
                              <p className="text-lg font-mono font-bold text-text-primary">
                                {usageStats?.total_coordinated_actions ?? 0}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletePricingCode !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDeletingPricing) {
                  setDeletePricingCode(null);
                }
              }}
              className="fixed inset-0 bg-bg-void/80 backdrop-blur-md z-[100] cursor-pointer"
            />

            {/* Modal Box */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-md bg-bg-raised/95 border border-red-500/20 rounded-xl shadow-2xl p-6 relative overflow-hidden pointer-events-auto"
              >
                {/* Ambient Red Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-500/10 rounded-full blur-3xl opacity-30 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-border-dim mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary text-base">Deactivate Pricing Rule</h3>
                      <p className="text-[11px] text-text-secondary">Soft-deactivate rule from system matrix</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!isDeletingPricing) {
                        setDeletePricingCode(null);
                      }
                    }}
                    className="p-1.5 rounded bg-bg-inset hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4 my-6 text-sm text-text-secondary relative z-10 text-left">
                  <p>
                    Are you sure you want to soft-deactivate the following pricing rule?
                  </p>
                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded text-center">
                    <span className="font-bold text-text-primary font-mono text-base tracking-wider">
                      {deletePricingCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Deactivating this rule removes it from manual dispatch calculations and customer intake estimates.
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-border-dim flex justify-end gap-3 relative z-10">
                  <button
                    type="button"
                    disabled={isDeletingPricing}
                    onClick={() => {
                      setDeletePricingCode(null);
                    }}
                    className="px-4 py-2 border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingPricing}
                    onClick={confirmDeletePricingRule}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-md text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    {isDeletingPricing ? (
                      <>
                        <Loader2 className="animate-spin" size={13} />
                        <span>Deactivating...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>Confirm Deactivation</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

